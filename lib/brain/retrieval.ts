import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "./db";

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
}

export async function retrieveMemories(
  options: RetrievalOptions,
): Promise<MemoryItem[]> {
  let q = supabase.from("memory_items").select("*");

  if (options.anchorOnly) {
    q = q.eq("is_anchor", true);
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

  q = q.order("created_at", { ascending: false });
  q = q.limit(options.limit ?? 20);

  const { data, error } = await q;
  if (error) return [];
  return data ?? [];
}

export async function fetchAnchorMemories(): Promise<MemoryItem[]> {
  return retrieveMemories({ query: "", anchorOnly: true, limit: 50 });
}

export async function fetchProfileMemories(): Promise<MemoryItem[]> {
  return retrieveMemories({ query: "", type: ["profile"], limit: 50 });
}
