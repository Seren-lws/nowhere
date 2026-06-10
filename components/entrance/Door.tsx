"use client";

import { motion, type Variants } from "motion/react";
import {
  ASSETS,
  DOOR,
  DOOR_EASE,
  DOOR_MAILBOX,
  DOOR_ROTATE_DEG,
  STAGE_PERSPECTIVE_PX,
  TIMELINE,
  boxToStyle,
} from "@/lib/entrance/layout";

/**
 * L4 门扇（动画主角）。素材A 中抠出的门扇贴图，覆于背景同位。
 * 绕左侧门轴向内转开；信箱口与门缝光长在门上，随门一起转。
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
  opening: boolean;
  hasUnread: boolean;
  onPushDoor: () => void;
  onOpenMailbox: () => void;
}

export function Door({
  opening,
  hasUnread,
  onPushDoor,
  onOpenMailbox,
}: DoorProps) {
  return (
    // 透视容器：门的 3D 旋转需要父级 perspective
    <div
      className="absolute"
      style={{ ...boxToStyle(DOOR), perspective: `${STAGE_PERSPECTIVE_PX}px` }}
    >
      {/* 门缝透光：未读时沿右缘一线暖光（门一开就被自身遮住，符合"门缝"） */}
      {hasUnread && !opening && (
        <motion.div
          aria-hidden
          className="absolute top-0 right-0 h-full w-[3px]"
          style={{
            background:
              "linear-gradient(to left, rgba(255,206,130,0.95), rgba(255,206,130,0))",
            filter: "blur(1.5px)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.div
        className="absolute inset-0 origin-left"
        style={{ transformStyle: "preserve-3d" }}
        variants={doorVariants}
        animate={opening ? "open" : "closed"}
      >
        {/* 门扇贴图，整块可点 → 推门 */}
        <button
          type="button"
          aria-label="推门进入"
          className="absolute inset-0 cursor-pointer border-0 p-0 outline-none"
          onClick={() => !opening && onPushDoor()}
          disabled={opening}
        >
          <img
            src={ASSETS.doorLeaf}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-fill"
          />
        </button>

        {/* 信箱投信口（门上）：点 → 留言；有信时露信角。覆于贴图的铜口之上 */}
        <button
          type="button"
          aria-label={hasUnread ? "查看留言" : "信箱"}
          className="absolute cursor-pointer outline-none"
          style={boxToStyle(DOOR_MAILBOX)}
          onClick={(e) => {
            e.stopPropagation();
            if (!opening) onOpenMailbox();
          }}
          disabled={opening}
        >
          {hasUnread && (
            // 露出的信角
            <span className="absolute -top-1.5 right-1 h-2.5 w-3 rotate-6 rounded-[1px] bg-amber-50 shadow-sm" />
          )}
        </button>
      </motion.div>
    </div>
  );
}
