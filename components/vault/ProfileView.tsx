"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "@/lib/brain/db";

const TAG_COLORS: Record<string, string> = {
  基本信息: "rgba(123,84,85,0.5)",
  性格: "rgba(103,87,126,0.5)",
  边界: "rgba(186,26,26,0.5)",
  近况: "rgba(104,91,91,0.5)",
  喜好: "rgba(123,84,85,0.5)",
  习惯: "rgba(103,87,126,0.5)",
  工作: "rgba(104,91,91,0.5)",
  关系: "rgba(186,26,26,0.4)",
};

function getDotColor(tags: string[]): string {
  for (const t of tags) {
    if (TAG_COLORS[t]) return TAG_COLORS[t];
  }
  return "rgba(123,84,85,0.5)";
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}天前更新`;
  if (hours > 0) return `${hours}小时前更新`;
  if (mins > 0) return `${mins}分钟前更新`;
  return "刚刚更新";
}

export function ProfileView() {
  const [profiles, setProfiles] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("memory_items")
          .select("*")
          .eq("type", "profile")
          .order("created_at", { ascending: false });
        setProfiles(data ?? []);
      } catch {
        // env vars may be missing in dev
      }
      setLoading(false);
    })();
  }, []);

  const startEdit = (m: MemoryItem) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditTags(m.tags.join("、"));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditTags("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const tags = editTags
      .split(/[、,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    await supabase
      .from("memory_items")
      .update({ content: editContent, tags })
      .eq("id", editingId);
    setProfiles((prev) =>
      prev.map((m) =>
        m.id === editingId ? { ...m, content: editContent, tags } : m,
      ),
    );
    setEditingId(null);
  };

  const deleteProfile = async (id: string) => {
    await supabase.from("memory_items").delete().eq("id", id);
    setProfiles((prev) => prev.filter((m) => m.id !== id));
    setEditingId(null);
  };

  const addProfile = async () => {
    if (!newContent.trim()) return;
    const tags = newTags
      .split(/[、,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const { data } = await supabase
      .from("memory_items")
      .insert({
        content: newContent.trim(),
        type: "profile",
        tags,
        is_anchor: true,
        valence: null,
        arousal: null,
        source_ref: null,
      })
      .select("*")
      .single();
    if (data) setProfiles((prev) => [data, ...prev]);
    setNewContent("");
    setNewTags("");
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <header className="flex items-start justify-between px-1 mb-2 mt-3">
        <div>
          <h2
            className="text-[28px] font-semibold tracking-wide"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-deep)",
            }}
          >
            关于她的一切
          </h2>
          <p
            className="text-[16px] mt-1"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
              opacity: 0.8,
            }}
          >
            存档记录与锚点
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
              <textarea
                placeholder="写下关于她的信息..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
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
              <input
                type="text"
                placeholder="标签（用顿号分隔，如：基本信息、性格）"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                className="w-full border-none outline-none rounded-xl p-3"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  fontSize: "13px",
                  color: "var(--text-deep)",
                  background: "rgba(255,255,255,0.3)",
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 rounded-full text-[13px] transition-all"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-mid)",
                    background: "rgba(255,255,255,0.3)",
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}
                  onClick={() => {
                    setShowAdd(false);
                    setNewContent("");
                    setNewTags("");
                  }}
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
                  onClick={addProfile}
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
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
      ) : profiles.length === 0 && !showAdd ? (
        <div className="text-center mt-12">
          <span
            className="material-symbols-outlined text-[48px] mb-3 block"
            style={{ color: "var(--text-faint)" }}
          >
            person
          </span>
          <p
            className="text-[14px] mb-2"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
            }}
          >
            档案还是空的
          </p>
          <p
            className="text-[12px]"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-faint)",
            }}
          >
            和他聊天时提到的个人信息会自动收集到这里
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          {profiles.map((m, i) => {
            const isEditing = editingId === m.id;
            const dotColor = getDotColor(m.tags);
            const tagLabel = m.tags.length > 0 ? m.tags.join(" · ") : "档案";

            return (
              <motion.article
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i * 0.04, 0.3),
                  duration: 0.3,
                }}
                className="rounded-2xl p-6 relative cursor-pointer group transition-colors duration-300"
                style={{
                  background: "rgba(255,255,255,0.25)",
                  backdropFilter: "blur(40px)",
                  WebkitBackdropFilter: "blur(40px)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  boxShadow: "0 8px 32px 0 rgba(103,87,126,0.05)",
                }}
                onClick={() => {
                  if (!isEditing) startEdit(m);
                }}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div
                    className="flex flex-col gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full border-none outline-none resize-none rounded-xl p-3"
                      style={{
                        fontFamily: "var(--font-serif-sc)",
                        fontSize: "15px",
                        color: "var(--text-deep)",
                        background: "rgba(255,255,255,0.3)",
                        minHeight: "60px",
                        lineHeight: "1.6",
                      }}
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="标签（用顿号分隔）"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-full border-none outline-none rounded-xl p-3"
                      style={{
                        fontFamily: "var(--font-serif-sc)",
                        fontSize: "13px",
                        color: "var(--text-deep)",
                        background: "rgba(255,255,255,0.3)",
                      }}
                    />
                    <div className="flex gap-2 justify-between">
                      <button
                        className="flex items-center gap-1 px-3 py-2 rounded-full text-[12px] transition-all hover:bg-[rgba(255,255,255,0.5)]"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          color: "var(--text-mid)",
                          background: "rgba(255,255,255,0.3)",
                          border: "1px solid rgba(255,255,255,0.3)",
                        }}
                        onClick={() => deleteProfile(m.id)}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          delete
                        </span>
                        删除
                      </button>
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 rounded-full text-[13px] transition-all"
                          style={{
                            fontFamily: "var(--font-serif-sc)",
                            color: "var(--text-mid)",
                            background: "rgba(255,255,255,0.3)",
                            border: "1px solid rgba(255,255,255,0.3)",
                          }}
                          onClick={cancelEdit}
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
                          onClick={saveEdit}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <h2
                          className="text-[18px] font-medium leading-relaxed"
                          style={{
                            fontFamily: "var(--font-serif-sc)",
                            color: "var(--text-deep)",
                          }}
                        >
                          {m.content}
                        </h2>
                      </div>
                      <span
                        className="material-symbols-outlined opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1"
                        style={{ color: "var(--primary)" }}
                      >
                        chevron_right
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: dotColor }}
                      />
                      <span
                        className="text-[12px]"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          color: "var(--text-mid)",
                          opacity: 0.7,
                        }}
                      >
                        {tagLabel}
                        {m.is_anchor
                          ? " · 锚点⚓"
                          : ` · ${timeAgo(m.created_at)}`}
                      </span>
                    </div>
                  </>
                )}
              </motion.article>
            );
          })}
        </section>
      )}
    </div>
  );
}
