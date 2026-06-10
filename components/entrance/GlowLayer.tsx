"use client";

import { motion } from "motion/react";
import { PORCH_LIGHT, boxToStyle } from "@/lib/entrance/layout";

/**
 * 灯光层：门廊铜灯光晕。放在夜罩"之上"，让灯光穿透夜色亮起来。
 * 用 screen 混合，暖光叠在夜色上发光；随主场景一起做视差由 Scene 控制。
 * （窗内暖光本期按声声反馈先撤掉。）
 */
interface GlowLayerProps {
  /** 夜/黄昏：门廊灯为你亮起 */
  porchLit: boolean;
}

export function GlowLayer({ porchLit }: GlowLayerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ mixBlendMode: "screen" }}
    >
      {porchLit && (
        <motion.div
          aria-hidden
          className="absolute"
          style={{
            ...boxToStyle(PORCH_LIGHT),
            background:
              "radial-gradient(circle at 50% 48%, rgba(255,222,160,1) 0%, rgba(255,200,130,0.5) 34%, rgba(255,200,130,0) 68%)",
          }}
          animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
