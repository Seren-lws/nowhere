"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type { DiaryEntry } from "@/lib/brain/diary";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function HisDiaryList() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [favToast, setFavToast] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/diary?id=${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/diary?author=companion");
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setEntries([]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center"
      style={{
        background: "#0a0a1a",
        color: "rgba(236,231,231,0.9)",
        fontFamily: "var(--font-serif-sc)",
      }}
    >
      {/* Ambient Heart Glows */}
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          width: 300,
          height: 300,
          top: "10%",
          left: "-5%",
          background: "radial-gradient(circle, rgba(212,165,165,0.1) 0%, rgba(212,165,165,0) 70%)",
          filter: "blur(60px)",
          zIndex: 0,
          animation: "pulse-heart 8s infinite alternate ease-in-out",
        }}
      />
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          width: 400,
          height: 400,
          bottom: "20%",
          right: "-10%",
          background: "radial-gradient(circle, rgba(212,165,165,0.1) 0%, rgba(212,165,165,0) 70%)",
          filter: "blur(60px)",
          zIndex: 0,
          animation: "pulse-heart 8s infinite alternate ease-in-out",
          animationDelay: "-4s",
        }}
      />
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          width: 200,
          height: 200,
          top: "40%",
          left: "30%",
          background: "radial-gradient(circle, rgba(212,165,165,0.1) 0%, rgba(212,165,165,0) 70%)",
          filter: "blur(60px)",
          zIndex: 0,
          opacity: 0.2,
          animation: "pulse-heart 8s infinite alternate ease-in-out",
          animationDelay: "-2s",
        }}
      />

      {/* Floating Heart Bubbles */}
      <HeartBubbles />

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50"
        style={{
          background: "rgba(10,10,26,0.6)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center justify-between px-5 h-16 w-full max-w-[800px] mx-auto relative">
          <button
            className="material-symbols-outlined active:scale-95 transition-all absolute left-4"
            style={{ color: "rgba(236,231,231,0.7)" }}
            onClick={() => router.back()}
          >
            arrow_back
          </button>
          <h1
            className="flex-1 text-center text-3xl pt-1"
            style={{ fontFamily: "'Pinyon Script', cursive", color: "#d4a5a5" }}
          >
            His Diary
          </h1>
          <div className="w-10 absolute right-4" />
        </div>
      </header>

      {/* Favorite Toast */}
      <AnimatePresence>
        {favToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-5 py-2.5 rounded-full"
            style={{
              background: "rgba(212,165,165,0.9)",
              backdropFilter: "blur(12px)",
              color: "white",
              fontFamily: "var(--font-serif-sc)",
              fontSize: "13px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            ⭐ 已收藏到我的收藏
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full pt-24 pb-20 px-5 max-w-[600px] mx-auto relative z-10 overflow-y-auto no-scrollbar">
        <div className="flex flex-col space-y-6">
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
                style={{
                  color: "rgba(212,165,165,0.3)",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                favorite
              </span>
              <p className="text-lg mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                他还没有写过日记
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                回到客厅聊聊天，他会把心事写下来的。
              </p>
            </motion.div>
          ) : (
            entries.map((entry, i) => (
              <DiaryCard
                key={entry.id}
                entry={entry}
                index={i}
                onFavToast={() => {
                  setFavToast(true);
                  setTimeout(() => setFavToast(false), 1500);
                }}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Diary Card ─── */

function DiaryCard({ entry, index, onFavToast, onDelete }: { entry: DiaryEntry; index: number; onFavToast: () => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const dateStr = formatDate(entry.created_at);

  useEffect(() => {
    fetch(`/api/favorites?source=diary`)
      .then((r) => r.json())
      .then((items: { metadata: { diary_id?: string } }[]) => {
        if (items.some((i) => i.metadata?.diary_id === entry.id)) {
          setFavorited(true);
        }
      })
      .catch(() => {});
  }, [entry.id]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    try {
      if (next) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: "diary",
            content: entry.content,
            owner: "user",
            metadata: { diary_id: entry.id, date: entry.created_at },
          }),
        });
        onFavToast();
      } else {
        await fetch(`/api/favorites?diaryId=${entry.id}`, { method: "DELETE" });
      }
    } catch {
      setFavorited(!next);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      className="p-6 relative overflow-hidden cursor-default"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "1.5rem",
        boxShadow:
          "8px 8px 16px rgba(0,0,0,0.5), -4px -4px 12px rgba(255,255,255,0.01), inset 0 0 15px rgba(255,255,255,0.02)",
        transition: "all 0.3s ease",
      }}
    >
      {/* Date + Actions */}
      <div className="flex justify-between items-center mb-4">
        <time className="font-medium text-sm" style={{ color: "rgba(212,194,194,0.9)" }}>
          {dateStr}
        </time>
        <div className="flex items-center gap-2">
          <button
            className="active:scale-90 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("确定删除这篇日记吗？")) onDelete(entry.id);
            }}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: "rgba(212,165,165,0.3)" }}
            >
              delete_outline
            </span>
          </button>
          <button
            className="active:scale-90 transition-transform"
            onClick={toggleFav}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{
                color: favorited ? "rgba(212,165,165,0.8)" : "rgba(212,165,165,0.4)",
                fontVariationSettings: favorited ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              favorite
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <p
          className="text-base leading-relaxed"
          style={{
            color: "rgba(236,231,231,0.9)",
            ...(!expanded
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }
              : {}),
          }}
        >
          {entry.content}
        </p>
        <button
          className="text-sm font-medium flex items-center gap-1 active:opacity-70 transition-all"
          style={{ color: "#d4a5a5" }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "点击收起文字" : "点击展开全部文字"}
          <span className="material-symbols-outlined text-xs">
            {expanded ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
        </button>
      </div>
    </motion.article>
  );
}

/* ─── Floating Heart Bubbles ─── */

function HeartBubbles() {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const createBubble = useCallback(() => {
    if (!containerRef.current) return;
    const span = document.createElement("span");
    span.className = "material-symbols-outlined";
    span.textContent = "favorite";
    const size = Math.random() * 30 + 30;
    const duration = Math.random() * 8 + 12;
    Object.assign(span.style, {
      position: "fixed",
      bottom: "-80px",
      left: `${Math.random() * 90 + 5}vw`,
      fontSize: `${size}px`,
      color: "rgba(212,165,165,0.35)",
      filter: "blur(2px) drop-shadow(0 0 15px rgba(212,165,165,0.8))",
      animation: `float-up ${duration}s linear forwards`,
      pointerEvents: "none",
      zIndex: "0",
    });
    containerRef.current.appendChild(span);
    setTimeout(() => span.remove(), duration * 1000);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(createBubble, Math.random() * 6000);
    }
    intervalRef.current = setInterval(createBubble, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mounted, createBubble]);

  if (!mounted) return null;

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0" />;
}
