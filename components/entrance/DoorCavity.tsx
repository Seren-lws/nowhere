"use client";

import { motion, type Variants } from "motion/react";
import {
  CAVITY_DARK,
  CAVITY_INSET_PX,
  DOOR,
  TIMELINE,
  boxToStyle,
} from "@/lib/entrance/layout";

/**
 * L2 门洞暗底 + L3 门洞光。垫在门扇之下，门开后露出。
 * - L2：与门扇同位同尺寸的柔和暗色矩形（非死黑），四边各向内收 CAVITY_INSET_PX 防露边。
 * - L3：奶油暖光径向渐变 + 模糊 + 呼吸；推门时向外扩散并增亮。低饱和、低对比。
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
  warm = "rgba(248, 232, 208, 1)",
}: DoorCavityProps) {
  return (
    <div className="absolute" style={boxToStyle(DOOR)}>
      {/* L2 柔和暗底 */}
      <div
        className="absolute rounded-[10%/4%]"
        style={{ inset: `${CAVITY_INSET_PX}px`, background: CAVITY_DARK }}
      />
      {/* L3 门洞光：呼吸（idle）→ 扩散（open）。奶油暖调、低饱和 */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-[10%/4%]"
        style={{
          background: `radial-gradient(62% 56% at 50% 60%, ${warm} 0%, rgba(238,218,192,0.5) 40%, rgba(232,212,190,0) 74%)`,
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
