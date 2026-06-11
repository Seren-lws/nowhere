"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "@/lib/brain/db";

const TYPE_LABELS: Record<string, string> = {
  fact: "事实",
  event: "事件",
  emotion: "情绪",
  promise: "约定",
  preference: "喜好",
  habit: "习惯",
  relationship: "关系",
};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "anchor", label: "⚓ 锚点" },
  { key: "fact", label: "事实" },
  { key: "event", label: "事件" },
  { key: "emotion", label: "情绪" },
  { key: "promise", label: "约定" },
  { key: "preference", label: "喜好" },
  { key: "habit", label: "习惯" },
];

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

function getValenceStyle(v: number | null) {
  if (v !== null && v > 0)
    return { stripe: "#FFB7C5", badge: "rgba(255,183,197,0.15)", label: "积极", icon: "sentiment_satisfied" };
  if (v !== null && v < 0)
    return { stripe: "#A9B2C3", badge: "rgba(169,178,195,0.15)", label: "消极", icon: "sentiment_dissatisfied" };
  return { stripe: "transparent", badge: "", label: "", icon: "" };
}

export function MemoryList() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const loadMemories = useCallback(async () => {
    let q = supabase
      .from("memory_items")
      .select("*")
      .neq("type", "profile")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filter === "anchor") q = q.eq("is_anchor", true);
    else if (filter !== "all") q = q.eq("type", filter);

    const { data } = await q;
    setMemories(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadMemories();
  }, [loadMemories]);

  const filtered = search
    ? memories.filter(
        (m) =>
          m.content.toLowerCase().includes(search.toLowerCase()) ||
          m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : memories;

  const toggleAnchor = async (m: MemoryItem) => {
    const next = !m.is_anchor;
    await supabase.from("memory_items").update({ is_anchor: next }).eq("id", m.id);
    setMemories((prev) =>
      prev.map((item) => (item.id === m.id ? { ...item, is_anchor: next } : item)),
    );
  };

  const deleteMemory = async (id: string) => {
    await supabase.from("memory_items").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setExpandedId(null);
  };

  const startEdit = (m: MemoryItem) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase
      .from("memory_items")
      .update({ content: editContent })
      .eq("id", editingId);
    setMemories((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, content: editContent } : m)),
    );
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div
        className="flex items-center gap-3 rounded-full"
        style={{
          padding: "12px 18px",
          background: "#fdf8f8",
          boxShadow: "inset 3px 3px 6px #e0dada, inset -3px -3px 6px #ffffff",
        }}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ color: "var(--text-faint)" }}
        >
          search
        </span>
        <input
          type="text"
          placeholder="搜索记忆..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-none bg-transparent w-full outline-none"
          style={{
            fontFamily: "var(--font-serif-sc)",
            fontSize: "14px",
            color: "var(--text-deep)",
          }}
        />
      </div>

      {/* Filter capsules */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0 transition-all duration-300"
              style={{
                padding: "8px 16px",
                borderRadius: "50px",
                fontFamily: "var(--font-serif-sc)",
                fontSize: "13px",
                whiteSpace: "nowrap",
                color: active ? "var(--primary)" : "var(--text-mid)",
                fontWeight: active ? 600 : 400,
                background: active
                  ? "rgba(123,84,85,0.12)"
                  : "rgba(255,255,255,0.22)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${active ? "rgba(123,84,85,0.25)" : "rgba(255,255,255,0.38)"}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Memory cards */}
      {loading ? (
        <p
          className="text-center text-[14px] mt-8"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-mid)",
          }}
        >
          加载中…
        </p>
      ) : filtered.length === 0 ? (
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
            {search ? "没有找到匹配的记忆" : "还没有记忆，和他聊聊天吧"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((m, i) => {
            const vs = getValenceStyle(m.valence);
            const expanded = expandedId === m.id;
            const isEditing = editingId === m.id;
            const typeLabel = TYPE_LABELS[m.type] ?? m.type;

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
                className="relative overflow-hidden cursor-pointer transition-all duration-300"
                style={{
                  padding: "16px 16px 16px 20px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.22)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: `1px solid ${m.is_anchor ? "rgba(255,183,197,0.4)" : "rgba(255,255,255,0.38)"}`,
                  boxShadow: m.is_anchor
                    ? "0 2px 16px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.5), 0 0 20px rgba(255,183,197,0.15)"
                    : "0 2px 16px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.5)",
                }}
                onClick={() => {
                  if (!isEditing) setExpandedId(expanded ? null : m.id);
                }}
              >
                {/* Left stripe */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{
                    background: vs.stripe,
                    borderRadius: "20px 0 0 20px",
                  }}
                />

                {/* Card content */}
                <div className="flex flex-col gap-2">
                  {isEditing ? (
                    <div
                      className="flex flex-col gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full border-none outline-none resize-none rounded-xl p-3"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          fontSize: "14px",
                          color: "var(--text-deep)",
                          background: "rgba(255,255,255,0.3)",
                          minHeight: "60px",
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          className="px-3 py-1.5 rounded-full text-[12px] transition-all"
                          style={{
                            fontFamily: "var(--font-serif-sc)",
                            color: "var(--text-mid)",
                            background: "rgba(255,255,255,0.3)",
                            border: "1px solid rgba(255,255,255,0.3)",
                          }}
                          onClick={() => setEditingId(null)}
                        >
                          取消
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-full text-[12px] transition-all"
                          style={{
                            fontFamily: "var(--font-serif-sc)",
                            color: "white",
                            background: "var(--primary)",
                          }}
                          onClick={saveEdit}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-[14px] leading-relaxed"
                      style={{
                        fontFamily: "var(--font-serif-sc)",
                        color: "var(--text-deep)",
                      }}
                    >
                      {m.content}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {m.is_anchor && (
                        <span
                          className="text-[12px]"
                          style={{ color: "var(--primary)" }}
                        >
                          ⚓
                        </span>
                      )}
                      <span
                        className="text-[12px]"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          color: "var(--text-faint)",
                        }}
                      >
                        {typeLabel}
                        {m.tags.length > 0 && ` · ${m.tags.join(" · ")}`}
                      </span>
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
                </div>

                {/* Expanded section */}
                <AnimatePresence>
                  {expanded && !isEditing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mt-3 pt-3 flex flex-col gap-2"
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.2)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {vs.label && (
                          <div
                            className="inline-flex items-center gap-1 self-start"
                            style={{
                              padding: "4px 10px",
                              borderRadius: "50px",
                              fontFamily: "var(--font-serif-sc)",
                              fontSize: "12px",
                              background: vs.badge,
                              color:
                                vs.label === "积极"
                                  ? "var(--primary)"
                                  : "var(--text-mid)",
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {vs.icon}
                            </span>
                            {vs.label}
                          </div>
                        )}

                        {m.source_ref && (
                          <p
                            className="text-[12px]"
                            style={{
                              fontFamily: "var(--font-serif-sc)",
                              color: "var(--text-faint)",
                            }}
                          >
                            来源：{m.source_ref}
                          </p>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-1">
                          <button
                            className="flex items-center gap-1 transition-all hover:bg-[rgba(255,255,255,0.5)]"
                            style={{
                              padding: "6px 12px",
                              borderRadius: "50px",
                              fontFamily: "var(--font-serif-sc)",
                              fontSize: "12px",
                              color: "var(--text-mid)",
                              background: "rgba(255,255,255,0.3)",
                              border: "1px solid rgba(255,255,255,0.3)",
                            }}
                            onClick={() => toggleAnchor(m)}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              anchor
                            </span>
                            {m.is_anchor ? "取消锚点" : "标为锚点"}
                          </button>
                          <button
                            className="flex items-center gap-1 transition-all hover:bg-[rgba(255,255,255,0.5)]"
                            style={{
                              padding: "6px 12px",
                              borderRadius: "50px",
                              fontFamily: "var(--font-serif-sc)",
                              fontSize: "12px",
                              color: "var(--text-mid)",
                              background: "rgba(255,255,255,0.3)",
                              border: "1px solid rgba(255,255,255,0.3)",
                            }}
                            onClick={() => startEdit(m)}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              edit
                            </span>
                            编辑
                          </button>
                          <button
                            className="flex items-center gap-1 transition-all hover:bg-[rgba(255,255,255,0.5)]"
                            style={{
                              padding: "6px 12px",
                              borderRadius: "50px",
                              fontFamily: "var(--font-serif-sc)",
                              fontSize: "12px",
                              color: "var(--text-mid)",
                              background: "rgba(255,255,255,0.3)",
                              border: "1px solid rgba(255,255,255,0.3)",
                            }}
                            onClick={() => deleteMemory(m.id)}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              delete
                            </span>
                            删除
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
