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
    <div
      className="absolute pointer-events-none"
      style={{ bottom: "12%", right: "8%", width: 120, height: 120 }}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle, rgba(255,218,133,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "scale(3)",
        }}
      />
      {/* Moon SVG */}
      <svg viewBox="0 0 100 100" className="w-full h-full relative z-10">
        <defs>
          <filter id="moon-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="moon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff8e1" />
            <stop offset="50%" stopColor="#ffda85" />
            <stop offset="100%" stopColor="#f0c050" />
          </linearGradient>
        </defs>
        {/* Crescent: full circle minus an offset circle */}
        <clipPath id="crescent-clip">
          <rect width="100" height="100" />
        </clipPath>
        <mask id="crescent-mask">
          <rect width="100" height="100" fill="black" />
          <circle cx="50" cy="50" r="30" fill="white" />
          <circle cx="62" cy="42" r="26" fill="black" />
        </mask>
        <circle
          cx="50" cy="50" r="30"
          fill="url(#moon-grad)"
          mask="url(#crescent-mask)"
          filter="url(#moon-glow)"
          opacity="0.9"
        />
      </svg>
    </div>
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
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "#0d0c15", color: "white" }}>
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
        <CrescentMoon />
      </div>

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

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-5 pt-24 pb-32 max-w-[800px] mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <span
            className="text-[48px]"
            style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.9)" }}
          >
            卧室
          </span>
          <p
            className="text-[14px] tracking-[0.2em] mt-2"
            style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.4)" }}
          >
            PRIVATE SANCTUARY
          </p>
        </motion.div>

        {/* Cards */}
        <div className="w-full space-y-6">
          {/* 亲密聊天 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[40px] p-10 flex flex-col items-center text-center cursor-pointer transition-all duration-500 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(60px)",
              WebkitBackdropFilter: "blur(60px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={() => router.push("/bedroom/intimate")}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "inset 0 4px 10px rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-4xl">🌙</span>
            </div>
            <h2
              className="text-2xl mb-2"
              style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}
            >
              亲密聊天
            </h2>
            <p
              className="text-base"
              style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.5)" }}
            >
              和他做爱做的事
            </p>
            <div className="mt-8 flex space-x-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "#7b5455", animation: "pulse-orb 2s infinite alternate" }}
              />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </div>
          </motion.div>

          {/* 睡眠陪伴 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="group rounded-[40px] p-10 flex flex-col items-center text-center cursor-pointer transition-all duration-500 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(60px)",
              WebkitBackdropFilter: "blur(60px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={() => router.push("/bedroom/sleep")}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "inset 0 4px 10px rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-4xl">😴</span>
            </div>
            <h2
              className="text-2xl mb-2"
              style={{ fontFamily: "var(--font-serif-sc)", color: "white" }}
            >
              睡眠陪伴
            </h2>
            <p
              className="text-base"
              style={{ fontFamily: "var(--font-serif-sc)", color: "rgba(255,255,255,0.5)" }}
            >
              让他哄你睡觉
            </p>
            <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity">
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
      `}</style>
    </div>
  );
}
