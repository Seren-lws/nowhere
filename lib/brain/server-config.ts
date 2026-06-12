import { supabase } from "@/lib/supabase";

const SYNC_KEYS = ["baseUrl", "apiKey", "chatModel", "gardenerModel", "barkKey"] as const;

export type SyncKey = (typeof SYNC_KEYS)[number];

export async function syncSettingsToServer(
  settings: Record<string, string>,
): Promise<void> {
  const now = new Date().toISOString();
  const rows = SYNC_KEYS.filter((k) => settings[k] != null).map((k) => ({
    key: k,
    value: settings[k],
    updated_at: now,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("server_config").upsert(rows, {
    onConflict: "key",
  });

  if (error) throw new Error(`同步设置失败: ${error.message}`);
}

export async function loadServerConfig(): Promise<Record<SyncKey, string>> {
  const { data, error } = await supabase
    .from("server_config")
    .select("key, value")
    .in("key", [...SYNC_KEYS]);

  if (error) throw new Error(`读取服务端配置失败: ${error.message}`);

  const config = {} as Record<string, string>;
  for (const row of data ?? []) {
    config[row.key] = row.value;
  }
  return config as Record<SyncKey, string>;
}
