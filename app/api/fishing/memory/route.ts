import { NextResponse } from "next/server";
import { saveMemoryItem, updateMemoryEmbedding } from "@/lib/brain/db";
import { generateEmbedding } from "@/lib/brain/embedding";

// 娱乐室钓鱼：钓到稀有以上的鱼时，把这件事记进他的记忆（带向量，便于以后语义检索）
export async function POST(req: Request) {
  try {
    const { content, tags, baseUrl, apiKey, embeddingModel } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "缺少内容" }, { status: 400 });
    }
    const id = await saveMemoryItem({
      content,
      type: "event",
      tags: Array.isArray(tags) ? tags : ["钓鱼", "娱乐室"],
    });
    if (baseUrl && apiKey && embeddingModel) {
      generateEmbedding(content, baseUrl, apiKey, embeddingModel)
        .then((emb) => updateMemoryEmbedding(id, emb))
        .catch(() => {});
    }
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
