"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { isChatReady, loadSettings, type BrainSettings } from "@/lib/brain/config";
import {
  buildMessages,
  DEFAULT_NAME,
  FIRST_GREETING,
  parseReply,
  type ChatMode,
} from "@/lib/brain/personality";
import {
  HISTORY_WINDOW,
  loadHistory,
  saveHistory,
  toContext,
  type ChatMessage,
} from "@/lib/brain/memory";
import { sendChat } from "@/lib/brain/client";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LivingRoom() {
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("sentences");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(loadSettings());
    const h = loadHistory();
    if (h.length === 0) {
      const greet: ChatMessage = { role: "assistant", content: FIRST_GREETING, ts: Date.now() };
      setMessages([greet]);
      saveHistory([greet]);
    } else {
      setMessages(h);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const ready = settings ? isChatReady(settings) : false;

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !settings) return;
    setError(null);

    const acc = [...messages, { role: "user", content: text, ts: Date.now() } as ChatMessage];
    setMessages(acc);
    saveHistory(acc);
    setInput("");
    setSending(true);

    const ctx = toContext(messages).slice(-HISTORY_WINDOW);

    try {
      const raw = await sendChat(buildMessages(ctx, text, mode), settings);
      const { inner, parts } = parseReply(raw, mode);
      setSending(false);

      let t = Date.now();
      if (inner) {
        await delay(220);
        acc.push({ role: "inner", content: inner, ts: t++ });
        setMessages([...acc]);
        saveHistory(acc);
      }
      for (const p of parts) {
        await delay(mode === "sentences" ? 620 : 280);
        acc.push({ role: "assistant", content: p, ts: t++ });
        setMessages([...acc]);
        saveHistory(acc);
      }
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="flex h-[100dvh] flex-col bg-[#f6f3ee] text-zinc-700">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-black/5 bg-white/45 px-5 py-3 backdrop-blur-md">
        <Link href="/floor-plan" className="text-sm text-zinc-400 hover:text-zinc-600">
          ‹ 回家
        </Link>
        <div className="flex flex-col items-center leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            <span className="text-[15px] font-medium tracking-tight text-zinc-700">
              {DEFAULT_NAME}
            </span>
          </div>
          <span className="max-w-[160px] truncate text-[10px] text-zinc-400">
            {settings?.chatModel || "在线"}
          </span>
        </div>
        <Link
          href="/settings"
          aria-label="设置"
          className="text-zinc-400 transition hover:rotate-45 hover:text-zinc-600"
        >
          <Gear />
        </Link>
      </header>

      {/* 消息区 */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-6">
        {messages.map((m) => (
          <Bubble key={m.ts} role={m.role} content={m.content} />
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
              <span className="inline-flex gap-1">
                <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
              </span>
            </div>
          </div>
        )}

        {!ready && (
          <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-zinc-500 backdrop-blur-sm">
            还没接上他的大脑～点右上角的
            <Link href="/settings" className="mx-1 text-violet-500 underline">
              ⚙ 设置
            </Link>
            填好中转站、API Key 和对话模型，他就能开口了。
          </div>
        )}
        {error && (
          <div className="rounded-2xl bg-rose-50/80 px-4 py-3 text-sm text-rose-500 backdrop-blur-sm">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 方式切换 */}
      <div className="flex justify-center pb-1.5">
        <div className="flex rounded-full bg-white/50 p-0.5 text-xs backdrop-blur-sm">
          <ModeTab active={mode === "sentences"} onClick={() => setMode("sentences")}>
            一句一句说
          </ModeTab>
          <ModeTab active={mode === "passage"} onClick={() => setMode("passage")}>
            写成一篇
          </ModeTab>
        </div>
      </div>

      {/* 输入栏 */}
      <div className="border-t border-black/5 bg-white/45 px-4 py-3 backdrop-blur-md">
        <div className="flex items-end gap-2">
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
            placeholder={ready ? `想对${DEFAULT_NAME}说点什么…` : "先去设置接上他的大脑"}
            disabled={!ready || sending}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-black/10 bg-white/80 px-4 py-2.5 text-[15px] outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200/50 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!ready || sending || !input.trim()}
            className="rounded-2xl bg-violet-300/80 px-5 py-2.5 text-sm font-medium text-violet-950 transition hover:bg-violet-300 disabled:opacity-40"
          >
            说
          </button>
        </div>
      </div>
    </main>
  );
}

function Bubble({ role, content }: { role: ChatMessage["role"]; content: string }) {
  if (role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-end"
      >
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-violet-200/80 to-violet-300/70 px-4 py-2.5 text-[15px] leading-relaxed text-violet-950">
          {content}
        </div>
      </motion.div>
    );
  }
  if (role === "inner") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex justify-start"
      >
        <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-zinc-200/40 px-4 py-2.5 backdrop-blur-sm">
          <span className="mb-0.5 block text-[11px] text-zinc-400">心声</span>
          <span className="whitespace-pre-wrap text-[14px] italic leading-relaxed text-zinc-400">
            {content}
          </span>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex justify-start"
    >
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/85 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-700 shadow-sm backdrop-blur-sm">
        {content}
      </div>
    </motion.div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 transition ${
        active ? "bg-white text-violet-700 shadow-sm" : "text-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

function Gear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
