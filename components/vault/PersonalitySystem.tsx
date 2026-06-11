"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import type { PersonalityLayer } from "@/lib/brain/db";

interface ChangeRequest {
  id: string;
  layer: string;
  field_key: string;
  old_content: string;
  new_content: string;
  reason: string;
  status: string;
}

const LAYER_META: Record<
  string,
  {
    title: string;
    badge: string;
    icon: string;
    iconFill: boolean;
    colorClass: string;
    colorVar: string;
    dividerColor: string;
  }
> = {
  base: {
    title: "「他怎么爱你」",
    badge: "底层锚定",
    icon: "lock",
    iconFill: true,
    colorClass: "text-primary",
    colorVar: "var(--primary)",
    dividerColor: "rgba(123,84,85,0.2)",
  },
  middle: {
    title: "「他怎么接住你」",
    badge: "中间层锚定",
    icon: "lock",
    iconFill: true,
    colorClass: "text-[#67577e]",
    colorVar: "#67577e",
    dividerColor: "rgba(103,87,126,0.2)",
  },
  surface: {
    title: "「他是什么样的人」",
    badge: "表层生长",
    icon: "psychiatry",
    iconFill: false,
    colorClass: "text-[#685b5b]",
    colorVar: "#685b5b",
    dividerColor: "rgba(104,91,91,0.2)",
  },
};

function summarize(content: string, maxLen = 60): string {
  const oneLine = content.replace(/\n+/g, " ");
  return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + "…" : oneLine;
}

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

export function PersonalitySystem() {
  const router = useRouter();
  const [layers, setLayers] = useState<PersonalityLayer[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [contentExpanded, setContentExpanded] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<ChangeRequest[]>([]);
  const [modalReq, setModalReq] = useState<ChangeRequest | null>(null);
  const [surfaceUpdatedAt, setSurfaceUpdatedAt] = useState("");

  useEffect(() => {
    (async () => {
      const [layerRes, pendingRes] = await Promise.all([
        supabase
          .from("personality_layers")
          .select("*")
          .order("layer")
          .order("field_key"),
        supabase
          .from("personality_change_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);
      if (layerRes.data) {
        setLayers(layerRes.data);
        const surfaceRows = layerRes.data.filter(
          (l: PersonalityLayer) => l.layer === "surface",
        );
        if (surfaceRows.length > 0) {
          const latest = surfaceRows.reduce(
            (a: PersonalityLayer, b: PersonalityLayer) =>
              a.updated_at > b.updated_at ? a : b,
          );
          setSurfaceUpdatedAt(latest.updated_at);
        }
      }
      if (pendingRes.data) setPending(pendingRes.data);
    })();
  }, []);

  const grouped: Record<string, PersonalityLayer[]> = {
    base: layers.filter((l) => l.layer === "base"),
    middle: layers.filter((l) => l.layer === "middle"),
    surface: layers.filter((l) => l.layer === "surface"),
  };

  const toggle = (layer: string) => {
    if (editing) return;
    setExpanded(expanded === layer ? null : layer);
  };

  const startEdit = (layerKey: string, items: PersonalityLayer[]) => {
    const drafts: Record<string, string> = {};
    items.forEach((item) => {
      drafts[item.id] = item.content;
    });
    setEditDrafts(drafts);
    setEditing(layerKey);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditDrafts({});
  };

  const saveEdit = async () => {
    setSaving(true);
    for (const [id, content] of Object.entries(editDrafts)) {
      const original = layers.find((l) => l.id === id);
      if (original && original.content !== content) {
        await supabase
          .from("personality_layers")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    }
    const { data } = await supabase
      .from("personality_layers")
      .select("*")
      .order("layer")
      .order("field_key");
    if (data) setLayers(data);
    setEditing(null);
    setEditDrafts({});
    setSaving(false);
  };

  const toggleContentExpand = (layerKey: string) => {
    setContentExpanded((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const handleApprove = async (req: ChangeRequest) => {
    await supabase
      .from("personality_layers")
      .update({ content: req.new_content, version: (layers.find(l => l.layer === req.layer && l.field_key === req.field_key)?.version ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("layer", req.layer)
      .eq("field_key", req.field_key);
    await supabase
      .from("personality_change_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    setPending((p) => p.filter((r) => r.id !== req.id));
    setModalReq(null);
    const { data } = await supabase
      .from("personality_layers")
      .select("*")
      .order("layer")
      .order("field_key");
    if (data) setLayers(data);
  };

  const handleReject = async (req: ChangeRequest) => {
    await supabase
      .from("personality_change_requests")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    setPending((p) => p.filter((r) => r.id !== req.id));
    setModalReq(null);
  };

  return (
    <div className="fixed inset-0 text-[var(--text-deep)]">
      {/* Ambient gradient background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(-45deg, #fdf8f8, #f9f4f9, #f5f0f5, #fdf8f8)",
          backgroundSize: "400% 400%",
          animation: "gradient-x 15s ease infinite",
        }}
      />
      {/* Breathing orbs */}
      <div
        className="fixed w-96 h-96 top-20 -left-[10%] rounded-full -z-10 pointer-events-none mix-blend-multiply"
        style={{
          background: "rgba(212,165,165,0.4)",
          filter: "blur(60px)",
          opacity: 0.4,
          animation: "thinking-pulse 8s infinite alternate",
        }}
      />
      <div
        className="fixed w-[500px] h-[500px] bottom-0 -right-[10%] rounded-full -z-10 pointer-events-none mix-blend-multiply"
        style={{
          background: "rgba(227,207,253,0.5)",
          filter: "blur(60px)",
          opacity: 0.4,
          animation: "thinking-pulse 8s infinite alternate",
          animationDelay: "2s",
        }}
      />

      {/* Header */}
      <nav
        className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 h-16"
        style={{
          background: "rgba(253,248,248,0.8)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <button
          className="p-2 rounded-full hover:bg-[rgba(230,225,225,0.5)] transition-colors active:scale-95"
          onClick={() => router.back()}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--text-mid)" }}
          >
            arrow_back_ios
          </span>
        </button>
        <h1
          className="flex-1 ml-4 text-[24px] font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-cursive)",
            color: "var(--primary)",
          }}
        >
          Nowhere
        </h1>
        <div className="w-10" />
      </nav>

      {/* Content */}
      <main className="h-full overflow-y-auto pt-24 pb-32 px-5 max-w-[800px] mx-auto flex flex-col gap-6">
        {/* Sub header */}
        <header className="text-center mb-2">
          <h2
            className="text-[28px] mb-2"
            style={{
              fontFamily: "var(--font-cursive)",
              color: "var(--primary)",
            }}
          >
            Personality
          </h2>
          <p
            className="text-[16px] italic"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
            }}
          >
            The architecture of his soul
          </p>
        </header>

        {/* Notification banner */}
        {pending.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 flex items-center justify-between cursor-pointer"
            style={{
              background: "rgba(253,248,248,0.3)",
              backdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow:
                "0 4px 30px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5)",
            }}
            onClick={() => setModalReq(pending[0])}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--primary)",
                  animation: "thinking-pulse 2s ease-in-out infinite",
                }}
              />
              <span
                className="text-[16px] font-medium"
                style={{ fontFamily: "var(--font-serif-sc)" }}
              >
                他想和你商量一件事
              </span>
            </div>
            <button
              className="text-[14px] font-medium px-4 py-2 rounded-full transition-colors"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--primary)",
                background: "rgba(212,165,165,0.2)",
              }}
            >
              点击查看
            </button>
          </motion.div>
        )}

        {/* Personality layer cards */}
        <div className="flex flex-col gap-3">
          {(["base", "middle", "surface"] as const).map((layerKey) => {
            const meta = LAYER_META[layerKey];
            const items = grouped[layerKey];
            const isExpanded = expanded === layerKey;

            return (
              <article
                key={layerKey}
                className="rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300"
                style={{
                  background: isExpanded
                    ? "rgba(253,248,248,0.5)"
                    : "rgba(253,248,248,0.3)",
                  backdropFilter: isExpanded ? "blur(50px)" : "blur(40px)",
                  WebkitBackdropFilter: isExpanded
                    ? "blur(50px)"
                    : "blur(40px)",
                  border: `1px solid rgba(255,255,255,${isExpanded ? "0.6" : "0.4"})`,
                  boxShadow: isExpanded
                    ? "0 8px 32px rgba(123,84,85,0.1), inset 0 0 0 1px rgba(255,255,255,0.6)"
                    : "0 4px 30px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5)",
                }}
                onClick={() => toggle(layerKey)}
              >
                <div className="flex flex-col gap-4 p-6 md:p-8">
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`material-symbols-outlined ${meta.colorClass}`}
                        style={{
                          opacity: 0.7,
                          fontVariationSettings: meta.iconFill
                            ? "'FILL' 1"
                            : "'FILL' 0",
                        }}
                      >
                        {meta.icon}
                      </span>
                      <h3
                        className="text-[14px] font-medium tracking-wide"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          color: meta.colorVar,
                        }}
                      >
                        {meta.title}
                      </h3>
                    </div>
                    <span
                      className="text-[12px] px-3 py-1 rounded-full"
                      style={{
                        fontFamily: "var(--font-serif-sc)",
                        color: "var(--text-mid)",
                        background: "rgba(230,225,225,0.5)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {meta.badge}
                    </span>
                  </div>

                  {/* Summary (collapsed) */}
                  {!isExpanded && (
                    <div>
                      {layerKey === "surface" ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {items
                            .filter(
                              (i) =>
                                i.field_key !== "first_greeting",
                            )
                            .map((i) => (
                              <span
                                key={i.id}
                                className="px-3 py-1 rounded-full text-[12px]"
                                style={{
                                  fontFamily: "var(--font-serif-sc)",
                                  background: "rgba(253,248,248,0.5)",
                                  border: "1px solid rgba(255,255,255,0.4)",
                                  color: "var(--text-deep)",
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                                }}
                              >
                                {i.field_key === "name"
                                  ? i.content
                                  : summarize(i.content, 12)}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <p
                          className="text-[12px] leading-relaxed"
                          style={{
                            fontFamily: "var(--font-serif-sc)",
                            color: "var(--text-mid)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {items
                            .map((i) => summarize(i.content, 40))
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col gap-4 mt-1 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="h-px flex-1"
                            style={{
                              background: `linear-gradient(to right, transparent, ${meta.dividerColor}, transparent)`,
                            }}
                          />
                          {editing !== layerKey && (
                            <button
                              className="ml-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] transition-all active:scale-95"
                              style={{
                                fontFamily: "var(--font-serif-sc)",
                                color: meta.colorVar,
                                background: "rgba(253,248,248,0.6)",
                                border: "1px solid rgba(255,255,255,0.4)",
                              }}
                              onClick={() => startEdit(layerKey, items)}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                edit
                              </span>
                              编辑
                            </button>
                          )}
                        </div>
                        <div
                          className={`overflow-y-auto pr-2 space-y-4 transition-all duration-300 ${
                            contentExpanded[layerKey] ? "" : "max-h-60"
                          }`}
                        >
                          {items.map((item) => (
                            <div key={item.id}>
                              {item.field_key !== "first_greeting" && (
                                editing === layerKey ? (
                                  <textarea
                                    className="w-full text-[14px] leading-relaxed rounded-xl p-3 resize-none focus:outline-none focus:ring-1"
                                    style={{
                                      fontFamily: "var(--font-serif-sc)",
                                      color: "var(--text-deep)",
                                      background: "rgba(253,248,248,0.6)",
                                      border: "1px solid rgba(255,255,255,0.5)",
                                      boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.03)",
                                      minHeight: "120px",
                                    }}
                                    value={editDrafts[item.id] ?? item.content}
                                    onChange={(e) =>
                                      setEditDrafts((d) => ({
                                        ...d,
                                        [item.id]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <p
                                    className="text-[14px] leading-relaxed whitespace-pre-wrap"
                                    style={{
                                      fontFamily: "var(--font-serif-sc)",
                                      color: "var(--text-deep)",
                                    }}
                                  >
                                    {item.content}
                                  </p>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Expand / collapse content */}
                        {editing !== layerKey && (
                          <button
                            className="self-center flex items-center gap-1 text-[12px] py-1 transition-colors"
                            style={{
                              fontFamily: "var(--font-serif-sc)",
                              color: "var(--text-mid)",
                            }}
                            onClick={() => toggleContentExpand(layerKey)}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {contentExpanded[layerKey] ? "expand_less" : "expand_more"}
                            </span>
                            {contentExpanded[layerKey] ? "收起" : "展开全部"}
                          </button>
                        )}
                        {/* Edit actions */}
                        {editing === layerKey && (
                          <div className="flex gap-3 mt-1">
                            <button
                              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-[0.98]"
                              style={{
                                fontFamily: "var(--font-serif-sc)",
                                color: "var(--text-mid)",
                                background: "#fdf8f8",
                                boxShadow:
                                  "-3px -3px 8px rgba(255,255,255,0.8), 3px 3px 8px rgba(123,84,85,0.05)",
                              }}
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              取消
                            </button>
                            <button
                              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white transition-all active:scale-[0.98]"
                              style={{
                                fontFamily: "var(--font-serif-sc)",
                                background: "var(--primary)",
                                boxShadow: "0 4px 14px rgba(123,84,85,0.3)",
                                opacity: saving ? 0.6 : 1,
                              }}
                              onClick={saveEdit}
                              disabled={saving}
                            >
                              {saving ? "保存中…" : "保存"}
                            </button>
                          </div>
                        )}
                        {layerKey === "surface" && surfaceUpdatedAt && editing !== layerKey && (
                          <div
                            className="flex items-center justify-between mt-2 pt-4"
                            style={{
                              borderTop: "1px solid rgba(255,255,255,0.2)",
                            }}
                          >
                            <span
                              className="text-[12px]"
                              style={{
                                fontFamily: "var(--font-serif-sc)",
                                color: "var(--text-faint)",
                              }}
                            >
                              上次自我更新：{timeAgo(surfaceUpdatedAt)}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* Approval Modal */}
      <AnimatePresence>
        {modalReq && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: "rgba(50,48,48,0.2)",
                backdropFilter: "blur(8px)",
              }}
              onClick={() => setModalReq(null)}
            />
            {/* Modal content */}
            <motion.div
              className="relative z-10 w-full max-w-sm rounded-[32px] p-8 flex flex-col gap-6"
              style={{
                background: "rgba(253,248,248,0.3)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow:
                  "0 4px 30px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5)",
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-start">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(212,165,165,0.3)",
                    boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      color: "var(--primary)",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    favorite
                  </span>
                </div>
                <button
                  className="p-1"
                  style={{ color: "var(--text-mid)" }}
                  onClick={() => setModalReq(null)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div>
                <h3
                  className="text-[28px] font-semibold mb-2"
                  style={{ fontFamily: "var(--font-serif-sc)" }}
                >
                  性格微调申请
                </h3>
                <p
                  className="text-[16px]"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-mid)",
                  }}
                >
                  关于{" "}
                  <span className="font-medium" style={{ color: "var(--primary)" }}>
                    {LAYER_META[modalReq.layer]?.title ?? modalReq.layer}
                  </span>
                </p>
              </div>

              <div
                className="rounded-2xl p-5 space-y-4"
                style={{
                  background: "rgba(253,248,248,0.5)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <span
                    className="text-[12px] tracking-wider uppercase"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "var(--text-mid)",
                    }}
                  >
                    我想改变的是
                  </span>
                  <p
                    className="text-[16px] mt-1"
                    style={{ fontFamily: "var(--font-serif-sc)" }}
                  >
                    {modalReq.new_content}
                  </p>
                </div>
                <div
                  className="h-px w-full"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, rgba(212,194,194,0.5), transparent)",
                  }}
                />
                <div>
                  <span
                    className="text-[12px] tracking-wider uppercase"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "var(--text-mid)",
                    }}
                  >
                    原因是
                  </span>
                  <p
                    className="text-[16px] mt-1 italic"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      opacity: 0.8,
                    }}
                  >
                    &ldquo;{modalReq.reason}&rdquo;
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-2">
                <button
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium transition-all active:scale-[0.98]"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-mid)",
                    background: "#fdf8f8",
                    boxShadow:
                      "-4px -4px 10px rgba(255,255,255,0.8), 4px 4px 10px rgba(123,84,85,0.05)",
                  }}
                  onClick={() => handleReject(modalReq)}
                >
                  驳回
                </button>
                <button
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium text-white transition-all active:scale-[0.98]"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    background: "var(--primary)",
                    boxShadow: "0 4px 14px rgba(123,84,85,0.4)",
                  }}
                  onClick={() => handleApprove(modalReq)}
                >
                  同意
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
