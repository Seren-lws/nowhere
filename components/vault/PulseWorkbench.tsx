"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { loadSettings } from "@/lib/brain/config";
import { resolveConflict as resolveConflictAction } from "@/lib/brain/gardener";

interface GardenerLog {
  id: string;
  type: "patrol" | "merge" | "conflict" | "cleanup";
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  status: "completed" | "pending" | "resolved";
  created_at: string;
}

function timeLabel(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const days = Math.floor(diff / 86400000);
  const d = new Date(ts);
  const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (days === 0) return `今天 ${time}`;
  if (days === 1) return `昨天 ${time}`;
  if (days === 2) return `前天 ${time}`;
  return `${days}天前 ${time}`;
}

const ICON_MAP: Record<
  string,
  { icon: string; fill: boolean; color: string }
> = {
  patrol: { icon: "check_circle", fill: true, color: "var(--primary)" },
  merge: { icon: "merge", fill: false, color: "#67577e" },
  conflict: { icon: "warning_amber", fill: true, color: "#ba1a1a" },
  cleanup: { icon: "history", fill: false, color: "var(--text-mid)" },
};

export function PulseWorkbench() {
  const [logs, setLogs] = useState<GardenerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [patrolling, setPatrolling] = useState(false);
  const [patrolMsg, setPatrolMsg] = useState("");

  const fetchLogs = async () => {
    try {
      const { data } = await supabase
        .from("gardener_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs(data ?? []);
    } catch {
      // table may not exist yet
    }
  };

  useEffect(() => {
    fetchLogs().then(() => setLoading(false));
  }, []);

  const startPatrol = async () => {
    const settings = loadSettings();
    if (!settings.apiKey || !settings.gardenerModel) {
      setPatrolMsg("请先到设置里填好 API Key 和园丁模型");
      return;
    }
    setPatrolling(true);
    setPatrolMsg("园丁正在巡逻中…");
    try {
      const res = await fetch("/api/gardener", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config: {
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            gardenerModel: settings.gardenerModel,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPatrolMsg(data.error || "巡逻失败了");
      } else {
        setPatrolMsg(data.summary || "巡逻完成");
        await fetchLogs();
      }
    } catch {
      setPatrolMsg("巡逻出错了，请检查网络和设置");
    }
    setPatrolling(false);
  };

  const resolveConflict = async (logId: string, choice: "first" | "second") => {
    await resolveConflictAction(logId, choice);
    setLogs((prev) =>
      prev.map((l) =>
        l.id === logId ? { ...l, status: "resolved" as const } : l,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="mb-2 mt-3">
        <div className="flex items-start justify-between">
          <div>
            <h2
              className="text-[22px] font-semibold mb-2"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--text-deep)",
              }}
            >
              园丁日志
            </h2>
            <p
              className="text-[13px] leading-5 max-w-md"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--text-mid)",
              }}
            >
              维护内心的秩序，修剪记忆的枝丫。
            </p>
          </div>
          <button
            onClick={startPatrol}
            disabled={patrolling}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-95 disabled:opacity-50 mt-1"
            style={{
              fontFamily: "var(--font-serif-sc)",
              background: "var(--primary)",
              color: "white",
              boxShadow: "0 2px 8px rgba(123,84,85,0.3)",
            }}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{
                animation: patrolling ? "spin 1.5s linear infinite" : undefined,
              }}
            >
              {patrolling ? "progress_activity" : "psychiatry"}
            </span>
            {patrolling ? "巡逻中…" : "手动巡逻"}
          </button>
        </div>
        {patrolMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[13px] mt-3 px-3 py-2 rounded-lg"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
              background: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.6)",
            }}
          >
            {patrolMsg}
          </motion.p>
        )}
      </div>

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
      ) : logs.length === 0 ? (
        <div className="text-center mt-12">
          <span
            className="material-symbols-outlined text-[48px] mb-3 block"
            style={{ color: "var(--text-faint)" }}
          >
            psychiatry
          </span>
          <p
            className="text-[14px] mb-2"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
            }}
          >
            园丁还没有开始工作
          </p>
          <p
            className="text-[12px]"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-faint)",
            }}
          >
            他会在深夜悄悄巡逻，整理记忆、发现矛盾、维护秩序
          </p>
        </div>
      ) : (
        /* Timeline */
        <div className="relative pl-12">
          {/* Vertical line */}
          <div
            className="absolute left-[24px] top-0 bottom-0 w-[2px]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(123,84,85,0.2), rgba(123,84,85,0.05))",
            }}
          />

          <div className="flex flex-col gap-6">
            {logs.map((log, i) => {
              const cfg = ICON_MAP[log.type] ?? ICON_MAP.patrol;
              const isConflictPending =
                log.type === "conflict" && log.status === "pending";
              const isOld = i >= 3;

              return (
                <motion.article
                  key={log.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: isOld ? 0.6 : 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.3 }}
                  className="relative z-10"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-12 top-6 rounded-full border-2 border-white"
                    style={{
                      width: isConflictPending ? 16 : 12,
                      height: isConflictPending ? 16 : 12,
                      background: isConflictPending
                        ? "#ba1a1a"
                        : log.type === "patrol"
                          ? "var(--primary-container)"
                          : "#e6e1e1",
                      boxShadow: [
                        "0 1px 3px rgba(0,0,0,0.1)",
                        isConflictPending
                          ? "0 0 0 4px rgba(186,26,26,0.3)"
                          : log.type === "patrol"
                            ? "0 0 0 4px rgba(212,165,165,0.2)"
                            : "",
                      ]
                        .filter(Boolean)
                        .join(", "),
                      animation: isConflictPending
                        ? "gentle-pulse 2s infinite"
                        : undefined,
                    }}
                  />

                  {/* Card */}
                  <div
                    className="rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-0.5"
                    style={{
                      background: isConflictPending
                        ? "rgba(255,218,214,0.1)"
                        : "rgba(255,255,255,0.4)",
                      backdropFilter: "blur(24px)",
                      WebkitBackdropFilter: "blur(24px)",
                      border: `1px solid ${isConflictPending ? "rgba(186,26,26,0.2)" : "rgba(255,255,255,0.6)"}`,
                      boxShadow:
                        "0 4px 24px -1px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{
                          color: cfg.color,
                          fontVariationSettings: cfg.fill
                            ? "'FILL' 1"
                            : "'FILL' 0",
                        }}
                      >
                        {cfg.icon}
                      </span>
                      <h3
                        className="text-[18px] font-semibold flex-1"
                        style={{
                          fontFamily: "var(--font-serif-sc)",
                          color: "var(--text-deep)",
                        }}
                      >
                        {log.title} ·{" "}
                        <span
                          style={{
                            color: isConflictPending
                              ? "var(--primary-container)"
                              : "var(--text-mid)",
                          }}
                        >
                          {timeLabel(log.created_at)}
                        </span>
                      </h3>
                      {isConflictPending && (
                        <span
                          className="px-3 py-1 rounded-full text-[10px]"
                          style={{
                            background: "rgba(186,26,26,0.1)",
                            color: "#ba1a1a",
                            fontFamily: "var(--font-serif-sc)",
                          }}
                        >
                          待处理
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    {isConflictPending && log.metadata ? (
                      <ConflictBody
                        log={log}
                        onResolve={resolveConflict}
                      />
                    ) : (
                      <NormalBody log={log} />
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ConflictBody({
  log,
  onResolve,
}: {
  log: GardenerLog;
  onResolve: (id: string, choice: "first" | "second") => void;
}) {
  const meta = log.metadata as Record<string, string> | null;
  return (
    <div className="flex flex-col gap-3">
      {/* Quote A */}
      <div
        className="flex items-center gap-3 rounded-xl p-3"
        style={{
          background: "rgba(253,248,248,0.5)",
          border: "1px solid rgba(255,255,255,0.4)",
        }}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ color: "var(--text-faint)", opacity: 0.5 }}
        >
          format_quote
        </span>
        <p
          className="flex-1 text-[16px]"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
          }}
        >
          {meta?.quote_a}
        </p>
      </div>

      {/* VS divider */}
      <div className="flex justify-center -my-1 relative z-10">
        <div
          className="rounded-full px-3 py-0.5 text-[12px]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-mid)",
          }}
        >
          VS
        </div>
      </div>

      {/* Quote B */}
      <div
        className="flex items-center gap-3 rounded-xl p-3"
        style={{
          background: "rgba(253,248,248,0.5)",
          border: "1px solid rgba(255,255,255,0.4)",
        }}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ color: "var(--text-faint)", opacity: 0.5 }}
        >
          format_quote
        </span>
        <p
          className="flex-1 text-[16px]"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
          }}
        >
          {meta?.quote_b}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-3">
        <button
          className="flex-1 py-3 rounded-xl text-[14px] font-medium transition-colors"
          style={{
            fontFamily: "var(--font-serif-sc)",
            background: "var(--bg-surface)",
            color: "var(--text-deep)",
            border: "1px solid rgba(130,116,115,0.3)",
          }}
          onClick={() => onResolve(log.id, "first")}
        >
          保留前者
        </button>
        <button
          className="flex-1 py-3 rounded-xl text-[14px] font-medium transition-transform active:scale-95"
          style={{
            fontFamily: "var(--font-serif-sc)",
            background: "var(--primary)",
            color: "white",
            boxShadow: "0 4px 12px rgba(123,84,85,0.3)",
          }}
          onClick={() => onResolve(log.id, "second")}
        >
          保留后者
        </button>
      </div>
    </div>
  );
}

function NormalBody({ log }: { log: GardenerLog }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        boxShadow:
          "inset 2px 2px 5px rgba(123,84,85,0.1), inset -2px -2px 5px rgba(255,255,255,0.7)",
      }}
    >
      {log.type === "merge" ? (
        <div className="flex gap-3 items-start">
          <div className="w-1 bg-[rgba(103,87,126,0.3)] rounded-full self-stretch" />
          <p
            className="text-[16px] leading-6"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
            }}
          >
            {log.description}
          </p>
        </div>
      ) : (
        <p
          className="text-[16px] leading-6"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-mid)",
          }}
        >
          {log.description}
        </p>
      )}
    </div>
  );
}
