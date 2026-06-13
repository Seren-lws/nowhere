import { NextResponse } from "next/server";
import { saveMemoryItem } from "@/lib/brain/db";
import { createDiary, getLastChatTime } from "@/lib/brain/diary";
import { addFavorite } from "@/lib/brain/favorites";
import { supabase } from "@/lib/supabase";

interface SavedMemory {
  content: string;
  type: string;
  tags?: string[];
  is_anchor?: boolean;
}

interface SavedFavorite {
  content: string;
  source: string;
}

interface ChatRequest {
  messages: { role: string; content: string }[];
  config: { baseUrl: string; apiKey: string; model: string; tavilyKey?: string };
  tools?: unknown[];
  room?: string;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const { messages, config, tools, room: chatRoom } = body;
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return NextResponse.json(
      { error: "还没配置好：请到设置里填中转站、API Key 和对话模型" },
      { status: 400 },
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "没有消息内容" }, { status: 400 });
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let currentMessages = [...messages];
  const maxToolRounds = 5;
  const savedMemories: SavedMemory[] = [];
  const savedFavorites: SavedFavorite[] = [];
  let bedroomInvite: string | null = null;
  let searchQuery: string | null = null;
  let diaryWritten = false;
  let timelineEvent: string | null = null;
  let reminderSet: string | null = null;
  let personalityRequest = false;

  for (let round = 0; round < maxToolRounds; round++) {
    const reqBody: Record<string, unknown> = {
      model: config.model,
      messages: currentMessages,
      temperature: 0.9,
    };
    if (tools && tools.length > 0) {
      reqBody.tools = tools;
      reqBody.tool_choice = "auto";
    }

    let upstream: Response;
    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(reqBody),
      });
    } catch (e) {
      return NextResponse.json(
        {
          error: `连不上中转站：${e instanceof Error ? e.message : String(e)}`,
        },
        { status: 502 },
      );
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `中转站返回 ${upstream.status}：${text.slice(0, 300)}` },
        { status: 502 },
      );
    }

    let data: {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: {
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }[];
          role?: string;
        };
        finish_reason?: string;
      }[];
    };
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "中转站返回了无法解析的数据" },
        { status: 502 },
      );
    }

    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      return NextResponse.json(
        { error: "中转站没有返回内容" },
        { status: 502 },
      );
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      currentMessages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
      } as unknown as { role: string; content: string });

      for (const tc of msg.tool_calls) {
        let result = '{"ok":true}';

        if (tc.function.name === "save_memory") {
          try {
            const args = JSON.parse(tc.function.arguments);
            await saveMemoryItem({
              content: args.content,
              type: args.type,
              valence: args.valence,
              arousal: args.arousal,
              tags: args.tags,
              is_anchor: args.is_anchor,
            });
            savedMemories.push({
              content: args.content,
              type: args.type,
              tags: args.tags,
              is_anchor: args.is_anchor,
            });
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else if (tc.function.name === "save_favorite") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const now = new Date();
            const tokyoDate = now.toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
            await addFavorite({
              source: args.source ?? "chat",
              content: args.content,
              owner: "companion",
              metadata: { date: tokyoDate, room: chatRoom || "living-room" },
            });
            savedFavorites.push({
              content: args.content,
              source: args.source ?? "chat",
            });
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else if (tc.function.name === "write_diary") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const lastChat = await getLastChatTime();
            const coverFrom = lastChat
              ? new Date(lastChat.getTime() - 2 * 60 * 60 * 1000).toISOString()
              : undefined;
            await createDiary({
              author: "companion",
              content: args.content,
              cover_from: coverFrom,
              cover_to: new Date().toISOString(),
            });
            diaryWritten = true;
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else if (tc.function.name === "save_timeline_event") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const { error: tlError } = await supabase
              .from("timeline_events")
              .insert({
                title: args.title,
                content: args.content ?? null,
                event_date: args.event_date,
                icon: args.icon ?? "favorite",
                source: "ai",
              });
            if (tlError) throw tlError;
            timelineEvent = args.title;
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else if (tc.function.name === "web_search") {
          try {
            const args = JSON.parse(tc.function.arguments);
            searchQuery = args.query;
            if (!config.tavilyKey) {
              result = JSON.stringify({ ok: false, error: "未配置 Tavily API Key，请到设置页填写" });
            } else {
              const searchRes = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  api_key: config.tavilyKey,
                  query: args.query,
                  max_results: 5,
                  include_answer: true,
                }),
              });
              if (!searchRes.ok) {
                result = JSON.stringify({ ok: false, error: `搜索失败 (${searchRes.status})` });
              } else {
                const searchData = await searchRes.json();
                const snippets = (searchData.results || [])
                  .map((r: { title: string; content: string; url: string }) =>
                    `【${r.title}】${r.content}`
                  )
                  .join("\n\n");
                result = JSON.stringify({
                  ok: true,
                  answer: searchData.answer || "",
                  results: snippets,
                });
              }
            }
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else if (tc.function.name === "set_reminder") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const { error: remErr } = await supabase
              .from("reminders")
              .insert({
                content: args.content,
                remind_at: args.remind_at,
                bark_message: args.bark_message,
              });
            if (remErr) throw remErr;
            reminderSet = args.content;
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else if (tc.function.name === "invite_bedroom") {
          try {
            const args = JSON.parse(tc.function.arguments);
            bedroomInvite = args.message || "过来。";
          } catch {}
        } else if (tc.function.name === "request_personality_change") {
          try {
            const args = JSON.parse(tc.function.arguments);
            const { data: current } = await supabase
              .from("personality_layers")
              .select("content")
              .eq("layer", args.layer)
              .eq("field_key", args.field_key)
              .single();

            await supabase.from("personality_change_requests").insert({
              layer: args.layer,
              field_key: args.field_key,
              old_content: current?.content ?? "",
              new_content: args.new_content,
              reason: args.reason,
            });
            personalityRequest = true;
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        currentMessages.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        } as unknown as { role: string; content: string });
      }
      continue;
    }

    const content = msg.content;
    if (!content) {
      return NextResponse.json(
        { error: "中转站没有返回内容" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      content,
      ...(savedMemories.length > 0 ? { savedMemories } : {}),
      ...(savedFavorites.length > 0 ? { savedFavorites } : {}),
      ...(bedroomInvite ? { bedroomInvite } : {}),
      ...(searchQuery ? { searchQuery } : {}),
      ...(diaryWritten ? { diaryWritten } : {}),
      ...(timelineEvent ? { timelineEvent } : {}),
      ...(reminderSet ? { reminderSet } : {}),
      ...(personalityRequest ? { personalityRequest } : {}),
    });
  }

  return NextResponse.json(
    { error: "工具调用轮次过多" },
    { status: 500 },
  );
}
