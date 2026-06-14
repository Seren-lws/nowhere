import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/brain/embedding";

export async function POST(req: Request) {
  try {
    const { text, baseUrl, apiKey, model } = await req.json();
    if (!text || !baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }
    const embedding = await generateEmbedding(text, baseUrl, apiKey, model);
    return NextResponse.json({ embedding });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
