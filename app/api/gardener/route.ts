import { NextResponse } from "next/server";
import { runPatrol } from "@/lib/brain/gardener";

interface GardenerRequest {
  config: {
    baseUrl: string;
    apiKey: string;
    gardenerModel: string;
  };
}

export async function POST(req: Request) {
  let body: GardenerRequest;
  try {
    body = (await req.json()) as GardenerRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const { config } = body;
  if (!config?.baseUrl || !config?.apiKey || !config?.gardenerModel) {
    return NextResponse.json(
      { error: "还没配置好：请到设置里填中转站、API Key 和园丁模型" },
      { status: 400 },
    );
  }

  try {
    const result = await runPatrol(config);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
