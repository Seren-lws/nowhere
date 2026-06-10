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
  /** 被点选的我方消息（弹出编辑/重试操作条） */
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
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

  /** 向模型要回复：base 以一条我方消息收尾，回复逐条落进 base 的副本 */
  const requestReply = async (base: ChatMessage[]) => {
    if (!settings) return;
    const last = base[base.length - 1];
    const ctx = toContext(base.slice(0, -1)).slice(-HISTORY_WINDOW);
    setSending(true);
    setError(null);
    try {
      const raw = await sendChat(buildMessages(ctx, last.content, mode), settings);
      const { inner, parts } = parseReply(raw, mode);
      setSending(false);

      const acc = [...base];
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

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !settings) return;
    setSelectedTs(null);
    const acc = [...messages, { role: "user", content: text, ts: Date.now() } as ChatMessage];
    setMessages(acc);
    saveHistory(acc);
    setInput("");
    await requestReply(acc);
  };

  /** 编辑重发：删掉这条及之后的一切，原文填回输入框 */
  const editResend = (ts: number) => {
    const idx = messages.findIndex((m) => m.ts === ts);
    if (idx < 0) return;
    const target = messages[idx];
    const truncated = messages.slice(0, idx);
    setMessages(truncated);
    saveHistory(truncated);
    setInput(target.content);
    setSelectedTs(null);
  };

  /** 重新回复：保留这条，删掉之后他的所有话，重新请一遍（换模型测试用） */
  const retryFrom = async (ts: number) => {
    const idx = messages.findIndex((m) => m.ts === ts);
    if (idx < 0) return;
    const truncated = messages.slice(0, idx + 1);
    setMessages(truncated);
    saveHistory(truncated);
    setSelectedTs(null);
    await requestReply(truncated);
  };

  /** 清空当前聊天（回到初见的招呼） */
  const clearChat = () => {
    if (!window.confirm("把这间客厅的聊天清空吗？清空后他会回到初见时的样子（设置和其他数据不受影响）。")) return;
    const greet: ChatMessage = { role: "assistant", content: FIRST_GREETING, ts: Date.now() };
    setMessages([greet]);
    saveHistory([greet]);
    setSelectedTs(null);
    setError(null);
  };

  return (
    <main
      className="flex h-[100dvh] flex-col"
      style={{ background: "var(--bg-gradient)", color: "var(--text-deep)" }}
    >
      {/* 顶栏 */}
      <header
        className="flex items-center justify-between px-5 py-4"
        style={{
          background: "rgba(249,242,244,.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(232,196,196,.1)",
        }}
      >
        <Link
          href="/floor-plan"
          className="flex items-center gap-0.5 text-[13px] transition-opacity hover:opacity-70"
          style={{ color: "var(--accent-dusk)", letterSpacing: "1px" }}
        >
          ‹ 回房间
        </Link>
        <div className="flex flex-col items-center leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent-wisteria)", boxShadow: "0 0 6px rgba(138,125,165,.6)" }}
            />
            <span
              className="text-[16px] font-medium"
              style={{ letterSpacing: "2px", color: "var(--text-deep)" }}
            >
              {DEFAULT_NAME}
            </span>
          </div>
          <span
            className="max-w-[180px] truncate text-[10px]"
            style={{ color: "var(--text-faint)", letterSpacing: ".5px" }}
          >
            {settings?.chatModel || "在线"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="清空聊天"
            onClick={clearChat}
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--accent-dusk)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Broom />
          </button>
          <Link
            href="/settings"
            aria-label="设置"
            className="transition-all hover:rotate-45"
            style={{ color: "var(--accent-dusk)" }}
          >
            <Gear />
          </Link>
        </div>
      </header>

      {/* 消息区 */}
      <div className="flex-1 space-y-1 overflow-y-auto px-5 py-6">
        {messages.map((m) => (
          <Bubble
            key={m.ts}
            role={m.role}
            content={m.content}
            selected={selectedTs === m.ts}
            onSelect={
              m.role === "user" && !sending
                ? () => setSelectedTs(selectedTs === m.ts ? null : m.ts)
                : undefined
            }
            onEditResend={() => editResend(m.ts)}
            onRetry={() => retryFrom(m.ts)}
          />
        ))}

        {sending && (
          <div className="flex justify-start pt-2">
            <div
              className="rounded-2xl rounded-bl-md px-4 py-3"
              style={{ background: "var(--bubble-them)" }}
            >
              <span className="inline-flex gap-1">
                <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
              </span>
            </div>
          </div>
        )}

        {!ready && (
          <div
            className="rounded-2xl px-4 py-3 text-[13px]"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--card-shadow)",
              color: "var(--text-mid)",
              backdropFilter: "blur(14px)",
            }}
          >
            还没接上他的大脑～点右上角的齿轮，填好中转站、API Key 和对话模型，他就能开口了。
          </div>
        )}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: "rgba(200,140,140,.06)",
              border: "1px solid rgba(200,140,140,.2)",
              color: "#b07070",
            }}
          >
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 方式切换（胶囊 Tab） */}
      <div className="flex justify-center gap-1.5 pb-2">
        <PillTab active={mode === "sentences"} onClick={() => setMode("sentences")}>
          一句一句说
        </PillTab>
        <PillTab active={mode === "passage"} onClick={() => setMode("passage")}>
          写成一篇
        </PillTab>
      </div>

      {/* 输入栏 */}
      <div
        className="px-4 pb-4 pt-2"
        style={{
          background: "rgba(249,242,244,.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(232,196,196,.1)",
        }}
      >
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
            className="max-h-32 flex-1 resize-none px-4 py-2.5 text-[14px] outline-none transition-all disabled:opacity-60"
            style={{
              borderRadius: 12,
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--text-deep)",
              fontFamily: "inherit",
              lineHeight: 1.7,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
          />
          <button
            type="button"
            onClick={send}
            disabled={!ready || sending || !input.trim()}
            aria-label="发送"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center transition-all disabled:opacity-40"
            style={{
              borderRadius: "50%",
              border: "none",
              background: "linear-gradient(135deg, var(--blush) 0%, var(--accent-wisteria) 100%)",
              color: "rgba(255,255,255,.95)",
              boxShadow: "0 2px 10px rgba(196,160,170,.2)",
              cursor: "pointer",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "translateX(-1px)" }}>
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

function Bubble({
  role,
  content,
  selected,
  onSelect,
  onEditResend,
  onRetry,
}: {
  role: ChatMessage["role"];
  content: string;
  selected?: boolean;
  onSelect?: () => void;
  onEditResend?: () => void;
  onRetry?: () => void;
}) {
  if (role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-end py-1 pl-9"
      >
        <div
          onClick={onSelect}
          className="max-w-full whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5 text-[14.5px]"
          style={{
            background: "var(--bubble-me)",
            color: "rgba(255,255,255,.96)",
            lineHeight: 1.75,
            letterSpacing: ".3px",
            cursor: onSelect ? "pointer" : "default",
            outline: selected ? "2px solid rgba(187,167,199,.55)" : "none",
            outlineOffset: 2,
          }}
        >
          {content}
        </div>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 flex gap-1.5"
          >
            <ActionPill onClick={onEditResend}>✎ 编辑重发</ActionPill>
            <ActionPill onClick={onRetry}>↻ 重新回复</ActionPill>
          </motion.div>
        )}
      </motion.div>
    );
  }
  if (role === "inner") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex justify-start py-1 pr-9"
      >
        <div
          className="max-w-full px-4 py-2.5 text-[12px] italic"
          style={{
            background: "var(--thought-bg)",
            borderLeft: "2px solid var(--thought-border)",
            borderRadius: 12,
            color: "var(--text-mid)",
            lineHeight: 1.65,
          }}
        >
          <span
            className="mr-1.5 not-italic"
            style={{ color: "var(--text-faint)", letterSpacing: "1px" }}
          >
            心声
          </span>
          {content}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex justify-start py-1 pr-9"
    >
      <div
        className="max-w-full whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-2.5 text-[14.5px]"
        style={{
          background: "var(--bubble-them)",
          color: "var(--text-deep)",
          lineHeight: 1.75,
          letterSpacing: ".3px",
        }}
      >
        {content}
      </div>
    </motion.div>
  );
}

function ActionPill({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 text-[12px] transition-all"
      style={{
        borderRadius: 14,
        background: "rgba(255,255,255,.75)",
        border: "1px solid rgba(196,166,184,.35)",
        color: "var(--text-mid)",
        letterSpacing: ".5px",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: "0 2px 8px rgba(0,0,0,.05)",
      }}
    >
      {children}
    </button>
  );
}

function PillTab({
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
      className="px-4 py-1.5 text-[13px] transition-all"
      style={{
        borderRadius: 20,
        fontWeight: active ? 500 : 400,
        color: active ? "var(--text-deep)" : "var(--text-mid)",
        background: active ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.4)",
        border: active ? "1px solid rgba(196,166,184,.35)" : "1px solid transparent",
        letterSpacing: ".5px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function Gear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function Broom() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulse rounded-full"
      style={{ animationDelay: `${delay}s`, background: "var(--text-faint)" }}
    />
  );
}
