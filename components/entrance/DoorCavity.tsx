"use client";

import { motion, type Variants } from "motion/react";
import { CAVITY_INSET_PX, DOOR, TIMELINE, boxToStyle } from "@/lib/entrance/layout";

/**
 * L2 门洞黑底 + L3 门洞光。垫在门扇之下，门开后露出。
 * - L2：与门扇同位同尺寸的纯黑矩形，四边各向内收 CAVITY_INSET_PX 防露边。
 * - L3：暖黄径向渐变 + 模糊 + 呼吸；推门时向外扩散并增亮。色温可随时间联动。
 */

const lightVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 0.55,
    transition: { duration: 0 },
  },
  open: {
    scale: 1.7,
    opacity: 1,
    transition: {
      delay: TIMELINE.cavityLight.start / 1000,
      duration: TIMELINE.cavityLight.duration / 1000,
      ease: "easeOut",
    },
  },
};

interface DoorCavityProps {
  opening: boolean;
  /** 色温：随时间氛围联动的暖光中心色 */
  warm?: string;
}

export function DoorCavity({
  opening,
  warm = "rgba(255, 196, 120, 1)",
}: DoorCavityProps) {
  return (
    <div className="absolute" style={boxToStyle(DOOR)}>
      {/* L2 黑底 */}
      <div
        className="absolute rounded-[10%/4%] bg-black"
        style={{ inset: `${CAVITY_INSET_PX}px` }}
      />
      {/* L3 门洞光：呼吸（idle）→ 扩散（open） */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-[10%/4%]"
        style={{
          background: `radial-gradient(60% 55% at 50% 60%, ${warm} 0%, rgba(255,170,90,0.55) 38%, rgba(255,150,70,0) 72%)`,
          filter: "blur(6px)",
        }}
        variants={lightVariants}
        animate={opening ? "open" : "idle"}
      >
        {/* 门未开时的微呼吸：叠一层缓慢明灭，不影响 open 的扩散 */}
        {!opening && (
          <motion.div
            className="absolute inset-0 rounded-[10%/4%]"
            style={{ background: "inherit" }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}
