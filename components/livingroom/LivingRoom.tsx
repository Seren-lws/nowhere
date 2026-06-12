"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { isChatReady, loadSettings, type BrainSettings } from "@/lib/brain/config";
import {
  buildMessages,
  DEFAULT_NAME,
  FIRST_GREETING,
  SAVE_MEMORY_TOOL,
  SAVE_FAVORITE_TOOL,
  WRITE_DIARY_TOOL,
  REQUEST_PERSONALITY_CHANGE_TOOL,
  INVITE_BEDROOM_TOOL,
  parseReply,
  type ChatMode,
} from "@/lib/brain/personality";
import {
  HISTORY_WINDOW,
  loadHistory,
  saveHistory,
  loadHistoryFromDb,
  saveMessageToDb,
  toContext,
  type ChatMessage,
  type DiaryShareData,
} from "@/lib/brain/memory";
import { clearChatMessages } from "@/lib/brain/db";
import { sendChat, type SavedMemoryInfo } from "@/lib/brain/client";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TWO_HOURS = 2 * 60 * 60 * 1000;

export function LivingRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    const s = loadSettings();
    setSettings(s);

    (async () => {
      let h: ChatMessage[] = [];
      try {
        h = await loadHistoryFromDb();
      } catch {}
      if (h.length === 0) h = loadHistory();

      if (h.length === 0) {
        const greet: ChatMessage = { role: "assistant", content: FIRST_GREETING, ts: Date.now() };
        setMessages([greet]);
        saveHistory([greet]);
      } else {
        setMessages(h);
        saveHistory(h);
      }

      if (isChatReady(s)) {
        triggerAutoDiary(s);
      }
    })();
  }, []);

  const triggerAutoDiary = async (s: BrainSettings) => {
    try {
      const res = await fetch("/api/diary?author=companion&limit=1");
      const lastDiaries = await res.json();
      const lastDiaryTime = lastDiaries?.[0]?.created_at
        ? new Date(lastDiaries[0].created_at).getTime()
        : 0;

      const lastMsgRes = await fetch("/api/chat/last-time");
      const { lastTime } = await lastMsgRes.json();
      if (!lastTime) return;

      const gap = Date.now() - new Date(lastTime).getTime();
      if (gap < TWO_HOURS) return;

      if (lastDiaryTime > new Date(lastTime).getTime()) return;

      const genRes = await fetch("/api/diary/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseUrl: s.baseUrl,
          apiKey: s.apiKey,
          model: s.chatModel,
          since: lastTime,
        }),
      });

      if (genRes.ok) {
        const { id } = await genRes.json();
        if (id) {
          const notif: ChatMessage = {
            role: "diary-notify",
            content: id,
            ts: Date.now(),
          };
          setMessages((prev) => {
            const next = [...prev, notif];
            saveHistory(next);
            return next;
          });
        }
      }
    } catch {}
  };

  const shareHandled = useRef(false);
  useEffect(() => {
    const diaryId = searchParams.get("shareDiary");
    if (!diaryId || shareHandled.current || !settings || sending) return;

    const alreadyShared = messages.some(
      (m) => m.diaryShare?.id === diaryId,
    );
    if (alreadyShared) {
      router.replace("/living-room", { scroll: false });
      return;
    }

    shareHandled.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/diary?id=${diaryId}`);
        if (!res.ok) return;
        const diary = await res.json();
        if (!diary?.content) return;

        const shareData: DiaryShareData = {
          id: diary.id,
          content: diary.content,
          mood: diary.mood,
          created_at: diary.created_at,
        };

        const shareMsg: ChatMessage = {
          role: "user",
          content: `我把我的日记分享给你看：\n\n${diary.content}`,
          ts: Date.now(),
          diaryShare: shareData,
        };

        const acc = [...messages, shareMsg];
        setMessages(acc);
        saveHistory(acc);
        saveMessageToDb("user", shareMsg.content).then((dbId) => {
          shareMsg.dbId = dbId;
          saveHistory(acc);
        }).catch(() => {});

        router.replace("/living-room", { scroll: false });
        await requestReply(acc);
      } catch {}
    })();
  }, [searchParams, settings, messages, sending]);

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
      const assembled = await buildMessages(ctx, last.content, mode);
      const resp = await sendChat(assembled, settings, [SAVE_MEMORY_TOOL, SAVE_FAVORITE_TOOL, WRITE_DIARY_TOOL, REQUEST_PERSONALITY_CHANGE_TOOL, INVITE_BEDROOM_TOOL]);
      const { inner, parts } = parseReply(resp.content, mode);
      setSending(false);

      const acc = [...base];
      let t = Date.now();

      if (resp.savedMemories && resp.savedMemories.length > 0) {
        await delay(150);
        acc.push({ role: "memory", content: "", ts: t++, memories: resp.savedMemories });
        setMessages([...acc]);
        saveHistory(acc);
      }

      if (resp.savedFavorites && resp.savedFavorites.length > 0) {
        await delay(150);
        acc.push({ role: "fav-notify", content: resp.savedFavorites[0].source === "diary" ? "他收藏了你的日记" : "他收藏了你的话", ts: t++ });
        setMessages([...acc]);
        saveHistory(acc);
      }

      if (inner) {
        await delay(220);
        const innerMsg: ChatMessage = { role: "inner", content: inner, ts: t++ };
        acc.push(innerMsg);
        setMessages([...acc]);
        saveHistory(acc);
        saveMessageToDb("inner", inner).then((dbId) => { innerMsg.dbId = dbId; saveHistory(acc); }).catch(() => {});
      }
      for (const p of parts) {
        await delay(mode === "sentences" ? 620 : 280);
        const asstMsg: ChatMessage = { role: "assistant", content: p, ts: t++ };
        acc.push(asstMsg);
        setMessages([...acc]);
        saveHistory(acc);
        saveMessageToDb("assistant", p).then((dbId) => { asstMsg.dbId = dbId; saveHistory(acc); }).catch(() => {});
      }

      if (resp.bedroomInvite) {
        await delay(400);
        acc.push({ role: "bedroom-invite", content: resp.bedroomInvite, ts: t++ });
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
    saveMessageToDb("user", text).then((dbId) => {
      acc[acc.length - 1].dbId = dbId;
      saveHistory(acc);
    }).catch(() => {});
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

  const [favToast, setFavToast] = useState(false);

  const favoriteChat = async (text: string, ts: number) => {
    try {
      const d = new Date(ts);
      const tokyoDate = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
      const dateStr = `${tokyoDate.getFullYear()}-${String(tokyoDate.getMonth() + 1).padStart(2, "0")}-${String(tokyoDate.getDate()).padStart(2, "0")}`;
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          content: text,
          owner: "user",
          metadata: { date: dateStr, room: "living-room" },
        }),
      });
      setFavToast(true);
      setTimeout(() => setFavToast(false), 1500);
    } catch {}
  };

  const goToBedroom = () => {
    const recent = toContext(messages).slice(-6);
    const ctx = encodeURIComponent(JSON.stringify(recent));
    router.push(`/bedroom/intimate?from=livingroom&context=${ctx}`);
  };

  const clearChat = () => {
    if (!window.confirm("把这间客厅的聊天清空吗？清空后他会回到初见时的样子（设置和其他数据不受影响）。")) return;
    const greet: ChatMessage = { role: "assistant", content: FIRST_GREETING, ts: Date.now() };
    setMessages([greet]);
    saveHistory([greet]);
    clearChatMessages("living-room").catch(() => {});
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
          {messages.map((m, idx) => {
            const showTime = shouldShowTime(messages, idx);
            return (
              <div key={m.ts}>
                {showTime && <TimeStamp ts={m.ts} />}
                {m.role === "memory" && m.memories ? (
                  <MemoryTag memories={m.memories} />
                ) : m.role === "diary-notify" ? (
                  <DiaryNotifyCard diaryId={m.content} />
                ) : m.role === "fav-notify" ? (
                  <FavNotifyCard text={m.content} />
                ) : m.role === "bedroom-invite" ? (
                  <BedroomInviteCard message={m.content} onAccept={() => goToBedroom()} />
                ) : m.diaryShare ? (
                  <DiaryShareCard diary={m.diaryShare} />
                ) : (
                  <Bubble
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
                    onFavorite={
                      m.role === "assistant"
                        ? () => favoriteChat(m.content, m.ts)
                        : undefined
                    }
                  />
                )}
              </div>
            );
          })}

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

      {/* Favorite Toast */}
      <AnimatePresence>
        {favToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-44 z-50 px-5 py-2.5 rounded-full"
            style={{
              background: "rgba(123,84,85,0.9)",
              backdropFilter: "blur(12px)",
              color: "white",
              fontFamily: "var(--font-serif-sc)",
              fontSize: "13px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
          >
            ⭐ 已收藏
          </motion.div>
        )}
      </AnimatePresence>

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
  onFavorite,
}: {
  role: ChatMessage["role"];
  content: string;
  selected?: boolean;
  onSelect?: () => void;
  onEditResend?: () => void;
  onRetry?: () => void;
  onFavorite?: () => void;
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
        <details className="w-full max-w-[85%] group" open>
          <summary className="flex items-center gap-1.5 px-1 cursor-pointer list-none italic select-none">
            <span
              className="material-symbols-outlined text-[12px]"
              style={{ color: "var(--accent-wisteria)" }}
            >
              chat_bubble
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)" }}>
              心声
            </span>
            <span
              className="material-symbols-outlined text-[12px] transition-transform group-open:rotate-180"
              style={{ color: "var(--text-faint)", opacity: 0.4 }}
            >
              expand_more
            </span>
          </summary>
          <div
            className="mt-1.5 rounded-xl px-3 py-2 italic whitespace-pre-wrap"
            style={{
              background: "rgba(255,255,255,0.4)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-deep)",
              lineHeight: "1.6",
              fontSize: "12.5px",
            }}
          >
            {content}
          </div>
        </details>
      </motion.div>
    );
  }

  const [showFavMenu, setShowFavMenu] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handlePointerDown = () => {
    if (!onFavorite) return;
    longPressRef.current = setTimeout(() => setShowFavMenu(true), 500);
  };
  const handlePointerUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-start gap-2"
    >
      <div
        className="neu-flat rounded-xl px-3.5 py-2.5 max-w-[80%] whitespace-pre-wrap select-none"
        style={{
          fontFamily: "var(--font-serif-sc)",
          fontSize: "14.5px",
          lineHeight: "24px",
          color: "var(--text-deep)",
          cursor: onFavorite ? "pointer" : "default",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => {
          if (onFavorite) {
            e.preventDefault();
            setShowFavMenu(true);
          }
        }}
      >
        {content}
      </div>
      <AnimatePresence>
        {showFavMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <ActionPill
              onClick={() => {
                setShowFavMenu(false);
                onFavorite?.();
              }}
            >
              ⭐ 收藏这句话
            </ActionPill>
          </motion.div>
        )}
      </AnimatePresence>
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

/* ─── Diary Share Card ─── */

function DiaryShareCard({ diary }: { diary: DiaryShareData }) {
  const [open, setOpen] = useState(false);
  const date = new Date(diary.created_at);
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-end"
    >
      <div
        className="rounded-xl overflow-hidden max-w-[80%] cursor-pointer active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg, rgba(237,220,255,0.4), rgba(255,218,217,0.4))",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff",
        }}
        onClick={() => setOpen(!open)}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ color: "var(--primary)", fontVariationSettings: "'FILL' 1" }}
          >
            auto_stories
          </span>
          <div className="flex-1">
            <p
              className="text-[13px]"
              style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
            >
              她分享了一篇日记给你
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-faint)" }}
            >
              {dateStr}的日记 · 点击{open ? "收起" : "查看"}
            </p>
          </div>
          <span
            className="material-symbols-outlined text-[16px] transition-transform"
            style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : "none" }}
          >
            expand_more
          </span>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-3 pt-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}
              >
                {diary.mood && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[11px] mb-2"
                    style={{
                      background: "rgba(212,165,165,0.2)",
                      color: "var(--primary)",
                      fontFamily: "var(--font-serif-sc)",
                    }}
                  >
                    {diary.mood}
                  </span>
                )}
                <p
                  className="text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
                >
                  {diary.content}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Memory Tag ─── */

const TYPE_LABELS: Record<string, string> = {
  fact: "事实",
  event: "事件",
  emotion: "情绪",
  promise: "约定",
  preference: "喜好",
  habit: "习惯",
  relationship: "关系",
  profile: "档案",
};

function MemoryTag({ memories }: { memories: SavedMemoryInfo[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-start"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95"
        style={{
          background: "rgba(212,165,165,0.15)",
          border: "1px solid rgba(212,165,165,0.25)",
          fontFamily: "var(--font-serif-sc)",
          fontSize: "12px",
          color: "var(--primary)",
        }}
      >
        <span
          className="material-symbols-outlined text-[14px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          bookmark
        </span>
        存入记忆
        <span
          className="material-symbols-outlined text-[12px] transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        >
          chevron_right
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden w-full max-w-[85%]"
          >
            <div
              className="mt-2 rounded-xl p-3 flex flex-col gap-2"
              style={{
                background: "rgba(212,165,165,0.08)",
                border: "1px solid rgba(212,165,165,0.15)",
              }}
            >
              {memories.map((m, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px]"
                      style={{
                        background: "rgba(212,165,165,0.2)",
                        color: "var(--primary)",
                        fontFamily: "var(--font-serif-sc)",
                      }}
                    >
                      {TYPE_LABELS[m.type] || m.type}
                    </span>
                    {m.is_anchor && (
                      <span className="text-[10px]" style={{ color: "var(--primary)" }}>⚓</span>
                    )}
                    {m.tags && m.tags.length > 0 && (
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)" }}
                      >
                        {m.tags.join(" · ")}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[13px] leading-relaxed"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "var(--text-deep)",
                    }}
                  >
                    {m.content}
                  </p>
                  {i < memories.length - 1 && (
                    <div className="h-px my-1" style={{ background: "rgba(212,165,165,0.12)" }} />
                  )}
                </div>
              ))}

              <button
                onClick={() => router.push("/vault/memories")}
                className="flex items-center gap-1 self-end mt-1 px-3 py-1 rounded-full transition-all active:scale-95"
                style={{
                  background: "rgba(212,165,165,0.15)",
                  border: "1px solid rgba(212,165,165,0.2)",
                  fontFamily: "var(--font-serif-sc)",
                  fontSize: "11px",
                  color: "var(--primary)",
                }}
              >
                查看记忆
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Time Stamp ─── */

const FIVE_MINUTES = 5 * 60 * 1000;

function shouldShowTime(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  const curr = messages[index];
  return curr.ts - prev.ts > FIVE_MINUTES;
}

function formatChatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const tokyoOffset = 9 * 60;
  const localOffset = d.getTimezoneOffset();
  const tokyoDate = new Date(d.getTime() + (localOffset + tokyoOffset) * 60000);
  const tokyoNow = new Date(now.getTime() + (now.getTimezoneOffset() + tokyoOffset) * 60000);

  const hour = tokyoDate.getHours().toString().padStart(2, "0");
  const min = tokyoDate.getMinutes().toString().padStart(2, "0");
  const time = `${hour}:${min}`;

  const isToday =
    tokyoDate.getFullYear() === tokyoNow.getFullYear() &&
    tokyoDate.getMonth() === tokyoNow.getMonth() &&
    tokyoDate.getDate() === tokyoNow.getDate();

  if (isToday) return time;

  const yesterday = new Date(tokyoNow);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    tokyoDate.getFullYear() === yesterday.getFullYear() &&
    tokyoDate.getMonth() === yesterday.getMonth() &&
    tokyoDate.getDate() === yesterday.getDate();

  if (isYesterday) return `昨天 ${time}`;

  return `${tokyoDate.getMonth() + 1}/${tokyoDate.getDate()} ${time}`;
}

function TimeStamp({ ts }: { ts: number }) {
  return (
    <div className="flex justify-center py-2">
      <span
        className="text-[11px] px-3 py-1 rounded-full"
        style={{
          color: "var(--text-faint)",
          background: "rgba(236,231,231,0.5)",
          fontFamily: "var(--font-serif-sc)",
        }}
      >
        {formatChatTime(ts)}
      </span>
    </div>
  );
}

/* ─── Diary Notify Card ─── */

function FavNotifyCard({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-center"
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
        style={{
          background: "rgba(212,165,165,0.12)",
          border: "1px solid rgba(212,165,165,0.2)",
          fontFamily: "var(--font-serif-sc)",
          fontSize: "13px",
          color: "var(--primary)",
        }}
      >
        <span
          className="material-symbols-outlined text-[16px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          bookmark
        </span>
        {text}
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>⭐</span>
      </div>
    </motion.div>
  );
}

function DiaryNotifyCard({ diaryId }: { diaryId: string }) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-center"
    >
      <button
        onClick={() => router.push(`/study/his-drawer/diary`)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-95"
        style={{
          background: "rgba(212,165,165,0.12)",
          border: "1px solid rgba(212,165,165,0.2)",
          fontFamily: "var(--font-serif-sc)",
          fontSize: "13px",
          color: "var(--primary)",
        }}
      >
        <span
          className="material-symbols-outlined text-[16px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          auto_stories
        </span>
        他写了一篇日记
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          点击查看
        </span>
        <span className="material-symbols-outlined text-[14px]">
          arrow_forward
        </span>
      </button>
    </motion.div>
  );
}

/* ─── Bedroom Invite Card ─── */

function BedroomInviteCard({ message, onAccept }: { message: string; onAccept: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex justify-center my-2"
    >
      <div
        className="w-full max-w-[85%] rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(123,94,167,0.12), rgba(201,101,214,0.1), rgba(255,143,160,0.1))",
          border: "1px solid rgba(201,101,214,0.2)",
          boxShadow: "0 4px 24px rgba(123,94,167,0.1), inset 0 1px 0 rgba(255,255,255,0.3)",
        }}
      >
        <div className="px-5 pt-4 pb-3 flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(201,101,214,0.2), rgba(255,143,160,0.2))",
            }}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ color: "#c965d6", fontVariationSettings: "'FILL' 1" }}
            >
              nightlight
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] italic whitespace-pre-wrap leading-relaxed"
              style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
            >
              {message}
            </p>
          </div>
        </div>
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={onAccept}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #c965d6, #ff8fa0)",
              color: "white",
              fontFamily: "var(--font-serif-sc)",
              fontSize: "13px",
              fontWeight: 500,
              boxShadow: "0 2px 12px rgba(201,101,214,0.3)",
            }}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </span>
            去卧室
          </button>
        </div>
      </div>
    </motion.div>
  );
}
