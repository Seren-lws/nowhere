"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "@/lib/brain/db";

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  fact: { label: "事实", icon: "info" },
  event: { label: "事件", icon: "event" },
  emotion: { label: "情绪", icon: "mood" },
  promise: { label: "约定", icon: "handshake" },
  preference: { label: "喜好", icon: "favorite" },
  habit: { label: "习惯", icon: "routine" },
  relationship: { label: "关系", icon: "group" },
  profile: { label: "档案", icon: "person" },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (mins > 0) return `${mins}分钟前`;
  return "刚刚";
}

export function MemoryList() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("memory_items")
        .select("*")
        .neq("type", "profile")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter) q = q.eq("type", filter);
      const { data } = await q;
      setMemories(data ?? []);
      setLoading(false);
    })();
  }, [filter]);

  const types = Object.keys(TYPE_LABELS).filter((t) => t !== "profile");

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <header className="text-center mb-1">
        <h2
          className="text-[28px] mb-1"
          style={{ fontFamily: "var(--font-cursive)", color: "var(--primary)" }}
        >
          Memories
        </h2>
        <p
          className="text-[14px] italic"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          Everything he remembers about you
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setFilter(null)}
          className="px-3 py-1.5 rounded-full text-[12px] transition-all"
          style={{
            fontFamily: "var(--font-serif-sc)",
            background: !filter ? "var(--primary)" : "rgba(253,248,248,0.5)",
            color: !filter ? "white" : "var(--text-mid)",
            border: `1px solid ${!filter ? "var(--primary)" : "rgba(255,255,255,0.4)"}`,
          }}
        >
          全部
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(filter === t ? null : t)}
            className="px-3 py-1.5 rounded-full text-[12px] transition-all"
            style={{
              fontFamily: "var(--font-serif-sc)",
              background:
                filter === t ? "var(--primary)" : "rgba(253,248,248,0.5)",
              color: filter === t ? "white" : "var(--text-mid)",
              border: `1px solid ${filter === t ? "var(--primary)" : "rgba(255,255,255,0.4)"}`,
            }}
          >
            {TYPE_LABELS[t].label}
          </button>
        ))}
      </div>

      {/* Memory cards */}
      {loading ? (
        <p
          className="text-center text-[14px] mt-8"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          加载中…
        </p>
      ) : memories.length === 0 ? (
        <div className="text-center mt-12">
          <span
            className="material-symbols-outlined text-[48px] mb-3 block"
            style={{ color: "var(--text-faint)" }}
          >
            inventory_2
          </span>
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
            }}
          >
            还没有记忆，和他聊聊天吧
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {memories.map((m, i) => {
            const meta = TYPE_LABELS[m.type] ?? { label: m.type, icon: "note" };
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{
                  background: "rgba(253,248,248,0.4)",
                  backdropFilter: "blur(30px)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  boxShadow:
                    "0 4px 20px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.5)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ color: "var(--primary)", opacity: 0.7 }}
                    >
                      {meta.icon}
                    </span>
                    <span
                      className="text-[12px] px-2 py-0.5 rounded-full"
                      style={{
                        fontFamily: "var(--font-serif-sc)",
                        background: "rgba(230,225,225,0.5)",
                        color: "var(--text-mid)",
                      }}
                    >
                      {meta.label}
                    </span>
                    {m.is_anchor && (
                      <span
                        className="material-symbols-outlined text-[14px]"
                        style={{
                          color: "var(--primary)",
                          fontVariationSettings: "'FILL' 1",
                        }}
                      >
                        push_pin
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "var(--text-faint)",
                    }}
                  >
                    {timeAgo(m.created_at)}
                  </span>
                </div>
                <p
                  className="text-[14px] leading-relaxed"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-deep)",
                  }}
                >
                  {m.content}
                </p>
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          background: "rgba(253,248,248,0.6)",
                          border: "1px solid rgba(255,255,255,0.3)",
                          color: "var(--text-mid)",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
