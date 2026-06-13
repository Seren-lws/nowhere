"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { key: "memories", label: "Memories", icon: "auto_awesome", href: "/vault/memories" },
  { key: "pulse", label: "Pulse", icon: "bubble_chart", href: "/vault/pulse" },
  { key: "profile", label: "Profile", icon: "person", href: "/vault/profile" },
  { key: "timeline", label: "Timeline", icon: "timeline", href: "/vault/timeline" },
] as const;

export function MemoryTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey =
    TABS.find((t) => pathname.startsWith(t.href))?.key ?? "memories";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around"
      style={{
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 16px))",
        background: "rgba(253,248,248,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.3)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.href)}
            className="flex flex-col items-center gap-1 rounded-2xl transition-all duration-300"
            style={{
              padding: "8px 16px",
              fontFamily: "var(--font-serif-sc)",
              fontSize: "11px",
              color: active ? "var(--primary)" : "var(--text-faint)",
              background: active ? "rgba(255,255,255,0.4)" : "transparent",
            }}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
