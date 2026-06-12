import { NextResponse } from "next/server";
import {
  loadSessionMessages,
  saveBedroomMessage,
} from "@/lib/brain/bedroom";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }
  try {
    const messages = await loadSessionMessages(sessionId);
    return NextResponse.json(messages);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, role, content } = body;
    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: "缺少必填字段" },
        { status: 400 },
      );
    }
    const id = await saveBedroomMessage(sessionId, role, content);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
