import { NextResponse } from "next/server";
import { loadServerConfig } from "@/lib/brain/server-config";
import { runPatrol } from "@/lib/brain/gardener";
import { runHeartbeat } from "@/lib/brain/heartbeat";
import { supabase } from "@/lib/supabase";
import { sendBarkNotification } from "@/lib/brain/bark";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const secret = process.env.CRON_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const task = searchParams.get("task") || "gardener";

  try {
    switch (task) {
      case "gardener":
        return await handleGardener();
      case "heartbeat":
        return await handleHeartbeat();
      case "reminder":
        return await handleReminder();
      default:
        return NextResponse.json({ error: `未知任务: ${task}` }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleGardener() {
  const config = await loadServerConfig();

  if (!config.baseUrl || !config.apiKey || !config.gardenerModel) {
    return NextResponse.json(
      { error: "服务端配置不完整，请到设置页保存一次" },
      { status: 400 },
    );
  }

  const result = await runPatrol({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    gardenerModel: config.gardenerModel,
  });

  return NextResponse.json({ ok: true, ...result });
}

async function handleHeartbeat() {
  const config = await loadServerConfig();

  if (!config.baseUrl || !config.apiKey || !config.chatModel) {
    return NextResponse.json(
      { error: "服务端配置不完整，请到设置页保存一次" },
      { status: 400 },
    );
  }

  const result = await runHeartbeat({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    chatModel: config.chatModel,
  });

  return NextResponse.json({ ok: true, ...result });
}

async function handleReminder() {
  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .lte("remind_at", now);

  if (error) throw new Error(`查询提醒失败: ${error.message}`);
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const r of due) {
    const ok = await sendBarkNotification(
      r.bark_title || "⏰ 提醒",
      r.bark_message || r.content,
      { group: "nowhere-reminder", url: "https://nowhere-lyart.vercel.app/living-room" },
    );
    if (ok) {
      await supabase.from("reminders").update({ status: "sent" }).eq("id", r.id);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent, total: due.length });
}
