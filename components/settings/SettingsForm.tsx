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

const TTS_VOICES: { id: string; label: string }[] = [
  { id: "male-qn-qingse", label: "青涩青年（温柔）" },
  { id: "male-qn-jingying", label: "精英青年（沉稳）" },
  { id: "male-qn-badao", label: "霸道青年（低沉）" },
  { id: "male-qn-daxuesheng", label: "大学生（阳光）" },
  { id: "presenter_male", label: "男主持人（磁性）" },
  { id: "audiobook_male_1", label: "有声书男声（讲故事）" },
  { id: "audiobook_male_2", label: "有声书男声二（沉稳）" },
  { id: "female-shaonv", label: "少女（甜美）" },
  { id: "female-yujie", label: "御姐（成熟）" },
  { id: "presenter_female", label: "女主持人" },
  { id: "audiobook_female_1", label: "有声书女声" },
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
      <div className="mx-auto w-full max-w-md px-5 py-7">
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
              onClick={onSave}
              className="px-7 py-2.5 text-[13.5px] transition-all"
              style={{
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, var(--blush) 0%, var(--accent-wisteria) 100%)",
                color: "rgba(255,255,255,.95)",
                letterSpacing: "2px",
                boxShadow: "0 2px 10px rgba(196,160,170,.2)",
                cursor: "pointer",
              }}
            >
              {saved ? "已保存" : "保存"}
            </button>
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
            语音消息（ElevenLabs）
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
                在 elevenlabs.io 的 API Keys 页面获取
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

        {/* 语音设置（睡眠陪伴） */}
        <GlassCard>
          <h2
            className="mb-4 text-[13px]"
            style={{ color: "var(--text-faint)", letterSpacing: "2px" }}
          >
            语音 · 睡眠陪伴（MiniMax）
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span
                className="mb-1.5 block text-[13px]"
                style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
              >
                TTS 模型
              </span>
              <input
                type="text"
                value={s.ttsModel}
                onChange={(e) => update("ttsModel", e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
              />
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                MiniMax 语音模型，如 speech-2.8-turbo
              </span>
            </label>

            <label className="block">
              <span
                className="mb-1.5 block text-[13px]"
                style={{ color: "var(--text-mid)", letterSpacing: "1px" }}
              >
                音色
              </span>
              <select
                value={s.ttsVoice}
                onChange={(e) => update("ttsVoice", e.target.value)}
                className="w-full px-3.5 py-2.5 text-[13.5px] outline-none appearance-none cursor-pointer"
                style={inputStyle}
              >
                {TTS_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                他讲故事的声音
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
    </main>
  );
}
