import { NextResponse } from "next/server";
import { saveMemoryItem } from "@/lib/brain/db";

interface ChatRequest {
  messages: { role: string; content: string }[];
  config: { baseUrl: string; apiKey: string; model: string };
  tools?: unknown[];
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const { messages, config, tools } = body;
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
        if (tc.function.name === "save_memory") {
          let result = '{"ok":true}';
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
          } catch (e) {
            result = JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          currentMessages.push({
            role: "tool",
            content: result,
            tool_call_id: tc.id,
          } as unknown as { role: string; content: string });
        }
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
    return NextResponse.json({ content });
  }

  return NextResponse.json(
    { error: "工具调用轮次过多" },
    { status: 500 },
  );
}
