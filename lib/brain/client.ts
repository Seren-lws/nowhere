/**
 * 大脑层 · 对话调用（客户端 → 本地后台 /api/chat → yunwu 中转）
 * key 经本地后台转一手，避免浏览器直连被 CORS 拦；key 只在本机。
 */

import type { BrainSettings } from "./config";
import type { LLMMessage } from "./personality";

export async function sendChat(
  messages: LLMMessage[],
  settings: BrainSettings,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      config: {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.chatModel,
      },
    }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error || `请求失败 (${res.status})`);
  }
  const data = (await res.json()) as { content: string };
  return data.content;
}

/** 测试连接：发一句极短的话，看通不通、能不能说话 */
export async function testConnection(
  settings: BrainSettings,
): Promise<{ ok: boolean; message: string }> {
  try {
    const reply = await sendChat(
      [{ role: "user", content: "连接测试，请只回复两个字：在的" }],
      settings,
    );
    return { ok: true, message: reply.trim().slice(0, 60) || "（空回复）" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
