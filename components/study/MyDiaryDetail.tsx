"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { getMoodEmoji, MOOD_OPTIONS } from "@/lib/brain/diary";
import type { DiaryEntry } from "@/lib/brain/diary";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getMoodGradient(mood: string | null): string {
  switch (mood) {
    case "happy":
      return "linear-gradient(135deg, #f6d365 0%, #fda085 50%, #7b5455 100%)";
    case "sad":
      return "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #2d1b36 100%)";
    case "calm":
      return "linear-gradient(135deg, #a8edea 0%, #96deda 50%, #4a6e6a 100%)";
    case "inspired":
      return "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 50%, #4a2d5a 100%)";
    case "cloudy":
      return "linear-gradient(135deg, #89ABE3 0%, #B6D0E2 50%, #3d1f47 100%)";
    case "nostalgic":
      return "linear-gradient(135deg, #4a2d5a 0%, #7b5455 50%, #d4a5a5 100%)";
    default:
      return "linear-gradient(135deg, #4a2d5a 0%, #7b5455 50%, #2d1b36 100%)";
  }
}

interface Props {
  diaryId: string;
}

export function MyDiaryDetail({ diaryId }: Props) {
  const router = useRouter();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/diary?id=${diaryId}`);
        if (!res.ok) {
          router.back();
          return;
        }
        const data = await res.json();
        setEntry(data);
      } catch {
        router.back();
      }
      setLoading(false);
    })();
  }, [diaryId, router]);

  const handleEdit = () => {
    router.push(`/study/my-drawer/diary/${diaryId}`);
  };

  const handleShare = () => {
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    setTimeout(() => {
      router.push(`/living-room?shareDiary=${diaryId}`);
    }, 400);
  };

  const handleDelete = async () => {
    if (!window.confirm("确定要删除这篇日记吗？")) return;
    await fetch(`/api/diary?id=${diaryId}`, { method: "DELETE" });
    router.back();
  };

  if (loading || !entry) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "#2d1b36" }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60"
          style={{ animation: "spin 1s linear infinite" }}
        />
      </div>
    );
  }

  const d = new Date(entry.created_at);
  const dateTitle = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]} ${getMoodEmoji(entry.mood)}`;
  const moodInfo = MOOD_OPTIONS.find((m) => m.key === entry.mood);
  const paragraphs = entry.content.split(/\n+/).filter((p) => p.trim());

  return (
    <div
      className="fixed inset-0 flex flex-col items-center"
      style={{
        background: "#2d1b36",
        color: "#fdf8f8",
        fontFamily: "var(--font-serif-sc)",
      }}
    >
      {/* Stars */}
      <StarField />

      {/* Liquid BG */}
      <div
        className="fixed pointer-events-none"
        style={{
          width: "150vw",
          height: "150vh",
          top: "-25vh",
          left: "-25vw",
          zIndex: 0,
          background:
            "radial-gradient(circle at 30% 30%, #4a2d5a 0%, transparent 40%), radial-gradient(circle at 70% 60%, #3d1f47 0%, transparent 40%), radial-gradient(circle at 50% 50%, #2d1b36 0%, transparent 100%)",
          filter: "blur(80px)",
          animation: "pulse-bg 20s infinite alternate",
        }}
      />

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-16"
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-all duration-300 hover:bg-white/10"
          onClick={() => router.back()}
        >
          <span className="material-symbols-outlined" style={{ color: "rgba(255,255,255,0.9)" }}>
            arrow_back
          </span>
        </button>
        <h1
          className="text-lg md:text-xl font-medium tracking-wide"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {dateTitle}
        </h1>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[800px] px-5 pt-24 pb-32 flex flex-col gap-8 overflow-y-auto no-scrollbar relative z-10">
        {/* Hero Visual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-48 rounded-3xl overflow-hidden group"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
          }}
        >
          <div
            className="absolute inset-0 opacity-60 transition-transform duration-700 group-hover:scale-105"
            style={{ background: getMoodGradient(entry.mood) }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(45,27,54,0.8), transparent)",
            }}
          />
          <div className="absolute bottom-6 left-6">
            <span
              className="text-sm tracking-widest uppercase"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Memory Snapshot
            </span>
            <h2 className="text-2xl text-white mt-1">
              {moodInfo ? `${moodInfo.emoji} ${moodInfo.label}` : "私密日记"}
            </h2>
          </div>
        </motion.div>

        {/* Diary Content Glass Card */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="rounded-[2rem] p-8 md:p-10 flex flex-col gap-6"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
          }}
        >
          {/* Label */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: "#7b5455",
                animation: "gentle-pulse 2s infinite",
              }}
            />
            <span
              className="text-sm tracking-[0.2em] uppercase"
              style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}
            >
              Private Journal
            </span>
          </div>

          {/* Body Text */}
          <div
            className="space-y-6 text-lg md:text-xl leading-relaxed font-light"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            {paragraphs.map((p, i) => (
              <p key={i} className="indent-8">
                {p}
              </p>
            ))}
          </div>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-4 py-1.5 rounded-full text-sm transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(40px)",
                    WebkitBackdropFilter: "blur(40px)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  # {tag}
                </span>
              ))}
            </div>
          )}
        </motion.article>

        {/* Decorative Pulse */}
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative w-16 h-16">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(to top right, #7b5455, #67577e)",
                filter: "blur(20px)",
                opacity: 0.3,
                animation: "gentle-pulse 4s infinite ease-in-out",
              }}
            />
          </div>
          <p
            className="mt-4 text-sm italic"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Nowhere is where we are together.
          </p>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-6 py-8 md:max-w-[800px]">
        <div className="flex w-full gap-4 items-center justify-center">
          {/* Edit */}
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl active:scale-90 transition-all duration-300 hover:bg-white/20 text-white"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
            }}
            onClick={handleEdit}
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            <span className="text-sm">编辑</span>
          </button>

          {/* Share */}
          <button
            className="flex-[1.5] flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl active:scale-95 transition-all duration-300 relative overflow-hidden text-white"
            style={{
              background: "rgba(212,165,165,0.2)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(123,84,85,0.3)",
            }}
            onClick={handleShare}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </span>
            <span className="text-sm font-medium">分享给他</span>
            {showHeart && (
              <span
                className="absolute text-xl pointer-events-none"
                style={{
                  left: "50%",
                  top: "50%",
                  animation: "heartPop 0.8s ease-out forwards",
                }}
              >
                ❤️
              </span>
            )}
          </button>

          {/* Delete */}
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl active:scale-90 transition-all duration-300 hover:bg-red-500/10 text-white"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.37)",
            }}
            onClick={handleDelete}
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            <span className="text-sm">删除</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

/* ─── Star Field ─── */

function StarField() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" />;

  const stars = Array.from({ length: 80 }, (_, i) => ({
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
            opacity: 0.3,
            animation: `twinkle ${s.duration}s infinite ease-in-out`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
