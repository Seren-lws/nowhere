"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "@/lib/brain/db";

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

export function ProfileView() {
  const [profiles, setProfiles] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("memory_items")
        .select("*")
        .eq("type", "profile")
        .order("created_at", { ascending: false });
      setProfiles(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <header className="text-center mb-1">
        <h2
          className="text-[28px] mb-1"
          style={{ fontFamily: "var(--font-cursive)", color: "var(--primary)" }}
        >
          Profile
        </h2>
        <p
          className="text-[14px] italic"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          What he knows about you
        </p>
      </header>

      {loading ? (
        <p
          className="text-center text-[14px] mt-8"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          加载中…
        </p>
      ) : profiles.length === 0 ? (
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
        <div className="flex flex-col gap-3">
          {profiles.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="rounded-2xl p-5 flex flex-col gap-2"
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
                    style={{
                      color: "var(--primary)",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    push_pin
                  </span>
                  {m.tags.length > 0 && (
                    <div className="flex gap-1.5">
                      {m.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{
                            fontFamily: "var(--font-serif-sc)",
                            background: "rgba(212,165,165,0.15)",
                            color: "var(--primary)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
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
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
