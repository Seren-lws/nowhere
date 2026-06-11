"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";

interface VaultStats {
  pendingRequests: number;
  pendingPreview: string;
  memoryCount: number;
  anchorCount: number;
  latestMemory: string;
  surfaceUpdatedAgo: string;
}

async function fetchStats(): Promise<VaultStats> {
  const [pending, memories, anchors, latest, surfaceUpdate] = await Promise.all([
    supabase
      .from("personality_change_requests")
      .select("new_content")
      .eq("status", "pending"),
    supabase
      .from("memory_items")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("memory_items")
      .select("id", { count: "exact", head: true })
      .eq("is_anchor", true),
    supabase
      .from("memory_items")
      .select("content")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("personality_layers")
      .select("updated_at")
      .eq("layer", "surface")
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  const pendingCount = pending.data?.length ?? 0;
  const pendingPreview =
    pendingCount > 0
      ? `他想修改${pendingCount}条底层内容`
      : "";

  const latestContent = latest.data?.[0]?.content ?? "";
  const latestMemory = latestContent
    ? `最近记了「${latestContent.length > 15 ? latestContent.slice(0, 15) + "…" : latestContent}」`
    : "";

  let surfaceUpdatedAgo = "";
  const surfaceTs = surfaceUpdate.data?.[0]?.updated_at;
  if (surfaceTs) {
    const diff = Date.now() - new Date(surfaceTs).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) surfaceUpdatedAgo = `表层上次更新于${days}天前`;
    else if (hours > 0) surfaceUpdatedAgo = `表层上次更新于${hours}小时前`;
    else surfaceUpdatedAgo = `表层刚刚更新`;
  }

  return {
    pendingRequests: pendingCount,
    pendingPreview,
    memoryCount: memories.count ?? 0,
    anchorCount: anchors.count ?? 0,
    latestMemory,
    surfaceUpdatedAgo,
  };
}

export function Vault() {
  const router = useRouter();
  const [stats, setStats] = useState<VaultStats | null>(null);

  useEffect(() => {
    fetchStats().then(setStats);
  }, []);

  return (
    <div className="fixed inset-0" style={{ background: "#fdf8f8" }}>
      {/* Background */}
      <div
        className="fixed inset-0 w-full h-full z-0"
        style={{
          backgroundImage: "url('/rooms/vault.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,218,217,0.3), rgba(237,220,255,0.2), rgba(255,218,217,0.3))",
            backdropFilter: "blur(1px)",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-5 h-16"
        style={{
          background: "rgba(253,248,248,0.2)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.1)" }}
          onClick={() => router.push("/floor-plan")}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--primary)" }}
          >
            arrow_back
          </span>
        </button>
        <h1
          className="text-[24px] font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
          }}
        >
          保险柜
        </h1>
        <div className="w-10" />
      </header>

      {/* Cards */}
      <main className="relative z-10 w-full max-w-[800px] mx-auto pt-28 pb-12 px-5 flex flex-col gap-6">
        {/* Card 1: 人格系统 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[32px] p-6 cursor-pointer transition-all duration-300 relative group active:scale-[0.98]"
          style={{
            background: "#fdf8f8",
            boxShadow: "10px 10px 20px #e0dada, -10px -10px 20px #ffffff",
          }}
          onClick={() => router.push("/vault/personality")}
        >
          {/* Notification Badge */}
          {stats && stats.pendingRequests > 0 && (
            <div
              className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(247,242,242,0.9)",
                border: "1px solid rgba(255,255,255,0.5)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--primary)",
                  boxShadow: "0 0 6px var(--primary)",
                  animation: "gentle-pulse 2.5s ease-in-out infinite",
                }}
              />
              <span
                className="text-[12px] font-medium"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "var(--text-mid)",
                }}
              >
                {stats.pendingPreview}
              </span>
            </div>
          )}

          <div className="flex flex-col items-start gap-4 mt-2">
            <div
              className="w-14 h-14 rounded-[16px] flex items-center justify-center"
              style={{
                background: "rgba(123,84,85,0.1)",
                boxShadow:
                  "inset 4px 4px 8px #e0dada, inset -4px -4px 8px #ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span
                className="material-symbols-outlined text-[32px]"
                style={{
                  color: "var(--primary)",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                psychology
              </span>
            </div>
            <div>
              <h2
                className="text-[28px] font-bold mb-1"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "var(--text-deep)",
                  textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                }}
              >
                人格系统
              </h2>
              <p
                className="text-[16px] leading-6"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "var(--text-mid)",
                  opacity: 0.8,
                }}
              >
                3层人格
                {stats?.surfaceUpdatedAgo
                  ? ` · ${stats.surfaceUpdatedAgo}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--text-mid)" }}
            >
              arrow_forward
            </span>
          </div>
        </motion.div>

        {/* Card 2: 记忆系统 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.1,
          }}
          className="rounded-[32px] p-6 cursor-pointer transition-all duration-300 relative group active:scale-[0.98]"
          style={{
            background: "#fdf8f8",
            boxShadow: "10px 10px 20px #e0dada, -10px -10px 20px #ffffff",
          }}
          onClick={() => {}}
        >
          <div className="flex flex-col items-start gap-4 mt-2">
            <div
              className="w-14 h-14 rounded-[16px] flex items-center justify-center"
              style={{
                background: "rgba(103,87,126,0.1)",
                boxShadow:
                  "inset 4px 4px 8px #e0dada, inset -4px -4px 8px #ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span
                className="material-symbols-outlined text-[32px]"
                style={{
                  color: "#67577e",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                inventory_2
              </span>
            </div>
            <div>
              <h2
                className="text-[28px] font-bold mb-1"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "var(--text-deep)",
                  textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                }}
              >
                记忆系统
              </h2>
              <p
                className="text-[16px] leading-6"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "var(--text-mid)",
                  opacity: 0.8,
                }}
              >
                {stats
                  ? `${stats.memoryCount}条记忆 · ${stats.anchorCount}个锚点`
                  : "加载中…"}
                {stats?.latestMemory && (
                  <>
                    <br />
                    <span
                      className="mt-1 block"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {stats.latestMemory}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--text-mid)" }}
            >
              arrow_forward
            </span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
