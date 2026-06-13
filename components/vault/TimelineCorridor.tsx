"use client";

import { useEffect, useState } from "react";
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

function formatDate(dateStr: string): { month: string; day: string; year: string; weekday: string } {
  const d = new Date(dateStr + "T00:00:00");
  const month = `${d.getMonth() + 1}月`;
  const day = `${d.getDate()}日`;
  const year = `${d.getFullYear()}`;
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return { month, day, year, weekday: weekdays[d.getDay()] };
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
        setEvents((prev) => [data, ...prev].sort(
          (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
        ));
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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-start justify-between px-1 mb-2 mt-3">
        <div>
          <h2
            className="text-[22px] font-semibold tracking-wide"
            style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
          >
            时间回廊
          </h2>
          <p
            className="text-[13px] mt-1"
            style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)", opacity: 0.8 }}
          >
            那些值得被记住的时刻
          </p>
        </div>
        <button
          className="flex items-center gap-1 px-4 py-1.5 rounded-full text-[14px] font-medium transition-all active:scale-90 mt-1"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--primary)",
            background: "rgba(255,255,255,0.3)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
          onClick={() => setShowAdd(!showAdd)}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          添加
        </button>
      </header>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl p-5 flex flex-col gap-3 mb-2"
              style={{
                background: "rgba(255,255,255,0.35)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                border: "1px solid rgba(255,255,255,0.5)",
                boxShadow: "0 8px 32px 0 rgba(103,87,126,0.05)",
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
                  color: "var(--text-deep)",
                  background: "rgba(255,255,255,0.3)",
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
                  color: "var(--text-deep)",
                  background: "rgba(255,255,255,0.3)",
                  minHeight: "50px",
                }}
              />
              <div className="flex gap-3 items-center">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="border-none outline-none rounded-xl p-3 flex-1"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    fontSize: "13px",
                    color: "var(--text-deep)",
                    background: "rgba(255,255,255,0.3)",
                  }}
                />
                <div className="flex gap-1">
                  {ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[16px] transition-all"
                      style={{
                        background: newIcon === opt.value ? "rgba(123,84,85,0.2)" : "transparent",
                        border: newIcon === opt.value ? "1px solid rgba(123,84,85,0.3)" : "1px solid transparent",
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
                    color: "var(--text-mid)",
                    background: "rgba(255,255,255,0.3)",
                    border: "1px solid rgba(255,255,255,0.3)",
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
                    background: "var(--primary)",
                    boxShadow: "0 4px 12px rgba(123,84,85,0.3)",
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
        <p
          className="text-center text-[14px] mt-8"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          加载中…
        </p>
      ) : events.length === 0 && !showAdd ? (
        <div className="text-center mt-12">
          <span
            className="material-symbols-outlined text-[48px] mb-3 block"
            style={{ color: "var(--text-faint)" }}
          >
            timeline
          </span>
          <p
            className="text-[14px] mb-2"
            style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
          >
            时间回廊还是空的
          </p>
          <p
            className="text-[12px]"
            style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-faint)" }}
          >
            点右上角添加你们的重要时刻，或者聊天时他会自动记录
          </p>
        </div>
      ) : (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div
            className="absolute left-[11px] top-2 bottom-2 w-[2px]"
            style={{
              background: "linear-gradient(to bottom, rgba(123,84,85,0.3), rgba(123,84,85,0.05))",
            }}
          />

          {events.map((evt, i) => {
            const date = formatDate(evt.event_date);
            const ago = daysAgo(evt.event_date);

            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.4), duration: 0.35 }}
                className="relative mb-6 group"
              >
                {/* Node dot */}
                <div
                  className="absolute -left-8 top-3 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "2px solid rgba(123,84,85,0.4)",
                    boxShadow: "0 2px 8px rgba(123,84,85,0.15)",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ color: "var(--primary)", fontVariationSettings: "'FILL' 1" }}
                  >
                    {evt.icon}
                  </span>
                </div>

                {/* Card */}
                <div
                  className="rounded-2xl p-5 relative"
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    backdropFilter: "blur(40px)",
                    WebkitBackdropFilter: "blur(40px)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    boxShadow: "0 8px 32px 0 rgba(103,87,126,0.05)",
                  }}
                >
                  {/* Date row */}
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-medium"
                        style={{ fontFamily: "var(--font-serif-sc)", color: "var(--primary)" }}
                      >
                        {date.year}年{date.month}{date.day}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          color: "var(--text-mid)",
                          background: "rgba(255,255,255,0.3)",
                        }}
                      >
                        {date.weekday} · {ago}
                      </span>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 p-1"
                      onClick={() => deleteEvent(evt.id)}
                    >
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        close
                      </span>
                    </button>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-[16px] font-medium leading-relaxed"
                    style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-deep)" }}
                  >
                    {evt.title}
                  </h3>

                  {/* Content */}
                  {evt.content && (
                    <p
                      className="text-[13px] leading-relaxed mt-2"
                      style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
                    >
                      {evt.content}
                    </p>
                  )}

                  {/* Source tag */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        fontFamily: "var(--font-serif-sc)",
                        color: "var(--text-faint)",
                        background: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {SOURCE_LABEL[evt.source] ?? evt.source}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
