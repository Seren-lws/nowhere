import { saveChatMessage, loadChatMessages } from "./db";

import type { SavedMemoryInfo } from "./client";

export type ChatRole = "user" | "assistant" | "inner" | "memory";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: number;
  dbId?: string;
  memories?: SavedMemoryInfo[];
}

export function toContext(
  msgs: ChatMessage[],
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of msgs) {
    if (m.role === "inner" || m.role === "memory") continue;
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

export async function saveMessageToDb(
  role: ChatRole,
  content: string,
): Promise<string> {
  return saveChatMessage(role, content);
}

export async function loadHistoryFromDb(): Promise<ChatMessage[]> {
  const rows = await loadChatMessages("living-room", 200);
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    ts: new Date(r.created_at).getTime(),
    dbId: r.id,
  }));
}

export async function migrateLocalToDb(): Promise<number> {
  const local = loadHistory();
  if (local.length === 0) return 0;

  let migrated = 0;
  for (const m of local) {
    if (m.dbId) continue;
    try {
      await saveChatMessage(m.role, m.content);
      migrated++;
    } catch {
      break;
    }
  }
  return migrated;
}
