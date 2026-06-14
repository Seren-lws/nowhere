import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/brain/embedding";

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey, model } = await req.json();
    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const { data: items, error } = await supabase
      .from("memory_items")
      .select("id, content")
      .is("embedding", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ updated: 0, remaining: 0 });
    }

    let updated = 0;
    for (const item of items) {
      try {
        const embedding = await generateEmbedding(item.content, baseUrl, apiKey, model);
        if (embedding.length > 0) {
          await supabase
            .from("memory_items")
            .update({ embedding: JSON.stringify(embedding) })
            .eq("id", item.id);
          updated++;
        }
      } catch {
        break;
      }
    }

    const { count } = await supabase
      .from("memory_items")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    return NextResponse.json({ updated, remaining: count ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
