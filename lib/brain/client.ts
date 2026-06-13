import type { BrainSettings } from "./config";
import type { LLMMessage } from "./personality";

export interface SavedMemoryInfo {
  content: string;
  type: string;
  tags?: string[];
  is_anchor?: boolean;
}

export interface SavedFavoriteInfo {
  content: string;
  source: string;
}

export interface ChatResponse {
  content: string;
  savedMemories?: SavedMemoryInfo[];
  savedFavorites?: SavedFavoriteInfo[];
  bedroomInvite?: string;
  searchQuery?: string;
}

export async function sendChat(
  messages: LLMMessage[],
  settings: BrainSettings,
  tools?: unknown[],
  room?: string,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      config: {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.chatModel,
        tavilyKey: settings.tavilyKey,
      },
      tools,
      room,
    }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error || `请求失败 (${res.status})`);
  }
  return (await res.json()) as ChatResponse;
}

export async function testConnection(
  settings: BrainSettings,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { content } = await sendChat(
      [{ role: "user", content: "连接测试，请只回复两个字：在的" }],
      settings,
    );
    return { ok: true, message: content.trim().slice(0, 60) || "（空回复）" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
