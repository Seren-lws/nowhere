"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";

export default function BookshelfPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0" style={{ background: "#fcf8f7" }}>
      {/* Background */}
      <div
        className="fixed inset-0 w-full h-full z-0"
        style={{
          backgroundImage: "url('/rooms/study.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(252,248,247,0.5), rgba(245,235,225,0.4), rgba(252,248,247,0.6))",
            backdropFilter: "blur(3px)",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-5 h-16"
        style={{
          background: "rgba(252,248,247,0.3)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.1)" }}
          onClick={() => router.back()}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "#67577e" }}
          >
            arrow_back_ios
          </span>
        </button>
        <h1
          className="text-[24px] font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
          }}
        >
          共读书架
        </h1>
        <div className="w-10" />
      </header>

      {/* Empty state */}
      <main className="relative z-10 w-full max-w-[800px] mx-auto h-full flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span
            className="material-symbols-outlined text-[56px] mb-4 block"
            style={{
              color: "var(--text-faint)",
              fontVariationSettings: "'FILL' 0",
            }}
          >
            auto_stories
          </span>
          <p
            className="text-[18px] mb-2"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-mid)",
            }}
          >
            书架还空着
          </p>
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-serif-sc)",
              color: "var(--text-faint)",
            }}
          >
            以后这里会放你们一起读过的书、一起走过的字。
          </p>
        </motion.div>
      </main>
    </div>
  );
}
