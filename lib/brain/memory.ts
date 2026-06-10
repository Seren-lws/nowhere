/**
 * 大脑层 · 简单记忆（P0）
 *
 * 先本地存这次的对话历史（localStorage）。完整记忆系统（单表 memory_items、
 * 锚点、衰减、原话层、园丁）留给 P1 保险柜，届时替换本模块、客厅无需改动。
 */

export type ChatRole = "user" | "assistant" | "inner"; // inner = 心声（仅展示，不进上下文）

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** 毫秒时间戳（写入时由调用方传入，避免在纯函数里取时间） */
  ts: number;
}

/**
 * 把展示用的消息转成发给模型的上下文：丢掉心声，合并连续的同角色。
 */
export function toContext(
  msgs: ChatMessage[],
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of msgs) {
    if (m.role === "inner") continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content += "\n" + m.content;
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

export const CHAT_KEY = "nowhere:chat:living-room";

/** 上下文里最多带多少条历史给模型（简易记忆窗口） */
export const HISTORY_WINDOW = 30;

export function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(msgs: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAT_KEY);
}
