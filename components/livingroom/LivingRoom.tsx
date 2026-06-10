"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isChatReady, loadSettings, type BrainSettings } from "@/lib/brain/config";
import {
  buildMessages,
  DEFAULT_NAME,
  FIRST_GREETING,
  type LLMMessage,
} from "@/lib/brain/personality";
import {
  HISTORY_WINDOW,
  loadHistory,
  saveHistory,
  type ChatMessage,
} from "@/lib/brain/memory";
import { sendChat } from "@/lib/brain/client";
import { AssistantBubble } from "./AssistantBubble";

export function LivingRoom() {
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingTs, setTypingTs] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 初始化：读设置 + 历史；初次无历史则放某先生的"门口那一眼"
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    const h = loadHistory();
    if (h.length === 0) {
      const greet: ChatMessage = {
        role: "assistant",
        content: FIRST_GREETING,
        ts: Date.now(),
      };
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
    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    saveHistory(next);
    setInput("");
    setSending(true);

    const window: LLMMessage[] = next
      .slice(-HISTORY_WINDOW)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const reply = await sendChat(buildMessages(window.slice(0, -1), text), settings);
      const ts = Date.now();
      const aiMsg: ChatMessage = { role: "assistant", content: reply, ts };
      const after = [...next, aiMsg];
      setMessages(after);
      saveHistory(after);
      setTypingTs(ts); // 让这条逐字浮现
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex h-[100dvh] flex-col bg-[#f3f0ea]">
      {/* 顶栏 */}
      <header className="flex items-center justify-between border-b border-black/5 bg-[#efeae3]/80 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          <span className="text-base font-medium tracking-tight text-zinc-700">
            {DEFAULT_NAME}
          </span>
          <span className="text-xs text-zinc-400">在家</span>
        </div>
        <Link
          href="/floor-plan"
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          回家
        </Link>
      </header>

      {/* 消息区 */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.ts} className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl rounded-br-md bg-violet-200/70 px-4 py-2.5 text-[15px] leading-relaxed text-violet-950">
                {m.content}
              </div>
            </div>
          ) : (
            <AssistantBubble
              key={m.ts}
              content={m.content}
              animate={m.ts === typingTs}
            />
          ),
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white/80 px-4 py-3 text-zinc-400">
              <span className="inline-flex gap-1">
                <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
              </span>
            </div>
          </div>
        )}

        {!ready && (
          <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-zinc-500">
            还没接上他的大脑～去
            <Link href="/settings" className="mx-1 text-violet-600 underline">
              设置
            </Link>
            填好中转站、API Key 和对话模型，他就能开口了。
          </div>
        )}
        {error && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-500">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入栏 */}
      <div className="border-t border-black/5 bg-[#efeae3]/80 px-4 py-3 backdrop-blur-sm">
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
            placeholder={ready ? "和他说说话…" : "先去设置接上他的大脑"}
            disabled={!ready || sending}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-zinc-300/70 bg-white/85 px-4 py-2.5 text-[15px] outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200/50 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!ready || sending || !input.trim()}
            className="rounded-2xl bg-violet-300/85 px-5 py-2.5 text-sm font-medium text-violet-950 transition hover:bg-violet-300 disabled:opacity-40"
          >
            说
          </button>
        </div>
      </div>
    </main>
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
