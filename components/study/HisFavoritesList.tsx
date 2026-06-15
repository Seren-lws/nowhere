"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type { FavoriteItem, FavoriteSource } from "@/lib/brain/favorites";

function isFavImage(item: FavoriteItem) { return item.metadata.type === "image" && item.metadata.imageUrl; }

const FILTERS: { key: FavoriteSource | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "chat", label: "我的原话" },
  { key: "diary", label: "我的日记" },
  { key: "bedroom", label: "卧室" },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function HisFavoritesList() {
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
      const url =
        filter === "all"
          ? "/api/favorites?owner=companion"
          : `/api/favorites?owner=companion&source=${filter}`;
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

  const particles = mounted
    ? Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: seededRandom(i * 13 + 3) * 100,
        top: seededRandom(i * 17 + 5) * 100,
        duration: seededRandom(i * 23 + 7) * 10 + 10,
        delay: seededRandom(i * 31 + 11) * 10,
      }))
    : [];

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background: "linear-gradient(180deg, #e0f2fe 0%, #fce7f3 100%)",
        color: "#5d5451",
        fontFamily: "var(--font-serif-sc)",
      }}
    >
      {/* Floating Particles */}
      {mounted && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute w-1 h-1 rounded-full bg-white/40"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                animation: `float ${p.duration}s infinite ease-in-out`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50 h-16 flex items-center px-5"
        style={{
          background: "rgba(224,242,254,0.4)",
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
            <span className="material-symbols-outlined text-2xl" style={{ color: "#5d5451" }}>
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
                color: "#5d5451",
                fontFamily: "var(--font-serif-sc)",
              }}
            />
          ) : (
            <h1
              className="text-[22px] font-bold tracking-tight flex-1 text-center"
              style={{ color: "#5d5451" }}
            >
              他的收藏
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
            <span className="material-symbols-outlined text-2xl" style={{ color: "#5d5451" }}>
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
                background: "rgba(255,255,255,0.25)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow:
                  filter === f.key
                    ? "inset 4px 4px 8px rgba(93,84,81,0.05), inset -4px -4px 8px rgba(255,255,255,0.9)"
                    : "8px 8px 16px rgba(93,84,81,0.08), -8px -8px 16px rgba(255,255,255,0.8)",
                color: filter === f.key ? "#5d5451" : "rgba(93,84,81,0.6)",
                fontSize: "14px",
                fontWeight: 500,
              }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </section>

        {/* Cards */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="w-8 h-8 rounded-full border-2"
                style={{
                  borderColor: "rgba(93,84,81,0.2)",
                  borderTopColor: "rgba(93,84,81,0.6)",
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
                style={{ color: "rgba(93,84,81,0.2)", fontVariationSettings: "'FILL' 1" }}
              >
                {keyword ? "search_off" : "bookmark"}
              </span>
              <p className="text-lg mb-2" style={{ color: "rgba(93,84,81,0.5)" }}>
                {keyword ? "没有找到" : "他还没有收藏"}
              </p>
              <p className="text-sm" style={{ color: "rgba(93,84,81,0.35)" }}>
                {keyword ? "换个关键词试试" : "聊聊天吧，说不定哪句话会被他偷偷藏起来"}
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
                  {item.source === "chat" && isFavImage(item) ? (
                    <HisImageCard item={item} onDelete={handleDelete} />
                  ) : item.source === "chat" ? (
                    <HisChatCard item={item} onDelete={handleDelete} />
                  ) : item.source === "diary" ? (
                    <HisDiaryCard item={item} onDelete={handleDelete} />
                  ) : item.source === "bedroom" ? (
                    <HisBedroomCard item={item} onDelete={handleDelete} />
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Chat Card (我的原话) ─── */

function HisChatCard({
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
      className="group relative rounded-3xl p-6 transition-all active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow:
          "inset 4px 4px 10px rgba(0,0,0,0.04), inset -4px -4px 10px rgba(255,255,255,0.05)",
      }}
    >
      <button
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90"
        style={{ color: "rgba(93,84,81,0.5)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <div className="flex items-center gap-2 mb-4" style={{ color: "rgba(93,84,81,0.5)" }}>
        <span className="material-symbols-outlined text-sm">format_quote</span>
        <span className="text-xs">我的原话</span>
      </div>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "#5d5451" }}
      >
        &ldquo;{item.content}&rdquo;
      </p>
      <div className="mt-4 flex justify-end">
        <span className="text-xs" style={{ color: "rgba(93,84,81,0.5)" }}>
          {dateStr}
        </span>
      </div>
    </div>
  );
}

/* ─── Diary Card (我的日记) ─── */

function HisDiaryCard({
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
      className="group relative rounded-xl p-8 mx-2 transition-all"
      style={{
        backgroundColor: "#F9F7F2",
        backgroundImage: "url('https://www.transparenttextures.com/patterns/handmade-paper.png')",
        transform: "rotate(-1deg)",
        boxShadow: "10px 10px 25px rgba(0,0,0,0.1)",
        color: "#4A4A4A",
      }}
    >
      <button
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90"
        style={{ color: "rgba(93,84,81,0.5)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <div className="flex items-center gap-2 mb-6 opacity-60">
        <span className="material-symbols-outlined text-sm" style={{ color: "rgba(93,84,81,0.7)" }}>
          edit_note
        </span>
        <span className="text-xs" style={{ color: "rgba(93,84,81,0.7)" }}>我的日记</span>
      </div>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "#5d5451" }}
      >
        {item.content}
      </p>
      <div className="mt-8 flex justify-end">
        <span className="text-xs italic" style={{ color: "rgba(93,84,81,0.5)" }}>
          {dateStr}
        </span>
      </div>
    </div>
  );
}

/* ─── Bedroom Card (卧室对话) ─── */

function HisBedroomCard({
  item,
  onDelete,
}: {
  item: FavoriteItem;
  onDelete: (id: string) => void;
}) {
  const messages = item.metadata.messages ?? [{ role: "user", content: item.content }];

  return (
    <div
      className="group relative rounded-3xl p-6 transition-all active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow:
          "inset 4px 4px 10px rgba(0,0,0,0.04), inset -4px -4px 10px rgba(255,255,255,0.05)",
      }}
    >
      <button
        className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90"
        style={{ color: "rgba(93,84,81,0.5)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <div className="flex items-center gap-2 mb-6 opacity-60">
        <span className="material-symbols-outlined text-sm" style={{ color: "rgba(93,84,81,0.7)" }}>
          bedroom_parent
        </span>
        <span className="text-xs" style={{ color: "rgba(93,84,81,0.7)" }}>卧室对话</span>
      </div>

      <div className="space-y-4 w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className="px-4 py-3 max-w-[85%] text-sm leading-relaxed"
              style={{
                borderRadius:
                  msg.role === "user"
                    ? "20px 20px 4px 20px"
                    : "20px 20px 20px 4px",
                background:
                  msg.role === "user"
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.1)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow:
                  msg.role === "user"
                    ? "0 8px 32px rgba(93,84,81,0.05)"
                    : "inset 4px 4px 10px rgba(0,0,0,0.04), inset -4px -4px 10px rgba(255,255,255,0.05)",
                color: "#5d5451",
              }}
            >
              {msg.content}
            </div>
            {msg.time && (
              <span
                className={`text-[10px] mt-1 opacity-40 ${msg.role === "user" ? "mr-2" : "ml-2"}`}
                style={{ color: "#5d5451" }}
              >
                {msg.time}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Image Card (她的图片) ─── */

function HisImageCard({
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
      className="group relative rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow:
          "inset 4px 4px 10px rgba(0,0,0,0.04), inset -4px -4px 10px rgba(255,255,255,0.05)",
      }}
    >
      <button
        className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-2 active:scale-90 rounded-full"
        style={{ color: "white", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        onClick={() => onDelete(item.id)}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
      <img
        src={item.metadata.imageUrl}
        alt={item.content}
        className="w-full h-auto max-h-[300px] object-cover"
        loading="lazy"
      />
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3 opacity-60">
          <span className="material-symbols-outlined text-sm" style={{ color: "rgba(93,84,81,0.7)" }}>
            photo
          </span>
          <span className="text-xs" style={{ color: "rgba(93,84,81,0.7)" }}>她的图片</span>
        </div>
        {item.content && item.content !== "图片" && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: "#5d5451" }}>
            {item.content}
          </p>
        )}
        <div className="flex justify-end">
          <span className="text-xs" style={{ color: "rgba(93,84,81,0.5)" }}>
            {dateStr}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatFavDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
