import { NextResponse } from "next/server";

interface TTSRequest {
  text: string;
  config: {
    baseUrl: string;
    apiKey: string;
    model: string;
    voice: string;
  };
  speed?: number;
}

export async function POST(req: Request) {
  let body: TTSRequest;
  try {
    body = (await req.json()) as TTSRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const { text, config, speed } = body;
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    return NextResponse.json(
      { error: "还没配置好：请到设置里填中转站、API Key 和 TTS 模型" },
      { status: 400 },
    );
  }
  if (!text?.trim()) {
    return NextResponse.json({ error: "没有文本内容" }, { status: 400 });
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl.replace(/\/v1$/, "")}/minimax/v1/t2a_v2`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        text: text.trim(),
        voice_setting: {
          voice_id: config.voice || "male-qn-qingse",
          speed: speed ?? 0.9,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          format: "mp3",
          sample_rate: 32000,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `TTS 请求失败 (${res.status}): ${errText.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
      return NextResponse.json(
        { error: `TTS 错误: ${data.base_resp.status_msg || "未知错误"}` },
        { status: 502 },
      );
    }

    const audioData = data.data?.audio;
    if (!audioData) {
      return NextResponse.json(
        { error: "TTS 没有返回音频数据" },
        { status: 502 },
      );
    }

    const audioBuffer = Buffer.from(audioData, "hex");
    return new Response(audioBuffer, {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": audioBuffer.length.toString(),
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `连不上 TTS 服务: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
