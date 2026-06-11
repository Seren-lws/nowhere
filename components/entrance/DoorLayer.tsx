"use client";

import { motion } from "motion/react";
import {
  DOOR,
  DOOR_MAILBOX,
  ASSETS,
  boxToStyle,
  DOOR_ROTATE_DEG,
  STAGE_PERSPECTIVE_PX,
  DOOR_EASE,
} from "@/lib/entrance/layout";

interface DoorLayerProps {
  opening: boolean;
  onPush: () => void;
  onMailbox: () => void;
}

export function DoorLayer({ opening, onPush, onMailbox }: DoorLayerProps) {
  const doorStyle = boxToStyle(DOOR);

  return (
    <div
      className="absolute"
      style={{
        ...doorStyle,
        perspective: `${STAGE_PERSPECTIVE_PX}px`,
      }}
    >
      <motion.button
        aria-label="推门进入"
        className="absolute inset-0 cursor-pointer border-none bg-transparent p-0"
        style={{
          transformOrigin: "left center",
          transformStyle: "preserve-3d",
        }}
        initial={{ rotateY: 0 }}
        animate={opening ? { rotateY: DOOR_ROTATE_DEG } : { rotateY: 0 }}
        transition={
          opening
            ? { duration: 1.2, ease: DOOR_EASE }
            : { duration: 0.3 }
        }
        whileHover={opening ? undefined : { filter: "brightness(1.06)" }}
        whileTap={opening ? undefined : { filter: "brightness(1.12)", scale: 0.98 }}
        onClick={opening ? undefined : onPush}
      >
        <img
          src={ASSETS.doorLeaf}
          alt=""
          draggable={false}
          className="block h-full w-full select-none"
          style={{ objectFit: "fill" }}
        />

        {/* 信箱热区 */}
        <button
          aria-label="信箱"
          className="absolute border-none bg-transparent p-0"
          style={{
            left: `${DOOR_MAILBOX.left}%`,
            top: `${DOOR_MAILBOX.top}%`,
            width: `${DOOR_MAILBOX.width}%`,
            height: `${DOOR_MAILBOX.height}%`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onMailbox();
          }}
        />
      </motion.button>
    </div>
  );
}
