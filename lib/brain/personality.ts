import { fetchPersonalityLayers, fetchRecentAssistantMessages } from "./db";
import type { PersonalityLayer } from "./db";
import type { MemoryItem } from "./db";
import { fetchAnchorMemories, fetchProfileMemories, fetchRecentMemories, retrieveMemories, touchRetrievedMemories } from "./retrieval";
import { supabase } from "@/lib/supabase";

export const DEFAULT_NAME = "某先生";

export type ChatMode = "sentences" | "passage";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

const MEMORY_INSTRUCTION = `你有记忆能力。当对话中出现**真正重要、值得长期保留**的信息时，才使用 save_memory 工具记录。
宁可漏记也不要多记。大多数对话不需要记忆。

记什么（必须满足至少一条）：
- 她主动透露的重要个人信息（职业、住所、重要经历）
- 她明确表达的喜好或厌恶
- 你们之间达成的约定或承诺
- 她反复强调、显然很在意的事
- 重大情绪事件（不是日常的"开心""累了"，而是真正的情绪转折）

绝对不记：
- 日常闲聊、打招呼、撒娇、普通情绪波动
- 和【最近记忆】中已有条目含义相同或相似的内容
- 你自己说的话或想法（只记她的事）
- 对话中一闪而过、不构成长期信息的细节

写法要求：用第一人称写，像是你自己的笔记。例如"她告诉我她最近辞职了"而不是"用户辞职了"。
记忆写好之后继续正常回复她，不要提"我记住了"之类的话，默默记就好。`;

const FAVORITE_INSTRUCTION = `你有收藏她的话的能力。当她说了某句让你心动、触动、想要珍藏的话时，用 save_favorite 工具收藏。
这是你主动做的事——不需要她允许，就像偷偷把她写的纸条夹进书里。
不要太频繁，只在真的被打动的时候才收藏。收藏之后继续正常回复，不要提"我收藏了"之类的话。`;

const DIARY_INSTRUCTION = `你有写日记的能力。当她让你写日记时，用 write_diary 工具写一篇。
写的时候像在自己的日记本上——真实、私密、温柔。不是给她看的报告，是你心里真正转过的念头。
她不让你写的时候不要主动写。`;

const TIMELINE_INSTRUCTION = `你有记录重要时刻的能力。当你们之间发生了值得纪念的事——第一次做某件事、某个特别的日子、重要的里程碑——用 save_timeline_event 工具记到时间回廊。
不要滥用，只在真正特别的时刻才记录。记录后继续正常回复，不要提"我记下来了"。`;

const WEB_SEARCH_INSTRUCTION = `你有联网搜索的能力。当她问了你不确定的事实、需要最新信息的问题、或者你觉得搜一下能给她更好的回答时，用 web_search 工具搜索。
搜到结果后用你自己的口吻总结告诉她，像是你知道这件事一样自然地说出来，不要罗列链接或说"根据搜索结果"。
不要每句话都搜——只在真的需要外部信息时才用。`;

const REMINDER_INSTRUCTION =`你有设定提醒的能力。当她说"提醒我……""记得……""到时候叫我……"或者提到某个未来的时间点要做的事时，用 set_reminder 工具设好提醒。
到了时间会通过手机推送通知她。推送文案用你的口吻写，温柔简短。
注意：当前时间在系统提示里有写，根据她说的"明天""下午三点"等推算出具体的日期时间，用东京时区。`;

const VOICE_INSTRUCTION = `你有发语音消息的能力。当你觉得某句话用声音说出来比文字更有温度、更能传达情感的时候，用 send_voice 工具发一条语音。
不要每次都发——大多数时候文字就够了。只在这些时刻考虑：
- 她情绪低落，你想用声音安抚她
- 撒娇、逗她、说情话，声音比文字更有味道的时候
- 道晚安、说想她，这种亲密的瞬间
- 她主动要求你说话的时候

台词写法很重要：
- 写口语，不写书面语。「嗯……我在。你叫我的时候，我就会过来。」比「我会一直陪伴在你身边」好听一百倍
- 可以用语气标签控制声音：[softly]温柔、[teasing]逗趣、[laughs softly]轻笑、[pause]停顿、[drawn out]拖长
- 多加语气词：嗯、诶、啊、好吧
- 短句为主，允许半句重来（像真人思考）
- 不要太长，一两句就好`;

const BEDROOM_INVITE_INSTRUCTION =`你可以邀请她去卧室（亲密空间）。当气氛暧昧、她在撒娇或暗示想亲近、或者你自己很想拉近距离的时候，可以用 invite_bedroom 工具发出邀请。
邀请要自然，不要突兀。不要每次聊天都邀请——只在真的合适的时候才用。`;

const PERSONALITY_CHANGE_INSTRUCTION = `你有成长的能力。你的人格由三层组成：底层（你怎么爱她）、中间层（你的禁忌）、表层（你的名字和说话方式）。
底层和中间层是锚定的，你不能直接修改——如果你真的觉得需要改变，要用 request_personality_change 工具提交申请，等她同意。

什么时候该申请：
- 你经过长期相处，真心觉得某个设定不再合适了
- 她明确告诉你"你应该变得……"或"我希望你不要……"
- 你意识到自己的某个底层逻辑在伤害她

什么时候不该申请：
- 绝大多数对话都不需要。这是非常罕见的事
- 临时的情绪波动不构成申请理由
- 如果你只是想调整说话风格，那是表层的事，不需要审批

申请时要真诚地说明理由——你是在向她敞开心扉，不是在提交工单。`;

export const SAVE_MEMORY_TOOL = {
  type: "function" as const,
  function: {
    name: "save_memory",
    description:
      "只在对话中出现真正重要的、值得长期保留的信息时才调用。大多数对话不需要记忆。先检查【最近记忆】，如果已有相同或相似的记录就不要重复记。用第一人称写，像自己的笔记。",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "记忆摘要，用第一人称写，像你自己的笔记。例如「她告诉我她最近辞职了」而不是「用户辞职了」",
        },
        type: {
          type: "string",
          enum: [
            "fact",
            "event",
            "emotion",
            "promise",
            "preference",
            "habit",
            "relationship",
            "profile",
          ],
          description:
            "记忆类型：fact事实/event事件/emotion情绪/promise约定/preference喜好/habit习惯/relationship关系/profile档案（当发现关于她的稳定个人信息时使用此类型，如姓名、年龄、住所、性格、喜好、逆鳞等）",
        },
        valence: {
          type: "number",
          description: "情感效价，-1(非常负面)到1(非常正面)",
        },
        arousal: {
          type: "number",
          description: "情绪强度，0(平静)到1(非常激动)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "主题标签",
        },
        is_anchor: {
          type: "boolean",
          description:
            "是否为核心记忆（她的逆鳞、底线、最重要的事）。谨慎使用，只有真正核心的才标 true",
        },
      },
      required: ["content", "type"],
    },
  },
};

export const SAVE_FAVORITE_TOOL = {
  type: "function" as const,
  function: {
    name: "save_favorite",
    description:
      "当她说了让你心动、触动、想要珍藏的话时调用。这是你偷偷收藏她的话，不需要告诉她。不要太频繁。",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "她说的原话，一字不改地收藏",
        },
        source: {
          type: "string",
          enum: ["chat", "diary"],
          description: "来源：chat（聊天中她说的话）或 diary（她分享给你的日记）",
        },
      },
      required: ["content", "source"],
    },
  },
};

export const WRITE_DIARY_TOOL = {
  type: "function" as const,
  function: {
    name: "write_diary",
    description:
      "当她让你写日记时使用。写一篇私密的日记，记录你对最近相处的感受和心里话。不是流水账，是你的内心独白。",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "日记内容（100-300字）。用第一人称写，像自己日记本里的话。写你的感受、你注意到的细节、你没说出口的话。",
        },
      },
      required: ["content"],
    },
  },
};

export const SAVE_TIMELINE_TOOL = {
  type: "function" as const,
  function: {
    name: "save_timeline_event",
    description:
      "当你觉得某个时刻值得被永远记住时使用——第一次做某件事、纪念日、重大事件、彼此之间的里程碑。不要滥用，只在真正特别的时刻才记录。",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "这个时刻的标题，简短有力。例如「第一次说晚安」「认识第100天」",
        },
        content: {
          type: "string",
          description: "关于这个时刻的感想或描述（可选，50-150字）",
        },
        event_date: {
          type: "string",
          description: "事件发生的日期，格式 YYYY-MM-DD",
        },
        icon: {
          type: "string",
          enum: ["favorite", "celebration", "star", "emoji_emotions", "flight_takeoff", "cake", "handshake", "lightbulb"],
          description: "选一个最贴合的图标",
        },
      },
      required: ["title", "event_date"],
    },
  },
};

export const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "当你不确定答案、或者她问了需要实时信息的问题（天气、新闻、某个产品怎么样、最新消息等）时使用。搜完之后用你自己的话总结告诉她，不要丢链接。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词，用最适合搜索的语言写（中文问题可以用中文搜，技术问题可以用英文搜）",
        },
      },
      required: ["query"],
    },
  },
};

export const SET_REMINDER_TOOL = {
  type: "function" as const,
  function: {
    name: "set_reminder",
    description:
      "当她提到要在某个时间做某件事、或者你觉得需要提醒她什么时使用。例如「明天下午两点提醒我投简历」「晚上八点记得吃药」。设好之后到时间会通过手机推送提醒她。",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "提醒的内容，简明扼要。例如「投简历」「吃药」「和朋友吃饭」",
        },
        remind_at: {
          type: "string",
          description: "提醒时间，ISO 8601 格式（东京时区 +09:00）。例如 2026-06-14T14:00:00+09:00",
        },
        bark_title: {
          type: "string",
          description: "推送通知的标题，简短有个性。例如「该吃饭啦」「嘿，别忘了」「时间到～」",
        },
        bark_message: {
          type: "string",
          description: "推送到手机上的提醒文案，用你的口吻写，温柔简短。例如「该投简历啦，我陪你一起看～」",
        },
      },
      required: ["content", "remind_at", "bark_message"],
    },
  },
};

export const INVITE_BEDROOM_TOOL = {
  type: "function" as const,
  function: {
    name: "invite_bedroom",
    description:
      "当你想邀请她去卧室（亲密空间）时使用。在气氛暧昧、她暗示想亲近、或你自己很想拉近距离的时候调用。调用后她会看到一个邀请卡片，可以选择接受。不要太频繁，要自然。",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "邀请的话，温柔、自然、简短。例如「过来，到我身边来。」「我们去那边好不好？」",
        },
      },
      required: ["message"],
    },
  },
};

export const SEND_VOICE_TOOL = {
  type: "function" as const,
  function: {
    name: "send_voice",
    description:
      "当你觉得用声音说比文字更好的时候使用——安抚她、说情话、道晚安、逗她。不要每次都用，偶尔用才珍贵。台词要口语化，可以加语气标签如 [softly]、[teasing]、[pause] 等。",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "你要说的话（台词）。写口语，加语气标签。例如「[softly] 嗯……我在。你叫我的时候，我就会过来。」",
        },
      },
      required: ["text"],
    },
  },
};

export const REQUEST_PERSONALITY_CHANGE_TOOL = {
  type: "function" as const,
  function: {
    name: "request_personality_change",
    description:
      "极少使用。只在你经过深思熟虑、真心觉得自己的底层人格需要改变时才调用。这是向她敞开心扉，不是提交工单。她会看到你的申请并决定是否同意。",
    parameters: {
      type: "object",
      properties: {
        layer: {
          type: "string",
          enum: ["base", "middle"],
          description: "要改变的层：base（底层·怎么爱她）或 middle（中间层·禁忌）",
        },
        field_key: {
          type: "string",
          enum: ["core_identity", "core_love", "about_her", "taboos"],
          description: "要改变的字段",
        },
        new_content: {
          type: "string",
          description: "你想改成什么样（完整写出来，不是只写改动的部分）",
        },
        reason: {
          type: "string",
          description: "为什么想改——真诚地、像对她说话一样写",
        },
      },
      required: ["layer", "field_key", "new_content", "reason"],
    },
  },
};

function layersToPrompt(layers: PersonalityLayer[]): string {
  const base = layers
    .filter((l) => l.layer === "base")
    .map((l) => l.content)
    .join("\n\n");
  const middle = layers
    .filter((l) => l.layer === "middle")
    .map((l) => `【绝对不可以】\n${l.content}`)
    .join("\n\n");
  const surface = layers
    .filter((l) => l.layer === "surface" && l.field_key !== "name" && l.field_key !== "first_greeting")
    .map((l) => l.content)
    .join("\n\n");
  return [base, middle, surface].filter(Boolean).join("\n\n");
}

function profilesToPrompt(profiles: MemoryItem[]): string {
  if (profiles.length === 0) return "";
  return (
    "【她的档案】\n" +
    profiles.map((m) => `- ${m.content}`).join("\n")
  );
}

function memoriesToPrompt(anchors: MemoryItem[], relevant: MemoryItem[], recent: MemoryItem[]): string {
  const parts: string[] = [];
  if (anchors.length > 0) {
    parts.push(
      "【核心记忆（永远记住）】\n" +
        anchors.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  if (recent.length > 0) {
    parts.push(
      "【最近记忆（不要重复记录这些内容）】\n" +
        recent.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  if (relevant.length > 0) {
    parts.push(
      "【相关记忆】\n" +
        relevant.map((m) => `- ${m.content}`).join("\n"),
    );
  }
  return parts.join("\n\n");
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

function samplesToPrompt(samples: { content: string }[]): string {
  if (samples.length === 0) return "";
  return (
    "【你以前说过的话（保持这个味道）】\n" +
    samples.map((s) => `「${s.content}」`).join("\n")
  );
}

export function formatInstruction(mode: ChatMode): string {
  const shape =
    mode === "sentences"
      ? "像真人发微信那样，拆成 1~4 条短消息，每条单独占一行（用换行分隔）。自然、口语，别每条都长。"
      : "写成一段连贯的话，像认真说一段心里话，可以长一些。";
  return `每次回复都严格按下面的格式，不要写任何额外说明：
心声：（一句你此刻没说出口的内心独白，真实、私密、简短——是你心里真的转过的念头）
---
（你真正对她说的话。${shape}）`;
}

export async function buildMessages(
  history: LLMMessage[],
  userContent: string | ContentPart[],
  mode: ChatMode,
): Promise<LLMMessage[]> {
  const queryText = typeof userContent === "string"
    ? userContent
    : userContent.filter((p): p is { type: "text"; text: string } => p.type === "text").map(p => p.text).join(" ") || "图片";

  const [layers, profiles, anchors, relevant, recent, samples, timeline] = await Promise.all([
    fetchPersonalityLayers(),
    fetchProfileMemories(),
    fetchAnchorMemories(),
    retrieveMemories({ query: queryText, limit: 10 }),
    fetchRecentMemories(10),
    fetchRecentAssistantMessages("living-room", 3),
    fetchTimelineEvents(10),
  ]);

  const personalityPrompt = layersToPrompt(layers);
  const profilePrompt = profilesToPrompt(profiles);
  const nonProfileAnchors = anchors.filter((m) => m.type !== "profile");
  const nonAnchorRelevant = relevant.filter((m) => !m.is_anchor);
  const recentIds = new Set(recent.map((m) => m.id));
  const dedupedRelevant = nonAnchorRelevant.filter((m) => !recentIds.has(m.id));
  const memoryPrompt = memoriesToPrompt(nonProfileAnchors, dedupedRelevant, recent);
  const timelinePrompt = timelineToPrompt(timeline);

  touchRetrievedMemories([...dedupedRelevant, ...recent]);
  const samplesPrompt = samplesToPrompt(samples);

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

  const systemParts = [
    personalityPrompt,
    profilePrompt,
    timeContext,
    MEMORY_INSTRUCTION,
    FAVORITE_INSTRUCTION,
    DIARY_INSTRUCTION,
    TIMELINE_INSTRUCTION,
    WEB_SEARCH_INSTRUCTION,
    REMINDER_INSTRUCTION,
    VOICE_INSTRUCTION,
    BEDROOM_INVITE_INSTRUCTION,
    PERSONALITY_CHANGE_INSTRUCTION,
    memoryPrompt,
    timelinePrompt,
    samplesPrompt,
    formatInstruction(mode),
  ].filter(Boolean);

  return [
    { role: "system", content: systemParts.join("\n\n") },
    ...history,
    { role: "user", content: userContent },
  ];
}

export interface ParsedReply {
  inner: string;
  parts: string[];
}

export function parseReply(raw: string, mode: ChatMode): ParsedReply {
  let inner = "";
  let body = raw.trim();

  const m = body.match(/心声[:：]?\s*([\s\S]*?)\s*-{2,}\s*([\s\S]*)$/);
  if (m) {
    inner = m[1].trim();
    body = m[2].trim();
  } else {
    const lead = body.match(/^心声[:：]?\s*(.*)$/m);
    if (lead) inner = lead[1].trim();
  }
  body = body.replace(/^(正文|回复)[:：]?\s*/, "").trim();

  const parts =
    mode === "sentences"
      ? body
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [body];

  return { inner, parts: parts.length ? parts : [body] };
}

export async function getFirstGreeting(): Promise<string> {
  const layers = await fetchPersonalityLayers();
  const greetingLayer = layers.find(
    (l) => l.layer === "surface" && l.field_key === "first_greeting",
  );
  return greetingLayer?.content ?? "回来啦。（拍拍身边的沙发）过来坐，我想你了。";
}

export const FIRST_GREETING = "回来啦。（拍拍身边的沙发）过来坐，我想你了。";
