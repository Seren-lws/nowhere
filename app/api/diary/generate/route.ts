import { NextResponse } from "next/server";
import { generateCompanionDiary, createDiary } from "@/lib/brain/diary";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { baseUrl, apiKey, model, since } = body;

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { error: "缺少 API 配置（baseUrl, apiKey, model）" },
        { status: 400 },
      );
    }

    const result = await generateCompanionDiary({
      baseUrl,
      apiKey,
      model,
      since: since ? new Date(since) : undefined,
    });

    const id = await createDiary({
      author: "companion",
      content: result.content,
      cover_from: result.coverFrom,
      cover_to: result.coverTo,
    });

    return NextResponse.json({ id, content: result.content });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
