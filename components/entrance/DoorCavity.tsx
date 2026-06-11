"use client";

import { motion } from "motion/react";
import { DOOR, CAVITY_DARK, CAVITY_INSET_PX, boxToStyle } from "@/lib/entrance/layout";

interface DoorCavityProps {
  opening: boolean;
}

export function DoorCavity({ opening }: DoorCavityProps) {
  const style = boxToStyle(DOOR);

  return (
    <>
      {/* L2: 门洞暗底 */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: style.left,
          top: style.top,
          width: style.width,
          height: style.height,
          background: CAVITY_DARK,
          clipPath: `inset(${CAVITY_INSET_PX}px)`,
        }}
      />

      {/* L3: 门洞暖光 */}
      <motion.div
        aria-hidden
        className="absolute"
        style={{
          left: style.left,
          top: style.top,
          width: style.width,
          height: style.height,
          background:
            "radial-gradient(ellipse 80% 70% at 50% 55%, rgba(255,222,160,0.9) 0%, rgba(250,200,130,0.4) 45%, transparent 75%)",
          clipPath: `inset(${CAVITY_INSET_PX}px)`,
        }}
        initial={{ opacity: 0.5, scale: 1 }}
        animate={
          opening
            ? { opacity: 1, scale: 1.3 }
            : { opacity: 0.5, scale: 1 }
        }
        transition={
          opening
            ? { duration: 1.0, ease: "easeOut", delay: 0.3 }
            : { duration: 0.3 }
        }
      />
    </>
  );
}
