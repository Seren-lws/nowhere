import { supabase } from "@/lib/supabase";

async function getBarkConfig(): Promise<{ key: string; icon: string } | null> {
  const { data } = await supabase
    .from("server_config")
    .select("key, value")
    .in("key", ["barkKey", "barkIcon"]);

  if (!data || data.length === 0) return null;

  const map: Record<string, string> = {};
  for (const row of data) map[row.key] = row.value;

  if (!map.barkKey) return null;
  return { key: map.barkKey, icon: map.barkIcon || "🐘" };
}

export async function sendBarkNotification(
  title: string,
  body: string,
  options?: { group?: string; icon?: string; url?: string },
): Promise<boolean> {
  const config = await getBarkConfig();
  if (!config) return false;

  const params = new URLSearchParams();
  if (options?.group) params.set("group", options.group);
  params.set("icon", options?.icon || config.icon);
  if (options?.url) params.set("url", options.url);

  const qs = params.toString();
  const url = `https://api.day.app/${config.key}/${encodeURIComponent(title)}/${encodeURIComponent(body)}${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
