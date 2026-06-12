import { supabase } from "@/lib/supabase";

async function getBarkKey(): Promise<string | null> {
  const { data } = await supabase
    .from("server_config")
    .select("value")
    .eq("key", "barkKey")
    .single();
  return data?.value || null;
}

export async function sendBarkNotification(
  title: string,
  body: string,
  options?: { group?: string; icon?: string; url?: string },
): Promise<boolean> {
  const key = await getBarkKey();
  if (!key) return false;

  const params = new URLSearchParams();
  if (options?.group) params.set("group", options.group);
  if (options?.icon) params.set("icon", options.icon);
  if (options?.url) params.set("url", options.url);

  const qs = params.toString();
  const url = `https://api.day.app/${key}/${encodeURIComponent(title)}/${encodeURIComponent(body)}${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
