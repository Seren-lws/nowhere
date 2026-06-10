"use client";

import { motion, type Variants } from "motion/react";
import {
  DOOR,
  DOORPLATE,
  DOOR_EASE,
  DOOR_ROTATE_DEG,
  STAGE_PERSPECTIVE_PX,
  TIMELINE,
  boxToStyle,
} from "@/lib/entrance/layout";

/**
 * L4 门扇（动画主角）。色块版：一块带门把的圆角矩形。
 * 绕左侧门轴向内转开；门牌 No.0 长在门上，随门一起转。
 * 真图替换：把这块矩形换成抠好的门扇 PNG 即可，位置取自同一份 DOOR 常量。
 */

const doorVariants: Variants = {
  closed: { rotateY: 0 },
  open: {
    rotateY: DOOR_ROTATE_DEG,
    transition: {
      duration: TIMELINE.door.duration / 1000,
      ease: DOOR_EASE,
      delay: TIMELINE.door.start / 1000,
    },
  },
};

interface DoorProps {
  /** 是否正在开门 */
  opening: boolean;
  /** 有未读留言：门缝（右缘）透出一线暖光 */
  hasUnread: boolean;
  /** 点门扇 → 推门 */
  onPushDoor: () => void;
  /** 长按门牌 No.0 → 设置占位页 */
  onLongPressPlate: () => void;
}

export function Door({
  opening,
  hasUnread,
  onPushDoor,
  onLongPressPlate,
}: DoorProps) {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  const startPress = () => {
    pressTimer = setTimeout(onLongPressPlate, 550);
  };
  const cancelPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  return (
    // 透视容器：门的 3D 旋转需要父级 perspective
    <div
      className="absolute"
      style={{
        ...boxToStyle(DOOR),
        perspective: `${STAGE_PERSPECTIVE_PX}px`,
      }}
    >
      {/* 门缝透光：未读时沿右缘一线暖光（门一打开就被自身遮住，符合"门缝") */}
      {hasUnread && !opening && (
        <motion.div
          aria-hidden
          className="absolute top-0 right-0 h-full w-[3px] rounded-full"
          style={{
            background:
              "linear-gradient(to left, rgba(255,200,120,0.95), rgba(255,200,120,0))",
            filter: "blur(1.5px)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.button
        type="button"
        aria-label="推门进入"
        className="absolute inset-0 origin-left cursor-pointer rounded-[10%/4%] border border-black/30 outline-none"
        style={{
          transformStyle: "preserve-3d",
          // 色块版门板：灰紫色，带一点立体明暗
          background:
            "linear-gradient(105deg, #6b6478 0%, #574f63 55%, #4b4456 100%)",
          boxShadow:
            "inset 0 0 0 2px rgba(255,255,255,0.04), inset -6px 0 14px rgba(0,0,0,0.35)",
        }}
        variants={doorVariants}
        animate={opening ? "open" : "closed"}
        onClick={() => !opening && onPushDoor()}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        disabled={opening}
      >
        {/* 门把 */}
        <span
          aria-hidden
          className="absolute top-1/2 right-[12%] h-2 w-2 -translate-y-1/2 rounded-full bg-amber-200/80 shadow"
        />
        {/* 门牌 No.0（长按 → 设置） */}
        <span
          aria-hidden
          className="absolute flex items-center justify-center rounded-sm bg-amber-100/85 text-[9px] font-semibold tracking-tight text-zinc-700 shadow-sm"
          style={{
            // 门牌相对门扇的内部定位（DOORPLATE 是舞台坐标，这里换算到门内部）
            left: `${((DOORPLATE.left - DOOR.left) / DOOR.width) * 100}%`,
            top: `${((DOORPLATE.top - DOOR.top) / DOOR.height) * 100}%`,
            width: `${(DOORPLATE.width / DOOR.width) * 100}%`,
            height: `${(DOORPLATE.height / DOOR.height) * 100}%`,
          }}
        >
          No.0
        </span>
      </motion.button>
    </div>
  );
}
