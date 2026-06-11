"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { ENTERING_FLAG, FLOOR_PLAN_ROUTE } from "@/lib/entrance/layout";

function Petals() {
  const petals = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => {
        const w = 6 + ((i * 7 + 3) % 8);
        return {
          id: i,
          width: w,
          height: w * 1.2,
          left: ((i * 17 + 5) % 80) - 20,
          top: ((i * 13 + 2) % 30) - 20,
          duration: 8 + ((i * 3) % 8),
          delay: ((i * 5) % 15),
        };
      }),
    [],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[5]" aria-hidden>
      {petals.map((p) => (
        <div
          key={p.id}
          className="petal"
          style={{
            width: p.width,
            height: p.height,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animation: `drift ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function EntranceScene() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);

  const handleEnter = useCallback(() => {
    if (entering) return;
    setEntering(true);
  }, [entering]);

  const handleLightComplete = useCallback(() => {
    if (!entering) return;
    try {
      sessionStorage.setItem(ENTERING_FLAG, "1");
    } catch {
      /* incognito */
    }
    router.push(FLOOR_PLAN_ROUTE);
  }, [entering, router]);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#fdf8f8" }}>
      {/* Background with zoom */}
      <motion.div
        className="fixed inset-0 bg-center bg-cover"
        style={{ backgroundImage: "url('/rooms/entrance.jpg')" }}
        animate={entering ? { scale: 1.5 } : { scale: 1 }}
        transition={{ duration: 2.5, ease: [0.4, 0, 0.2, 1] }}
      />

      <Petals />

      {/* Main layout */}
      <motion.div
        className="relative z-10 flex flex-col h-full w-full max-w-[800px] mx-auto"
        animate={entering ? { opacity: 0, scale: 1.05 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        {/* Header */}
        <header className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-white/10 max-w-[800px] left-1/2 -translate-x-1/2">
          <div className="flex justify-between items-center px-5 py-4">
            <button
              className="active:scale-95 transition-transform"
              aria-label="设置"
              onClick={() => router.push("/settings")}
            >
              <span
                className="material-symbols-outlined text-[28px]"
                style={{ color: "var(--primary)" }}
              >
                settings_heart
              </span>
            </button>
            <h1
              className="text-[36px] tracking-wide"
              style={{
                fontFamily: "var(--font-cursive)",
                color: "var(--primary)",
                textShadow:
                  "0 0 15px rgba(255,255,255,0.8), 0 0 5px rgba(123,84,85,0.2)",
              }}
            >
              Nowhere
            </h1>
            <div className="w-[28px]" />
          </div>
        </header>

        {/* Door button */}
        <div
          className="absolute"
          style={{ top: "55%", left: "47%", transform: "translate(-50%, -50%)" }}
        >
          <button
            className="liquid-glass rounded-full px-8 py-6 flex flex-col items-center gap-2 active:scale-95 transition-all duration-700 pulse-button"
            onClick={handleEnter}
          >
            <span
              className="material-symbols-outlined text-[36px]"
              style={{
                color: "var(--primary)",
                fontVariationSettings: "'FILL' 0, 'wght' 300",
              }}
            >
              door_open
            </span>
            <span
              className="text-[20px] tracking-[0.2em] font-bold"
              style={{
                fontFamily: "var(--font-serif-sc)",
                color: "var(--primary)",
              }}
            >
              欢迎回家
            </span>
          </button>
        </div>
      </motion.div>

      {/* Light expansion */}
      <motion.div
        className="fixed z-[90] pointer-events-none rounded-full"
        style={{
          top: "55%",
          left: "47%",
          width: 10,
          height: 10,
          background: "#FFF9F2",
          boxShadow: "0 0 100px 50px #FFF9F2",
          x: "-50%",
          y: "-50%",
        }}
        initial={{ scale: 0 }}
        animate={{ scale: entering ? 350 : 0 }}
        transition={{
          duration: 1.8,
          ease: [0.6, 0, 0.4, 1],
          delay: entering ? 0.1 : 0,
        }}
        onAnimationComplete={() => {
          if (entering) handleLightComplete();
        }}
      />
    </div>
  );
}
