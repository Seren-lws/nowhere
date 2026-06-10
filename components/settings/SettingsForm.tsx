"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type BrainSettings,
} from "@/lib/brain/config";
import { testConnection } from "@/lib/brain/client";
import { downloadExport, importBundle } from "@/lib/brain/export";

const FIELDS: {
  key: keyof BrainSettings;
  label: string;
  hint: string;
  password?: boolean;
}[] = [
  { key: "baseUrl", label: "中转站 URL", hint: "OpenAI 兼容地址，如 https://yunwu.ai/v1" },
  { key: "apiKey", label: "API Key", hint: "只存在你本机，只用于请你的中转站", password: true },
  { key: "chatModel", label: "对话模型", hint: "他的脸面，旗舰档（先填默认，随时换着试）" },
  { key: "gardenerModel", label: "园丁模型", hint: "后台苦力，便宜快速档（P1 记忆系统启用）" },
  { key: "embeddingModel", label: "向量检索模型", hint: "语义检索 embedding（P1 启用）" },
];

export function SettingsForm() {
  const [s, setS] = useState<BrainSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  const update = (key: keyof BrainSettings, v: string) => {
    setS((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  };

  const onSave = () => {
    saveSettings(s);
    setSaved(true);
    setNote(null);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const onTest = async () => {
    saveSettings(s); // 测试前先存，确保用的是当前值
    setTesting(true);
    setTestMsg(null);
    const r = await testConnection(s);
    setTesting(false);
    setTestMsg({ ok: r.ok, text: r.ok ? `通了：${r.message}` : r.message });
  };

  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const { imported } = importBundle(parsed);
      setS(loadSettings());
      setNote(`已导入 ${imported} 项数据。`);
    } catch (e) {
      setNote(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-md bg-[#f4f1ec] px-6 py-8 text-zinc-700">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">设置</h1>
        <Link
          href="/floor-plan"
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          回家
        </Link>
      </header>

      {/* 模型配置 */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-500">中转与模型</h2>
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm text-zinc-600">{f.label}</span>
            <div className="relative">
              <input
                type={f.password && !showKey ? "password" : "text"}
                value={s[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-xl border border-zinc-300/70 bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60"
              />
              {f.password && (
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400"
                >
                  {showKey ? "隐藏" : "显示"}
                </button>
              )}
            </div>
            <span className="mt-1 block text-xs text-zinc-400">{f.hint}</span>
          </label>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-violet-300/80 px-5 py-2.5 text-sm font-medium text-violet-950 transition hover:bg-violet-300"
          >
            {saved ? "已保存 ✓" : "保存"}
          </button>
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm text-zinc-600 transition hover:bg-white/60 disabled:opacity-50"
          >
            {testing ? "测试中…" : "测试连接"}
          </button>
        </div>
        {testMsg && (
          <p className={`text-sm ${testMsg.ok ? "text-emerald-600" : "text-rose-500"}`}>
            {testMsg.text}
          </p>
        )}
      </section>

      {/* 数据 */}
      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-medium text-zinc-500">我的数据</h2>
        <p className="text-xs text-zinc-400">
          所有数据都只存在你这台设备上。导出能把它带走、随时搬回来——他不会丢。
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={downloadExport}
            className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm text-zinc-600 transition hover:bg-white/60"
          >
            导出所有数据
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm text-zinc-600 transition hover:bg-white/60"
          >
            导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = "";
            }}
          />
        </div>
        {note && <p className="text-sm text-zinc-500">{note}</p>}
      </section>
    </main>
  );
}
