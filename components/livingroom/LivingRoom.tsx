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
  SAVE_TIMELINE_TOOL,
  WEB_SEARCH_TOOL,
  SET_REMINDER_TOOL,
  REQUEST_PERSONALITY_CHANGE_TOOL,
  UPDATE_SURFACE_PERSONALITY_TOOL,
  SEND_VOICE_TOOL,
  SEND_STICKER_TOOL,
  INVITE_BEDROOM_TOOL,
  parseReply,
  type ChatMode,
  type ContentPart,
} from "@/lib/brain/personality";
import {
  getHistoryWindow,
  loadHistory,
  saveHistory,
  loadHistoryFromDb,
  saveMessageToDb,
  toContext,
  type ChatMessage,
  type DiaryShareData,
} from "@/lib/brain/memory";
import { clearChatMessages } from "@/lib/brain/db";
import { STICKER_PACKS, ALL_STICKERS } from "@/lib/stickers";
import { sendChat, fetchEmbedding, type SavedMemoryInfo } from "@/lib/brain/client";
import { supabase } from "@/lib/supabase";

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
  const [showPlus, setShowPlus] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [pendingSticker, setPendingSticker] = useState<{ id: string; url: string; alt: string } | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          saveMessageToDb("diary-notify", id).then((dbId) => { notif.dbId = dbId; }).catch(() => {});
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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

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
    const ctx = toContext(base.slice(0, -1)).slice(-getHistoryWindow());
    setSending(true);
    setError(null);
    try {
      let userContent: string | ContentPart[] = last.content;
      try {
        const p = JSON.parse(last.content);
        if (p?.type === "image" && p.imageUrl) {
          userContent = [
            { type: "image_url", image_url: { url: p.imageUrl } },
            { type: "text", text: p.caption
              ? `她发了一张图片，并说：「${p.caption}」\n仔细看看图片内容，结合她说的话自然地回应。`
              : "她发了一张图片给你看。仔细看看图片内容，然后自然地回应她。" },
          ];
        }
      } catch {}
      const queryText = typeof userContent === "string" ? userContent : "";
      const queryEmbedding = queryText ? await fetchEmbedding(queryText, settings) : [];
      const assembled = await buildMessages(ctx, userContent, mode, queryEmbedding);
      const resp = await sendChat(assembled, settings, [SAVE_MEMORY_TOOL, SAVE_FAVORITE_TOOL, WRITE_DIARY_TOOL, SAVE_TIMELINE_TOOL, WEB_SEARCH_TOOL, SET_REMINDER_TOOL, SEND_VOICE_TOOL, SEND_STICKER_TOOL, REQUEST_PERSONALITY_CHANGE_TOOL, UPDATE_SURFACE_PERSONALITY_TOOL, INVITE_BEDROOM_TOOL]);
      const { inner, parts } = parseReply(resp.content, mode);
      setSending(false);

      const acc = [...base];
      let t = Date.now();

      if (resp.savedMemories && resp.savedMemories.length > 0) {
        await delay(150);
        const memMsg: ChatMessage = { role: "memory", content: "", ts: t++, memories: resp.savedMemories };
        acc.push(memMsg);
        setMessages([...acc]);
        try { memMsg.dbId = await saveMessageToDb("memory", JSON.stringify({ memories: resp.savedMemories })); } catch {}
        saveHistory(acc);
      }

      if (resp.savedFavorites && resp.savedFavorites.length > 0) {
        await delay(150);
        const favContent = resp.savedFavorites[0].source === "diary" ? "他收藏了你的日记" : "他收藏了你的话";
        const favMsg: ChatMessage = { role: "fav-notify", content: favContent, ts: t++ };
        acc.push(favMsg);
        setMessages([...acc]);
        try { favMsg.dbId = await saveMessageToDb("fav-notify", favContent); } catch {}
        saveHistory(acc);
      }

      if (resp.searchQuery) {
        await delay(150);
        const searchMsg: ChatMessage = { role: "search-notify", content: resp.searchQuery, ts: t++ };
        acc.push(searchMsg);
        setMessages([...acc]);
        try { searchMsg.dbId = await saveMessageToDb("search-notify", resp.searchQuery); } catch {}
        saveHistory(acc);
      }

      if (inner) {
        await delay(220);
        const innerMsg: ChatMessage = { role: "inner", content: inner, ts: t++ };
        acc.push(innerMsg);
        setMessages([...acc]);
        try { innerMsg.dbId = await saveMessageToDb("inner", inner); } catch {}
        saveHistory(acc);
      }
      for (const p of parts) {
        await delay(mode === "sentences" ? 620 : 280);
        const asstMsg: ChatMessage = { role: "assistant", content: p, ts: t++ };
        acc.push(asstMsg);
        setMessages([...acc]);
        try { asstMsg.dbId = await saveMessageToDb("assistant", p); } catch {}
        saveHistory(acc);
      }

      if (resp.bedroomInvite) {
        await delay(400);
        acc.push({ role: "bedroom-invite", content: resp.bedroomInvite, ts: t++ });
        setMessages([...acc]);
        saveHistory(acc);
      }

      if (resp.diaryWritten) {
        await delay(150);
        const diaryMsg: ChatMessage = { role: "tool-notify", content: "diary", ts: t++ };
        acc.push(diaryMsg);
        setMessages([...acc]);
        try { diaryMsg.dbId = await saveMessageToDb("tool-notify", "diary"); } catch {}
        saveHistory(acc);
      }

      if (resp.timelineEvent) {
        await delay(150);
        const tlContent = `timeline:${resp.timelineEvent}`;
        const tlMsg: ChatMessage = { role: "tool-notify", content: tlContent, ts: t++ };
        acc.push(tlMsg);
        setMessages([...acc]);
        try { tlMsg.dbId = await saveMessageToDb("tool-notify", tlContent); } catch {}
        saveHistory(acc);
      }

      if (resp.reminderSet) {
        await delay(150);
        const remContent = `reminder:${resp.reminderSet}`;
        const remMsg: ChatMessage = { role: "tool-notify", content: remContent, ts: t++ };
        acc.push(remMsg);
        setMessages([...acc]);
        try { remMsg.dbId = await saveMessageToDb("tool-notify", remContent); } catch {}
        saveHistory(acc);
      }

      if (resp.personalityRequest) {
        await delay(150);
        const perMsg: ChatMessage = { role: "tool-notify", content: "personality", ts: t++ };
        acc.push(perMsg);
        setMessages([...acc]);
        try { perMsg.dbId = await saveMessageToDb("tool-notify", "personality"); } catch {}
        saveHistory(acc);
      }

      if (resp.surfaceUpdate) {
        await delay(150);
        const surfContent = `surface:${resp.surfaceUpdate.reason}`;
        const surfMsg: ChatMessage = { role: "tool-notify", content: surfContent, ts: t++ };
        acc.push(surfMsg);
        setMessages([...acc]);
        try { surfMsg.dbId = await saveMessageToDb("tool-notify", surfContent); } catch {}
        saveHistory(acc);
      }

      if (resp.voiceMessage) {
        await delay(300);
        const voiceContent = JSON.stringify({ text: resp.voiceMessage.text, audioUrl: resp.voiceMessage.audioUrl });
        const voiceMsg: ChatMessage = { role: "voice", content: voiceContent, ts: t++ };
        acc.push(voiceMsg);
        setMessages([...acc]);
        try { voiceMsg.dbId = await saveMessageToDb("voice", voiceContent); } catch {}
        saveHistory(acc);
      }

      if (resp.stickerMessage) {
        await delay(200);
        const stickerContent = JSON.stringify({ type: "sticker", stickerId: resp.stickerMessage.stickerId, url: resp.stickerMessage.url, alt: resp.stickerMessage.alt });
        const stickerMsg: ChatMessage = { role: "assistant", content: stickerContent, ts: t++ };
        acc.push(stickerMsg);
        setMessages([...acc]);
        try { stickerMsg.dbId = await saveMessageToDb("assistant", stickerContent); } catch {}
        saveHistory(acc);
      }
    } catch (e) {
      setSending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const send = async () => {
    if (sending || !settings) return;
    const text = input.trim();

    if (pendingImage) {
      const caption = text;
      const imgFile = pendingImage.file;
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
      setInput("");
      setSelectedTs(null);
      setShowPlus(false);

      const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${imgFile.name.split(".").pop() || "jpg"}`;
      setSending(true);
      const { error: uploadErr } = await supabase.storage
        .from("chat-images")
        .upload(fileName, imgFile, { contentType: imgFile.type });
      if (uploadErr) {
        setSending(false);
        setError(`图片上传失败: ${uploadErr.message}`);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      const content = JSON.stringify({ type: "image", imageUrl: urlData.publicUrl, ...(caption ? { caption } : {}) });
      const msg: ChatMessage = { role: "user", content, ts: Date.now() };
      const acc = [...messages, msg];
      setMessages(acc);
      saveHistory(acc);
      setSending(false);
      saveMessageToDb("user", content).then((dbId) => {
        msg.dbId = dbId;
        saveHistory(acc);
      }).catch(() => {});
      await requestReply(acc);
      return;
    }

    if (pendingSticker) {
      const caption = text;
      const stickerData = pendingSticker;
      setPendingSticker(null);
      setInput("");
      setSelectedTs(null);

      const content = JSON.stringify({ type: "sticker", stickerId: stickerData.id, url: stickerData.url, alt: stickerData.alt, ...(caption ? { caption } : {}) });
      const msg: ChatMessage = { role: "user", content, ts: Date.now() };
      const acc = [...messages, msg];
      setMessages(acc);
      saveHistory(acc);
      saveMessageToDb("user", content).then((dbId) => { msg.dbId = dbId; saveHistory(acc); }).catch(() => {});
      await requestReply(acc);
      return;
    }

    if (!text) return;
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

  const sendSticker = (stickerId: string) => {
    const sticker = ALL_STICKERS.find(s => s.id === stickerId);
    if (!sticker) return;
    setShowPlus(false);
    setShowStickerPanel(false);
    setPendingSticker({ id: sticker.id, url: sticker.url, alt: sticker.alt });
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

  const tokyoDateStr = (ts: number) => {
    const d = new Date(ts);
    const t = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };

  const favoriteChat = async (text: string, ts: number) => {
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          content: text,
          owner: "user",
          metadata: { date: tokyoDateStr(ts), room: "living-room" },
        }),
      });
      setFavToast(true);
      setTimeout(() => setFavToast(false), 1500);
    } catch {}
  };

  const favoriteVoice = async (data: string, ts: number) => {
    try {
      const parsed = JSON.parse(data);
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          content: parsed.text || "",
          owner: "user",
          metadata: { date: tokyoDateStr(ts), room: "living-room", type: "voice", audioUrl: parsed.audioUrl },
        }),
      });
      setFavToast(true);
      setTimeout(() => setFavToast(false), 1500);
    } catch {}
  };

  const favoriteImage = async (data: string, ts: number) => {
    try {
      const parsed = JSON.parse(data);
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          content: parsed.caption || "图片",
          owner: "user",
          metadata: { date: tokyoDateStr(ts), room: "living-room", type: "image", imageUrl: parsed.imageUrl },
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setShowPlus(false);
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
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
                ) : m.role === "search-notify" ? (
                  <SearchNotifyCard query={m.content} />
                ) : m.role === "voice" ? (
                  <VoiceBubble data={m.content} onFavorite={() => favoriteVoice(m.content, m.ts)} />
                ) : isStickerMessage(m.content) ? (
                  <StickerBubble data={m.content} align={m.role === "user" ? "right" : "left"} />
                ) : isImageMessage(m.content) ? (
                  <ImageBubble data={m.content} onFavorite={() => favoriteImage(m.content, m.ts)} />
                ) : m.role === "tool-notify" ? (
                  <ToolNotifyCard payload={m.content} />
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Bottom bar: mode switcher + input */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="flex justify-center mb-3">
          <ModeSwitcher mode={mode} setMode={setMode} />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.4)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.5)",
          }}
        >
          <AnimatePresence>
            {showPlus && (
              <PlusPanel
                onImage={() => fileInputRef.current?.click()}
                onSticker={() => { setShowPlus(false); setShowStickerPanel(true); }}
                onLink={() => { setShowPlus(false); setShowLinkInput(true); }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showLinkInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="px-5 py-3 flex items-center gap-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}
                >
                  <div className="flex-1 relative">
                    <div className="absolute inset-0 neu-pressed rounded-full -z-10" />
                    <input
                      autoFocus
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && linkUrl.trim()) {
                          const url = linkUrl.trim();
                          setLinkUrl("");
                          setShowLinkInput(false);
                          const msg: ChatMessage = { role: "user", content: url, ts: Date.now() };
                          const acc = [...messages, msg];
                          setMessages(acc);
                          saveHistory(acc);
                          saveMessageToDb("user", url).then((dbId) => { msg.dbId = dbId; saveHistory(acc); }).catch(() => {});
                          requestReply(acc);
                        }
                      }}
                      placeholder="粘贴链接地址…"
                      className="w-full bg-transparent border-none focus:ring-0 focus:outline-none px-4 py-2 text-[14px]"
                      style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (linkUrl.trim()) {
                        const url = linkUrl.trim();
                        setLinkUrl("");
                        setShowLinkInput(false);
                        const msg: ChatMessage = { role: "user", content: url, ts: Date.now() };
                        const acc = [...messages, msg];
                        setMessages(acc);
                        saveHistory(acc);
                        saveMessageToDb("user", url).then((dbId) => { msg.dbId = dbId; saveHistory(acc); }).catch(() => {});
                        requestReply(acc);
                      }
                    }}
                    disabled={!linkUrl.trim()}
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full active:scale-95 transition-transform disabled:opacity-30"
                    style={{ background: "linear-gradient(135deg, #eddcff, #ffdad9)" }}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--text-deep)" }}>send</span>
                  </button>
                  <button
                    onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full active:scale-95 transition-transform"
                    style={{ background: "rgba(255,255,255,0.5)" }}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--text-faint)" }}>close</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sticker panel */}
          <AnimatePresence>
            {showStickerPanel && (
              <StickerPickerPanel
                onSelect={(id) => sendSticker(id)}
                onClose={() => setShowStickerPanel(false)}
              />
            )}
          </AnimatePresence>

          {/* Image preview */}
          <AnimatePresence>
            {pendingImage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pt-3 pb-2 flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={pendingImage.previewUrl}
                      alt="待发送"
                      className="w-16 h-16 object-cover rounded-xl"
                      style={{
                        boxShadow: "4px 4px 8px #e0dbdb, -4px -4px 8px #ffffff",
                        border: "1px solid rgba(255,255,255,0.4)",
                      }}
                    />
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(pendingImage.previewUrl);
                        setPendingImage(null);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(123,84,85,0.8)",
                        color: "white",
                        fontSize: "12px",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <span
                    className="text-[12px] pt-1"
                    style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)" }}
                  >
                    可以在下方输入文字说明，一起发送
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sticker preview */}
          <AnimatePresence>
            {pendingSticker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pt-3 pb-2 flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={pendingSticker.url}
                      alt={pendingSticker.alt}
                      className="w-16 h-16 object-contain rounded-xl"
                      style={{
                        boxShadow: "4px 4px 8px #e0dbdb, -4px -4px 8px #ffffff",
                        border: "1px solid rgba(255,255,255,0.4)",
                        background: "rgba(255,255,255,0.5)",
                      }}
                    />
                    <button
                      onClick={() => setPendingSticker(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(123,84,85,0.8)",
                        color: "white",
                        fontSize: "12px",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <span
                    className="text-[12px] pt-1"
                    style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)" }}
                  >
                    可以在下方输入文字，和表情包一起发送
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-5 pt-3 pb-8 flex items-center gap-3">
          <button
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full neu-flat active:scale-95 transition-transform"
            style={{ color: "var(--primary)" }}
            onClick={() => setShowPlus(!showPlus)}
          >
            <span
              className="material-symbols-outlined transition-transform duration-200"
              style={{ transform: showPlus ? "rotate(45deg)" : "none" }}
            >
              add
            </span>
          </button>

          <div className="flex-1 relative">
            <div className="absolute inset-0 neu-pressed rounded-[24px] -z-10" />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={pendingImage ? "添加文字说明（可选）" : pendingSticker ? "配一句话（可选）" : ready ? `想对${DEFAULT_NAME}说点什么…` : "先去设置接上他的大脑"}
              disabled={!ready || sending}
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none px-5 py-3 text-[16px] resize-none disabled:opacity-60"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--text-deep)",
                maxHeight: "120px",
                lineHeight: "24px",
                overflowY: input && textareaRef.current && textareaRef.current.scrollHeight > 120 ? "auto" : "hidden",
              }}
            />
          </div>

          <button
            type="button"
            onClick={send}
            disabled={!ready || sending || (!input.trim() && !pendingImage && !pendingSticker)}
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
  const urls = extractUrls(content);

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
        {urls.map((u) => (
          <LinkCard key={u} url={u} />
        ))}
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
      <InnerBubble content={content} onFavorite={onFavorite} />
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
      {urls.map((u) => (
        <LinkCard key={u} url={u} />
      ))}
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

/* ─── Search Notify Card ─── */

function SearchNotifyCard({ query }: { query: string }) {
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
          background: "rgba(103,87,126,0.08)",
          border: "1px solid rgba(103,87,126,0.15)",
          fontFamily: "var(--font-serif-sc)",
          fontSize: "12px",
          color: "var(--accent-wisteria)",
        }}
      >
        <span className="material-symbols-outlined text-[14px]">search</span>
        搜索了「{query}」
      </div>
    </motion.div>
  );
}

/* ─── Inner Bubble (with favorite) ─── */

function InnerBubble({ content, onFavorite }: { content: string; onFavorite?: () => void }) {
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
          className="mt-1.5 rounded-xl px-3 py-2 italic whitespace-pre-wrap select-none"
          style={{
            background: "rgba(255,255,255,0.4)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.2)",
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
            lineHeight: "1.6",
            fontSize: "12.5px",
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
      </details>
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
              ⭐ 收藏这句心声
            </ActionPill>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Voice Notify Card ─── */

/* ─── Voice Bubble ─── */

function VoiceBubble({ data, onFavorite }: { data: string; onFavorite?: () => void }) {
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-start gap-2"
    >
      <div
        className="rounded-xl overflow-hidden min-w-[65%] max-w-[80%] select-none"
        style={{
          background: "linear-gradient(135deg, rgba(107,143,122,0.12), rgba(140,180,160,0.08))",
          border: "1px solid rgba(107,143,122,0.2)",
          boxShadow: "6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff",
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
            style={{
              background: "linear-gradient(135deg, #6b8f7a, #8cb4a0)",
              boxShadow: "0 2px 8px rgba(107,143,122,0.3)",
            }}
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
                      style={{ background: "#6b8f7a" }}
                      animate={{ height: [4, 12 + Math.random() * 4, 6, 14, 4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}
              {!playing && (
                <div className="flex items-end gap-0.5 h-4">
                  {[8, 12, 6, 14, 10, 8, 4].map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full"
                      style={{ background: "#6b8f7a", height: h, opacity: 0.4 }}
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowText(!showText)}
              className="mt-1 text-[11px] transition-colors"
              style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showText ? "收起文字" : "查看文字"}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-3 pt-1"
                style={{ borderTop: "1px solid rgba(107,143,122,0.15)" }}
              >
                <p
                  className="text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
                >
                  {cleanText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showFavMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <ActionPill onClick={() => { setShowFavMenu(false); onFavorite?.(); }}>
              ⭐ 收藏这段语音
            </ActionPill>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Plus Panel ─── */

function PlusPanel({ onImage, onSticker, onLink }: { onImage: () => void; onSticker: () => void; onLink: () => void }) {
  const items = [
    { icon: "image", label: "图片", action: onImage, active: true },
    { icon: "mood", label: "表情", action: onSticker, active: true },
    { icon: "link", label: "链接", action: onLink, active: true },
  ];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div
        className="grid grid-cols-4 gap-4 px-8 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}
      >
        {items.map((item) => (
          <button
            key={item.icon}
            onClick={item.active ? item.action : undefined}
            disabled={!item.active}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95 disabled:cursor-default"
            style={{ opacity: item.active ? 1 : 0.3 }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.6)",
                boxShadow: item.active
                  ? "4px 4px 8px #e0dbdb, -4px -4px 8px #ffffff"
                  : "2px 2px 4px #e0dbdb, -2px -2px 4px #ffffff",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
            >
              <span
                className="material-symbols-outlined text-[24px]"
                style={{
                  color: item.active ? "var(--primary)" : "var(--text-faint)",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                {item.icon}
              </span>
            </div>
            <span
              className="text-[12px]"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: item.active ? "var(--text-mid)" : "var(--text-faint)",
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Sticker Picker ─── */

function StickerPickerPanel({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 280, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden flex flex-col"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.3)" }}
    >
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        <div className="flex gap-1">
          {STICKER_PACKS.map((pack, i) => (
            <button
              key={pack.name}
              onClick={() => setActiveTab(i)}
              className="px-3 py-1 rounded-lg text-[12px] transition-all"
              style={{
                fontFamily: "var(--font-serif-sc)",
                background: activeTab === i ? "rgba(123,84,85,0.15)" : "transparent",
                color: activeTab === i ? "var(--primary)" : "var(--text-faint)",
                fontWeight: activeTab === i ? 600 : 400,
              }}
            >
              {pack.name}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full"
          style={{ color: "var(--text-faint)" }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="grid grid-cols-4 gap-2">
          {STICKER_PACKS[activeTab]?.stickers.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="aspect-square rounded-xl overflow-hidden active:scale-90 transition-transform hover:bg-white/30"
              style={{ background: "rgba(255,255,255,0.15)" }}
              title={s.alt}
            >
              <img
                src={s.url}
                alt={s.alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Link Card ─── */

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`　-〿、。，！？]+/g;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches)].slice(0, 3);
}

interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

function LinkCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data: LinkPreview) => {
        if (!cancelled) {
          setPreview(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [url]);

  if (!loaded) {
    return (
      <div
        className="rounded-xl px-3.5 py-3 max-w-[80%] animate-pulse"
        style={{
          background: "rgba(255,255,255,0.5)",
          border: "1px solid rgba(255,255,255,0.4)",
          height: 60,
        }}
      />
    );
  }

  if (!preview?.title && !preview?.description) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl px-3.5 py-2.5 max-w-[80%] no-underline active:scale-[0.98] transition-transform"
        style={{
          background: "rgba(255,255,255,0.5)",
          border: "1px solid rgba(255,255,255,0.4)",
          boxShadow: "4px 4px 8px #e0dbdb, -4px -4px 8px #ffffff",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ color: "var(--primary)", fontVariationSettings: "'FILL' 1" }}
          >
            link
          </span>
          <span
            className="text-[13px] truncate"
            style={{ color: "var(--text-mid)", fontFamily: "var(--font-serif-sc)" }}
          >
            {url}
          </span>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden max-w-[80%] no-underline active:scale-[0.98] transition-transform"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "4px 4px 8px #e0dbdb, -4px -4px 8px #ffffff",
      }}
    >
      {preview.image && (
        <div className="w-full h-[130px] overflow-hidden">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className="px-3.5 py-2.5">
        {preview.title && (
          <div
            className="text-[14px] font-medium line-clamp-2"
            style={{ color: "var(--text-deep)", fontFamily: "var(--font-serif-sc)", lineHeight: "20px" }}
          >
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div
            className="text-[12px] mt-1 line-clamp-2"
            style={{ color: "var(--text-mid)", fontFamily: "var(--font-serif-sc)", lineHeight: "18px" }}
          >
            {preview.description}
          </div>
        )}
        {preview.siteName && (
          <div
            className="flex items-center gap-1 mt-1.5"
          >
            <span
              className="material-symbols-outlined text-[12px]"
              style={{ color: "var(--text-faint)" }}
            >
              language
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              {preview.siteName}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

/* ─── Image Bubble ─── */

function isImageMessage(content: string): boolean {
  try {
    const p = JSON.parse(content);
    return p?.type === "image" && !!p.imageUrl;
  } catch {
    return false;
  }
}

const STICKER_TEXT_RE = /^\[发送了表情包：(.+?)\]\s*(.*)$/;

function isStickerMessage(content: string): boolean {
  try {
    const p = JSON.parse(content);
    if (p?.type === "sticker" && !!p.url) return true;
  } catch {}
  const m = content.trim().match(STICKER_TEXT_RE);
  if (m) {
    const alt = m[1];
    return !!ALL_STICKERS.find((s) => s.alt === alt || s.alt.includes(alt) || alt.includes(s.alt));
  }
  return false;
}

function resolveStickerFromText(content: string): { url: string; alt: string; stickerId: string; caption?: string } | null {
  const m = content.trim().match(STICKER_TEXT_RE);
  if (!m) return null;
  const alt = m[1];
  const caption = m[2]?.trim() || undefined;
  const sticker = ALL_STICKERS.find((s) => s.alt === alt || s.alt.includes(alt) || alt.includes(s.alt));
  return sticker ? { url: sticker.url, alt: sticker.alt, stickerId: sticker.id, caption } : null;
}

function StickerBubble({ data, align }: { data: string; align: "left" | "right" }) {
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);

  let parsed: { type: string; stickerId: string; url: string; alt: string; caption?: string };
  try {
    const j = JSON.parse(data);
    parsed = j;
  } catch {
    const resolved = resolveStickerFromText(data);
    if (!resolved) return null;
    parsed = { type: "sticker", stickerId: resolved.stickerId, url: resolved.url, alt: resolved.alt, caption: resolved.caption };
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}
      >
        <div
          className="cursor-pointer active:scale-95 transition-transform"
          onClick={() => !imgError && setZoomed(true)}
        >
          {imgError ? (
            <div
              className="w-[120px] h-[120px] rounded-xl flex items-center justify-center text-center p-2"
              style={{ background: "rgba(230,225,225,0.5)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              <span className="text-[12px] leading-tight" style={{ color: "var(--text-faint)", fontFamily: "var(--font-serif-sc)" }}>
                {parsed.alt || "表情包"}
              </span>
            </div>
          ) : (
            <img
              src={parsed.url}
              alt={parsed.alt}
              className="w-[120px] h-[120px] object-cover rounded-xl"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        {parsed.caption && (
          <div
            className={`mt-1.5 rounded-[20px] ${align === "right" ? "rounded-br-[4px]" : "rounded-bl-[4px]"} px-4 py-2.5 max-w-[80%] whitespace-pre-wrap`}
            style={{
              fontFamily: "var(--font-serif-sc)",
              fontSize: "14.5px",
              lineHeight: "24px",
              background: align === "right" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "var(--text-deep)",
              boxShadow: "6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff",
            }}
          >
            {parsed.caption}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
            onClick={() => setZoomed(false)}
          >
            <motion.img
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              src={parsed.url}
              alt={parsed.alt}
              className="max-w-[80vw] max-h-[80vh] object-contain rounded-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ImageBubble({ data, onFavorite }: { data: string; onFavorite?: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [showFavMenu, setShowFavMenu] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  let parsed: { type: string; imageUrl: string; caption?: string };
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  const handlePointerDown = () => {
    if (!onFavorite) return;
    longPressRef.current = setTimeout(() => setShowFavMenu(true), 500);
  };
  const handlePointerUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-end gap-1"
      >
        <div
          className="rounded-xl overflow-hidden max-w-[70%] active:scale-[0.98] transition-transform select-none"
          style={{
            boxShadow: "6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff",
            cursor: "pointer",
          }}
          onClick={() => setZoomed(true)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => { if (onFavorite) { e.preventDefault(); setShowFavMenu(true); } }}
        >
          <img
            src={parsed.imageUrl}
            alt="发送的图片"
            className="w-full h-auto max-h-[300px] object-cover pointer-events-none"
            loading="lazy"
          />
        </div>
        {parsed.caption && (
          <div
            className="rounded-xl px-3.5 py-2 max-w-[70%] whitespace-pre-wrap"
            style={{
              background: "#ffdad9",
              boxShadow: "6px 6px 12px #e0dbdb, -6px -6px 12px #ffffff",
              fontFamily: "var(--font-serif-sc)",
              fontSize: "14.5px",
              lineHeight: "24px",
              color: "var(--text-deep)",
            }}
          >
            {parsed.caption}
          </div>
        )}
        <AnimatePresence>
          {showFavMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <ActionPill onClick={() => { setShowFavMenu(false); onFavorite?.(); }}>
                ⭐ 收藏这张图
              </ActionPill>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
            onClick={() => setZoomed(false)}
          >
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={parsed.imageUrl}
              alt="放大查看"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Tool Notify Card ─── */

const TOOL_NOTIFY_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  diary: { icon: "auto_stories", color: "var(--primary)", bg: "rgba(212,165,165,0.12)", border: "rgba(212,165,165,0.2)" },
  timeline: { icon: "timeline", color: "var(--accent-wisteria)", bg: "rgba(103,87,126,0.08)", border: "rgba(103,87,126,0.15)" },
  reminder: { icon: "alarm", color: "#6b8f7a", bg: "rgba(107,143,122,0.08)", border: "rgba(107,143,122,0.15)" },
  personality: { icon: "psychology", color: "var(--primary)", bg: "rgba(212,165,165,0.12)", border: "rgba(212,165,165,0.2)" },
  surface: { icon: "face_retouching_natural", color: "var(--accent-wisteria)", bg: "rgba(103,87,126,0.08)", border: "rgba(103,87,126,0.15)" },
};

function ToolNotifyCard({ payload }: { payload: string }) {
  const router = useRouter();

  let type = payload;
  let detail = "";
  const colonIdx = payload.indexOf(":");
  if (colonIdx > 0) {
    type = payload.slice(0, colonIdx);
    detail = payload.slice(colonIdx + 1);
  }

  const cfg = TOOL_NOTIFY_CONFIG[type] ?? TOOL_NOTIFY_CONFIG.diary;

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-center"
    >
      {target ? (
        <button
          onClick={() => router.push(target)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-95"
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            fontFamily: "var(--font-serif-sc)",
            fontSize: "12px",
            color: cfg.color,
          }}
        >
          <span
            className="material-symbols-outlined text-[14px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {cfg.icon}
          </span>
          {label}
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
        </button>
      ) : (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            fontFamily: "var(--font-serif-sc)",
            fontSize: "12px",
            color: cfg.color,
          }}
        >
          <span
            className="material-symbols-outlined text-[14px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {cfg.icon}
          </span>
          {label}
        </div>
      )}
    </motion.div>
  );
}
