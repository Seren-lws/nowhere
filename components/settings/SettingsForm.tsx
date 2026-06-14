"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type BrainSettings,
} from "@/lib/brain/config";
import { testConnection } from "@/lib/brain/client";
import { downloadExport, importBundle } from "@/lib/brain/export";
import { syncSettingsToServer } from "@/lib/brain/server-config";

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

/** 旧家同款玻璃卡片 */
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="mb-4 rounded-2xl p-5"
      style={{
        background: "var(--card-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {children}
    </section>
  );
}

export function SettingsForm() {
  const router = useRouter();
  const [s, setS] = useState<BrainSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  const update = (key: keyof BrainSettings, v: string) => {
    setS((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  };

  const onSave = async () => {
    saveSettings(s);
    setSaved(true);
    setNote(null);
    try {
      await syncSettingsToServer(s as unknown as Record<string, string>);
    } catch {
      setNote("本地已保存，但同步到服务端失败（定时任务可能无法运行）");
    }
    window.setTimeout(() => setSaved(false), 2000);
  };

  const onTest = async () => {
    saveSettings(s);
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

  const inputStyle: React.CSSProperties = {
    borderRadius: 11,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-deep)",
    fontFamily: "inherit",
    transition: "all .25s",
  };

  return (
    <main
      className="min-h-[100dvh] w-full"
      style={{ background: "var(--bg-gradient)", color: "var(--text-deep)" }}
    >
      <div className="mx-auto w-full max-w-md px-5 py-7 pb-24">
        <header className="mb-5 flex items-center justify-between px-1">
          <h1
            className="text-[19px] font-medium"
            style={{ letterSpacing: "3px", color: "var(--text-deep)" }}
          >
            设 置
          </h1>
          <button
            onClick={() => router.back()}
            className="text-[13px] transition-opacity hover:opacity-70"
            style={{ color: "var(--accent-dusk)", letterSpacing: "1px", background: "none", border: "none", cursor: "pointer" }}
          >
            ‹ 返回
          </button>
        </header>

        {/* 中转与模型 */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            中转与模型
          </h2>
          <div className="space-y-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span
                  className="mb-1.5 block text-[13px]"
                  style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
                >
                  {f.label}
                </span>
                <div className="relative">
                  <input
                    type={f.password && !showKey ? "password" : "text"}
                    value={s[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
                  />
                  {f.password && (
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]"
                      style={{ color: "var(--text-faint)", letterSpacing: "1px" }}
                    >
                      {showKey ? "隐藏" : "显示"}
                    </button>
                  )}
                </div>
                <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                  {f.hint}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onTest}
              disabled={testing}
              className="px-5 py-2.5 text-[13px] transition-all disabled:opacity-50"
              style={{
                borderRadius: 12,
                border: "1px solid rgba(205,193,217,.4)",
                background: "transparent",
                color: "var(--text-mid)",
                letterSpacing: "1px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {testing ? "测试中…" : "测试连接"}
            </button>
          </div>
          {testMsg && (
            <p
              className="mt-3 text-[13px]"
              style={{ color: testMsg.ok ? "#6b8f7a" : "#b07070" }}
            >
              {testMsg.text}
            </p>
          )}
        </GlassCard>

        {/* 语音消息（ElevenLabs） */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            语音（ElevenLabs）
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span
                className="mb-1.5 block text-[13px]"
                style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
              >
                API Key
              </span>
              <input
                type="password"
                value={s.elevenLabsKey}
                onChange={(e) => update("elevenLabsKey", e.target.value)}
                placeholder="sk_xxxxxxxx"
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
              />
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                elevenlabs.io → API Keys，语音消息和睡眠陪伴都用这个
              </span>
            </label>
            <label className="block">
              <span
                className="mb-1.5 block text-[13px]"
                style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
              >
                Voice ID（音色）
              </span>
              <input
                type="text"
                value={s.elevenLabsVoiceId}
                onChange={(e) => update("elevenLabsVoiceId", e.target.value)}
                placeholder="pU6Nb7V1jj4swj5j28sM"
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
              />
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                你选的音色 ID，在 ElevenLabs 音色库里复制
              </span>
            </label>
          </div>
        </GlassCard>

        {/* 推送通知 */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            推送通知（Bark）
          </h2>
          <label className="block">
            <span
              className="mb-1.5 block text-[13px]"
              style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
            >
              Bark Device Key
            </span>
            <input
              type="text"
              value={s.barkKey}
              onChange={(e) => update("barkKey", e.target.value)}
              placeholder="打开 Bark App 复制 Key"
              spellCheck={false}
              autoComplete="off"
              className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
            />
            <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              用于园丁巡逻、心跳消息、定时提醒等推送到 iPhone
            </span>
          </label>
          <label className="mt-4 block">
            <span
              className="mb-1.5 block text-[13px]"
              style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
            >
              推送头像
            </span>
            <input
              type="text"
              value={s.barkIcon}
              onChange={(e) => update("barkIcon", e.target.value)}
              placeholder="🐘"
              spellCheck={false}
              autoComplete="off"
              className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
            />
            <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              填 emoji 或图片 URL，显示在推送通知上
            </span>
          </label>
        </GlassCard>

        {/* 联网搜索 */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            联网搜索（Tavily）
          </h2>
          <label className="block">
            <span
              className="mb-1.5 block text-[13px]"
              style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
            >
              Tavily API Key
            </span>
            <input
              type="text"
              value={s.tavilyKey}
              onChange={(e) => update("tavilyKey", e.target.value)}
              placeholder="tvly-xxxxxxxx"
              spellCheck={false}
              autoComplete="off"
              className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
            />
            <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              去 tavily.com 注册即可免费获取，每月 1000 次搜索
            </span>
          </label>
        </GlassCard>

        {/* 对话设置 */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            对话设置
          </h2>
          <label className="block">
            <span
              className="mb-1.5 block text-[13px]"
              style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
            >
              上下文条数
            </span>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {[10, 20, 30, 50, 80].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setS((prev) => ({ ...prev, historyWindow: n })); setSaved(false); }}
                  className="px-4 py-2 text-[13px] transition-all active:scale-95"
                  style={{
                    borderRadius: 12,
                    border: s.historyWindow === n
                      ? "1.5px solid var(--accent-wisteria)"
                      : "1px solid var(--input-border)",
                    background: s.historyWindow === n
                      ? "rgba(205,193,217,0.15)"
                      : "var(--input-bg)",
                    color: s.historyWindow === n
                      ? "var(--accent-wisteria)"
                      : "var(--text-mid)",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    fontWeight: s.historyWindow === n ? 600 : 400,
                  }}
                >
                  {n} 条
                </button>
              ))}
            </div>
            <span className="mt-2 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              每次对话时带多少条历史消息给他。越多越了解上下文，但更费 token
            </span>
          </label>
        </GlassCard>

        {/* 记忆向量 */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            记忆向量
          </h2>
          <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
            向量搜索让他能理解语义而不只是匹配关键词。新记忆会自动生成向量，旧记忆需要手动补齐。
          </p>
          <button
            type="button"
            disabled={backfilling}
            onClick={async () => {
              setBackfilling(true);
              setBackfillMsg(null);
              try {
                const res = await fetch("/api/embedding/backfill", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    baseUrl: s.baseUrl,
                    apiKey: s.apiKey,
                    model: s.embeddingModel,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setBackfillMsg(`失败：${data.error}`);
                } else if (data.remaining > 0) {
                  setBackfillMsg(`本轮补齐 ${data.updated} 条，还剩 ${data.remaining} 条未处理，可再点一次`);
                } else {
                  setBackfillMsg(`完成！补齐了 ${data.updated} 条，全部记忆已有向量`);
                }
              } catch (e) {
                setBackfillMsg(`出错了：${e instanceof Error ? e.message : String(e)}`);
              }
              setBackfilling(false);
            }}
            className="px-5 py-2.5 text-[13px] transition-all disabled:opacity-50"
            style={{
              borderRadius: 12,
              border: "1px solid rgba(205,193,217,.4)",
              background: "transparent",
              color: "var(--text-mid)",
              letterSpacing: "1px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {backfilling ? "补齐中…" : "补齐旧记忆向量"}
          </button>
          {backfillMsg && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--text-mid)" }}>
              {backfillMsg}
            </p>
          )}
        </GlassCard>

        {/* 我的数据 */}
        <GlassCard>
          <h2
            className="mb-2 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            我的数据
          </h2>
          <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
            所有数据都只存在你这台设备上。导出能把它带走、随时搬回来——他不会丢。
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={downloadExport}
              className="px-5 py-2.5 text-[13px] transition-all"
              style={{
                borderRadius: 12,
                border: "1px solid rgba(205,193,217,.4)",
                background: "transparent",
                color: "var(--text-mid)",
                letterSpacing: "1px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              导出所有数据
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-5 py-2.5 text-[13px] transition-all"
              style={{
                borderRadius: 12,
                border: "1px solid rgba(205,193,217,.4)",
                background: "transparent",
                color: "var(--text-mid)",
                letterSpacing: "1px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
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
          {note && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--text-mid)" }}>
              {note}
            </p>
          )}
        </GlassCard>
      </div>

      {/* 固定底部保存按钮 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center py-4 px-5"
        style={{
          background: "linear-gradient(to top, rgba(252,247,242,0.95) 60%, rgba(252,247,242,0) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <button
          type="button"
          onClick={onSave}
          className="w-full max-w-md px-7 py-3 text-[14px] transition-all active:scale-[0.97]"
          style={{
            borderRadius: 16,
            border: "none",
            background: "linear-gradient(135deg, var(--blush) 0%, var(--accent-wisteria) 100%)",
            color: "rgba(255,255,255,.95)",
            letterSpacing: "2.5px",
            boxShadow: "0 4px 20px rgba(196,160,170,.3)",
            cursor: "pointer",
          }}
        >
          {saved ? "已保存 ✓" : "保存所有设置"}
        </button>
      </div>
    </main>
  );
}
