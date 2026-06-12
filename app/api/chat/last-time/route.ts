import { NextResponse } from "next/server";
import { getLastChatTime } from "@/lib/brain/diary";

export async function GET() {
  const lastTime = await getLastChatTime();
  return NextResponse.json({ lastTime: lastTime?.toISOString() ?? null });
}
