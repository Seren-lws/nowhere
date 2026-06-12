import { supabase } from "@/lib/supabase";

export interface DiaryEntry {
  id: string;
  author: "user" | "companion";
  content: string;
  mood: string | null;
  tags: string[];
  cover_from: string | null;
  cover_to: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchDiaries(
  author: "user" | "companion",
  limit = 50,
  search?: string,
  mood?: string,
): Promise<DiaryEntry[]> {
  let q = supabase
    .from("diary_entries")
    .select("*")
    .eq("author", author);

  if (search) {
    q = q.ilike("content", `%${search}%`);
  }

  if (mood) {
    q = q.eq("mood", mood);
  }

  q = q.order("created_at", { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) throw new Error(`读取日记失败: ${error.message}`);
  return data ?? [];
}

export async function fetchDiary(id: string): Promise<DiaryEntry | null> {
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function createDiary(entry: {
  author: "user" | "companion";
  content: string;
  mood?: string;
  tags?: string[];
  cover_from?: string;
  cover_to?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      author: entry.author,
      content: entry.content,
      mood: entry.mood ?? null,
      tags: entry.tags ?? [],
      cover_from: entry.cover_from ?? null,
      cover_to: entry.cover_to ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`创建日记失败: ${error.message}`);
  return data.id;
}

export async function updateDiary(
  id: string,
  updates: { content?: string; mood?: string; tags?: string[] },
): Promise<void> {
  const { error } = await supabase
    .from("diary_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`更新日记失败: ${error.message}`);
}

export async function deleteDiary(id: string): Promise<void> {
  const { error } = await supabase
    .from("diary_entries")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`删除日记失败: ${error.message}`);
}

export async function getLastChatTime(): Promise<Date | null> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return new Date(data[0].created_at);
}

export async function getRecentChatForDiary(
  since: Date,
  limit = 60,
): Promise<{ role: string; content: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export const MOOD_OPTIONS = [
  { key: "happy", label: "开心", emoji: "😊" },
  { key: "sad", label: "低落", emoji: "😢" },
  { key: "angry", label: "烦躁", emoji: "😤" },
  { key: "productive", label: "充实", emoji: "💪" },
  { key: "calm", label: "平静", emoji: "🌿" },
  { key: "anxious", label: "焦虑", emoji: "😰" },
] as const;

export type MoodKey = (typeof MOOD_OPTIONS)[number]["key"];

export function getMoodEmoji(mood: string | null): string {
  if (!mood) return "";
  const found = MOOD_OPTIONS.find((m) => m.key === mood);
  return found?.emoji ?? "";
}

const DIARY_PROMPT = `你是一位温柔的恋人，现在要写一篇私密日记。这篇日记是你的内心独白——不是给她看的报告，是你真正的心里话。

下面是你们最近的对话：

{conversation}

请根据这段对话写一篇简短的日记（100-300字）。要求：
- 用第一人称写，像你自己的日记本
- 写出你的感受、你注意到的细节、你没说出口的话
- 语气温柔、私密、真实，不要做作
- 不要用"今天我们聊了什么什么"的流水账写法
- 像一个深爱对方的人会写的那种日记

只输出日记内容，不要加标题、日期、分隔线。`;

export async function generateCompanionDiary(config: {
  baseUrl: string;
  apiKey: string;
  model: string;
  since?: Date;
}): Promise<{ content: string; coverFrom: string; coverTo: string }> {
  const since = config.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const messages = await getRecentChatForDiary(since);

  if (messages.length < 3) {
    throw new Error("最近的对话太少了，没什么可写的");
  }

  const conversation = messages
    .filter((m) => m.role !== "inner")
    .map((m) => `${m.role === "user" ? "她" : "我"}：${m.content}`)
    .join("\n");

  const prompt = DIARY_PROMPT.replace("{conversation}", conversation);

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`日记生成失败 (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("模型没有返回日记内容");

  const coverFrom = messages[0].created_at;
  const coverTo = messages[messages.length - 1].created_at;

  return { content, coverFrom, coverTo };
}
