"use client";

import { motion } from "motion/react";
import { PORCH_LIGHT, boxToStyle } from "@/lib/entrance/layout";

interface PorchGlowProps {
  porchLit: boolean;
}

export function PorchGlow({ porchLit }: PorchGlowProps) {
  if (!porchLit) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{ mixBlendMode: "screen" }}
    >
      <motion.div
        className="absolute"
        style={{
          ...boxToStyle(PORCH_LIGHT),
          background:
            "radial-gradient(circle at 50% 48%, rgba(255,222,160,1) 0%, rgba(255,200,130,0.5) 34%, rgba(255,200,130,0) 68%)",
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
