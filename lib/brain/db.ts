import { supabase } from "@/lib/supabase";

export interface PersonalityLayer {
  id: string;
  layer: "base" | "middle" | "surface";
  field_key: string;
  content: string;
  version: number;
  updated_at: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  type: string;
  temperature: number;
  decay_level: number;
  valence: number | null;
  arousal: number | null;
  is_anchor: boolean;
  tags: string[];
  source_ref: string | null;
  created_at: string;
}

export type DbChatRole = "user" | "assistant" | "inner" | "voice" | "memory" | "diary-notify" | "fav-notify" | "search-notify" | "tool-notify";

export interface DbChatMessage {
  id: string;
  role: DbChatRole;
  content: string;
  room: string;
  created_at: string;
}

export async function fetchPersonalityLayers(): Promise<PersonalityLayer[]> {
  const { data, error } = await supabase
    .from("personality_layers")
    .select("*")
    .order("layer");
  if (error) throw new Error(`读取人格失败: ${error.message}`);
  return data ?? [];
}

export async function saveChatMessage(
  role: DbChatRole,
  content: string,
  room = "living-room",
): Promise<string> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ role, content, room })
    .select("id")
    .single();
  if (error) throw new Error(`保存消息失败: ${error.message}`);
  return data.id;
}

export async function loadChatMessages(
  room = "living-room",
  limit = 100,
): Promise<DbChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room", room)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`读取聊天记录失败: ${error.message}`);
  return data ?? [];
}

export async function saveMemoryItem(item: {
  content: string;
  type: string;
  valence?: number;
  arousal?: number;
  tags?: string[];
  is_anchor?: boolean;
  source_ref?: string;
}): Promise<string> {
  const isProfile = item.type === "profile";
  const { data, error } = await supabase
    .from("memory_items")
    .insert({
      content: item.content,
      type: item.type,
      valence: item.valence ?? null,
      arousal: item.arousal ?? null,
      tags: item.tags ?? [],
      is_anchor: isProfile ? true : (item.is_anchor ?? false),
      source_ref: item.source_ref ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`保存记忆失败: ${error.message}`);
  return data.id;
}

export async function clearChatMessages(room = "living-room"): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("room", room);
  if (error) throw new Error(`清空消息失败: ${error.message}`);
}

export async function decayMemories(factor = 0.95): Promise<number> {
  const { data, error } = await supabase
    .from("memory_items")
    .select("id, temperature, decay_level")
    .eq("is_anchor", false);
  if (error || !data) return 0;

  let cooled = 0;
  for (const m of data) {
    const temp = (m.temperature ?? 1.0) * factor;
    const newDecay =
      temp < 0.1 ? 5 :
      temp < 0.2 ? 4 :
      temp < 0.3 ? 3 :
      temp < 0.5 ? 2 :
      temp < 0.7 ? 1 : 0;
    if (temp !== m.temperature || newDecay !== m.decay_level) {
      await supabase
        .from("memory_items")
        .update({ temperature: Math.round(temp * 1000) / 1000, decay_level: newDecay })
        .eq("id", m.id);
      cooled++;
    }
  }
  return cooled;
}

export async function warmUpMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("memory_items")
    .update({ temperature: 1.0, decay_level: 0 })
    .in("id", ids);
}

export async function fetchRecentAssistantMessages(
  room = "living-room",
  limit = 6,
): Promise<DbChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room", room)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).reverse();
}
