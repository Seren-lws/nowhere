import { NextResponse } from "next/server";
import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
  removeFavoriteByDiary,
  type FavoriteSource,
} from "@/lib/brain/favorites";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") as FavoriteSource | null;

  try {
    const favorites = await fetchFavorites(source ?? undefined);
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
    const { source, content, metadata } = body;

    if (!source || !content) {
      return NextResponse.json({ error: "缺少 source 或 content" }, { status: 400 });
    }

    const id = await addFavorite({ source, content, metadata });
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
  const diaryId = searchParams.get("diaryId");

  try {
    if (diaryId) {
      await removeFavoriteByDiary(diaryId);
    } else if (id) {
      await removeFavorite(id);
    } else {
      return NextResponse.json({ error: "缺少 id 或 diaryId" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
