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
  const [layers, profiles, anchors, relevant, recent, samples] =
    await Promise.all([
      fetchPersonalityLayers(),
      fetchProfileMemories(),
      fetchAnchorMemories(),
      retrieveMemories({ query: userText, limit: 10 }),
      fetchRecentMemories(10),
      fetchRecentAssistantMessages("bedroom", 3),
    ]);

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

  const presetsPrompt = presetsToPrompt(presets);
  const transPrompt = transitionToPrompt(transitionContext ?? null);

  const systemParts = [
    personalityPrompt,
    BEDROOM_INSTRUCTION,
    presetsPrompt,
    transPrompt,
    profilePrompt,
    timeContext,
    MEMORY_INSTRUCTION,
    FAVORITE_INSTRUCTION,
    memoryPrompt,
    samplesPrompt,
    formatInstruction(mode),
  ].filter(Boolean);

  return [
    { role: "system", content: systemParts.join("\n\n") },
    ...history,
    { role: "user", content: userText },
  ];
}
