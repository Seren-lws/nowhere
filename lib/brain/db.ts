import { supabase } from "@/lib/supabase";

export interface PersonalityLayer {
  id: string;
  layer: "base" | "middle" | "surface";
  field_key: string;
  content: string;
  version: number;
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

export interface DbChatMessage {
  id: string;
  role: "user" | "assistant" | "inner";
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
  role: "user" | "assistant" | "inner",
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
  const { data, error } = await supabase
    .from("memory_items")
    .insert({
      content: item.content,
      type: item.type,
      valence: item.valence ?? null,
      arousal: item.arousal ?? null,
      tags: item.tags ?? [],
      is_anchor: item.is_anchor ?? false,
      source_ref: item.source_ref ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`保存记忆失败: ${error.message}`);
  return data.id;
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
