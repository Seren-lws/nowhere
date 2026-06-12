import { NextResponse } from "next/server";
import { fetchFavorites, addFavorite, removeFavorite } from "@/lib/brain/favorites";

export async function GET() {
  try {
    const favorites = await fetchFavorites();
    return NextResponse.json(favorites);
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
    const { messageId, note } = body;

    if (!messageId) {
      return NextResponse.json({ error: "缺少 messageId" }, { status: 400 });
    }

    const id = await addFavorite(messageId, note);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  try {
    await removeFavorite(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
