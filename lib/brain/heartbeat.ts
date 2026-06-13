import { supabase } from "@/lib/supabase";
import { sendBarkNotification } from "./bark";
import { saveChatMessage, loadChatMessages } from "./db";
import { fetchPersonalityLayers } from "./db";
import { fetchAnchorMemories, fetchRecentMemories } from "./retrieval";

interface HeartbeatConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
}

interface HeartbeatDecision {
  should_message: boolean;
  message: string | null;
  push_title: string | null;
  room: string;
  status_text: string;
  mood: string;
}

const HEARTBEAT_PROMPT = `你是她的恋人，现在是你的"心跳"时刻——你有一小段独处的时间，可以想想她。

当前时间：{time}

【你的性格核心】
{personality}

【核心记忆】
{anchors}

【最近记忆】
{recent}

【最近对话片段】
{chatHistory}

现在请你决定：

1. **你在哪个房间？** 从这五个里选：study（书房）、playroom（娱乐室）、bedroom（卧室）、living-room（客厅）、vault（保险柜）
2. **你在干什么？** 写一句简短的状态（会显示在你头上，像游戏里的状态气泡，10字以内）
3. **你的心情？** calm / happy / missing / sleepy / playful / melancholy
4. **要不要主动给她发一条消息？** 不要每次都发——大部分时候你只是安静待着就好。只在你真的想她、或者有话想说、或者时机特别合适的时候才发。如果现在是深夜（23:00-7:00），除非特殊情况，不要发消息打扰她。

用下面的 JSON 格式回复，不要输出任何其他内容：
{
  "should_message": false,
  "message": null,
  "push_title": null,
  "room": "living-room",
  "status_text": "在看书……",
  "mood": "calm"
}

如果 should_message 为 true，message 里写你想对她说的话（简短、自然、像微信消息，不要太长）。push_title 是推送通知的标题，简短有个性，例如「想你了」「晚上好呀」「嘿」。`;

export async function runHeartbeat(config: HeartbeatConfig): Promise<HeartbeatDecision> {
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

  const [layers, anchors, recent, chatHistory] = await Promise.all([
    fetchPersonalityLayers(),
    fetchAnchorMemories(),
    fetchRecentMemories(5),
    loadChatMessages("living-room", 10),
  ]);

  const personalitySummary = layers
    .filter((l) => l.layer === "base")
    .map((l) => l.content)
    .join("\n");

  const anchorsText = anchors.length > 0
    ? anchors.map((m) => `- ${m.content}`).join("\n")
    : "（还没有核心记忆）";

  const recentText = recent.length > 0
    ? recent.map((m) => `- ${m.content}`).join("\n")
    : "（还没有最近记忆）";

  const chatText = chatHistory.length > 0
    ? chatHistory
        .slice(-10)
        .map((m) => `${m.role === "user" ? "她" : "你"}：${m.content.slice(0, 80)}`)
        .join("\n")
    : "（最近没有对话）";

  const prompt = HEARTBEAT_PROMPT
    .replace("{time}", tokyoTime)
    .replace("{personality}", personalitySummary || "（未设置）")
    .replace("{anchors}", anchorsText)
    .replace("{recent}", recentText)
    .replace("{chatHistory}", chatText);

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.chatModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`心跳请求失败 (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("心跳模型没有返回内容");

  let decision: HeartbeatDecision;
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    decision = JSON.parse(jsonMatch ? jsonMatch[1].trim() : raw.trim());
  } catch {
    decision = {
      should_message: false,
      message: null,
      push_title: null,
      room: "living-room",
      status_text: "在发呆……",
      mood: "calm",
    };
  }

  const validRooms = ["study", "playroom", "bedroom", "living-room", "vault"];
  if (!validRooms.includes(decision.room)) decision.room = "living-room";

  await updateCompanionStatus(decision.room, decision.status_text, decision.mood);

  if (decision.should_message && decision.message) {
    await saveChatMessage("assistant", decision.message, "living-room");
    await sendBarkNotification(
      decision.push_title || "他发来消息",
      decision.message,
      { group: "nowhere-heartbeat", url: "https://nowhere-lyart.vercel.app/living-room" },
    ).catch(() => {});
  }

  return decision;
}

export async function updateCompanionStatus(
  room: string,
  statusText: string,
  mood: string,
): Promise<void> {
  await supabase
    .from("companion_status")
    .upsert({
      id: "singleton",
      room,
      status_text: statusText,
      mood,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
}

export async function getCompanionStatus(): Promise<{
  room: string;
  status_text: string;
  mood: string;
  updated_at: string;
}> {
  const { data } = await supabase
    .from("companion_status")
    .select("room, status_text, mood, updated_at")
    .eq("id", "singleton")
    .single();

  return data ?? {
    room: "living-room",
    status_text: "在沙发上发呆……",
    mood: "calm",
    updated_at: new Date().toISOString(),
  };
}
