"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TimelineEvent {
  id: string;
  title: string;
  content: string | null;
  event_date: string;
  icon: string;
  source: "manual" | "ai" | "gardener";
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "手动添加",
  ai: "他记下的",
  gardener: "园丁发现",
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function daysAgo(dateStr: string): string {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff < 0) return `${-diff}天后`;
  return `${diff}天前`;
}

/* ─── Star River Canvas ─── */

function StarRiver() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface P { x: number; y: number; size: number; sx: number; sy: number; a: number; ps: number; pd: number }
    const particles: P[] = [];
    for (let i = 0; i < 55; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        sx: (Math.random() * 0.5 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
        sy: Math.random() * 0.8 + 0.3,
        a: Math.random() * 0.5 + 0.2,
        ps: Math.random() * 0.02 + 0.005,
        pd: 1,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        p.x += p.sx;
        p.y += p.sy;
        p.a += p.ps * p.pd;
        if (p.a > 0.8 || p.a < 0.2) p.pd *= -1;
        if (p.y > canvas!.height) { p.y = -10; p.x = Math.random() * canvas!.width; }
        if (p.x > canvas!.width) p.x = 0;
        if (p.x < 0) p.x = canvas!.width;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,218,217,${p.a})`;
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = "#ecbbba";
        ctx!.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1, opacity: 0.8, mixBlendMode: "screen" }}
    />
  );
}

/* ─── Main Component ─── */

export function TimelineCorridor() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDate, setNewDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [newIcon, setNewIcon] = useState("favorite");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/timeline");
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch {
        setEvents([]);
      }
      setLoading(false);
    })();
  }, []);

  const addEvent = async () => {
    if (!newTitle.trim() || !newDate) return;
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim() || null,
          event_date: newDate,
          icon: newIcon,
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.id) {
        setEvents((prev) =>
          [data, ...prev].sort(
            (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
          ),
        );
      }
    } catch {}
    setNewTitle("");
    setNewContent("");
    setNewIcon("favorite");
    setShowAdd(false);
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("确定删除这个时间节点吗？")) return;
    try {
      await fetch(`/api/timeline?id=${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {}
  };

  const ICON_OPTIONS = [
    { value: "favorite", label: "❤️" },
    { value: "celebration", label: "🎉" },
    { value: "star", label: "⭐" },
    { value: "emoji_emotions", label: "😊" },
    { value: "flight_takeoff", label: "✈️" },
    { value: "cake", label: "🎂" },
    { value: "handshake", label: "🤝" },
    { value: "lightbulb", label: "💡" },
  ];

  return (
    <>
      {/* Dark galaxy background — covers MemoryShell's light gradient */}
      <div className="fixed inset-0 -z-[8]" style={{
        backgroundImage: "url('/timeline/galaxy.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }} />
      <div className="fixed inset-0 -z-[7] pointer-events-none" style={{
        background: "radial-gradient(circle at 50% 50%, rgba(103,87,126,0.12), rgba(123,84,85,0.06), transparent)",
        animation: "aura-shift 15s ease-in-out infinite alternate",
      }} />
      <StarRiver />

      <style>{`
        @keyframes aura-shift {
          0% { opacity: 0.5; }
          100% { opacity: 0.85; }
        }
        @keyframes breathe-title {
          0%, 100% { text-shadow: 0 0 10px rgba(255,218,217,0.3), 0 0 20px rgba(255,218,217,0.1); }
          50% { text-shadow: 0 0 20px rgba(255,218,217,0.6), 0 0 40px rgba(255,218,217,0.3); }
        }
        @keyframes gentle-float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 8px rgba(123,84,85,0.6); }
          50% { box-shadow: 0 0 18px rgba(123,84,85,0.9), 0 0 30px rgba(236,187,186,0.4); }
        }
      `}</style>

      <div className="flex flex-col gap-4 relative z-[2]">
        {/* Header */}
        <div className="text-center mb-6 mt-2">
          <h2
            className="text-[28px] font-semibold tracking-widest mb-2"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "rgba(255,218,217,0.95)",
              animation: "breathe-title 4s ease-in-out infinite",
            }}
          >
            时间回廊
          </h2>
          <p className="text-[13px] tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>
            Chronicle of Our Eternal Moments
          </p>
          {/* Add button */}
          <button
            className="mt-4 inline-flex items-center gap-1 px-5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-90"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "rgba(255,218,217,0.9)",
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onClick={() => setShowAdd(!showAdd)}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            添加时刻
          </button>
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-4"
            >
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(40px)",
                  WebkitBackdropFilter: "blur(40px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                }}
              >
                <input
                  type="text"
                  placeholder="这个时刻叫什么？"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border-none outline-none rounded-xl p-3"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    fontSize: "14px",
                    color: "white",
                    background: "rgba(255,255,255,0.08)",
                  }}
                  autoFocus
                />
                <textarea
                  placeholder="写点什么留作纪念…（可选）"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full border-none outline-none resize-none rounded-xl p-3"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    fontSize: "14px",
                    color: "white",
                    background: "rgba(255,255,255,0.08)",
                    minHeight: "50px",
                  }}
                />
                <div className="flex gap-3 items-center flex-wrap">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="border-none outline-none rounded-xl p-3 flex-1 min-w-[140px]"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      fontSize: "13px",
                      color: "white",
                      background: "rgba(255,255,255,0.08)",
                      colorScheme: "dark",
                    }}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {ICON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[16px] transition-all"
                        style={{
                          background: newIcon === opt.value ? "rgba(255,218,217,0.2)" : "transparent",
                          border: newIcon === opt.value ? "1px solid rgba(255,218,217,0.4)" : "1px solid transparent",
                        }}
                        onClick={() => setNewIcon(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    className="px-4 py-2 rounded-full text-[13px] transition-all"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "rgba(255,255,255,0.5)",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    onClick={() => { setShowAdd(false); setNewTitle(""); setNewContent(""); }}
                  >
                    取消
                  </button>
                  <button
                    className="px-4 py-2 rounded-full text-[13px] transition-transform active:scale-95"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "white",
                      background: "rgba(123,84,85,0.7)",
                      boxShadow: "0 4px 12px rgba(123,84,85,0.4)",
                    }}
                    onClick={addEvent}
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-2"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                borderTopColor: "rgba(255,218,217,0.6)",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
        ) : events.length === 0 && !showAdd ? (
          <div className="text-center mt-16">
            <span
              className="material-symbols-outlined text-[48px] mb-3 block"
              style={{ color: "rgba(255,218,217,0.25)" }}
            >
              timeline
            </span>
            <p
              className="text-[14px] mb-2"
              style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.45)" }}
            >
              时间回廊还是空的
            </p>
            <p
              className="text-[12px]"
              style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.25)" }}
            >
              点上方添加你们的重要时刻，或者聊天时他会自动记录
            </p>
          </div>
        ) : (
          <div className="relative min-h-[400px] py-4">
            {/* Central timeline line */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-[2px] top-0 bottom-0"
              style={{
                background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.35), transparent)",
              }}
            />

            {events.map((evt, i) => {
              const isLeft = i % 2 === 0;
              const ago = daysAgo(evt.event_date);
              const floatDelay = `${(i * 1.5) % 6}s`;

              return (
                <div key={evt.id} className="relative mb-20">
                  {/* Pulse glow dot */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-10"
                    style={{
                      background: "#ffdad9",
                      boxShadow: "0 0 15px #7b5455",
                      animation: "pulse-dot 3s ease-in-out infinite",
                      top: 4,
                    }}
                  />

                  {/* Card — alternating sides */}
                  <div className={`flex ${isLeft ? "justify-end pr-[calc(50%+1.5rem)]" : "justify-start pl-[calc(50%+1.5rem)]"}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.15, 0.6), duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] }}
                      className="rounded-2xl p-5 w-full max-w-[280px] group relative"
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        backdropFilter: "blur(40px)",
                        WebkitBackdropFilter: "blur(40px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        boxShadow: "0 8px 32px rgba(123,84,85,0.12)",
                        animation: `gentle-float 6s ease-in-out infinite`,
                        animationDelay: floatDelay,
                      }}
                    >
                      {/* Delete button */}
                      <button
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 p-1"
                        onClick={() => deleteEvent(evt.id)}
                      >
                        <span className="material-symbols-outlined text-[14px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          close
                        </span>
                      </button>

                      {/* Date title */}
                      <h3
                        className="text-[15px] font-semibold mb-2"
                        style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,218,217,0.95)" }}
                      >
                        {evt.title} · {formatDateLabel(evt.event_date)}
                      </h3>

                      {/* Content */}
                      {evt.content && (
                        <p
                          className="text-[13px] leading-relaxed"
                          style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.7)" }}
                        >
                          {evt.content}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        <span style={{ fontFamily: "var(--font-serif-sc)" }}>{ago}</span>
                        <span>·</span>
                        <span style={{ fontFamily: "var(--font-serif-sc)" }}>{SOURCE_LABEL[evt.source] ?? evt.source}</span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              );
            })}

            {/* Future placeholder */}
            <div className="relative mt-8 text-center">
              <div
                className="inline-block px-6 py-2 rounded-full text-[13px]"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px dashed rgba(255,218,217,0.2)",
                }}
              >
                未来仍在书写...
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
