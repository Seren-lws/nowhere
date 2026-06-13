import { supabase } from "@/lib/supabase";

export type FavoriteSource = "chat" | "diary" | "bedroom";
export type FavoriteOwner = "user" | "companion";

export interface FavoriteItem {
  id: string;
  source: FavoriteSource;
  content: string;
  owner: FavoriteOwner;
  metadata: {
    date?: string;
    room?: string;
    diary_id?: string;
    type?: "voice" | "image";
    audioUrl?: string;
    imageUrl?: string;
    messages?: { role: string; content: string; time?: string }[];
  };
  created_at: string;
}

export async function fetchFavorites(
  owner: FavoriteOwner = "user",
  source?: FavoriteSource,
  limit = 50,
): Promise<FavoriteItem[]> {
  let query = supabase
    .from("favorites")
    .select("*")
    .eq("owner", owner)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  if (error) throw new Error(`读取收藏失败: ${error.message}`);
  return data ?? [];
}

export async function addFavorite(item: {
  source: FavoriteSource;
  content: string;
  owner?: FavoriteOwner;
  metadata?: FavoriteItem["metadata"];
}): Promise<string> {
  const { data, error } = await supabase
    .from("favorites")
    .insert({
      source: item.source,
      content: item.content,
      owner: item.owner ?? "user",
      metadata: item.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) throw new Error(`收藏失败: ${error.message}`);
  return data.id;
}

export async function removeFavorite(id: string): Promise<void> {
  const { error } = await supabase.from("favorites").delete().eq("id", id);
  if (error) throw new Error(`取消收藏失败: ${error.message}`);
}

export async function isFavoritedDiary(diaryId: string): Promise<boolean> {
  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq("source", "diary")
    .filter("metadata->>diary_id", "eq", diaryId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function removeFavoriteByDiary(diaryId: string): Promise<void> {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("source", "diary")
    .filter("metadata->>diary_id", "eq", diaryId);
  if (error) throw new Error(`取消日记收藏失败: ${error.message}`);
}
