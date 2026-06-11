import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

function getClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase 环境变量未配置");
    }
    _client = createClient(url, key, { db: { schema: "nowhere" } });
  }
  return _client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as any, {
  get(_target, prop) {
    const client = getClient();
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
