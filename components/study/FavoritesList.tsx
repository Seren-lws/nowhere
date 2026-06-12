"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type { FavoriteItem, FavoriteSource } from "@/lib/brain/favorites";

const FILTERS: { key: FavoriteSource | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "chat", label: "💬 他的话" },
  { key: "diary", label: "📖 他的日记" },
  { key: "bedroom", label: "🌙 卧室" },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function FavoritesList() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FavoriteSource | "all">("all");
  const [mounted, setMounted] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/favorites?owner=user" : `/api/favorites?owner=user&source=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/favorites?id=${id}`, { method: "DELETE" });
  };

  const keyword = searchText.trim().toLowerCase();
  const filtered = keyword
    ? items.filter((i) => i.content.toLowerCase().includes(keyword))
    : items;

  const sparkles = mounted
    ? Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: seededRandom(i * 13 + 3) * 100,
        top: seededRandom(i * 17 + 5) * 100,
        duration: seededRandom(i * 23 + 7) * 3 + 2,
        delay: seededRandom(i * 31 + 11) * 5,
      }))
    : [];

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background: "linear-gradient(135deg, #fdf8f8 0%, #f1dede 50%, #e3cffd 100%)",
        color: "var(--text-deep)",
        fontFamily: "var(--font-serif-sc)",
      }}
    >
      {/* Ambient BG */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -left-20 w-64 h-64 rounded-full opacity-30"
          style={{
            background: "#ffdad9",
            filter: "blur(40px)",
            animation: "drift 15s infinite alternate ease-in-out",
          }}
        />
        <div
          className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full opacity-20"
          style={{
            background: "#eddcff",
            filter: "blur(40px)",
            animation: "drift 15s infinite alternate ease-in-out",
            animationDelay: "-2s",
          }}
        />
        <div
          className="absolute top-6 right-6 w-80 h-80 rounded-full opacity-20"
          style={{
            background: "#f1dede",
            filter: "blur(40px)",
            animation: "drift 15s infinite alternate ease-in-out",
            animationDelay: "-5s",
          }}
        />
        {mounted &&
          sparkles.map((s) => (
            <div
              key={s.id}
              className="absolute w-[2px] h-[2px] rounded-full bg-white opacity-30"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                animation: `twinkle ${s.duration}s infinite ease-in-out`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
      </div>

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50 h-16 flex items-center px-5"
        style={{
          background: "rgba(253,248,248,0.4)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.3)",
        }}
      >
        <div className="max-w-[800px] w-full mx-auto flex justify-between items-center gap-3">
          <button
            className="p-2 rounded-full active:scale-95 transition-all flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.25)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
            onClick={() => searching ? (setSearching(false), setSearchText("")) : router.back()}
          >
            <span className="material-symbols-outlined text-2xl" style={{ color: "var(--primary)" }}>
              arrow_back
            </span>
          </button>
          {searching ? (
            <input
              ref={searchRef}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索收藏..."
              className="flex-1 h-10 px-4 rounded-full outline-none text-[15px]"
              style={{
                background: "rgba(255,255,255,0.3)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.4)",
                color: "var(--primary)",
                fontFamily: "var(--font-serif-sc)",
              }}
            />
          ) : (
            <h1
              className="text-[28px] font-bold tracking-tight flex-1 text-center"
              style={{ color: "var(--primary)" }}
            >
              我的收藏
            </h1>
          )}
          <button
            className="p-2 active:scale-95 transition-all flex-shrink-0"
            onClick={() => {
              if (searching) {
                setSearching(false);
                setSearchText("");
              } else {
                setSearching(true);
                setTimeout(() => searchRef.current?.focus(), 50);
              }
            }}
          >
            <span className="material-symbols-outlined text-2xl" style={{ color: "var(--primary)" }}>
              {searching ? "close" : "search"}
            </span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pt-24 pb-32 px-5 max-w-[800px] mx-auto w-full no-scrollbar">
        {/* Filter Chips */}
        <section className="mb-8 overflow-x-auto flex gap-3 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="px-6 py-2 rounded-full whitespace-nowrap active:scale-95 transition-transform"
              style={{
                background: filter === f.key ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.25)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow:
                  filter === f.key
                    ? "inset 4px 4px 8px rgba(123,84,85,0.05), inset -4px -4px 8px rgba(255,255,255,0.9)"
                    : "8px 8px 16px rgba(123,84,85,0.08), -8px -8px 16px rgba(255,255,255,0.8)",
                color: filter === f.key ? "var(--primary)" : "var(--text-mid)",
              }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </section>

        {/* Cards */}
        <div className="space-y-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="w-8 h-8 rounded-full border-2"
                style={{
                  borderColor: "rgba(123,84,85,0.2)",
                  borderTopColor: "rgba(123,84,85,0.6)",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <span
                className="material-symbols-outlined text-[56px] mb-4 block"
                style={{ color: "rgba(123,84,85,0.2)", fontVariationSettings: "'FILL' 1" }}
              >
                {keyword ? "search_off" : "bookmark"}
              </span>
              <p className="text-lg mb-2" style={{ color: "var(--text-mid)" }}>
                {keyword ? "没有找到" : "还没有收藏"}
              </p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {keyword ? "换个关键词试试" : "长按他的话，或者点日记的爱心，就能收藏啦"}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                >
                  {item.source === "chat" && (
                    <ChatCard item={item} onDelete={handleDelete} />
                  )}
                  {item.source === "diary" && (
                    <DiaryCard item={item} onDelete={handleDelete} />
                  )}
                  {item.source === "bedroom" && (
                    <BedroomCard item={item} onDelete={handleDelete} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Decorative Pulse */}
          {filtered.length > 0 && (
            <div className="flex justify-center py-12">
              <div className="relative w-16 h-16">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "rgba(123,84,85,0.2)",
                    filter: "blur(24px)",
                    animation: "gentle-pulse 4s infinite ease-in-out",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Chat Card ─── */

function ChatCard({
  item,
  onDelete,
}: {
  item: FavoriteItem;
  onDelete: (id: string) => void;
}) {
  const dateStr = item.metadata.date
    ? formatFavDate(item.metadata.date)
    : formatFavDate(item.created_at);

  return (
    <div
      className="group relative rounded-[32px] p-8 transition-all hover:-translate-y-1"
      style={{
        background: "#fdf8f8",
        boxShadow: "8px 8px 16px rgba(123,84,85,0.08), -8px -8px 16px rgba(255,255,255,0.8)",
      }}
    >
      <button
        className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90"
        style={{ color: "var(--text-faint)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <div className="flex flex-col gap-4">
        <span
          className="text-xl"
          style={{ fontFamily: "'Pinyon Script', cursive", color: "rgba(123,84,85,0.6)" }}
        >
          Whisper
        </span>
        <p
          className="text-lg leading-relaxed italic"
          style={{ color: "var(--text-deep)" }}
        >
          &ldquo;{item.content}&rdquo;
        </p>
        <span className="self-end text-xs mt-4" style={{ color: "var(--text-faint)" }}>
          — {dateStr} 客厅
        </span>
      </div>
    </div>
  );
}

/* ─── Diary Card ─── */

function DiaryCard({
  item,
  onDelete,
}: {
  item: FavoriteItem;
  onDelete: (id: string) => void;
}) {
  const dateStr = item.metadata.date
    ? formatFavDate(item.metadata.date)
    : formatFavDate(item.created_at);

  return (
    <div
      className="group relative rounded-lg p-8 rotate-1 transition-all hover:rotate-0 hover:-translate-y-1"
      style={{
        backgroundColor: "#fcf9f2",
        backgroundImage: "url('https://www.transparenttextures.com/patterns/handmade-paper.png')",
        boxShadow: "4px 8px 20px rgba(0,0,0,0.06)",
      }}
    >
      <button
        className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90"
        style={{ color: "var(--text-faint)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <div className="flex flex-col">
        <div className="flex justify-between items-baseline mb-6">
          <span
            className="font-bold border-b-2 pb-1"
            style={{ color: "var(--primary)", borderColor: "rgba(123,84,85,0.2)" }}
          >
            Diary Entry
          </span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            {dateStr}
          </span>
        </div>
        <p
          className="text-2xl leading-relaxed opacity-80"
          style={{
            fontFamily: "'Zhi Mang Xing', cursive",
            color: "var(--text-mid)",
          }}
        >
          {item.content}
        </p>
        <div className="mt-8 flex gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(123,84,85,0.2)" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "rgba(123,84,85,0.1)" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Bedroom Card ─── */

function BedroomCard({
  item,
  onDelete,
}: {
  item: FavoriteItem;
  onDelete: (id: string) => void;
}) {
  const messages = item.metadata.messages ?? [{ role: "assistant", content: item.content }];

  return (
    <div className="group relative p-4 flex flex-col gap-4">
      <button
        className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90"
        style={{ color: "var(--text-faint)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>

      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "self-end" : "self-start"}`}
        >
          <div
            className="px-5 py-3"
            style={{
              borderRadius: msg.role === "user" ? "24px 24px 0 24px" : "24px 24px 24px 0",
              ...(msg.role === "user"
                ? {
                    background: "rgba(123,84,85,0.2)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }
                : {
                    background: "rgba(255,255,255,0.25)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    boxShadow: "0 8px 32px rgba(123,84,85,0.05)",
                  }),
              color: "var(--text-deep)",
            }}
          >
            {msg.content}
          </div>
          {msg.time && (
            <span
              className={`text-[10px] ${msg.role === "user" ? "self-end mr-2" : "ml-2"}`}
              style={{ color: "var(--text-faint)", opacity: 0.4 }}
            >
              {msg.time}
            </span>
          )}
        </div>
      ))}

      <div className="mt-2 text-center">
        <span
          className="px-4 py-1 rounded-full text-[10px] uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.2)", color: "var(--text-faint)" }}
        >
          Fragment from 🌙 Bedroom
        </span>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatFavDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
