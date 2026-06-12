"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MOOD_OPTIONS, getMoodEmoji } from "@/lib/brain/diary";
import type { DiaryEntry } from "@/lib/brain/diary";

const PRESET_TAGS = ["觉察", "生活", "恋爱", "工作", "成长", "深夜"];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface Props {
  diaryId?: string;
}

export function MyDiaryEditor({ diaryId }: Props) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!diaryId);
  const [existing, setExisting] = useState<DiaryEntry | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!diaryId;
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  useEffect(() => {
    if (!diaryId) return;
    (async () => {
      try {
        const res = await fetch(`/api/diary?id=${diaryId}`);
        if (!res.ok) { router.back(); return; }
        const data = await res.json();
        setExisting(data);
        setContent(data.content || "");
        setMood(data.mood || null);
        setTags(data.tags || []);
      } catch {
        router.back();
      }
      setLoading(false);
    })();
  }, [diaryId, router]);

  const handleSave = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        await fetch("/api/diary", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: diaryId, content, mood, tags }),
        });
      } else {
        await fetch("/api/diary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ author: "user", content, mood, tags }),
        });
      }
      router.back();
    } catch {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!diaryId) return;
    if (!window.confirm("确定要删除这篇日记吗？")) return;
    await fetch(`/api/diary?id=${diaryId}`, { method: "DELETE" });
    router.back();
  };

  const handleShare = () => {
    if (!diaryId) return;
    router.push(`/living-room?shareDiary=${diaryId}`);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const addCustomTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setNewTag("");
    setShowTagInput(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#1c1424" }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60"
          style={{ animation: "spin 1s linear infinite" }}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "#1c1424", color: "rgba(255,255,255,0.9)", fontFamily: "var(--font-serif-sc)" }}
    >
      {/* Stars */}
      <StarField />

      {/* Header */}
      <header
        className="fixed top-0 left-0 w-full z-50"
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "inset 0 0 10px rgba(255,255,255,0.05)",
        }}
      >
        <div className="max-w-[800px] mx-auto h-16 flex items-center justify-between px-5 relative">
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-all"
            style={{ background: "transparent" }}
            onClick={() => router.back()}
          >
            <span className="material-symbols-outlined" style={{ color: "#ecbbba" }}>arrow_back</span>
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <h1
              className="text-lg font-medium tracking-widest"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              {isEdit ? "编辑日记" : "写日记"}
            </h1>
            <span
              className="text-[10px] tracking-tighter"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {isEdit && existing ? formatFullDate(existing.created_at) : dateStr}
            </span>
          </div>

          <button
            className="px-5 py-1.5 rounded-full text-sm font-medium active:scale-90 transition-transform"
            style={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: content.trim()
                ? "0 0 15px rgba(236,187,186,0.4), inset 0 0 12px rgba(255,255,255,0.2), 0 8px 32px rgba(123,84,85,0.1)"
                : "inset 0 0 12px rgba(255,255,255,0.2), 0 8px 32px rgba(123,84,85,0.1)",
              borderColor: content.trim() ? "rgba(236,187,186,0.6)" : "rgba(255,255,255,0.4)",
              color: "#ecbbba",
              opacity: content.trim() ? 1 : 0.5,
            }}
            disabled={!content.trim() || saving}
            onClick={handleSave}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-24 pb-32 px-5 max-w-[800px] mx-auto w-full relative z-10 flex flex-col gap-6 no-scrollbar">
        {/* Mood Selector */}
        <section className="flex flex-col gap-3">
          <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>此刻的心情</span>
          <div
            className="p-2 rounded-2xl flex justify-between items-center"
            style={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow: "inset 0 0 12px rgba(255,255,255,0.2), 0 8px 32px rgba(123,84,85,0.1)",
            }}
          >
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.key}
                className="w-12 h-12 flex items-center justify-center text-2xl transition-all rounded-xl"
                style={
                  mood === m.key
                    ? {
                        boxShadow: "0 0 15px rgba(236,187,186,0.4)",
                        borderColor: "rgba(236,187,186,0.6)",
                        background: "rgba(236,187,186,0.15)",
                        transform: "scale(1.1)",
                      }
                    : { opacity: mood ? 0.6 : 1 }
                }
                onClick={() => setMood(mood === m.key ? null : m.key)}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section className="flex flex-wrap gap-2 items-center">
          {PRESET_TAGS.map((tag) => (
            <button
              key={tag}
              className="px-4 py-1.5 rounded-full text-xs transition-all active:scale-95"
              style={
                tags.includes(tag)
                  ? {
                      background: "rgba(236,187,186,0.15)",
                      backdropFilter: "blur(24px)",
                      border: "1px solid rgba(236,187,186,0.6)",
                      boxShadow: "0 0 15px rgba(236,187,186,0.4), inset 0 0 12px rgba(255,255,255,0.2)",
                      color: "#ecbbba",
                    }
                  : {
                      background: "rgba(255,255,255,0.12)",
                      backdropFilter: "blur(24px)",
                      border: "1px solid rgba(255,255,255,0.4)",
                      boxShadow: "inset 0 0 12px rgba(255,255,255,0.2), 0 8px 32px rgba(123,84,85,0.1)",
                      color: "rgba(255,255,255,0.7)",
                    }
              }
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}

          {tags
            .filter((t) => !PRESET_TAGS.includes(t))
            .map((tag) => (
              <button
                key={tag}
                className="px-4 py-1.5 rounded-full text-xs transition-all active:scale-95"
                style={{
                  background: "rgba(236,187,186,0.15)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(236,187,186,0.6)",
                  boxShadow: "0 0 15px rgba(236,187,186,0.4)",
                  color: "#ecbbba",
                }}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}

          <AnimatePresence>
            {showTagInput ? (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <input
                  ref={tagInputRef}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustomTag();
                    if (e.key === "Escape") { setShowTagInput(false); setNewTag(""); }
                  }}
                  onBlur={addCustomTag}
                  placeholder="标签名"
                  className="px-3 py-1.5 rounded-full text-xs bg-transparent border outline-none w-20"
                  style={{
                    borderColor: "rgba(236,187,186,0.4)",
                    color: "#ecbbba",
                    fontFamily: "var(--font-serif-sc)",
                  }}
                  autoFocus
                />
              </motion.div>
            ) : (
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  boxShadow: "inset 0 0 12px rgba(255,255,255,0.2), 0 8px 32px rgba(123,84,85,0.1)",
                }}
                onClick={() => {
                  setShowTagInput(true);
                  setTimeout(() => tagInputRef.current?.focus(), 100);
                }}
              >
                <span className="material-symbols-outlined text-sm text-white">add</span>
              </button>
            )}
          </AnimatePresence>
        </section>

        {/* Text Area */}
        <section className="flex-grow flex flex-col">
          <div
            className="rounded-[32px] p-6 min-h-[400px] relative overflow-hidden group"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "inset 4px 4px 10px rgba(0,0,0,0.3), inset -4px -4px 10px rgba(255,255,255,0.05), inset 0 0 10px rgba(255,255,255,0.05)",
            }}
          >
            {/* Decorative pulse */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none transition-colors"
              style={{
                background: "rgba(236,187,186,0.05)",
                filter: "blur(80px)",
              }}
            />

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在这里，与真实的自己相遇..."
              className="w-full h-full min-h-[360px] bg-transparent border-none focus:ring-0 focus:outline-none p-0 text-lg leading-relaxed resize-none relative z-10"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "rgba(236,187,186,0.8)",
                caretColor: "#ecbbba",
              }}
            />
          </div>
        </section>

        {/* Action buttons for existing diaries */}
        {isEdit && (
          <section className="flex justify-center gap-4">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm active:scale-95 transition-transform"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(25px)",
                color: "rgba(255,255,255,0.7)",
              }}
              onClick={handleShare}
            >
              <span className="material-symbols-outlined text-lg">share</span>
              分享给他看
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm active:scale-95 transition-transform"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,100,100,0.2)",
                backdropFilter: "blur(25px)",
                color: "rgba(255,150,150,0.7)",
              }}
              onClick={handleDelete}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              删除
            </button>
          </section>
        )}

        {/* Footer Quote */}
        <footer className="mt-4 text-center pb-4">
          <p className="italic text-sm" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-serif-sc)" }}>
            "文字是寂静的避风港。"
          </p>
        </footer>
      </main>
    </div>
  );
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ─── Star Field ─── */

function StarField() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" />;

  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    size: seededRandom(i * 7 + 1) * 2 + 1,
    left: seededRandom(i * 13 + 3) * 100,
    top: seededRandom(i * 17 + 5) * 100,
    duration: seededRandom(i * 23 + 7) * 3 + 2,
    delay: seededRandom(i * 31 + 11) * 5,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}%`,
            top: `${s.top}%`,
            opacity: 0,
            animation: `twinkle ${s.duration}s infinite ease-in-out`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
