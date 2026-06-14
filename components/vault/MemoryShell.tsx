"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { MemoryTabs } from "./MemoryTabs";

const BUBBLE_COUNT = 12;

function useBubbles() {
  return useMemo(() => {
    const seeds = [
      { size: 35, left: 8, dur: 14, delay: 0 },
      { size: 22, left: 25, dur: 11, delay: 3 },
      { size: 50, left: 42, dur: 16, delay: 7 },
      { size: 28, left: 60, dur: 12, delay: 1 },
      { size: 40, left: 78, dur: 18, delay: 5 },
      { size: 18, left: 15, dur: 13, delay: 9 },
      { size: 55, left: 90, dur: 15, delay: 2 },
      { size: 30, left: 50, dur: 10, delay: 6 },
      { size: 24, left: 35, dur: 17, delay: 4 },
      { size: 45, left: 70, dur: 14, delay: 8 },
      { size: 20, left: 5, dur: 12, delay: 10 },
      { size: 38, left: 55, dur: 16, delay: 3 },
    ];
    return seeds.slice(0, BUBBLE_COUNT);
  }, []);
}

export function MemoryShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isTimeline = pathname.startsWith("/vault/timeline");
  const bubbles = useBubbles();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const exportData = useCallback(async () => {
    setMenuOpen(false);
    try {
      const [memories, profiles, logs] = await Promise.all([
        supabase
          .from("memory_items")
          .select("*")
          .neq("type", "profile")
          .order("created_at", { ascending: false }),
        supabase
          .from("memory_items")
          .select("*")
          .eq("type", "profile")
          .order("created_at", { ascending: false }),
        supabase
          .from("gardener_logs")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const payload = {
        exported_at: new Date().toISOString(),
        memories: memories.data ?? [],
        profiles: profiles.data ?? [],
        gardener_logs: logs.data ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nowhere-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail if tables don't exist yet
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await Promise.all([
        supabase.from("memory_items").delete().neq("id", ""),
        supabase.from("gardener_logs").delete().neq("id", ""),
      ]);
    } catch {
      // ignore
    }
    setConfirmClear(false);
    window.location.reload();
  }, []);

  return (
    <div className="fixed inset-0 text-[var(--text-deep)]">
      {/* Breathing gradient background — hidden on timeline (it has its own dark bg) */}
      {!isTimeline && (
        <div
          className="fixed inset-0 -z-10"
          style={{
            background:
              "linear-gradient(-45deg, #fdf8f8, #e3cffd, #d4a5a5, #f7f2f2)",
            backgroundSize: "400% 400%",
            animation: "gradient-x 15s ease infinite",
          }}
        />
      )}

      {/* Rising bubbles — hidden on timeline */}
      {!isTimeline && (
        <div className="fixed inset-0 -z-[5] overflow-hidden pointer-events-none">
          {bubbles.map((b, i) => (
            <div
              key={i}
              className="bubble"
              style={{
                width: b.size,
                height: b.size,
                left: `${b.left}%`,
                animation: `bubble-rise ${b.dur}s linear infinite`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <nav
        className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 h-14"
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
          onClick={() => router.push("/vault")}
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

        {/* More menu */}
        <div className="relative" ref={menuRef}>
          <button
            className="p-2 rounded-full hover:bg-[rgba(230,225,225,0.5)] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--text-mid)" }}
            >
              more_vert
            </span>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-44 rounded-2xl overflow-hidden z-50"
                style={{
                  background: "rgba(253,248,248,0.92)",
                  backdropFilter: "blur(30px)",
                  WebkitBackdropFilter: "blur(30px)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow:
                    "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(230,225,225,0.4)]"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/settings");
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ color: "var(--text-mid)" }}
                  >
                    tune
                  </span>
                  <span
                    className="text-[14px]"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "var(--text-deep)",
                    }}
                  >
                    API 设置
                  </span>
                </button>

                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(230,225,225,0.4)]"
                  onClick={exportData}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ color: "var(--text-mid)" }}
                  >
                    download
                  </span>
                  <span
                    className="text-[14px]"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "var(--text-deep)",
                    }}
                  >
                    导出数据
                  </span>
                </button>

                <div
                  style={{
                    height: 1,
                    background: "rgba(230,225,225,0.5)",
                    margin: "0 12px",
                  }}
                />

                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(230,225,225,0.4)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmClear(true);
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ color: "#ba1a1a" }}
                  >
                    delete_sweep
                  </span>
                  <span
                    className="text-[14px]"
                    style={{
                      fontFamily: "var(--font-serif-sc)",
                      color: "#ba1a1a",
                    }}
                  >
                    清空记忆
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Confirm clear modal */}
      <AnimatePresence>
        {confirmClear && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setConfirmClear(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-3xl p-6 mx-6 max-w-sm w-full"
              style={{
                background: "rgba(253,248,248,0.95)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                border: "1px solid rgba(255,255,255,0.5)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={{ color: "#ba1a1a" }}
                >
                  warning
                </span>
                <h3
                  className="text-[18px] font-semibold"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-deep)",
                  }}
                >
                  确认清空？
                </h3>
              </div>
              <p
                className="text-[14px] leading-relaxed mb-6"
                style={{
                  fontFamily: "var(--font-serif-sc)",
                  color: "var(--text-mid)",
                }}
              >
                这会删除所有记忆、档案和园丁日志，操作不可撤销。
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium transition-colors"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    background: "rgba(230,225,225,0.5)",
                    color: "var(--text-deep)",
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}
                  onClick={() => setConfirmClear(false)}
                >
                  取消
                </button>
                <button
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium transition-transform active:scale-95"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    background: "#ba1a1a",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(186,26,26,0.3)",
                  }}
                  onClick={clearAll}
                >
                  确认清空
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <main className="h-full overflow-y-auto pt-20 pb-28 px-5 max-w-[800px] mx-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <MemoryTabs />
    </div>
  );
}
