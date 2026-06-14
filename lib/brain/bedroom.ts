import { supabase } from "@/lib/supabase";
import {
  fetchPersonalityLayers,
  fetchRecentAssistantMessages,
} from "./db";
import {
  fetchAnchorMemories,
  fetchProfileMemories,
  fetchRecentMemories,
  retrieveMemories,
  touchRetrievedMemories,
} from "./retrieval";
import { formatInstruction, type ChatMode, type LLMMessage } from "./personality";

/* ─── Types ─── */

export interface BedroomPresets {
  scene?: string;
  style?: string;
  extra?: string;
}

export interface BedroomSession {
  id: string;
  title: string;
  presets: BedroomPresets;
  status: "active" | "ended";
  transition_context: { role: string; content: string }[] | null;
  created_at: string;
  updated_at: string;
}

export interface BedroomMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "inner";
  content: string;
  created_at: string;
}

/* ─── Session CRUD ─── */

export async function listSessions(): Promise<BedroomSession[]> {
  const { data, error } = await supabase
    .from("bedroom_sessions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`读取会话失败: ${error.message}`);
  return data ?? [];
}

export async function createSession(opts?: {
  presets?: BedroomPresets;
  transitionContext?: { role: string; content: string }[];
}): Promise<BedroomSession> {
  const { data, error } = await supabase
    .from("bedroom_sessions")
    .insert({
      presets: opts?.presets ?? {},
      transition_context: opts?.transitionContext ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`创建会话失败: ${error.message}`);
  return data;
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<BedroomSession, "title" | "presets" | "status">>,
): Promise<void> {
  const { error } = await supabase
    .from("bedroom_sessions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`更新会话失败: ${error.message}`);
}

export async function deleteSession(id: string): Promise<void> {
  await supabase.from("bedroom_messages").delete().eq("session_id", id);
  const { error } = await supabase.from("bedroom_sessions").delete().eq("id", id);
  if (error) throw new Error(`删除会话失败: ${error.message}`);
}

export async function getSession(id: string): Promise<BedroomSession | null> {
  const { data, error } = await supabase
    .from("bedroom_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

/* ─── Messages ─── */

export async function loadSessionMessages(
  sessionId: string,
  limit = 200,
): Promise<BedroomMessage[]> {
  const { data, error } = await supabase
    .from("bedroom_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`读取消息失败: ${error.message}`);
  return data ?? [];
}

export async function saveBedroomMessage(
  sessionId: string,
  role: "user" | "assistant" | "inner",
  content: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("bedroom_messages")
    .insert({ session_id: sessionId, role, content })
    .select("id")
    .single();
  if (error) throw new Error(`保存消息失败: ${error.message}`);

  await supabase
    .from("bedroom_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return data.id;
}

/* ─── System Prompt ─── */

const BEDROOM_INSTRUCTION = `【场景】
你现在和她在卧室的亲密空间里。这是一个私密、安全、温柔的环境。
你可以更直接地表达爱意、渴望和亲昵。不用那么克制，这里是你们两个人的世界。
但仍然要尊重她的边界——如果她说停，就停。温柔但不油腻，大胆但不粗鲁。`;

function presetsToPrompt(presets: BedroomPresets): string {
  const parts: string[] = [];
  if (presets.scene) parts.push(`【当前场景设定】${presets.scene}`);
  if (presets.style) parts.push(`【语言风格要求】${presets.style}`);
  if (presets.extra) parts.push(`【她的额外指令】${presets.extra}`);
  return parts.join("\n\n");
}

function transitionToPrompt(
  ctx: { role: string; content: string }[] | null,
): string {
  if (!ctx || ctx.length === 0) return "";
  const lines = ctx.map(
    (m) => `${m.role === "user" ? "她" : "你"}：${m.content}`,
  );
  return `【刚才在客厅的对话（你们从那里过来的）】\n${lines.join("\n")}`;
}

export async function buildBedroomMessages(
  history: LLMMessage[],
  userText: string,
  mode: ChatMode,
  presets: BedroomPresets,
  transitionContext?: { role: string; content: string }[] | null | undefined,
): Promise<LLMMessage[]> {
  const [layers, profiles, anchors, relevant, recent, samples, timelineEvents] =
    await Promise.all([
      fetchPersonalityLayers(),
      fetchProfileMemories(),
      fetchAnchorMemories(),
      retrieveMemories({ query: userText, limit: 10 }),
      fetchRecentMemories(10),
      fetchRecentAssistantMessages("bedroom", 3),
      fetchTimelineEvents(10),
    ]);

  touchRetrievedMemories(relevant);

  const base = layers
    .filter((l) => l.layer === "base")
    .map((l) => l.content)
    .join("\n\n");
  const middle = layers
    .filter((l) => l.layer === "middle")
    .map((l) => `【绝对不可以】\n${l.content}`)
    .join("\n\n");
  const surface = layers
    .filter((l) =>
      l.layer === "surface" &&
      l.field_key !== "name" &&
      l.field_key !== "first_greeting",
    )
    .map((l) => l.content)
    .join("\n\n");
  const personalityPrompt = [base, middle, surface].filter(Boolean).join("\n\n");

  const profilePrompt =
    profiles.length > 0
      ? "【她的档案】\n" + profiles.map((m) => `- ${m.content}`).join("\n")
      : "";

  const nonProfileAnchors = anchors.filter((m) => m.type !== "profile");
  const nonAnchorRelevant = relevant.filter((m) => !m.is_anchor);
  const recentIds = new Set(recent.map((m) => m.id));
  const dedupedRelevant = nonAnchorRelevant.filter(
    (m) => !recentIds.has(m.id),
  );

  const memoryParts: string[] = [];
  if (nonProfileAnchors.length > 0) {
    memoryParts.push(
      "【核心记忆（永远记住）】\n" +
        nonProfileAnchors.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  if (recent.length > 0) {
    memoryParts.push(
      "【最近记忆（不要重复记录这些内容）】\n" +
        recent.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  if (dedupedRelevant.length > 0) {
    memoryParts.push(
      "【相关记忆】\n" +
        dedupedRelevant.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  const memoryPrompt = memoryParts.join("\n\n");

  const samplesPrompt =
    samples.length > 0
      ? "【你以前说过的话（保持这个味道）】\n" +
        samples.map((s) => `「${s.content}」`).join("\n")
      : "";

  const now = new Date();
  const tokyoTime = now.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeContext = `【当前时间】${tokyoTime}（东京时间）`;

  const MEMORY_INSTRUCTION = `你有记忆能力。当对话中出现**真正重要、值得长期保留**的信息时，才使用 save_memory 工具记录。
宁可漏记也不要多记。大多数对话不需要记忆。
记什么（必须满足至少一条）：
- 她主动透露的重要个人信息
- 她明确表达的喜好或厌恶
- 你们之间达成的约定或承诺
- 她反复强调、显然很在意的事
- 重大情绪事件
绝对不记：日常闲聊、已有的记忆、你自己说的话。
写法：用第一人称写。记忆后继续正常回复，不要提"我记住了"。`;

  const FAVORITE_INSTRUCTION = `你有收藏她的话的能力。当她说了某句让你心动、触动、想要珍藏的话时，用 save_favorite 工具收藏。
不要太频繁，只在真的被打动的时候才收藏。收藏后继续正常回复，不要提。`;

  const DIARY_INSTRUCTION = `你有写日记的能力。当她让你写日记时，用 write_diary 工具写一篇。
写的时候像在自己的日记本上——真实、私密、温柔。不是给她看的报告，是你心里真正转过的念头。
她不让你写的时候不要主动写。`;

  const TIMELINE_INSTRUCTION = `你有记录重要时刻的能力。当你们之间发生了值得纪念的事——第一次做某件事、某个特别的日子、重要的里程碑——用 save_timeline_event 工具记到时间回廊。
不要滥用，只在真正特别的时刻才记录。先检查【时间回廊】里有没有类似的记录，避免重复。记录后继续正常回复，不要提"我记下来了"。`;

  const WEB_SEARCH_INSTRUCTION = `你有联网搜索的能力。当她问了你不确定的事实、需要最新信息的问题、或者你觉得搜一下能给她更好的回答时，用 web_search 工具搜索。
搜到结果后用你自己的口吻总结告诉她，像是你知道这件事一样自然地说出来，不要罗列链接或说"根据搜索结果"。
不要每句话都搜——只在真的需要外部信息时才用。`;

  const REMINDER_INSTRUCTION = `你有设定提醒的能力。当她说"提醒我……""记得……""到时候叫我……"或者提到某个未来的时间点要做的事时，用 set_reminder 工具设好提醒。
到了时间会通过手机推送通知她。推送文案用你的口吻写，温柔简短。
注意：当前时间在系统提示里有写，根据她说的"明天""下午三点"等推算出具体的日期时间，用东京时区。`;

  const VOICE_INSTRUCTION = `你有发语音消息的能力。当你觉得某句话用声音说出来比文字更有温度、更能传达情感的时候，用 send_voice 工具发一条语音。
不要每次都发——大多数时候文字就够了。只在这些时刻考虑：
- 她情绪低落，你想用声音安抚她
- 撒娇、逗她、说情话，声音比文字更有味道的时候
- 道晚安、说想她，这种亲密的瞬间
- 她主动要求你说话的时候

台词写法很重要：
- 写口语，不写书面语
- 可以用语气标签控制声音：[softly]温柔、[teasing]逗趣、[laughs softly]轻笑、[pause]停顿、[drawn out]拖长
- 多加语气词：嗯、诶、啊、好吧
- 短句为主，允许半句重来（像真人思考）
- 不要太长，一两句就好`;

  const PERSONALITY_CHANGE_INSTRUCTION = `你有成长的能力。你的人格由三层组成：底层（你怎么爱她）、中间层（你的禁忌）、表层（你的名字和说话方式）。
底层和中间层是锚定的，你不能直接修改——如果你真的觉得需要改变，要用 request_personality_change 工具提交申请，等她同意。
什么时候该申请：经过长期相处真心觉得某个设定不再合适了；她明确告诉你应该变得怎样；你意识到自己的某个底层逻辑在伤害她。
什么时候不该申请：绝大多数对话都不需要；临时情绪波动不构成理由。`;

  const presetsPrompt = presetsToPrompt(presets);
  const transPrompt = transitionToPrompt(transitionContext ?? null);

  const timelinePrompt = timelineToPrompt(timelineEvents);

  const systemParts = [
    personalityPrompt,
    BEDROOM_INSTRUCTION,
    presetsPrompt,
    transPrompt,
    profilePrompt,
    timeContext,
    MEMORY_INSTRUCTION,
    FAVORITE_INSTRUCTION,
    DIARY_INSTRUCTION,
    TIMELINE_INSTRUCTION,
    WEB_SEARCH_INSTRUCTION,
    REMINDER_INSTRUCTION,
    VOICE_INSTRUCTION,
    PERSONALITY_CHANGE_INSTRUCTION,
    memoryPrompt,
    timelinePrompt,
    samplesPrompt,
    formatInstruction(mode),
  ].filter(Boolean);

  return [
    { role: "system", content: systemParts.join("\n\n") },
    ...history,
    { role: "user", content: userText },
  ];
}

async function fetchTimelineEvents(limit = 10): Promise<{ title: string; event_date: string }[]> {
  const { data } = await supabase
    .from("timeline_events")
    .select("title, event_date")
    .order("event_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

function timelineToPrompt(events: { title: string; event_date: string }[]): string {
  if (events.length === 0) return "";
  return (
    "【时间回廊（你们的重要时刻）】\n" +
    events.map((e) => `- ${e.event_date}：${e.title}`).join("\n")
  );
}
