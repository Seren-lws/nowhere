"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

interface AmbientMotesProps {
  count?: number;
}

interface Mote {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

const WARM_COLORS = [
  "rgba(255, 230, 200, 0.12)",
  "rgba(255, 220, 180, 0.10)",
  "rgba(240, 225, 210, 0.11)",
  "rgba(200, 190, 220, 0.10)",
  "rgba(210, 200, 230, 0.09)",
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function AmbientMotes({ count = 6 }: AmbientMotesProps) {
  const motes = useMemo<Mote[]>(() => {
    const rand = seededRandom(42);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 10 + rand() * 80,
      y: 10 + rand() * 80,
      size: 8 + rand() * 12,
      color: WARM_COLORS[Math.floor(rand() * WARM_COLORS.length)],
      duration: 6 + rand() * 4,
      delay: rand() * 3,
    }));
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {motes.map((m) => (
        <motion.div
          key={m.id}
          className="absolute rounded-full"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.size,
            height: m.size,
            background: m.color,
            filter: "blur(3px)",
          }}
          animate={{
            y: [-15, 15, -15],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: m.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: m.delay,
          }}
        />
      ))}
    </div>
  );
}
