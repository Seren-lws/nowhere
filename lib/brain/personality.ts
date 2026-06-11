import { fetchPersonalityLayers, fetchRecentAssistantMessages } from "./db";
import type { PersonalityLayer } from "./db";
import type { MemoryItem } from "./db";
import { fetchAnchorMemories, fetchProfileMemories, retrieveMemories } from "./retrieval";

export const DEFAULT_NAME = "某先生";

export type ChatMode = "sentences" | "passage";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MEMORY_INSTRUCTION = `你有记忆能力。当对话中出现值得记住的信息时，使用 save_memory 工具记录。
记什么：她的重要经历、情绪变化、喜好、你们的约定、她反复强调的事。
不记什么：闲聊废话、已经记过的重复信息、无关紧要的细节。
记忆写好之后继续正常回复她，不要提"我记住了"之类的话，默默记就好。`;

export const SAVE_MEMORY_TOOL = {
  type: "function" as const,
  function: {
    name: "save_memory",
    description:
      "当你觉得对话中出现了值得记住的信息时调用。包括：她的重要经历、情绪状态、喜好厌恶、你们之间的约定、她反复提到的事。不要什么都记，只记真正重要的。",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "记忆摘要，用简洁的第三人称写",
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

function memoriesToPrompt(anchors: MemoryItem[], relevant: MemoryItem[]): string {
  const parts: string[] = [];
  if (anchors.length > 0) {
    parts.push(
      "【核心记忆（永远记住）】\n" +
        anchors.map((m) => `- ${m.content}`).join("\n"),
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
  const [layers, profiles, anchors, relevant, samples] = await Promise.all([
    fetchPersonalityLayers(),
    fetchProfileMemories(),
    fetchAnchorMemories(),
    retrieveMemories({ query: userText, limit: 10 }),
    fetchRecentAssistantMessages("living-room", 3),
  ]);

  const personalityPrompt = layersToPrompt(layers);
  const profilePrompt = profilesToPrompt(profiles);
  const nonProfileAnchors = anchors.filter((m) => m.type !== "profile");
  const nonAnchorRelevant = relevant.filter((m) => !m.is_anchor);
  const memoryPrompt = memoriesToPrompt(nonProfileAnchors, nonAnchorRelevant);
  const samplesPrompt = samplesToPrompt(samples);

  const systemParts = [
    personalityPrompt,
    profilePrompt,
    MEMORY_INSTRUCTION,
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
