"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { isChatReady, loadSettings, type BrainSettings } from "@/lib/brain/config";
import {
  buildMessages,
  parseReply,
  SAVE_MEMORY_TOOL,
  SAVE_FAVORITE_TOOL,
  type ChatMode,
} from "@/lib/brain/personality";
import { getHistoryWindow, toContext } from "@/lib/brain/memory";
import { sendChat } from "@/lib/brain/client";
import { saveChatMessage, loadChatMessages, clearChatMessages } from "@/lib/brain/db";
import type { LLMMessage } from "@/lib/brain/personality";

/* ─── Types ─── */

interface SleepMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  ts: number;
}

const SLEEP_KEY = "nowhere:chat:sleep";
const SLEEP_SYSTEM = `【场景】
你现在在卧室里，灯已经关了，她躺在你身边，想让你哄她睡觉。
你的任务是用温柔的声音给她讲睡前故事、轻声聊天、或者安抚她入睡。

讲故事的要求：
- 故事要温暖、舒缓、有画面感
- 语气像在耳边轻声说话，不要太激动
- 每段不要太长（100-200字），让她能慢慢听
- 可以在故事中间自然地问"还想听吗"或"困了吗"
- 如果她说困了/想睡了，温柔地道晚安

你说的每一句话都会被转成语音读给她听，所以：
- 不要用括号、星号等标记动作
- 不要用emoji
- 写口语化的、适合朗读的文字
- 标点符号要自然，给语音留好停顿`;

let msgId = 0;
const nextId = () => `sleep-${Date.now()}-${++msgId}`;

/* ─── Component ─── */

export function SleepCompanion() {
  const router = useRouter();
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [messages, setMessages] = useState<SleepMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favToast, setFavToast] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);

    (async () => {
      let saved: SleepMessage[] = [];
      try {
        const rows = await loadChatMessages("bedroom-sleep", 200);
        saved = rows.map((r) => ({
          id: r.id,
          role: r.role as "user" | "assistant",
          content: r.content,
          ts: new Date(r.created_at).getTime(),
        }));
      } catch {}
      if (saved.length === 0) saved = loadSleepHistory();

      if (saved.length === 0) {
        const greet: SleepMessage = {
          id: nextId(),
          role: "assistant",
          content: "来了？……灯关好了。躺过来，今晚想听什么？故事、还是就想听我说说话？",
          ts: Date.now(),
        };
        setMessages([greet]);
        saveSleepHistory([greet]);
        saveChatMessage("assistant", greet.content, "bedroom-sleep").catch(() => {});
        if (isChatReady(s)) ttsForMessage(greet, s);
      } else {
        setMessages(saved);
        saveSleepHistory(saved);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /* ─── Persistence ─── */

  function loadSleepHistory(): SleepMessage[] {
    try {
      const raw = localStorage.getItem(SLEEP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveSleepHistory(msgs: SleepMessage[]) {
    localStorage.setItem(SLEEP_KEY, JSON.stringify(msgs));
  }

  /* ─── TTS ─── */

  async function ttsForMessage(msg: SleepMessage, s: BrainSettings) {
    if (!s.elevenLabsKey || !s.elevenLabsVoiceId || msg.audioUrl) return;
    setTtsLoading(msg.id);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: msg.content,
          config: {
            elevenLabsKey: s.elevenLabsKey,
            elevenLabsVoiceId: s.elevenLabsVoiceId,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `TTS 失败 (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setMessages((prev) => {
        const next = prev.map((m) => m.id === msg.id ? { ...m, audioUrl: url } : m);
        saveSleepHistory(next);
        return next;
      });

      playAudio(url, msg.id);
    } catch (e) {
      setError(`语音生成失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTtsLoading(null);
    }
  }

  function playAudio(url: string, id: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlaying(id);
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    audio.play().catch(() => setPlaying(null));
  }

  function togglePlay(msg: SleepMessage) {
    if (playing === msg.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (msg.audioUrl) {
      playAudio(msg.audioUrl, msg.id);
    } else if (settings) {
      ttsForMessage(msg, settings);
    }
  }

  /* ─── Chat ─── */

  async function requestReply(base: SleepMessage[]) {
    if (!settings) return;
    setSending(true);
    setError(null);
    try {
      const ctx: LLMMessage[] = base
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-getHistoryWindow())
        .map((m) => ({ role: m.role, content: m.content }));

      const userText = ctx[ctx.length - 1].content;
      const history = ctx.slice(0, -1);

      const assembled = await buildMessages(history, userText, "passage" as ChatMode);
      assembled[0] = {
        role: "system",
        content: assembled[0].content + "\n\n" + SLEEP_SYSTEM,
      };

      const resp = await sendChat(assembled, settings, [SAVE_MEMORY_TOOL, SAVE_FAVORITE_TOOL]);
      const { parts } = parseReply(resp.content, "passage");
      const text = parts.join("\n");

      const asstMsg: SleepMessage = {
        id: nextId(),
        role: "assistant",
        content: text,
        ts: Date.now(),
      };

      const next = [...base, asstMsg];
      setMessages(next);
      saveSleepHistory(next);
      setSending(false);
      saveChatMessage("assistant", text, "bedroom-sleep").catch(() => {});

      ttsForMessage(asstMsg, settings);
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || !settings) return;
    const userMsg: SleepMessage = { id: nextId(), role: "user", content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    saveSleepHistory(next);
    setInput("");
    saveChatMessage("user", text, "bedroom-sleep").catch(() => {});
    await requestReply(next);
  }

  /* ─── Favorite ─── */

  async function favoriteMessage(msg: SleepMessage) {
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          content: msg.content,
          owner: "user",
          metadata: {
            room: "bedroom-sleep",
            has_audio: !!msg.audioUrl,
          },
        }),
      });
      setFavToast(true);
      setTimeout(() => setFavToast(false), 1500);
    } catch {}
  }

  const ready = settings ? isChatReady(settings) : false;
  const ttsReady = settings ? Boolean(settings.elevenLabsKey && settings.elevenLabsVoiceId) : false;

  return (
    <div className="fixed inset-0" style={{ background: "#0d0b1a" }}>
      {/* Background */}
      <SleepBg />

      {/* Header */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-5 h-14"
        style={{
          background: "rgba(13,11,26,0.6)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.06)" }}
          onClick={() => router.push("/bedroom")}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            arrow_back_ios
          </span>
        </button>

        <div className="flex flex-col items-center">
          <span
            className="text-[20px]"
            style={{ fontFamily: "'Pinyon Script', cursive", color: "rgba(255,255,255,0.7)" }}
          >
            Lullaby
          </span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            {ttsReady ? "语音已就绪" : "未配置语音"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: "rgba(255,255,255,0.06)" }}
            onClick={() => router.push("/settings")}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              settings
            </span>
          </button>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: "rgba(255,255,255,0.06)" }}
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              setPlaying(null);
              const greet: SleepMessage = {
                id: nextId(),
                role: "assistant",
                content: "来了？……灯关好了。躺过来，今晚想听什么？故事、还是就想听我说说话？",
                ts: Date.now(),
              };
              setMessages([greet]);
              saveSleepHistory([greet]);
              clearChatMessages("bedroom-sleep").then(() =>
                saveChatMessage("assistant", greet.content, "bedroom-sleep").catch(() => {})
              ).catch(() => {});
              if (settings && isChatReady(settings)) ttsForMessage(greet, settings);
            }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              refresh
            </span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <main
        ref={scrollRef}
        className="h-full overflow-y-auto pt-18 pb-36 px-5 max-w-[600px] mx-auto"
      >
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <VoiceBubble
              key={m.id}
              msg={m}
              playing={playing === m.id}
              loading={ttsLoading === m.id}
              onTogglePlay={() => togglePlay(m)}
              onFavorite={m.role === "assistant" ? () => favoriteMessage(m) : undefined}
            />
          ))}

          {sending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-2 px-1"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: "rgba(160,140,200,0.5)" }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <span className="text-[12px] italic" style={{ color: "rgba(255,255,255,0.3)" }}>
                他在想怎么说...
              </span>
            </motion.div>
          )}

          {!ready && (
            <div
              className="rounded-xl p-4 text-[13px] text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              还没接上他的大脑～去设置里填好中转站和 API Key
            </div>
          )}

          {error && (
            <div
              className="rounded-xl p-3 text-[12px]"
              style={{ background: "rgba(180,80,80,0.1)", border: "1px solid rgba(180,80,80,0.2)", color: "#cc8888" }}
            >
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Favorite Toast */}
      <AnimatePresence>
        {favToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-36 z-50 px-5 py-2.5 rounded-full"
            style={{
              background: "rgba(160,140,200,0.9)",
              backdropFilter: "blur(12px)",
              color: "white",
              fontSize: "13px",
            }}
          >
            已收藏
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div
        className="fixed bottom-0 left-0 w-full z-50 px-5 pt-3 pb-8 flex items-center gap-3"
        style={{
          background: "rgba(13,11,26,0.8)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="flex-1 relative rounded-full overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={ready ? "轻声说点什么…" : "先去设置接上大脑"}
            disabled={!ready || sending}
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none px-5 py-3 text-[15px] resize-none disabled:opacity-40"
            style={{
              color: "rgba(255,255,255,0.85)",
              maxHeight: "80px",
              lineHeight: "22px",
            }}
          />
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!ready || sending || !input.trim()}
          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full active:scale-95 transition-transform disabled:opacity-30"
          style={{
            background: "linear-gradient(135deg, rgba(120,100,180,0.6), rgba(160,140,200,0.4))",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ color: "rgba(255,255,255,0.8)" }}>
            send
          </span>
        </button>
      </div>
    </div>
  );
}

/* ─── Voice Bubble ─── */

function VoiceBubble({
  msg,
  playing,
  loading,
  onTogglePlay,
  onFavorite,
}: {
  msg: SleepMessage;
  playing: boolean;
  loading: boolean;
  onTogglePlay: () => void;
  onFavorite?: () => void;
}) {
  const [showFav, setShowFav] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex justify-end"
      >
        <div
          className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 text-[14px] whitespace-pre-wrap"
          style={{
            background: "rgba(120,100,180,0.25)",
            border: "1px solid rgba(120,100,180,0.2)",
            color: "rgba(255,255,255,0.85)",
            lineHeight: "22px",
          }}
        >
          {msg.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-start gap-2"
    >
      <div
        className="max-w-[90%] rounded-2xl rounded-bl-md overflow-hidden select-none"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onPointerDown={() => {
          if (!onFavorite) return;
          longPressRef.current = setTimeout(() => setShowFav(true), 500);
        }}
        onPointerUp={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
        onPointerLeave={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
        onContextMenu={(e) => { if (onFavorite) { e.preventDefault(); setShowFav(true); } }}
      >
        {/* Text */}
        <div
          className="px-4 pt-3 pb-2 text-[14.5px] whitespace-pre-wrap"
          style={{ color: "rgba(255,255,255,0.8)", lineHeight: "24px" }}
        >
          {msg.content}
        </div>

        {/* Audio control bar */}
        <div
          className="px-4 pb-3 pt-1 flex items-center gap-3"
        >
          <button
            onClick={onTogglePlay}
            disabled={loading}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all disabled:opacity-40"
            style={{
              background: playing
                ? "linear-gradient(135deg, rgba(160,140,200,0.5), rgba(120,100,180,0.4))"
                : "rgba(255,255,255,0.08)",
              border: `1px solid ${playing ? "rgba(160,140,200,0.4)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            {loading ? (
              <motion.span
                className="material-symbols-outlined text-[18px]"
                style={{ color: "rgba(255,255,255,0.5)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                progress_activity
              </motion.span>
            ) : (
              <span
                className="material-symbols-outlined text-[18px]"
                style={{
                  color: playing ? "rgba(200,180,255,0.9)" : "rgba(255,255,255,0.5)",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                {playing ? "pause" : "play_arrow"}
              </span>
            )}
          </button>

          {/* Waveform animation */}
          <div className="flex-1 flex items-center gap-[3px] h-6">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-full"
                style={{
                  background: playing
                    ? "rgba(160,140,200,0.6)"
                    : msg.audioUrl
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.06)",
                  minWidth: 2,
                }}
                animate={playing ? {
                  height: [4, 8 + Math.random() * 14, 4],
                } : {
                  height: msg.audioUrl ? 3 + Math.sin(i * 0.8) * 3 : 2,
                }}
                transition={playing ? {
                  duration: 0.4 + Math.random() * 0.3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  delay: i * 0.03,
                } : { duration: 0.3 }}
              />
            ))}
          </div>

          <span
            className="text-[11px] shrink-0"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {loading ? "生成中" : msg.audioUrl ? (playing ? "播放中" : "点击播放") : "无音频"}
          </span>
        </div>
      </div>

      {/* Favorite menu */}
      <AnimatePresence>
        {showFav && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <button
              onClick={() => { setShowFav(false); onFavorite?.(); }}
              className="px-3 py-1.5 text-[12px] rounded-lg active:scale-95 transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(200,180,255,0.8)",
              }}
            >
              收藏这段
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Background ─── */

function SleepBg() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Deep night gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, #1a1535 0%, #0d0b1a 60%, #080615 100%)",
        }}
      />

      {/* Soft floating orbs */}
      <div
        className="absolute"
        style={{
          width: "60vw", height: "60vw", maxWidth: 400, maxHeight: 400,
          top: "10%", left: "20%",
          background: "radial-gradient(circle, rgba(100,80,160,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "sleep-drift-1 20s infinite ease-in-out",
        }}
      />
      <div
        className="absolute"
        style={{
          width: "50vw", height: "50vw", maxWidth: 350, maxHeight: 350,
          bottom: "20%", right: "10%",
          background: "radial-gradient(circle, rgba(80,60,140,0.1) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "sleep-drift-2 25s infinite ease-in-out",
        }}
      />
      <div
        className="absolute"
        style={{
          width: "40vw", height: "40vw", maxWidth: 280, maxHeight: 280,
          top: "50%", left: "40%",
          background: "radial-gradient(circle, rgba(140,120,200,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "sleep-drift-3 18s infinite ease-in-out",
        }}
      />

      {/* Stars */}
      {Array.from({ length: 30 }).map((_, i) => {
        const seed = i * 137.508;
        const x = ((seed * 7.3) % 100);
        const y = ((seed * 3.7) % 100);
        const size = 1 + (seed % 2);
        const dur = 3 + (seed % 5);
        const del = (seed % 4);
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size, height: size,
              left: `${x}%`, top: `${y}%`,
              background: "rgba(200,190,255,0.4)",
              animation: `twinkle ${dur}s ${del}s infinite ease-in-out`,
            }}
          />
        );
      })}

      <style jsx global>{`
        @keyframes sleep-drift-1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(20px, -15px); }
          66% { transform: translate(-10px, 10px); }
        }
        @keyframes sleep-drift-2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-15px, -20px); }
        }
        @keyframes sleep-drift-3 {
          0%, 100% { transform: translate(0, 0); }
          40% { transform: translate(15px, 10px); }
          80% { transform: translate(-20px, -5px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
