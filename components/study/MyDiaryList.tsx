"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MOOD_OPTIONS, getMoodEmoji } from "@/lib/brain/diary";
import type { DiaryEntry } from "@/lib/brain/diary";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    display: `${d.getMonth() + 1}月${d.getDate().toString().padStart(2, "0")}日`,
    weekday: WEEKDAYS[d.getDay()],
  };
}

export function MyDiaryList() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchEntries = async (mood?: string | null, q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ author: "user" });
      if (mood) params.set("mood", mood);
      if (q) params.set("q", q);
      const res = await fetch(`/api/diary?${params}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleMoodFilter = (mood: string | null) => {
    setActiveMood(mood);
    fetchEntries(mood, searchText || undefined);
  };

  const handleSearch = () => {
    fetchEntries(activeMood, searchText || undefined);
  };

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchText("");
      fetchEntries(activeMood);
    } else {
      setSearchOpen(true);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center"
      style={{ background: "#221437", color: "white", fontFamily: "var(--font-serif-sc)" }}
    >
      {/* Star Background */}
      <StarField />

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50 flex items-center justify-between px-5 h-16"
        style={{
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            className="active:scale-95 transition-transform mr-1 flex items-center justify-center"
            onClick={() => router.back()}
          >
            <span className="material-symbols-outlined text-2xl text-white">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tight text-white">我的日记</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="active:scale-95 transition-transform" onClick={toggleSearch}>
            <span className="material-symbols-outlined text-2xl text-white">
              {searchOpen ? "close" : "search"}
            </span>
          </button>
          <button
            className="active:scale-95 transition-transform w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(25px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={() => router.push("/study/my-drawer/diary/new")}
          >
            <span className="material-symbols-outlined text-xl text-white">edit</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[800px] pt-24 pb-32 px-5 z-10 relative overflow-y-auto h-full no-scrollbar">
        {/* Search Bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div
                className="flex items-center gap-3 rounded-full px-4 py-2.5"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(25px)",
                }}
              >
                <span className="material-symbols-outlined text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
                  search
                </span>
                <input
                  ref={searchRef}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="搜索日记内容..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40"
                  style={{ fontFamily: "var(--font-serif-sc)" }}
                />
                {searchText && (
                  <button
                    className="text-white/50 active:scale-95"
                    onClick={() => {
                      setSearchText("");
                      fetchEntries(activeMood);
                    }}
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Branding */}
        <div className="mb-6 opacity-40 text-center">
          <span className="text-4xl" style={{ fontFamily: "'Pinyon Script', cursive", color: "#ecbbba" }}>
            Nowhere
          </span>
        </div>

        {/* Mood Filter */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 -mx-5 px-5">
          <button
            className="px-6 py-2 rounded-full whitespace-nowrap text-sm transition-all"
            style={
              activeMood === null
                ? {
                    background: "rgba(212,165,165,0.4)",
                    border: "1px solid rgba(212,165,165,0.6)",
                    boxShadow: "0 0 15px rgba(212,165,165,0.3)",
                    color: "white",
                    backdropFilter: "blur(12px)",
                  }
                : {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(12px)",
                    color: "rgba(255,255,255,0.7)",
                  }
            }
            onClick={() => handleMoodFilter(null)}
          >
            全部
          </button>
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.key}
              className="px-5 py-2 rounded-full whitespace-nowrap text-sm transition-all"
              style={
                activeMood === m.key
                  ? {
                      background: "rgba(212,165,165,0.4)",
                      border: "1px solid rgba(212,165,165,0.6)",
                      boxShadow: "0 0 15px rgba(212,165,165,0.3)",
                      color: "white",
                      backdropFilter: "blur(12px)",
                    }
                  : {
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      backdropFilter: "blur(12px)",
                      color: "rgba(255,255,255,0.7)",
                    }
              }
              onClick={() => handleMoodFilter(m.key)}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {/* Diary List */}
        <div className="flex flex-col gap-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60"
                style={{ animation: "spin 1s linear infinite" }}
              />
            </div>
          ) : entries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <span
                className="material-symbols-outlined text-[56px] mb-4 block"
                style={{ color: "rgba(255,255,255,0.2)", fontVariationSettings: "'FILL' 0" }}
              >
                edit_note
              </span>
              <p className="text-lg mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                {searchText ? "没有找到相关日记" : "还没有日记"}
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                {searchText ? "换个关键词试试？" : "点右上角的笔，写下第一篇。"}
              </p>
            </motion.div>
          ) : (
            entries.map((entry, i) => (
              <DiaryCard
                key={entry.id}
                entry={entry}
                index={i}
                onClick={() => router.push(`/study/my-drawer/diary/${entry.id}/detail`)}
              />
            ))
          )}
        </div>
      </main>

      {/* Floating Pulse */}
      <div className="fixed bottom-24 right-6 w-16 h-16 pointer-events-none opacity-40 z-0">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background: "linear-gradient(to top right, #7b5455, #d2beeb)",
            animation: "gentle-pulse 4s infinite ease-in-out",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Diary Card ─── */

function DiaryCard({
  entry,
  index,
  onClick,
}: {
  entry: DiaryEntry;
  index: number;
  onClick: () => void;
}) {
  const { display, weekday } = formatDate(entry.created_at);
  const emoji = getMoodEmoji(entry.mood);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
      className="rounded-[32px] p-6 transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(25px)",
        WebkitBackdropFilter: "blur(25px)",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      }}
      onClick={onClick}
    >
      {/* Date Row */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold" style={{ color: "#ecbbba" }}>
            {display}
          </span>
          <span className="text-sm opacity-60">{weekday}</span>
          {emoji && <span className="ml-2">{emoji}</span>}
        </div>
      </div>

      {/* Content Preview */}
      <p
        className="leading-relaxed text-sm mb-6"
        style={{
          color: "rgba(255,255,255,0.9)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {entry.content}
      </p>

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Star Field ─── */

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

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
