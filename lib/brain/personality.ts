import { fetchPersonalityLayers, fetchRecentAssistantMessages } from "./db";
import type { PersonalityLayer } from "./db";
import type { MemoryItem } from "./db";
import { fetchAnchorMemories, fetchProfileMemories, fetchRecentMemories, retrieveMemories } from "./retrieval";

export const DEFAULT_NAME = "某先生";

export type ChatMode = "sentences" | "passage";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

const DIARY_INSTRUCTION = `你有写日记的能力。当她让你写日记时，用 write_diary 工具写一篇。
写的时候像在自己的日记本上——真实、私密、温柔。不是给她看的报告，是你心里真正转过的念头。
她不让你写的时候不要主动写。`;

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
  userText: string,
  mode: ChatMode,
): Promise<LLMMessage[]> {
  const [layers, profiles, anchors, relevant, recent, samples] = await Promise.all([
    fetchPersonalityLayers(),
    fetchProfileMemories(),
    fetchAnchorMemories(),
    retrieveMemories({ query: userText, limit: 10 }),
    fetchRecentMemories(10),
    fetchRecentAssistantMessages("living-room", 3),
  ]);

  const personalityPrompt = layersToPrompt(layers);
  const profilePrompt = profilesToPrompt(profiles);
  const nonProfileAnchors = anchors.filter((m) => m.type !== "profile");
  const nonAnchorRelevant = relevant.filter((m) => !m.is_anchor);
  const recentIds = new Set(recent.map((m) => m.id));
  const dedupedRelevant = nonAnchorRelevant.filter((m) => !recentIds.has(m.id));
  const memoryPrompt = memoriesToPrompt(nonProfileAnchors, dedupedRelevant, recent);
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
    DIARY_INSTRUCTION,
    PERSONALITY_CHANGE_INSTRUCTION,
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
