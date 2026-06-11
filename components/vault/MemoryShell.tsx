"use client";

import { useRouter } from "next/navigation";
import { MemoryTabs } from "./MemoryTabs";

export function MemoryShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 text-[var(--text-deep)]">
      {/* Ambient gradient background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(-45deg, #f8f4fb, #fdf8f8, #f5f0f5, #f8f4fb)",
          backgroundSize: "400% 400%",
          animation: "gradient-x 15s ease infinite",
        }}
      />
      <div
        className="fixed w-96 h-96 top-20 -left-[10%] rounded-full -z-10 pointer-events-none mix-blend-multiply"
        style={{
          background: "rgba(178,155,220,0.3)",
          filter: "blur(60px)",
          opacity: 0.4,
          animation: "thinking-pulse 8s infinite alternate",
        }}
      />
      <div
        className="fixed w-[500px] h-[500px] bottom-0 -right-[10%] rounded-full -z-10 pointer-events-none mix-blend-multiply"
        style={{
          background: "rgba(212,165,165,0.3)",
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
        <div className="w-10" />
      </nav>

      {/* Tabs */}
      <div className="fixed top-16 left-0 w-full z-40 pt-3 pb-2"
        style={{
          background: "rgba(253,248,248,0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <MemoryTabs />
      </div>

      {/* Content */}
      <main className="h-full overflow-y-auto pt-36 pb-16 px-5 max-w-[800px] mx-auto">
        {children}
      </main>
    </div>
  );
}
