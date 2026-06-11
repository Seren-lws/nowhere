"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ENTERING_FLAG } from "@/lib/entrance/layout";

interface RoomDef {
  key: string;
  label: string;
  image: string;
  bg: string;
  icon: string;
  iconActive?: string;
  href?: string;
}

const ROOMS: RoomDef[] = [
  { key: "study", label: "书房", image: "/rooms/study.jpg", bg: "#fcf8f7", icon: "import_contacts", href: "/study" },
  { key: "playroom", label: "娱乐室", image: "/rooms/playroom.png", bg: "#e9e4f0", icon: "sports_esports", href: "/playroom" },
  { key: "bedroom", label: "卧室", image: "/rooms/bedroom.jpg", bg: "#f5eff5", icon: "bed", href: "/bedroom" },
  { key: "living-room", label: "客厅", image: "/rooms/living-room.jpg", bg: "#fcf7f2", icon: "chair", href: "/living-room" },
  { key: "vault", label: "保险柜", image: "/rooms/vault.jpg", bg: "#ece7e7", icon: "favorite_border", iconActive: "favorite", href: "/vault" },
];

function StudyEffects() {
  const items = useMemo(() => {
    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: `p${i}`,
      size: 2 + ((i * 3) % 4),
      left: (i * 7 + 3) % 100,
      top: (i * 11 + 5) % 100,
      duration: 15 + ((i * 5) % 10),
      delay: (i * 3) % 10,
      opacity: 0.2 + ((i * 7) % 5) / 10,
    }));
    const bubbles = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`,
      size: 20 + ((i * 7) % 30),
      left: (i * 23 + 10) % 100,
      duration: 12 + ((i * 3) % 8),
      delay: (i * 4) % 5,
    }));
    return { particles, bubbles };
  }, []);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-[5]">
        {items.particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              top: `${p.top}%`,
              animation: `tyndall-drift ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity,
            }}
          />
        ))}
        {items.bubbles.map((b) => (
          <div
            key={b.id}
            className="bubble"
            style={{
              width: b.size,
              height: b.size,
              left: `${b.left}%`,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              animation: `bubble-rise ${b.duration}s linear ${b.delay}s infinite`,
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)",
          mixBlendMode: "overlay",
        }}
      />
    </>
  );
}

function PlayroomEffects() {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{ animation: "pulse-bg 4s ease-in-out infinite" }}
      />
      <div
        className="absolute pointer-events-none z-[5]"
        style={{
          width: 500,
          height: 500,
          top: "10%",
          left: "0%",
          background: "radial-gradient(circle, rgba(160,200,255,0.4) 0%, transparent 75%)",
          animation: "screen-chroma 7s infinite alternate ease-in-out",
        }}
      />
    </>
  );
}

function BedroomEffects() {
  const fireflies = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        size: 3 + ((i * 3) % 4),
        left: 15 + ((i * 11) % 70),
        top: 20 + ((i * 13) % 60),
        duration: 8 + ((i * 3) % 6),
        delay: (i * 2) % 7,
      })),
    [],
  );

  return (
    <>
      {/* Soft moonlight from window area */}
      <div
        className="absolute pointer-events-none z-[5]"
        style={{
          top: "5%",
          right: "0%",
          width: "55%",
          height: "50%",
          background:
            "radial-gradient(ellipse at 80% 30%, rgba(200,210,240,0.25) 0%, rgba(200,210,240,0.08) 40%, transparent 70%)",
          animation: "moon-breathe 12s ease-in-out infinite",
        }}
      />
      {/* Fireflies */}
      <div className="absolute inset-0 pointer-events-none z-[5]">
        {fireflies.map((f) => (
          <div
            key={f.id}
            className="absolute rounded-full"
            style={{
              width: f.size,
              height: f.size,
              left: `${f.left}%`,
              top: `${f.top}%`,
              background: "radial-gradient(circle, rgba(255,230,170,0.9) 0%, rgba(255,230,170,0) 70%)",
              filter: "blur(1px)",
              animation: `firefly-drift ${f.duration}s ease-in-out ${f.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function LivingRoomEffects() {
  const embers = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: 62 + ((i * 5) % 16),
        size: 2 + ((i * 2) % 3),
        duration: 4 + ((i * 3) % 5),
        delay: (i * 2) % 6,
      })),
    [],
  );

  return (
    <>
      {/* Multi-layer fire glow */}
      <div
        className="absolute pointer-events-none z-[5]"
        style={{
          bottom: "35%",
          right: "15%",
          width: "30%",
          height: "25%",
          background:
            "radial-gradient(ellipse at 50% 70%, rgba(255,140,50,0.35) 0%, transparent 65%)",
          animation: "fire-flicker-a 2s ease-in-out infinite",
        }}
      />
      <div
        className="absolute pointer-events-none z-[5]"
        style={{
          bottom: "38%",
          right: "18%",
          width: "24%",
          height: "20%",
          background:
            "radial-gradient(ellipse at 50% 80%, rgba(255,100,30,0.3) 0%, transparent 60%)",
          animation: "fire-flicker-b 1.5s ease-in-out 0.3s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none z-[5]"
        style={{
          bottom: "40%",
          right: "20%",
          width: "18%",
          height: "15%",
          background:
            "radial-gradient(ellipse at 50% 90%, rgba(255,200,80,0.25) 0%, transparent 55%)",
          animation: "fire-flicker-a 1.8s ease-in-out 0.7s infinite",
        }}
      />
      {/* Rising embers */}
      <div className="absolute inset-0 pointer-events-none z-[6]">
        {embers.map((e) => (
          <div
            key={e.id}
            className="absolute rounded-full"
            style={{
              left: `${e.left}%`,
              bottom: "40%",
              width: e.size,
              height: e.size,
              background: "radial-gradient(circle, rgba(255,180,60,0.9) 0%, rgba(255,120,30,0) 70%)",
              animation: `ember-rise ${e.duration}s ease-out ${e.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function VaultEffects() {
  return (
    <div
      className="absolute rounded-full pointer-events-none z-[5]"
      style={{
        top: "35%",
        left: "50%",
        width: 220,
        height: 220,
        background: "rgba(96, 165, 250, 0.2)",
        transform: "translate(-50%, -50%)",
        animation: "core-intense 3.5s ease-in-out infinite, heartbeat 2s ease-in-out infinite",
      }}
    />
  );
}

const EFFECTS: Record<string, () => React.ReactNode> = {
  study: StudyEffects,
  playroom: PlayroomEffects,
  bedroom: BedroomEffects,
  "living-room": LivingRoomEffects,
  vault: VaultEffects,
};

export function FloorPlan() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeRoom, setActiveRoom] = useState(ROOMS[0].key);
  const [receding, setReceding] = useState(false);

  useEffect(() => {
    let entered = false;
    try {
      entered = sessionStorage.getItem(ENTERING_FLAG) === "1";
      sessionStorage.removeItem(ENTERING_FLAG);
    } catch {
      /* ignore */
    }
    if (entered) setReceding(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sections = container.querySelectorAll<HTMLElement>("section[data-room]");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-room");
            if (id) setActiveRoom(id);
          }
        }
      },
      { root: container, threshold: 0.6 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const scrollToRoom = (key: string) => {
    const el = containerRef.current?.querySelector(`section[data-room="${key}"]`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0" style={{ background: "#fdf8f8" }}>
      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] z-[100] h-16 flex items-center justify-between px-5 bg-white/20 backdrop-blur-xl border-b border-white/30">
        <button
          className="active:scale-95 transition-transform"
          aria-label="菜单"
        >
          <span className="material-symbols-outlined text-[28px]" style={{ color: "var(--primary)" }}>
            menu
          </span>
        </button>
        <h1
          className="text-[32px] mt-1"
          style={{
            fontFamily: "var(--font-cursive)",
            color: "var(--primary)",
          }}
        >
          Nowhere
        </h1>
        <button
          className="active:scale-95 transition-transform"
          aria-label="设置"
          onClick={() => router.push("/settings")}
        >
          <span className="material-symbols-outlined text-[28px]" style={{ color: "var(--primary)" }}>
            settings
          </span>
        </button>
      </header>

      {/* Scroll-snap container */}
      <main
        ref={containerRef}
        className="h-full overflow-y-scroll no-scrollbar"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {ROOMS.map((room) => {
          const EffectComponent = EFFECTS[room.key];
          return (
            <section
              key={room.key}
              data-room={room.key}
              className="relative h-[100vh] w-full overflow-hidden flex items-center justify-center"
              style={{ scrollSnapAlign: "start", background: room.bg }}
            >
              <img
                src={room.image}
                alt={room.label}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />

              {EffectComponent && <EffectComponent />}

              <div className="watercolor-overlay" />

              {/* Room label */}
              <button
                className="absolute liquid-glass z-20 active:scale-95 transition-transform cursor-pointer"
                style={{
                  bottom: "22vh",
                  right: "10vw",
                  padding: "0.75rem 2rem",
                  borderRadius: 9999,
                  animation: "gentle-float 4s ease-in-out infinite",
                  border: "none",
                }}
                onClick={() => room.href && router.push(room.href)}
              >
                <span
                  className="text-[24px] tracking-[0.3em]"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--primary)",
                  }}
                >
                  {room.label}
                </span>
              </button>
            </section>
          );
        })}
        <div className="h-20 w-full" />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-[100] h-16 liquid-glass rounded-full flex items-center justify-around px-4">
        {ROOMS.map((room) => {
          const isActive = activeRoom === room.key;
          const icon = isActive && room.iconActive ? room.iconActive : room.icon;
          return (
            <button
              key={room.key}
              className="p-3 rounded-full transition-all duration-300"
              style={
                isActive
                  ? {
                      background: "rgba(255,255,255,0.4)",
                      boxShadow: "inset 0 0 10px rgba(255,255,255,0.5)",
                      color: "var(--primary)",
                    }
                  : { color: "rgba(80,68,68,0.5)" }
              }
              onClick={() => scrollToRoom(room.key)}
              aria-label={room.label}
            >
              <span className="material-symbols-outlined">{icon}</span>
            </button>
          );
        })}
      </nav>

      {/* Entrance recede overlay */}
      <AnimatePresence>
        {receding && (
          <motion.div
            className="fixed inset-0 z-[200] pointer-events-none"
            style={{ background: "rgba(255, 249, 242, 1)" }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            onAnimationComplete={() => setReceding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
