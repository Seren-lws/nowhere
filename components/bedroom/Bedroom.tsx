"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function CrescentMoon() {
  return (
    <>
      {/* Breathing glow — z-5 so it sits BEHIND cards and bleeds through glass */}
      <div
        className="fixed pointer-events-none"
        style={{ bottom: "8%", right: "4%", width: 100, height: 100, zIndex: 5 }}
      >
        <div
          className="absolute"
          style={{
            top: "50%",
            left: "50%",
            width: 350,
            height: 350,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(255,218,133,0.25) 0%, rgba(255,218,133,0.08) 35%, transparent 65%)",
            filter: "blur(30px)",
            animation: "moon-breathe 6s infinite ease-in-out",
          }}
        />
      </div>
      {/* Moon SVG — z-20 so it's visible above cards, crescent opens LEFT */}
      <div
        className="fixed pointer-events-none"
        style={{ bottom: "8%", right: "4%", width: 100, height: 100, zIndex: 20 }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <filter id="moon-glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="moon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff8e1" />
              <stop offset="50%" stopColor="#ffda85" />
              <stop offset="100%" stopColor="#f0c050" />
            </linearGradient>
          </defs>
          <mask id="crescent-mask">
            <rect width="100" height="100" fill="black" />
            <circle cx="50" cy="50" r="28" fill="white" />
            <circle cx="38" cy="44" r="24" fill="black" />
          </mask>
          <circle
            cx="50" cy="50" r="28"
            fill="url(#moon-grad)"
            mask="url(#crescent-mask)"
            filter="url(#moon-glow)"
            opacity="0.9"
          />
        </svg>
      </div>
    </>
  );
}

function StarField() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const stars = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: seededRandom(i * 13 + 7) * 100,
    top: seededRandom(i * 17 + 3) * 100,
    size: seededRandom(i * 23 + 11) * 2 + 1,
    duration: seededRandom(i * 31 + 5) * 4 + 2,
    delay: seededRandom(i * 41 + 13) * 6,
    opacity: seededRandom(i * 53 + 19) * 0.3 + 0.05,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s infinite ease-in-out`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function PulsatingOrbs() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const orbs = containerRef.current.querySelectorAll<HTMLDivElement>(".orb");
      const x = (window.innerWidth - e.pageX) / 50;
      const y = (window.innerHeight - e.pageY) / 50;
      orbs.forEach((orb, i) => {
        const speed = (i + 1) * 0.5;
        orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        className="orb absolute rounded-full"
        style={{
          top: "-10%",
          right: "-10%",
          width: "60%",
          height: "60%",
          background: "#4f316e",
          filter: "blur(80px)",
          animation: "pulse-orb 8s infinite alternate",
        }}
      />
      <div
        className="orb absolute rounded-full"
        style={{
          bottom: "-20%",
          left: "-10%",
          width: "70%",
          height: "70%",
          background: "#2a1b3d",
          filter: "blur(80px)",
          animation: "pulse-orb 8s infinite alternate",
          animationDelay: "-4s",
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "80%",
          height: "80%",
          background: "rgba(123,84,85,0.1)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(13,12,21,0.5), #0d0c15)",
        }}
      />
    </div>
  );
}

export function Bedroom() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0d0c15", color: "white" }}>
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(-45deg, #0d0c15, #2a1b3d, #4f316e, #7b5455, #0d0c15)",
            backgroundSize: "400% 400%",
            animation: "fluid-bg 15s ease infinite",
          }}
        />
        <PulsatingOrbs />
        <StarField />
      </div>

      {/* Moon — separate layer so glow bleeds through glass cards */}
      <CrescentMoon />

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50 flex justify-between items-center px-5 h-16"
        style={{
          background: "transparent",
          backdropFilter: "blur(4px)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button
          className="p-2 transition-colors active:scale-90"
          style={{ color: "rgba(255,255,255,0.8)" }}
          onClick={() => router.push("/floor-plan")}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1
          className="text-[32px]"
          style={{ fontFamily: "'Pinyon Script', cursive", color: "white" }}
        >
          Nowhere
        </h1>
        <button
          className="p-2 transition-colors active:scale-90"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      {/* Main Content — single screen, no scroll */}
      <main className="relative z-10 flex flex-col items-center justify-center h-screen px-5 pt-16 pb-8 max-w-[800px] mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-6"
        >
          <span
            className="text-[32px]"
            style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.9)" }}
          >
            卧室
          </span>
          <p
            className="text-[12px] tracking-[0.2em] mt-1"
            style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.4)" }}
          >
            PRIVATE SANCTUARY
          </p>
        </motion.div>

        {/* Cards */}
        <div className="w-full space-y-4">
          {/* 亲密聊天 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="group rounded-[28px] px-6 py-7 flex flex-col items-center text-center cursor-pointer active:scale-95"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(60px)",
              WebkitBackdropFilter: "blur(60px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
            }}
            onClick={() => router.push("/bedroom/intimate")}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-500 group-hover:shadow-[0_0_24px_rgba(123,84,85,0.4)]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "inset 0 4px 10px rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-2xl">🌙</span>
            </div>
            <h2
              className="text-lg mb-1"
              style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}
            >
              亲密聊天
            </h2>
            <p
              className="text-sm"
              style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.5)" }}
            >
              和他做爱做的事
            </p>
            <div className="mt-4 h-5 flex items-center">
              <div className="flex space-x-2 group-hover:hidden transition-opacity">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#7b5455", animation: "pulse-orb 2s infinite alternate" }}
                />
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              </div>
              <span
                className="text-xs italic hidden group-hover:inline-block transition-opacity"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                &ldquo;过来，靠近我一点...&rdquo;
              </span>
            </div>
          </motion.div>

          {/* 睡眠陪伴 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="group rounded-[28px] px-6 py-7 flex flex-col items-center text-center cursor-pointer active:scale-95"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(60px)",
              WebkitBackdropFilter: "blur(60px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
            }}
            onClick={() => router.push("/bedroom/sleep")}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-500 group-hover:shadow-[0_0_24px_rgba(103,87,126,0.4)]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "inset 0 4px 10px rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-2xl">😴</span>
            </div>
            <h2
              className="text-lg mb-1"
              style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}
            >
              睡眠陪伴
            </h2>
            <p
              className="text-sm"
              style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.5)" }}
            >
              让他哄你睡觉
            </p>
            <div className="mt-4 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <span
                className="text-xs italic"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                &ldquo;Goodnight, my love...&rdquo;
              </span>
            </div>
          </motion.div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes fluid-bg {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-orb {
          0% { opacity: 0.3; transform: scale(1); }
          100% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.4; }
        }
        @keyframes moon-breathe {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.3); }
        }
      `}</style>
    </div>
  );
}
