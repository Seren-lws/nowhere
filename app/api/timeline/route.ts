import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("timeline_events")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
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
    const { title, content, event_date, icon, source } = body;
    if (!title || !event_date) {
      return NextResponse.json({ error: "缺少标题或日期" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("timeline_events")
      .insert({
        title,
        content: content ?? null,
        event_date,
        icon: icon ?? "favorite",
        source: source ?? "manual",
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, title, content, event_date, icon } = body;
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content || null;
    if (event_date !== undefined) updates.event_date = event_date;
    if (icon !== undefined) updates.icon = icon;

    const { data, error } = await supabase
      .from("timeline_events")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }
    const { error } = await supabase
      .from("timeline_events")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
