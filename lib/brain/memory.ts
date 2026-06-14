import { saveChatMessage, loadChatMessages, type DbChatRole } from "./db";
import type { ContentPart } from "./personality";

import type { SavedMemoryInfo } from "./client";

export type ChatRole = "user" | "assistant" | "inner" | "memory" | "diary-notify" | "fav-notify" | "search-notify" | "tool-notify" | "voice" | "bedroom-invite";

export interface DiaryShareData {
  id: string;
  content: string;
  mood?: string;
  created_at: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: number;
  dbId?: string;
  memories?: SavedMemoryInfo[];
  diaryShare?: DiaryShareData;
}

export function toContext(
  msgs: ChatMessage[],
): { role: "user" | "assistant"; content: string | ContentPart[] }[] {
  const out: { role: "user" | "assistant"; content: string | ContentPart[] }[] = [];
  for (const m of msgs) {
    if (m.role !== "user" && m.role !== "assistant") continue;

    let content: string | ContentPart[];
    try {
      const parsed = JSON.parse(m.content);
      if (parsed?.type === "sticker" && parsed.alt) {
        content = parsed.caption
          ? `[发送了表情包：${parsed.alt}] ${parsed.caption}`
          : `[发送了表情包：${parsed.alt}]`;
      } else if (m.role === "user" && parsed?.type === "image" && parsed.imageUrl) {
        content = [
          { type: "image_url", image_url: { url: parsed.imageUrl } },
          { type: "text", text: parsed.caption || "她发了一张图片。" },
        ];
      } else {
        content = m.content;
      }
    } catch {
      content = m.content;
    }

    const last = out[out.length - 1];
    if (last && last.role === m.role && typeof last.content === "string" && typeof content === "string") {
      last.content += "\n" + content;
    } else {
      out.push({ role: m.role, content });
    }
  }
  return out;
}

export const CHAT_KEY = "nowhere:chat:living-room";
export const HISTORY_WINDOW = 30;

export function getHistoryWindow(): number {
  if (typeof window === "undefined") return HISTORY_WINDOW;
  try {
    const raw = window.localStorage.getItem("nowhere:settings");
    if (!raw) return HISTORY_WINDOW;
    const s = JSON.parse(raw);
    return typeof s.historyWindow === "number" && s.historyWindow > 0 ? s.historyWindow : HISTORY_WINDOW;
  } catch {
    return HISTORY_WINDOW;
  }
}

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

export async function saveMessageToDb(
  role: DbChatRole,
  content: string,
): Promise<string> {
  return saveChatMessage(role, content);
}

export async function loadHistoryFromDb(): Promise<ChatMessage[]> {
  const rows = await loadChatMessages("living-room", 500);
  return rows.map((r) => {
    const msg: ChatMessage = {
      role: r.role as ChatRole,
      content: r.content,
      ts: new Date(r.created_at).getTime(),
      dbId: r.id,
    };
    if (r.role === "memory") {
      try {
        const parsed = JSON.parse(r.content);
        if (parsed.memories) {
          msg.memories = parsed.memories;
          msg.content = "";
        }
      } catch {}
    }
    return msg;
  });
}

export async function migrateLocalToDb(): Promise<number> {
  const local = loadHistory();
  if (local.length === 0) return 0;

  let migrated = 0;
  for (const m of local) {
    if (m.dbId || m.role === "bedroom-invite") continue;
    try {
      const content = m.role === "memory" && m.memories
        ? JSON.stringify({ memories: m.memories })
        : m.content;
      await saveChatMessage(m.role as DbChatRole, content);
      migrated++;
    } catch {
      break;
    }
  }
  return migrated;
}
