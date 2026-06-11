"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";

const TABS = [
  { key: "memories", label: "记忆", icon: "inventory_2", href: "/vault/memories" },
  { key: "pulse", label: "园丁", icon: "psychiatry", href: "/vault/pulse" },
  { key: "profile", label: "档案", icon: "person", href: "/vault/profile" },
  { key: "gallery", label: "画廊", icon: "photo_library", href: "/vault/gallery" },
] as const;

export function MemoryTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const activeKey =
    TABS.find((t) => pathname.startsWith(t.href))?.key ?? "memories";

  return (
    <nav
      className="flex gap-1 p-1 rounded-2xl mx-5"
      style={{
        background: "rgba(253,248,248,0.4)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow:
          "inset 2px 2px 4px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.href)}
            className="relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-colors"
          >
            {active && (
              <motion.div
                layoutId="memory-tab-bg"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "#fdf8f8",
                  boxShadow:
                    "4px 4px 10px rgba(0,0,0,0.06), -2px -2px 6px rgba(255,255,255,0.8)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className="material-symbols-outlined text-[20px] relative z-10"
              style={{
                color: active ? "var(--primary)" : "var(--text-mid)",
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                transition: "color 0.2s",
              }}
            >
              {tab.icon}
            </span>
            <span
              className="text-[11px] font-medium relative z-10"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: active ? "var(--text-deep)" : "var(--text-mid)",
                transition: "color 0.2s",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
