"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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
  const bubbles = useBubbles();

  return (
    <div className="fixed inset-0 text-[var(--text-deep)]">
      {/* Breathing gradient background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(-45deg, #fdf8f8, #e3cffd, #d4a5a5, #f7f2f2)",
          backgroundSize: "400% 400%",
          animation: "gradient-x 15s ease infinite",
        }}
      />

      {/* Rising bubbles */}
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
        <button className="p-2 rounded-full hover:bg-[rgba(230,225,225,0.5)] transition-colors">
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--text-mid)" }}
          >
            more_vert
          </span>
        </button>
      </nav>

      {/* Content */}
      <main className="h-full overflow-y-auto pt-20 pb-28 px-5 max-w-[800px] mx-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <MemoryTabs />
    </div>
  );
}
