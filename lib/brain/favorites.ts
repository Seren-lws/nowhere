import { supabase } from "@/lib/supabase";

export interface ChatFavorite {
  id: string;
  message_id: string;
  note: string | null;
  created_at: string;
  message?: {
    role: string;
    content: string;
    created_at: string;
  };
}

export async function fetchFavorites(limit = 50): Promise<ChatFavorite[]> {
  const { data, error } = await supabase
    .from("chat_favorites")
    .select("*, message:chat_messages!message_id(role, content, created_at)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`读取收藏失败: ${error.message}`);
  return data ?? [];
}

export async function addFavorite(
  messageId: string,
  note?: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("chat_favorites")
    .select("id")
    .eq("message_id", messageId)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  const { data, error } = await supabase
    .from("chat_favorites")
    .insert({ message_id: messageId, note: note ?? null })
    .select("id")
    .single();
  if (error) throw new Error(`收藏失败: ${error.message}`);
  return data.id;
}

export async function removeFavorite(id: string): Promise<void> {
  const { error } = await supabase
    .from("chat_favorites")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`取消收藏失败: ${error.message}`);
}

export async function isFavorited(messageId: string): Promise<boolean> {
  const { data } = await supabase
    .from("chat_favorites")
    .select("id")
    .eq("message_id", messageId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
