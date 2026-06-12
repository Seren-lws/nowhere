import { NextResponse } from "next/server";
import {
  fetchDiaries,
  fetchDiary,
  createDiary,
  updateDiary,
  deleteDiary,
} from "@/lib/brain/diary";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const author = searchParams.get("author") as "user" | "companion" | null;

  if (id) {
    const entry = await fetchDiary(id);
    if (!entry) return NextResponse.json({ error: "日记不存在" }, { status: 404 });
    return NextResponse.json(entry);
  }

  if (!author || !["user", "companion"].includes(author)) {
    return NextResponse.json({ error: "需要 author 参数（user 或 companion）" }, { status: 400 });
  }

  const search = searchParams.get("q") || undefined;
  const entries = await fetchDiaries(author, 50, search);
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { author, content, mood, tags } = body;

    if (!author || !content) {
      return NextResponse.json({ error: "缺少 author 或 content" }, { status: 400 });
    }

    const id = await createDiary({ author, content, mood, tags });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, content, mood, tags } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    await updateDiary(id, { content, mood, tags });
    return NextResponse.json({ ok: true });
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
    await deleteDiary(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
