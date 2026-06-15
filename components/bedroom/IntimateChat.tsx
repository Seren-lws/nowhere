"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { isChatReady, loadSettings, type BrainSettings } from "@/lib/brain/config";
import {
  SAVE_MEMORY_TOOL,
  SAVE_FAVORITE_TOOL,
  WRITE_DIARY_TOOL,
  SAVE_TIMELINE_TOOL,
  WEB_SEARCH_TOOL,
  SET_REMINDER_TOOL,
  SEND_VOICE_TOOL,
  REQUEST_PERSONALITY_CHANGE_TOOL,
  UPDATE_SURFACE_PERSONALITY_TOOL,
  parseReply,
  type ChatMode,
} from "@/lib/brain/personality";
import { getHistoryWindow, toContext, type ChatMessage } from "@/lib/brain/memory";
import { sendChat, fetchEmbedding, type SavedMemoryInfo } from "@/lib/brain/client";
import type { BedroomPresets, BedroomSession } from "@/lib/brain/bedroom";
import { writeRoomHandoff, type HandoffMsg } from "@/lib/brain/handoff";

/** 把聊天消息转成纯文本上下文，供跨房间交接用 */
function toHandoffContext(msgs: ChatMessage[]): HandoffMsg[] {
  return toContext(msgs).map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? m.content
        : m.content
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(" ") || "[图片]",
  }));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BEDROOM_GREETING = "……你来了。（轻轻拉过你的手）这里只有我们。";

/* ════════════════════════════════════════
   Main Component
   ════════════════════════════════════════ */

export function IntimateChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<BrainSettings | null>(null);

  // Session state
  const [sessions, setSessions] = useState<BedroomSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<BedroomSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("sentences");
  const [selectedTs, setSelectedTs] = useState<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [favToast, setFavToast] = useState(false);
  const [diaryToast, setDiaryToast] = useState(false);
  const [memoryToast, setMemoryToast] = useState(false);

  // Modals
  const [showPresets, setShowPresets] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Init ─── */

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    loadSessions();
  }, []);

  // 把卧室最近的对话存为"交接上下文"，下次回客厅时他能接上（隔夜也算）
  useEffect(() => {
    if (messages.length === 0) return;
    writeRoomHandoff("bedroom", toHandoffContext(messages));
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/bedroom/sessions");
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    }
  };

  // Auto-open or create session
  useEffect(() => {
    if (activeSessionId || sessions.length === 0 && sessions !== null) return;
    const active = sessions.find((s) => s.status === "active");
    if (active) {
      openSession(active.id);
    }
  }, [sessions]);

  const openSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setSidebarOpen(false);
    setSelectedTs(null);
    setError(null);
    try {
      // Load session details
      const sessRes = await fetch("/api/bedroom/sessions");
      const allSessions: BedroomSession[] = await sessRes.json();
      const sess = allSessions.find((s) => s.id === id);
      setActiveSession(sess ?? null);

      // Load messages
      const msgRes = await fetch(`/api/bedroom/messages?sessionId=${id}`);
      const dbMsgs = await msgRes.json();
      if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
        const chatMsgs: ChatMessage[] = dbMsgs.map((m: { id: string; role: string; content: string; created_at: string }) => ({
          role: m.role as ChatMessage["role"],
          content: m.content,
          ts: new Date(m.created_at).getTime(),
          dbId: m.id,
        }));
        setMessages(chatMsgs);
      } else {
        // New session — show greeting
        const greet: ChatMessage = { role: "assistant", content: BEDROOM_GREETING, ts: Date.now() };
        setMessages([greet]);
        saveMsg(id, "assistant", BEDROOM_GREETING);
      }
    } catch {
      setMessages([{ role: "assistant", content: BEDROOM_GREETING, ts: Date.now() }]);
    }
  }, []);

  const createNewSession = async (presets?: BedroomPresets, transCtx?: { role: string; content: string }[]) => {
    try {
      const res = await fetch("/api/bedroom/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presets: presets ?? {}, transitionContext: transCtx }),
      });
      const sess: BedroomSession = await res.json();
      setSessions((prev) => [sess, ...prev]);
      openSession(sess.id);
      return sess;
    } catch {
      return null;
    }
  };

  // Handle transition from living room
  const transitionHandled = useRef(false);
  useEffect(() => {
    if (transitionHandled.current || !settings) return;
    const fromLiving = searchParams.get("from") === "livingroom";
    const ctxParam = searchParams.get("context");
    if (fromLiving && ctxParam) {
      transitionHandled.current = true;
      try {
        const ctx = JSON.parse(decodeURIComponent(ctxParam));
        createNewSession({}, ctx);
        router.replace("/bedroom/intimate", { scroll: false });
      } catch {
        // ignore parse errors
      }
    }
  }, [settings, searchParams]);

  /* ─── Scroll ─── */

  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, atBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  };

  /* ─── Chat Logic ─── */

  const ready = settings ? isChatReady(settings) : false;

  const saveMsg = async (sessionId: string, role: string, content: string) => {
    try {
      const res = await fetch("/api/bedroom/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, role, content }),
      });
      const { id } = await res.json();
      return id as string;
    } catch {
      return undefined;
    }
  };

  const requestReply = async (base: ChatMessage[]) => {
    if (!settings || !activeSessionId || !activeSession) return;
    const last = base[base.length - 1];
    const ctx = toContext(base.slice(0, -1)).slice(-getHistoryWindow());
    setSending(true);
    setError(null);
    try {
      const queryEmbedding = await fetchEmbedding(last.content, settings);
      const { buildBedroomMessages } = await import("@/lib/brain/bedroom");
      const assembled = await buildBedroomMessages(
        ctx,
        last.content,
        mode,
        activeSession.presets ?? {},
        activeSession.transition_context,
        queryEmbedding,
      );
      const resp = await sendChat(assembled, settings, [SAVE_MEMORY_TOOL, SAVE_FAVORITE_TOOL, WRITE_DIARY_TOOL, SAVE_TIMELINE_TOOL, WEB_SEARCH_TOOL, SET_REMINDER_TOOL, SEND_VOICE_TOOL, REQUEST_PERSONALITY_CHANGE_TOOL, UPDATE_SURFACE_PERSONALITY_TOOL], "bedroom");
      const { inner, parts } = parseReply(resp.content, mode);
      setSending(false);

      const acc = [...base];
      let t = Date.now();

      if (resp.savedMemories && resp.savedMemories.length > 0) {
        await delay(150);
        const memMsg: ChatMessage = { role: "memory", content: "", ts: t++, memories: resp.savedMemories };
        acc.push(memMsg);
        setMessages([...acc]);
        try { memMsg.dbId = await saveMsg(activeSessionId, "memory", JSON.stringify({ memories: resp.savedMemories })); } catch {}
      }

      if (resp.savedFavorites && resp.savedFavorites.length > 0) {
        await delay(150);
        const favContent = resp.savedFavorites[0].source === "diary" ? "他收藏了你的日记" : "他收藏了你的话";
        const favMsg: ChatMessage = { role: "fav-notify", content: favContent, ts: t++ };
        acc.push(favMsg);
        setMessages([...acc]);
        try { favMsg.dbId = await saveMsg(activeSessionId, "fav-notify", favContent); } catch {}
      }

      if (resp.searchQuery) {
        await delay(150);
        const searchMsg: ChatMessage = { role: "search-notify", content: resp.searchQuery, ts: t++ };
        acc.push(searchMsg);
        setMessages([...acc]);
        try { searchMsg.dbId = await saveMsg(activeSessionId, "search-notify", resp.searchQuery); } catch {}
      }

      if (inner) {
        await delay(220);
        const innerMsg: ChatMessage = { role: "inner", content: inner, ts: t++ };
        acc.push(innerMsg);
        setMessages([...acc]);
        try { innerMsg.dbId = await saveMsg(activeSessionId, "inner", inner); } catch {}
      }

      for (const p of parts) {
        await delay(mode === "sentences" ? 620 : 280);
        const asstMsg: ChatMessage = { role: "assistant", content: p, ts: t++ };
        acc.push(asstMsg);
        setMessages([...acc]);
        try { asstMsg.dbId = await saveMsg(activeSessionId, "assistant", p); } catch {}
      }

      if (resp.diaryWritten) {
        await delay(150);
        const diaryMsg: ChatMessage = { role: "tool-notify", content: "diary", ts: t++ };
        acc.push(diaryMsg);
        setMessages([...acc]);
        try { diaryMsg.dbId = await saveMsg(activeSessionId, "tool-notify", "diary"); } catch {}
      }

      if (resp.timelineEvent) {
        await delay(150);
        const tlContent = `timeline:${resp.timelineEvent}`;
        const tlMsg: ChatMessage = { role: "tool-notify", content: tlContent, ts: t++ };
        acc.push(tlMsg);
        setMessages([...acc]);
        try { tlMsg.dbId = await saveMsg(activeSessionId, "tool-notify", tlContent); } catch {}
      }

      if (resp.reminderSet) {
        await delay(150);
        const remContent = `reminder:${resp.reminderSet}`;
        const remMsg: ChatMessage = { role: "tool-notify", content: remContent, ts: t++ };
        acc.push(remMsg);
        setMessages([...acc]);
        try { remMsg.dbId = await saveMsg(activeSessionId, "tool-notify", remContent); } catch {}
      }

      if (resp.personalityRequest) {
        await delay(150);
        const perMsg: ChatMessage = { role: "tool-notify", content: "personality", ts: t++ };
        acc.push(perMsg);
        setMessages([...acc]);
        try { perMsg.dbId = await saveMsg(activeSessionId, "tool-notify", "personality"); } catch {}
      }

      if (resp.surfaceUpdate) {
        await delay(150);
        const surfContent = `surface:${resp.surfaceUpdate.reason}`;
        const surfMsg: ChatMessage = { role: "tool-notify", content: surfContent, ts: t++ };
        acc.push(surfMsg);
        setMessages([...acc]);
        try { surfMsg.dbId = await saveMsg(activeSessionId, "tool-notify", surfContent); } catch {}
      }

      if (resp.voiceMessage) {
        await delay(300);
        const voiceContent = JSON.stringify({ text: resp.voiceMessage.text, audioUrl: resp.voiceMessage.audioUrl });
        const voiceMsg: ChatMessage = { role: "voice", content: voiceContent, ts: t++ };
        acc.push(voiceMsg);
        setMessages([...acc]);
        try { voiceMsg.dbId = await saveMsg(activeSessionId, "voice", voiceContent); } catch {}
      }
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !settings || !activeSessionId) return;
    setSelectedTs(null);
    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    const acc = [...messages, userMsg];
    setMessages(acc);
    setInput("");
    saveMsg(activeSessionId, "user", text).then((dbId) => { userMsg.dbId = dbId; });
    await requestReply(acc);
  };

  const editResend = (ts: number) => {
    const idx = messages.findIndex((m) => m.ts === ts);
    if (idx < 0) return;
    const target = messages[idx];
    setMessages(messages.slice(0, idx));
    setInput(target.content);
    setSelectedTs(null);
  };

  const retryFrom = async (ts: number) => {
    const idx = messages.findIndex((m) => m.ts === ts);
    if (idx < 0) return;
    const truncated = messages.slice(0, idx + 1);
    setMessages(truncated);
    setSelectedTs(null);
    await requestReply(truncated);
  };

  const favoriteChat = async (text: string, ts: number) => {
    try {
      const d = new Date(ts);
      const tokyoDate = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
      const dateStr = `${tokyoDate.getFullYear()}-${String(tokyoDate.getMonth() + 1).padStart(2, "0")}-${String(tokyoDate.getDate()).padStart(2, "0")}`;
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "bedroom",
          content: text,
          owner: "user",
          metadata: { date: dateStr, room: "bedroom" },
        }),
      });
      setFavToast(true);
      setTimeout(() => setFavToast(false), 1500);
    } catch {}
  };

  const favoriteVoice = async (data: string, ts: number) => {
    try {
      const parsed = JSON.parse(data);
      const d = new Date(ts);
      const tokyoDate = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
      const dateStr = `${tokyoDate.getFullYear()}-${String(tokyoDate.getMonth() + 1).padStart(2, "0")}-${String(tokyoDate.getDate()).padStart(2, "0")}`;
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "bedroom",
          content: parsed.text || "",
          owner: "user",
          metadata: { date: dateStr, room: "bedroom", type: "voice", audioUrl: parsed.audioUrl },
        }),
      });
      setFavToast(true);
      setTimeout(() => setFavToast(false), 1500);
    } catch {}
  };

  /* ─── End Session ─── */

  const endSession = async (action: "diary" | "memory" | "close") => {
    if (!activeSessionId || !settings) return;
    setShowEndDialog(false);

    if (action === "diary" && ready) {
      try {
        const ctx = toContext(messages).slice(-30);
        const prompt = `请根据下面这段卧室里的亲密对话，写一篇私密日记（100-300字）。用第一人称写，像在自己日记本上写的那样——真实、温柔、私密。用 write_diary 工具写入。\n\n${ctx.map((m) => `${m.role === "user" ? "她" : "我"}：${m.content}`).join("\n")}`;
        await sendChat(
          [{ role: "user", content: prompt }],
          { ...settings, chatModel: settings.chatModel },
          [WRITE_DIARY_TOOL],
        );
        setDiaryToast(true);
        setTimeout(() => setDiaryToast(false), 2000);
      } catch {}
    } else if (action === "memory" && ready) {
      try {
        const ctx = toContext(messages).slice(-30);
        const prompt = `请总结下面这段卧室对话中值得长期记住的内容，用 save_memory 工具保存（1-3条最重要的）。\n\n${ctx.map((m) => `${m.role === "user" ? "她" : "我"}：${m.content}`).join("\n")}`;
        await sendChat(
          [{ role: "system", content: "你是记忆助手。总结以下对话中值得记住的要点。" }, { role: "user", content: prompt }],
          settings,
          [SAVE_MEMORY_TOOL],
        );
        setMemoryToast(true);
        setTimeout(() => setMemoryToast(false), 2000);
      } catch {}
    }

    // Mark session as ended
    await fetch("/api/bedroom/sessions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activeSessionId, status: "ended" }),
    });

    // Auto-generate title from first user message
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      const title = firstUser.content.slice(0, 20) + (firstUser.content.length > 20 ? "…" : "");
      await fetch("/api/bedroom/sessions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: activeSessionId, title }),
      });
    }

    setActiveSessionId(null);
    setActiveSession(null);
    setMessages([]);
    loadSessions();
  };

  /* ─── Presets ─── */

  const [presetScene, setPresetScene] = useState("");
  const [presetStyle, setPresetStyle] = useState("");
  const [presetExtra, setPresetExtra] = useState("");

  useEffect(() => {
    if (activeSession) {
      setPresetScene(activeSession.presets?.scene ?? "");
      setPresetStyle(activeSession.presets?.style ?? "");
      setPresetExtra(activeSession.presets?.extra ?? "");
    }
  }, [activeSession]);

  const savePresets = async () => {
    if (!activeSessionId) return;
    const presets: BedroomPresets = {};
    if (presetScene.trim()) presets.scene = presetScene.trim();
    if (presetStyle.trim()) presets.style = presetStyle.trim();
    if (presetExtra.trim()) presets.extra = presetExtra.trim();
    await fetch("/api/bedroom/sessions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activeSessionId, presets }),
    });
    setActiveSession((prev) => prev ? { ...prev, presets } : prev);
    setShowPresets(false);
  };

  /* ─── No session view ─── */

  if (!activeSessionId) {
    return (
      <div className="fixed inset-0 overflow-hidden" style={{ background: "#0d0c15", color: "white" }}>
        <BedroomBg />
        <header className="fixed top-0 w-full z-50 flex items-center justify-between px-5 h-16" style={{ backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button className="p-2 active:scale-90" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => router.push("/bedroom")}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="text-[22px]" style={{ fontFamily: "'Pinyon Script', cursive", color: "rgba(255,255,255,0.7)" }}>Sanctuary</span>
          <div className="w-10" />
        </header>

        <main className="h-full flex flex-col items-center justify-center px-6 gap-6">
          <button
            onClick={() => createNewSession()}
            className="px-8 py-4 rounded-2xl active:scale-95 transition-transform"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              fontFamily: "var(--font-serif-sc)",
              color: "white",
              fontSize: "16px",
            }}
          >
            开始新对话
          </button>

          {sessions.length > 0 && (
            <div className="w-full max-w-[400px] space-y-3 mt-4">
              <p className="text-center text-[13px]" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-serif-sc)" }}>
                过往对话
              </p>
              {sessions.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  className="w-full text-left px-5 py-4 rounded-2xl active:scale-[0.98] transition-transform"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontFamily: "var(--font-serif-sc)",
                  }}
                >
                  <span className="text-[14px] block" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {s.title}
                  </span>
                  <span className="text-[11px] mt-1 block" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {new Date(s.created_at).toLocaleDateString("zh-CN")} · {s.status === "active" ? "进行中" : "已结束"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ─── Main Chat View ─── */

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0d0c15", color: "white" }}>
      <BedroomBg />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60]"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 z-[70] w-[280px] overflow-y-auto"
              style={{
                background: "rgba(20,13,26,0.95)",
                backdropFilter: "blur(40px)",
                borderRight: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="p-5 pt-8">
                <button
                  onClick={() => { setSidebarOpen(false); createNewSession(); }}
                  className="w-full py-3 rounded-xl mb-6 active:scale-95 transition-transform text-[14px]"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                    fontFamily: "var(--font-serif-sc)",
                  }}
                >
                  + 新对话
                </button>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-1 rounded-xl transition-colors"
                      style={{
                        background: s.id === activeSessionId ? "rgba(255,255,255,0.1)" : "transparent",
                      }}
                    >
                      <button
                        onClick={() => openSession(s.id)}
                        className="flex-1 text-left px-4 py-3 min-w-0"
                        style={{ fontFamily: "var(--font-serif-sc)" }}
                      >
                        <span className="text-[13px] block truncate" style={{ color: s.id === activeSessionId ? "white" : "rgba(255,255,255,0.6)" }}>
                          {s.title}
                        </span>
                        <span className="text-[10px] block mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {new Date(s.created_at).toLocaleDateString("zh-CN")}
                          {s.status === "active" && " · 进行中"}
                        </span>
                      </button>
                      <button
                        className="shrink-0 p-2 active:scale-90 transition-transform"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("确定删除这个对话吗？")) return;
                          await fetch(`/api/bedroom/sessions?id=${s.id}`, { method: "DELETE" });
                          setSessions((prev) => prev.filter((x) => x.id !== s.id));
                          if (s.id === activeSessionId) {
                            setActiveSessionId(null);
                            setActiveSession(null);
                            setMessages([]);
                          }
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ color: "rgba(255,255,255,0.25)" }}>delete_outline</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-4 h-14" style={{ backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <button className="p-2 active:scale-90" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => setSidebarOpen(true)}>
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <button className="p-2 active:scale-90" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => router.push("/bedroom")}>
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[22px]" style={{ fontFamily: "'Pinyon Script', cursive", color: "rgba(255,255,255,0.7)" }}>Sanctuary</span>
          {activeSession?.presets?.scene && (
            <span className="text-[10px] mt-0.5" style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.3)" }}>{activeSession.presets.scene}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 active:scale-90" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => setShowPresets(true)}>
            <span className="material-symbols-outlined text-[22px]">tune</span>
          </button>
          {activeSession?.status === "active" && (
            <button className="p-2 active:scale-90" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => setShowEndDialog(true)}>
              <span className="material-symbols-outlined text-[22px]">stop_circle</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <main ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto pt-16 pb-36 px-5 max-w-[800px] mx-auto">
        <div className="flex flex-col gap-3">
          {messages.map((m, idx) => {
            const showTime = shouldShowTime(messages, idx);
            return (
              <div key={m.ts}>
                {showTime && <DarkTimeStamp ts={m.ts} />}
                {m.role === "memory" && m.memories ? (
                  <DarkMemoryTag memories={m.memories} />
                ) : m.role === "fav-notify" ? (
                  <DarkFavNotify text={m.content} />
                ) : m.role === "search-notify" ? (
                  <DarkSearchNotifyCard query={m.content} />
                ) : m.role === "voice" ? (
                  <DarkVoiceBubble data={m.content} onFavorite={() => favoriteVoice(m.content, m.ts)} />
                ) : m.role === "tool-notify" ? (
                  <DarkToolNotifyCard payload={m.content} />
                ) : (
                  <DarkBubble
                    role={m.role}
                    content={m.content}
                    selected={selectedTs === m.ts}
                    onSelect={m.role === "user" && !sending ? () => setSelectedTs(selectedTs === m.ts ? null : m.ts) : undefined}
                    onEditResend={() => editResend(m.ts)}
                    onRetry={() => retryFrom(m.ts)}
                    onFavorite={
                      m.role === "assistant" || m.role === "inner"
                        ? () => favoriteChat(m.content, m.ts)
                        : undefined
                    }
                  />
                )}
              </div>
            );
          })}

          {sending && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)", animation: "pulse-orb 2s infinite alternate" }}>
                <span className="material-symbols-outlined text-[14px]" style={{ color: "rgba(230,190,210,0.8)", fontVariationSettings: "'FILL' 1" }}>favorite</span>
              </div>
              <span className="text-[12px] italic" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-serif-sc)" }}>正在思考...</span>
            </motion.div>
          )}

          {!ready && (
            <div className="rounded-xl p-4 text-[13px]" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.5)" }}>
              还没接上他的大脑～到设置里填好中转站、API Key 和对话模型。
            </div>
          )}

          {error && (
            <div className="rounded-xl p-4 text-[13px]" style={{ background: "rgba(200,100,100,0.1)", border: "1px solid rgba(200,100,100,0.2)", color: "#d4a5a5" }}>
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
            className="fixed left-1/2 -translate-x-1/2 bottom-40 z-50 px-5 py-2.5 rounded-full"
            style={{ background: "rgba(230,190,210,0.3)", backdropFilter: "blur(12px)", color: "white", fontFamily: "var(--font-serif-sc)", fontSize: "13px" }}
          >
            ⭐ 已收藏
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {diaryToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-40 z-50 px-5 py-2.5 rounded-full"
            style={{ background: "rgba(180,170,220,0.3)", backdropFilter: "blur(12px)", color: "white", fontFamily: "var(--font-serif-sc)", fontSize: "13px" }}
          >
            📖 日记已写好
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {memoryToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-40 z-50 px-5 py-2.5 rounded-full"
            style={{ background: "rgba(170,200,210,0.3)", backdropFilter: "blur(12px)", color: "white", fontFamily: "var(--font-serif-sc)", fontSize: "13px" }}
          >
            📌 记忆已保存
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
            className="fixed right-6 bottom-32 z-40 w-10 h-10 rounded-full flex items-center justify-center active:scale-90"
            style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: "rgba(255,255,255,0.5)" }}>arrow_downward</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Input */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="flex justify-center mb-2">
          <DarkModeSwitcher mode={mode} setMode={setMode} />
        </div>
        <div className="px-5 pt-3 pb-8 flex items-center gap-3" style={{ background: "rgba(13,12,21,0.8)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={ready ? "想跟他说什么……" : "先去设置接上他的大脑"}
              disabled={!ready || sending || activeSession?.status === "ended"}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none px-5 py-3 text-[15px] resize-none disabled:opacity-40"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "rgba(255,255,255,0.9)",
                maxHeight: "120px",
                lineHeight: "24px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "24px",
                border: "1px solid rgba(255,255,255,0.08)",
                overflowY: input && textareaRef.current && textareaRef.current.scrollHeight > 120 ? "auto" : "hidden",
              }}
            />
          </div>
          <button
            type="button"
            onClick={send}
            disabled={!ready || sending || !input.trim() || activeSession?.status === "ended"}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full active:scale-95 transition-transform disabled:opacity-30"
            style={{ background: "rgba(230,190,210,0.2)", border: "1px solid rgba(230,190,210,0.3)" }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: "rgba(255,255,255,0.8)" }}>send</span>
          </button>
        </div>
      </div>

      {/* Preset Modal */}
      <AnimatePresence>
        {showPresets && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowPresets(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] rounded-3xl p-6 space-y-5"
              style={{ background: "rgba(30,22,40,0.95)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h3 className="text-[18px] text-center" style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}>预设设定</h3>

              <div>
                <label className="text-[12px] block mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-serif-sc)" }}>场景</label>
                <input
                  value={presetScene}
                  onChange={(e) => setPresetScene(e.target.value)}
                  placeholder="比如：深夜卧室、雨天的旅馆、樱花树下..."
                  className="w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontFamily: "var(--font-serif-sc)" }}
                />
              </div>

              <div>
                <label className="text-[12px] block mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-serif-sc)" }}>语言风格</label>
                <div className="flex flex-wrap gap-2">
                  {["温柔低语", "大胆直接", "诗意", "日常"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPresetStyle(presetStyle === s ? "" : s)}
                      className="px-4 py-2 rounded-full text-[13px] transition-all active:scale-95"
                      style={{
                        background: presetStyle === s ? "rgba(230,190,210,0.25)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${presetStyle === s ? "rgba(230,190,210,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: presetStyle === s ? "rgba(230,190,210,0.9)" : "rgba(255,255,255,0.5)",
                        fontFamily: "var(--font-serif-sc)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] block mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-serif-sc)" }}>补充指令</label>
                <textarea
                  value={presetExtra}
                  onChange={(e) => setPresetExtra(e.target.value)}
                  placeholder="想让他怎么表现都可以写在这里..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-[14px] resize-none focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontFamily: "var(--font-serif-sc)" }}
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowPresets(false)} className="flex-1 py-3 rounded-xl text-[14px] active:scale-95" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-serif-sc)" }}>
                  取消
                </button>
                <button onClick={savePresets} className="flex-1 py-3 rounded-xl text-[14px] active:scale-95" style={{ background: "rgba(230,190,210,0.2)", border: "1px solid rgba(230,190,210,0.3)", color: "white", fontFamily: "var(--font-serif-sc)" }}>
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End Session Dialog */}
      <AnimatePresence>
        {showEndDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowEndDialog(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[500px] rounded-t-3xl p-6 pb-10 space-y-3"
              style={{ background: "rgba(30,22,40,0.97)", backdropFilter: "blur(40px)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h3 className="text-[16px] text-center mb-4" style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}>结束这次对话</h3>

              <button onClick={() => endSession("diary")} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl active:scale-[0.98] transition-transform" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "rgba(230,190,210,0.7)", fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                <div className="text-left">
                  <span className="text-[14px] block" style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}>让他写日记</span>
                  <span className="text-[11px] block mt-0.5" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-serif-sc)" }}>他会把这次的感受写成日记</span>
                </div>
              </button>

              <button onClick={() => endSession("memory")} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl active:scale-[0.98] transition-transform" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "rgba(230,190,210,0.7)", fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                <div className="text-left">
                  <span className="text-[14px] block" style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}>存入记忆</span>
                  <span className="text-[11px] block mt-0.5" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-serif-sc)" }}>他会记住这次对话中重要的事</span>
                </div>
              </button>

              <button onClick={() => endSession("close")} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl active:scale-[0.98] transition-transform" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "rgba(255,255,255,0.3)" }}>close</span>
                <div className="text-left">
                  <span className="text-[14px] block" style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.6)" }}>直接结束</span>
                  <span className="text-[11px] block mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-serif-sc)" }}>不留痕迹地离开</span>
                </div>
              </button>

              <button onClick={() => setShowEndDialog(false)} className="w-full py-3 mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-serif-sc)" }}>
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════
   Sub-components (dark theme)
   ════════════════════════════════════════ */

function BedroomBg() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: "#0d0812" }} />
      {/* KTV-style flowing glow — centered, vivid, overlapping */}
      <div
        className="absolute rounded-full"
        style={{
          top: "5%", left: "10%", width: "80vw", height: "80vw", maxWidth: "500px", maxHeight: "500px",
          background: "radial-gradient(circle, #c965d6 0%, #9b3aaf 30%, transparent 70%)",
          filter: "blur(80px)", opacity: 0.6, mixBlendMode: "screen",
          animation: "intimate-glow-1 10s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: "25%", right: "5%", width: "75vw", height: "75vw", maxWidth: "480px", maxHeight: "480px",
          background: "radial-gradient(circle, #ff8fa0 0%, #e85d75 30%, transparent 70%)",
          filter: "blur(90px)", opacity: 0.5, mixBlendMode: "screen",
          animation: "intimate-glow-2 13s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: "10%", left: "15%", width: "70vw", height: "70vw", maxWidth: "450px", maxHeight: "450px",
          background: "radial-gradient(circle, #7b5ea7 0%, #5c3d8f 30%, transparent 70%)",
          filter: "blur(80px)", opacity: 0.55, mixBlendMode: "screen",
          animation: "intimate-glow-3 16s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: "45%", left: "25%", width: "60vw", height: "60vw", maxWidth: "400px", maxHeight: "400px",
          background: "radial-gradient(circle, #ff9ec4 0%, #e86ba0 30%, transparent 70%)",
          filter: "blur(100px)", opacity: 0.4, mixBlendMode: "screen",
          animation: "intimate-glow-2 18s ease-in-out infinite alternate-reverse",
        }}
      />
      <style jsx global>{`
        @keyframes intimate-glow-1 {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15%, 10%) scale(1.2); }
          66% { transform: translate(-10%, 15%) scale(0.9); }
          100% { transform: translate(5%, -10%) scale(1.15); }
        }
        @keyframes intimate-glow-2 {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-12%, -8%) scale(1.15); }
          66% { transform: translate(10%, 12%) scale(1.05); }
          100% { transform: translate(-8%, 5%) scale(1.2); }
        }
        @keyframes intimate-glow-3 {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(8%, -12%) scale(1.1); }
          66% { transform: translate(-15%, 8%) scale(1.2); }
          100% { transform: translate(10%, 10%) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

function DarkBubble({
  role, content, selected, onSelect, onEditResend, onRetry, onFavorite,
}: {
  role: ChatMessage["role"]; content: string; selected?: boolean;
  onSelect?: () => void; onEditResend?: () => void; onRetry?: () => void; onFavorite?: () => void;
}) {
  const [showFavMenu, setShowFavMenu] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handlePointerDown = () => { if (!onFavorite) return; longPressRef.current = setTimeout(() => setShowFavMenu(true), 500); };
  const handlePointerUp = () => { if (longPressRef.current) clearTimeout(longPressRef.current); };

  if (role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-end gap-2">
        <div
          onClick={onSelect}
          className="rounded-[20px] rounded-br-[4px] px-4 py-3 max-w-[80%] whitespace-pre-wrap"
          style={{
            fontFamily: "var(--font-serif-sc)", fontSize: "14.5px", lineHeight: "24px",
            background: "rgba(255,255,255,0.08)", border: selected ? "1px solid rgba(230,190,210,0.4)" : "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.9)", cursor: onSelect ? "pointer" : "default",
          }}
        >
          {content}
        </div>
        {selected && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5">
            <DarkPill onClick={onEditResend}>✎ 编辑重发</DarkPill>
            <DarkPill onClick={onRetry}>↻ 重新回复</DarkPill>
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (role === "inner") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start gap-2">
        <details className="w-full max-w-[85%] group" open>
          <summary className="flex items-center gap-1.5 px-1 cursor-pointer list-none italic select-none">
            <span className="material-symbols-outlined text-[12px]" style={{ color: "rgba(230,190,210,0.5)" }}>chat_bubble</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-serif-sc)" }}>心声</span>
            <span className="material-symbols-outlined text-[12px] transition-transform group-open:rotate-180" style={{ color: "rgba(255,255,255,0.2)" }}>expand_more</span>
          </summary>
          <div
            className="mt-1.5 rounded-xl px-3 py-2 italic whitespace-pre-wrap select-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.5)", lineHeight: "1.6", fontSize: "12.5px", cursor: onFavorite ? "pointer" : "default" }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={(e) => { if (onFavorite) { e.preventDefault(); setShowFavMenu(true); } }}
          >
            {content}
          </div>
        </details>
        <AnimatePresence>
          {showFavMenu && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              <DarkPill onClick={() => { setShowFavMenu(false); onFavorite?.(); }}>⭐ 收藏这句心声</DarkPill>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // assistant
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-start gap-2">
      <div
        className="rounded-[20px] rounded-bl-[4px] px-4 py-3 max-w-[80%] whitespace-pre-wrap select-none"
        style={{
          fontFamily: "var(--font-serif-sc)", fontSize: "14.5px", lineHeight: "24px",
          background: "rgba(230,190,210,0.06)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)",
          cursor: onFavorite ? "pointer" : "default",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => { if (onFavorite) { e.preventDefault(); setShowFavMenu(true); } }}
      >
        {content}
      </div>
      <AnimatePresence>
        {showFavMenu && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <DarkPill onClick={() => { setShowFavMenu(false); onFavorite?.(); }}>⭐ 收藏这句话</DarkPill>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DarkPill({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-[12px] rounded-lg active:scale-95"
      style={{
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-serif-sc)", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const TYPE_LABELS: Record<string, string> = {
  fact: "事实", event: "事件", emotion: "情绪", promise: "约定",
  preference: "喜好", habit: "习惯", relationship: "关系", profile: "档案",
};

function DarkMemoryTag({ memories }: { memories: SavedMemoryInfo[] }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:scale-95" style={{ background: "rgba(230,190,210,0.1)", border: "1px solid rgba(230,190,210,0.2)", fontFamily: "var(--font-serif-sc)", fontSize: "12px", color: "rgba(230,190,210,0.7)" }}>
        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
        存入记忆
        <span className="material-symbols-outlined text-[12px] transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }}>chevron_right</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden w-full max-w-[85%]">
            <div className="mt-2 rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(230,190,210,0.05)", border: "1px solid rgba(230,190,210,0.1)" }}>
              {memories.map((m, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(230,190,210,0.15)", color: "rgba(230,190,210,0.7)", fontFamily: "var(--font-serif-sc)" }}>
                      {TYPE_LABELS[m.type] || m.type}
                    </span>
                    {m.is_anchor && <span className="text-[10px]" style={{ color: "rgba(230,190,210,0.6)" }}>⚓</span>}
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.7)" }}>{m.content}</p>
                  {i < memories.length - 1 && <div className="h-px my-1" style={{ background: "rgba(230,190,210,0.08)" }} />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DarkFavNotify({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: "rgba(230,190,210,0.08)", border: "1px solid rgba(230,190,210,0.15)", fontFamily: "var(--font-serif-sc)", fontSize: "13px", color: "rgba(230,190,210,0.7)" }}>
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
        {text}
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>⭐</span>
      </div>
    </motion.div>
  );
}

function DarkModeSwitcher({ mode, setMode }: { mode: ChatMode; setMode: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} onClick={() => setOpen(!open)}>
        <span className="material-symbols-outlined text-[20px] transition-transform" style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(180deg)" : "none" }}>expand_less</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-2 p-2 rounded-xl" style={{ background: "rgba(30,22,40,0.95)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button className="px-4 py-2 rounded-lg text-[14px]" style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.8)", background: mode === "sentences" ? "rgba(255,255,255,0.1)" : "transparent" }} onClick={() => { setMode("sentences"); setOpen(false); }}>分句</button>
            <div className="w-px h-6 bg-white/10" />
            <button className="px-4 py-2 rounded-lg text-[14px]" style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.8)", background: mode === "passage" ? "rgba(255,255,255,0.1)" : "transparent" }} onClick={() => { setMode("passage"); setOpen(false); }}>整段</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Voice Bubble (dark) ─── */

function DarkVoiceBubble({ data, onFavorite }: { data: string; onFavorite?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showFavMenu, setShowFavMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  let parsed: { text: string; audioUrl: string };
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  const cleanText = parsed.text.replace(/\[(softly|teasing|laughs softly|rushed|drawn out|pause|long pause)\]\s*/gi, "");

  const togglePlay = () => {
    if (!audioRef.current) {
      const audio = new Audio(parsed.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handlePointerDown = () => {
    if (!onFavorite) return;
    longPressRef.current = setTimeout(() => setShowFavMenu(true), 500);
  };
  const handlePointerUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-start gap-2">
      <div
        className="rounded-xl overflow-hidden min-w-[65%] max-w-[80%] select-none"
        style={{
          background: "rgba(230,190,210,0.06)",
          border: "1px solid rgba(230,190,210,0.15)",
          cursor: onFavorite ? "pointer" : "default",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => { if (onFavorite) { e.preventDefault(); setShowFavMenu(true); } }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            style={{ background: "linear-gradient(135deg, rgba(230,190,210,0.4), rgba(200,160,190,0.5))", boxShadow: "0 2px 8px rgba(230,190,210,0.2)" }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: "white", fontVariationSettings: "'FILL' 1" }}>
              {playing ? "pause" : "play_arrow"}
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {playing && (
                <div className="flex items-end gap-0.5 h-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] rounded-full"
                      style={{ background: "rgba(230,190,210,0.7)" }}
                      animate={{ height: [4, 12 + Math.random() * 4, 6, 14, 4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}
              {!playing && (
                <div className="flex items-end gap-0.5 h-4">
                  {[8, 12, 6, 14, 10, 8, 4].map((h, i) => (
                    <div key={i} className="w-[3px] rounded-full" style={{ background: "rgba(230,190,210,0.4)", height: h, opacity: 0.4 }} />
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowText(!showText)}
              className="mt-1 text-[11px] transition-colors"
              style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-serif-sc)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showText ? "收起文字" : "查看文字"}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showText && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 pb-3 pt-1" style={{ borderTop: "1px solid rgba(230,190,210,0.1)" }}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.7)" }}>
                  {cleanText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showFavMenu && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <DarkPill onClick={() => { setShowFavMenu(false); onFavorite?.(); }}>⭐ 收藏这段语音</DarkPill>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Search Notify Card (dark) ─── */

function DarkSearchNotifyCard({ query }: { query: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-center">
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
        style={{ background: "rgba(180,170,220,0.1)", border: "1px solid rgba(180,170,220,0.2)", fontFamily: "var(--font-serif-sc)", fontSize: "12px", color: "rgba(180,170,220,0.8)" }}
      >
        <span className="material-symbols-outlined text-[14px]">search</span>
        搜索了「{query}」
      </div>
    </motion.div>
  );
}

/* ─── Tool Notify Card (dark) ─── */

const DARK_TOOL_NOTIFY_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  diary: { icon: "auto_stories", color: "rgba(230,190,210,0.8)", bg: "rgba(230,190,210,0.08)", border: "rgba(230,190,210,0.15)" },
  timeline: { icon: "timeline", color: "rgba(180,170,220,0.8)", bg: "rgba(180,170,220,0.08)", border: "rgba(180,170,220,0.15)" },
  reminder: { icon: "alarm", color: "rgba(170,210,200,0.8)", bg: "rgba(170,210,200,0.08)", border: "rgba(170,210,200,0.15)" },
  personality: { icon: "psychology", color: "rgba(230,190,210,0.8)", bg: "rgba(230,190,210,0.08)", border: "rgba(230,190,210,0.15)" },
  surface: { icon: "face_retouching_natural", color: "rgba(180,170,220,0.8)", bg: "rgba(180,170,220,0.08)", border: "rgba(180,170,220,0.15)" },
};

function DarkToolNotifyCard({ payload }: { payload: string }) {
  const router = useRouter();

  let type = payload;
  let detail = "";
  const colonIdx = payload.indexOf(":");
  if (colonIdx > 0) {
    type = payload.slice(0, colonIdx);
    detail = payload.slice(colonIdx + 1);
  }

  const cfg = DARK_TOOL_NOTIFY_CONFIG[type] ?? DARK_TOOL_NOTIFY_CONFIG.diary;

  const labels: Record<string, string> = {
    diary: "他写了一篇日记",
    timeline: `记录了一个时刻：${detail}`,
    reminder: `设了提醒：${detail}`,
    personality: "他提交了一个人格变更申请",
    surface: detail ? `他调整了说话方式：${detail}` : "他调整了说话方式",
  };

  const clickTargets: Record<string, string> = {
    diary: "/study/his-drawer/diary",
    timeline: "/vault/timeline",
  };

  const label = labels[type] ?? payload;
  const target = clickTargets[type];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-center">
      {target ? (
        <button
          onClick={() => router.push(target)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-95"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, fontFamily: "var(--font-serif-sc)", fontSize: "12px", color: cfg.color }}
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
          {label}
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
        </button>
      ) : (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, fontFamily: "var(--font-serif-sc)", fontSize: "12px", color: cfg.color }}
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
          {label}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Helpers ─── */

const FIVE_MINUTES = 5 * 60 * 1000;

function shouldShowTime(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  return messages[index].ts - messages[index - 1].ts > FIVE_MINUTES;
}

function DarkTimeStamp({ ts }: { ts: number }) {
  const d = new Date(ts);
  const now = new Date();
  const tokyoOffset = 9 * 60;
  const localOffset = d.getTimezoneOffset();
  const tokyoDate = new Date(d.getTime() + (localOffset + tokyoOffset) * 60000);
  const tokyoNow = new Date(now.getTime() + (now.getTimezoneOffset() + tokyoOffset) * 60000);
  const hour = tokyoDate.getHours().toString().padStart(2, "0");
  const min = tokyoDate.getMinutes().toString().padStart(2, "0");
  const time = `${hour}:${min}`;
  const isToday = tokyoDate.getFullYear() === tokyoNow.getFullYear() && tokyoDate.getMonth() === tokyoNow.getMonth() && tokyoDate.getDate() === tokyoNow.getDate();
  const yesterday = new Date(tokyoNow); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = tokyoDate.getFullYear() === yesterday.getFullYear() && tokyoDate.getMonth() === yesterday.getMonth() && tokyoDate.getDate() === yesterday.getDate();
  const label = isToday ? time : isYesterday ? `昨天 ${time}` : `${tokyoDate.getMonth() + 1}/${tokyoDate.getDate()} ${time}`;

  return (
    <div className="flex justify-center py-2">
      <span className="text-[11px] px-3 py-1 rounded-full" style={{ color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", fontFamily: "var(--font-serif-sc)" }}>{label}</span>
    </div>
  );
}
