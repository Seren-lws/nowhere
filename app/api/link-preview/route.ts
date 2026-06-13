import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "无效的 URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; NowhereBot/1.0; +https://nowhere.app)",
        accept: "text/html",
      },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { title: null, description: null, image: null, siteName: null },
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { title: null, description: null, image: null, siteName: null },
      );
    }

    const html = await res.text();
    const head = html.slice(0, 30000);

    const og = (name: string) => {
      const m = head.match(
        new RegExp(
          `<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`,
          "i",
        ),
      );
      if (m) return decodeEntities(m[1]);
      const m2 = head.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`,
          "i",
        ),
      );
      return m2 ? decodeEntities(m2[1]) : null;
    };

    const metaContent = (name: string) => {
      const m = head.match(
        new RegExp(
          `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
          "i",
        ),
      );
      if (m) return decodeEntities(m[1]);
      const m2 = head.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
          "i",
        ),
      );
      return m2 ? decodeEntities(m2[1]) : null;
    };

    const titleTag = head.match(/<title[^>]*>([^<]+)<\/title>/i);

    const title = og("title") || (titleTag ? decodeEntities(titleTag[1].trim()) : null);
    const description = og("description") || metaContent("description");
    const image = og("image");
    const siteName = og("site_name") || extractDomain(url);

    return NextResponse.json({ title, description, image, siteName });
  } catch {
    return NextResponse.json(
      { title: null, description: null, image: null, siteName: null },
    );
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
