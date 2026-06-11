"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
  const router = useRouter();
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("sentences");
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, atBottom]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const ready = settings ? isChatReady(settings) : false;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  const retryFrom = async (ts: number) => {
    const idx = messages.findIndex((m) => m.ts === ts);
    if (idx < 0) return;
    const truncated = messages.slice(0, idx + 1);
    setMessages(truncated);
    saveHistory(truncated);
    setSelectedTs(null);
    await requestReply(truncated);
  };

  const clearChat = () => {
    if (!window.confirm("把这间客厅的聊天清空吗？清空后他会回到初见时的样子（设置和其他数据不受影响）。")) return;
    const greet: ChatMessage = { role: "assistant", content: FIRST_GREETING, ts: Date.now() };
    setMessages([greet]);
    saveHistory([greet]);
    setSelectedTs(null);
    setError(null);
    setShowMenu(false);
  };

  return (
    <div className="fixed inset-0" style={{ background: "#fdf8f8" }}>
      {/* Watercolor background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] bg-[#f1dede] top-[-100px] left-[-100px] rounded-full"
          style={{ filter: "blur(80px)", opacity: 0.4 }}
        />
        <div
          className="absolute w-[600px] h-[600px] bg-[#eddcff] bottom-[-200px] right-[-100px] rounded-full"
          style={{ filter: "blur(80px)", opacity: 0.4 }}
        />
        <div
          className="absolute w-[400px] h-[400px] bg-[#ffdad9] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ filter: "blur(80px)", opacity: 0.4 }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 h-16 bg-[#fdf8f8]/80 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            className="p-2 rounded-full hover:bg-[#f2eded] transition-colors active:scale-95"
            onClick={() => router.push("/floor-plan")}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
              arrow_back_ios
            </span>
          </button>
          <div className="flex flex-col">
            <span
              className="text-[16px] font-medium"
              style={{ letterSpacing: "2px", color: "var(--text-deep)", fontFamily: "var(--font-serif-sc)" }}
            >
              {DEFAULT_NAME}
            </span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                {settings?.chatModel || "在线"}
              </span>
            </div>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            className="p-2 rounded-full hover:bg-[#f2eded] transition-colors active:scale-95"
            onClick={() => setShowMenu(!showMenu)}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
              more_vert
            </span>
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 min-w-[140px] rounded-xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                }}
              >
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-[14px] hover:bg-black/5 transition-colors"
                  style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
                  onClick={clearChat}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--primary)" }}>
                    delete_sweep
                  </span>
                  清空聊天
                </button>
                <div className="h-px bg-black/5" />
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-[14px] hover:bg-black/5 transition-colors"
                  style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
                  onClick={() => {
                    setShowMenu(false);
                    router.push("/settings");
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--primary)" }}>
                    settings
                  </span>
                  设置
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Chat messages */}
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto pt-20 pb-40 px-5 max-w-[800px] mx-auto"
      >
        <div className="flex flex-col gap-3">
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
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 py-2"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center pulse-orb"
                style={{ background: "#ecbbba" }}
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  style={{ color: "var(--primary)", fontVariationSettings: "'FILL' 1" }}
                >
                  favorite
                </span>
              </div>
              <span className="text-[12px] italic" style={{ color: "var(--text-faint)" }}>
                正在思考...
              </span>
            </motion.div>
          )}

          {!ready && (
            <div
              className="neu-flat rounded-xl p-4 text-[13px]"
              style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
            >
              还没接上他的大脑～点右上角的三个点，进入设置，填好中转站、API Key 和对话模型，他就能开口了。
            </div>
          )}

          {error && (
            <div
              className="rounded-xl p-4 text-[13px]"
              style={{ background: "rgba(200,140,140,.06)", border: "1px solid rgba(200,140,140,.2)", color: "#b07070" }}
            >
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed right-6 bottom-36 z-40 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
            onClick={scrollToBottom}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--text-mid)" }}>
              arrow_downward
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom bar: mode switcher + input */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="flex justify-center mb-3">
          <ModeSwitcher mode={mode} setMode={setMode} />
        </div>

        <div
          className="px-5 pt-3 pb-8 flex items-center gap-3"
          style={{
            background: "rgba(255,255,255,0.4)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.5)",
          }}
        >
          <button
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full neu-flat active:scale-95 transition-transform"
            style={{ color: "var(--primary)" }}
          >
            <span className="material-symbols-outlined">add</span>
          </button>

          <div className="flex-1 relative">
            <div className="absolute inset-0 neu-pressed rounded-[24px] -z-10" />
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
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none px-5 py-3 text-[16px] resize-none disabled:opacity-60"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--text-deep)",
                maxHeight: "120px",
                lineHeight: "24px",
              }}
            />
          </div>

          <button
            type="button"
            onClick={send}
            disabled={!ready || sending || !input.trim()}
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #eddcff, #ffdad9)" }}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--text-deep)" }}>
              send
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Mode Switcher ─── */

function ModeSwitcher({ mode, setMode }: { mode: ChatMode; setMode: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-transform"
        style={{
          background: "rgba(236,231,231,0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
        onClick={() => setOpen(!open)}
      >
        <span
          className="material-symbols-outlined text-[20px] transition-transform"
          style={{ color: "var(--text-mid)", transform: open ? "rotate(180deg)" : "none" }}
        >
          expand_less
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-2 p-2 rounded-xl whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, #eddcff, #ffdad9)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            <button
              className="px-4 py-2 rounded-lg text-[14px] transition-colors"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--text-deep)",
                background: mode === "sentences" ? "rgba(255,255,255,0.6)" : "transparent",
                boxShadow: mode === "sentences" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}
              onClick={() => {
                setMode("sentences");
                setOpen(false);
              }}
            >
              分句
            </button>
            <div className="w-px h-6 bg-white/20" />
            <button
              className="px-4 py-2 rounded-lg text-[14px] transition-colors"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--text-deep)",
                background: mode === "passage" ? "rgba(255,255,255,0.6)" : "transparent",
                boxShadow: mode === "passage" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}
              onClick={() => {
                setMode("passage");
                setOpen(false);
              }}
            >
              整段
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Bubble ─── */

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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-end gap-2"
      >
        <div
          onClick={onSelect}
          className="rounded-xl px-3.5 py-2.5 max-w-[80%] whitespace-pre-wrap"
          style={{
            fontFamily: "var(--font-serif-sc)",
            fontSize: "14.5px",
            lineHeight: "24px",
            background: "#ffdad9",
            boxShadow: selected
              ? "0 0 0 2px rgba(123,84,85,0.3), 6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff"
              : "6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff",
            color: "var(--text-deep)",
            cursor: onSelect ? "pointer" : "default",
          }}
        >
          {content}
        </div>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-1.5"
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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-start"
      >
        <details className="w-full max-w-[85%] group">
          <summary className="flex items-center gap-2 px-2 cursor-pointer list-none italic select-none">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: "var(--accent-wisteria)" }}
            >
              chat_bubble
            </span>
            <span className="text-[14px]" style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)" }}>
              心声
            </span>
            <span
              className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-180"
              style={{ color: "var(--text-faint)", opacity: 0.4 }}
            >
              expand_more
            </span>
          </summary>
          <div
            className="mt-2 rounded-xl px-3.5 py-2.5 italic whitespace-pre-wrap"
            style={{
              background: "rgba(255,255,255,0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-deep)",
              lineHeight: "1.65",
              fontSize: "13.5px",
            }}
          >
            {content}
          </div>
        </details>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-start"
    >
      <div
        className="neu-flat rounded-xl px-3.5 py-2.5 max-w-[80%] whitespace-pre-wrap"
        style={{
          fontFamily: "var(--font-serif-sc)",
          fontSize: "14.5px",
          lineHeight: "24px",
          color: "var(--text-deep)",
        }}
      >
        {content}
      </div>
    </motion.div>
  );
}

/* ─── Action Pill ─── */

function ActionPill({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-[12px] rounded-lg transition-all active:scale-95"
      style={{
        background: "rgba(255,255,255,0.7)",
        border: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "2px 2px 6px #e0dbdb, -2px -2px 6px #ffffff",
        color: "var(--text-mid)",
        fontFamily: "var(--font-serif-sc)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
