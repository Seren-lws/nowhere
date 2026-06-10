"use client";

import { motion } from "motion/react";
import { MAILBOX, PORCH_LIGHT, WINDOW, boxToStyle } from "@/lib/entrance/layout";

/**
 * L1 主场景（色块版）：全景背景 + 窗 + 门廊灯 + 信箱。
 * 真图替换：整张全景图直接作背景，本组件里的色块元素退场或对齐到素材A的对应位置。
 * 门扇 / 门洞光不在这里（见 Door / DoorCavity），但它们与本层同属"主场景组"一起做视差。
 */

interface MainSceneProps {
  /** 他"在家"：窗内暖光 */
  isHome: boolean;
  /** 有未读：信箱露出信角 */
  hasUnread: boolean;
  /** 夜间：门廊灯为你亮起 */
  porchLit: boolean;
  /** 点信箱 → 留言占位页 */
  onOpenMailbox: () => void;
}

export function MainScene({
  isHome,
  hasUnread,
  porchLit,
  onOpenMailbox,
}: MainSceneProps) {
  return (
    <div className="absolute inset-0">
      {/* 全景背景色块：夜墙的墙面渐变 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #2b2740 0%, #353049 42%, #3d3650 70%, #2c2738 100%)",
        }}
      />

      {/* 窗：在家时窗内暖光 */}
      <div
        className="absolute overflow-hidden rounded-sm border border-black/30"
        style={boxToStyle(WINDOW)}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: isHome
              ? "linear-gradient(180deg, #ffd98a, #ffb95c)"
              : "linear-gradient(180deg, #2a2740, #20203a)",
          }}
          animate={isHome ? { opacity: [0.85, 1, 0.85] } : { opacity: 1 }}
          transition={
            isHome
              ? { duration: 5, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
        />
        {/* 窗格 */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/25" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/25" />
      </div>

      {/* 门廊灯：夜/黄昏点亮 + 光晕呼吸 */}
      <div
        className="absolute flex items-center justify-center"
        style={boxToStyle(PORCH_LIGHT)}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
        {porchLit && (
          <motion.div
            aria-hidden
            className="absolute inset-[-120%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,210,140,0.85) 0%, rgba(255,190,110,0.25) 40%, rgba(255,190,110,0) 70%)",
            }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.96, 1.04, 0.96] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* 信箱：有信时露出信角，可点 */}
      <button
        type="button"
        aria-label={hasUnread ? "查看留言" : "信箱"}
        className="absolute cursor-pointer rounded-sm border border-black/40 bg-zinc-700 outline-none"
        style={boxToStyle(MAILBOX)}
        onClick={onOpenMailbox}
      >
        {/* 投信口 */}
        <span className="absolute left-1/2 top-1/3 h-[3px] w-1/2 -translate-x-1/2 rounded bg-black/50" />
        {hasUnread && (
          // 露出的信角
          <span className="absolute -top-1 right-1 h-2.5 w-3 rotate-6 rounded-[1px] bg-amber-50 shadow" />
        )}
      </button>
    </div>
  );
}
