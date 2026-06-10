/**
 * 大脑层 · 数据导出 / 导入（"我的数据永远能带走"——对抗失去的地基）
 *
 * 打包本地所有 nowhere 数据（设置 + 聊天记录，以后还有记忆）成一个文件；
 * 导入能读回来，换设备 / 换部署 / 重装都能让他"记得"。
 */

const PREFIX = "nowhere:";
const SKIP = new Set(["nowhere:entering"]); // 转场临时标记，不导出

export interface ExportBundle {
  app: "nowhere";
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

/** 收集本地所有 nowhere 数据 */
export function buildExport(exportedAt: string): ExportBundle {
  const data: Record<string, unknown> = {};
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX) || SKIP.has(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (raw == null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return { app: "nowhere", version: 1, exportedAt, data };
}

/** 触发下载（文件名带时间戳） */
export function downloadExport(): void {
  if (typeof window === "undefined") return;
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const bundle = buildExport(now.toISOString());
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nowhere-备份-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从导出文件恢复（写回 localStorage）。返回恢复的条目数。 */
export function importBundle(parsed: unknown): { imported: number } {
  if (typeof window === "undefined") return { imported: 0 };
  const bundle = parsed as Partial<ExportBundle>;
  if (!bundle || bundle.app !== "nowhere" || typeof bundle.data !== "object") {
    throw new Error("这不是一个 nowhere 备份文件");
  }
  let imported = 0;
  for (const [key, value] of Object.entries(bundle.data!)) {
    if (!key.startsWith(PREFIX)) continue;
    window.localStorage.setItem(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    );
    imported++;
  }
  return { imported };
}
