"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import {
  ASSETS,
  DOORPLATE,
  PORCH_LIGHT,
  WINDOW,
  boxToStyle,
} from "@/lib/entrance/layout";

/**
 * L1 主场景：素材A 全景图铺满舞台，上面叠"在家"窗光、夜灯光晕、No.0 长按热区。
 * 门扇 / 门洞光不在这里（见 Door / DoorCavity），但与本层同属"主场景组"一起做视差。
 */

interface MainSceneProps {
  /** 他"在家"：窗内暖光 */
  isHome: boolean;
  /** 夜/黄昏：门廊灯为你亮起 */
  porchLit: boolean;
  /** 长按门牌 No.0 → 设置 */
  onOpenSettings: () => void;
}

export function MainScene({ isHome, porchLit, onOpenSettings }: MainSceneProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    timer.current = setTimeout(onOpenSettings, 550);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className="absolute inset-0">
      {/* 全景背景：素材A */}
      <img
        src={ASSETS.scene}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />

      {/* 窗：在家时窗内暖光（叠在画里的窗上，柔光呼吸） */}
      {isHome && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            ...boxToStyle(WINDOW),
            background:
              "radial-gradient(60% 70% at 50% 55%, rgba(255,214,140,0.55), rgba(255,200,120,0) 75%)",
            mixBlendMode: "screen",
            borderRadius: "8%",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* 门廊灯光晕：夜/黄昏点亮 + 呼吸 */}
      {porchLit && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            ...boxToStyle(PORCH_LIGHT),
            background:
              "radial-gradient(circle at 50% 45%, rgba(255,212,150,0.85) 0%, rgba(255,196,120,0.3) 38%, rgba(255,196,120,0) 70%)",
            mixBlendMode: "screen",
          }}
          animate={{ opacity: [0.55, 1, 0.55], scale: [0.97, 1.05, 0.97] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* No.0 门牌长按热区（透明，落在画里的门牌上）→ 设置 */}
      <button
        type="button"
        aria-label="设置"
        className="absolute cursor-pointer rounded-md outline-none"
        style={boxToStyle(DOORPLATE)}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
