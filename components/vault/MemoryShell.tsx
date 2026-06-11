"use client";

import { useRouter } from "next/navigation";
import { MemoryTabs } from "./MemoryTabs";

export function MemoryShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 text-[var(--text-deep)]">
      {/* Background gradient */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, #fdf8f8 0%, #f1dede 50%, #e3cffd 100%)",
        }}
      />

      {/* Floating bubbles */}
      <div
        className="fixed w-[200px] h-[200px] rounded-full -z-10 pointer-events-none"
        style={{
          top: "15%",
          left: "10%",
          background:
            "radial-gradient(circle, rgba(255,183,197,0.2) 0%, transparent 70%)",
          animation: "float-bubble 12s ease-in-out infinite",
        }}
      />
      <div
        className="fixed w-[150px] h-[150px] rounded-full -z-10 pointer-events-none"
        style={{
          top: "60%",
          right: "5%",
          background:
            "radial-gradient(circle, rgba(227,207,253,0.25) 0%, transparent 70%)",
          animation: "float-bubble 10s ease-in-out infinite",
          animationDelay: "3s",
        }}
      />
      <div
        className="fixed w-[120px] h-[120px] rounded-full -z-10 pointer-events-none"
        style={{
          bottom: "25%",
          left: "60%",
          background:
            "radial-gradient(circle, rgba(241,222,222,0.3) 0%, transparent 70%)",
          animation: "float-bubble 14s ease-in-out infinite",
          animationDelay: "6s",
        }}
      />

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
