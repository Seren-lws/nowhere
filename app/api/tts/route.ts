import { NextResponse } from "next/server";

interface TTSRequest {
  text: string;
  config: {
    elevenLabsKey: string;
    elevenLabsVoiceId: string;
  };
}

export async function POST(req: Request) {
  let body: TTSRequest;
  try {
    body = (await req.json()) as TTSRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const { text, config } = body;
  if (!config?.elevenLabsKey || !config?.elevenLabsVoiceId) {
    return NextResponse.json(
      { error: "还没配置好：请到设置里填 ElevenLabs API Key 和 Voice ID" },
      { status: 400 },
    );
  }
  if (!text?.trim()) {
    return NextResponse.json({ error: "没有文本内容" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": config.elevenLabsKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_v3",
          language_code: "zh",
          voice_settings: {
            stability: 0.34,
            similarity_boost: 0.75,
            style: 0.84,
            speed: 1.2,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `TTS 请求失败 (${res.status}): ${errText.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": audioBuffer.byteLength.toString(),
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
