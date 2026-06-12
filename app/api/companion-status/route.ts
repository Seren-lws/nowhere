import { NextResponse } from "next/server";
import { getCompanionStatus } from "@/lib/brain/heartbeat";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getCompanionStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
