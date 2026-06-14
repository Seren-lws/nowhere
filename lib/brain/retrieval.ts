import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "./db";
import { warmUpMemories } from "./db";

export type MemoryType =
  | "fact"
  | "event"
  | "emotion"
  | "promise"
  | "preference"
  | "habit"
  | "relationship"
  | "profile";

export interface RetrievalOptions {
  query: string;
  tags?: string[];
  type?: MemoryType[];
  anchorOnly?: boolean;
  limit?: number;
  queryEmbedding?: number[];
}

export async function retrieveMemories(
  options: RetrievalOptions,
): Promise<MemoryItem[]> {
  if (options.queryEmbedding && options.queryEmbedding.length > 0 && !options.anchorOnly) {
    return retrieveByVector(options.queryEmbedding, options.limit ?? 10);
  }

  let q = supabase.from("memory_items").select("*");

  if (options.anchorOnly) {
    q = q.eq("is_anchor", true);
  } else {
    q = q.lt("decay_level", 4);
  }

  if (options.type && options.type.length > 0) {
    q = q.in("type", options.type);
  }

  if (options.tags && options.tags.length > 0) {
    q = q.overlaps("tags", options.tags);
  }

  if (options.query && !options.anchorOnly) {
    q = q.ilike("content", `%${options.query}%`);
  }

  q = q.order("temperature", { ascending: false });
  q = q.order("created_at", { ascending: false });
  q = q.limit(options.limit ?? 20);

  const { data, error } = await q;
  if (error) return [];
  return data ?? [];
}

async function retrieveByVector(
  embedding: number[],
  limit: number,
): Promise<MemoryItem[]> {
  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: 0.3,
    match_count: limit,
  });
  if (error || !data) return [];
  return data.map((row: MemoryItem & { similarity: number }) => ({
    id: row.id,
    content: row.content,
    type: row.type,
    temperature: row.temperature,
    decay_level: row.decay_level,
    valence: row.valence,
    arousal: row.arousal,
    is_anchor: row.is_anchor,
    tags: row.tags,
    source_ref: row.source_ref,
    created_at: row.created_at,
  }));
}

export async function fetchAnchorMemories(): Promise<MemoryItem[]> {
  return retrieveMemories({ query: "", anchorOnly: true, limit: 50 });
}

export async function fetchProfileMemories(): Promise<MemoryItem[]> {
  return retrieveMemories({ query: "", type: ["profile"], limit: 50 });
}

export async function fetchRecentMemories(limit = 10): Promise<MemoryItem[]> {
  const { data, error } = await supabase
    .from("memory_items")
    .select("*")
    .lt("decay_level", 4)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function touchRetrievedMemories(memories: MemoryItem[]): Promise<void> {
  const ids = memories.filter((m) => !m.is_anchor && m.temperature < 1.0).map((m) => m.id);
  if (ids.length > 0) warmUpMemories(ids).catch(() => {});
}
