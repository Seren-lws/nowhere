import { NextResponse } from "next/server";

/**
 * 对话代理：客户端把消息 + 配置（中转站/key/模型）发来，这里转一手去
 * OpenAI-compatible 中转站（yunwu.ai）。key 只在本机内存里过一下，不存储、不记录。
 */

interface ChatRequest {
  messages: { role: string; content: string }[];
  config: { baseUrl: string; apiKey: string; model: string };
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const { messages, config } = body;
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

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.9,
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      // 把中转站的报错透传出去（截断，避免过长），方便排查
      return NextResponse.json(
        { error: `中转站返回 ${upstream.status}：${text.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const data = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "中转站没有返回内容" },
        { status: 502 },
      );
    }
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json(
      { error: `连不上中转站：${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
