"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";
import {
  ENTERING_FLAG,
  FLOOR_PLAN_ROUTE,
  STAGE_ASPECT,
  TIMELINE,
} from "@/lib/entrance/layout";
import { MOCK_ENTRANCE_STATE } from "@/lib/entrance/state";
import { MainScene } from "./MainScene";
import { DoorCavity } from "./DoorCavity";
import { Door } from "./Door";
import { GlowLayer } from "./GlowLayer";
import { useParallax } from "./hooks/useParallax";
import { useTimeOfDay } from "./hooks/useTimeOfDay";
import { useHaptics } from "./hooks/useHaptics";

/** 各时间档的门洞暖光中心色 */
const WARM_BY_TOD = {
  dawn: "rgba(255,212,150,1)",
  day: "rgba(255,214,156,1)",
  dusk: "rgba(255,192,112,1)",
  night: "rgba(255,182,98,1)",
} as const;

export function Scene() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { lightImpact } = useHaptics();
  const mood = useTimeOfDay();
  const tilt = useParallax();

  const [opening, setOpening] = useState(false);
  // 预加载门槛：色块版无图可载，默认即就绪。素材版可改为图层贴图加载完成后再置 true。
  const [ready] = useState(true);

  const state = MOCK_ENTRANCE_STATE;

  useEffect(() => {
    router.prefetch(FLOOR_PLAN_ROUTE); // 预取落点，避免转场白屏
  }, [router]);

  // 主场景组 ±4px 视差（"呼吸"而非"晃动"）
  const sceneX = useTransform(tilt.x, [-1, 1], [-4, 4]);
  const sceneY = useTransform(tilt.y, [-1, 1], [-4, 4]);

  const pushDoor = () => {
    if (opening || !ready) return;
    setOpening(true);
    lightImpact();
  };

  const goFloorPlan = () => {
    try {
      sessionStorage.setItem(ENTERING_FLAG, "1");
    } catch {
      /* 隐私模式下静默 */
    }
    router.push(FLOOR_PLAN_ROUTE);
  };

  const floodVariants: Variants = {
    hidden: { opacity: 0 },
    open: {
      opacity: 1,
      transition: reduced
        ? { duration: 0.35 }
        : {
            delay: TIMELINE.flood.start / 1000,
            duration: TIMELINE.flood.duration / 1000,
            ease: "easeIn",
          },
    },
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#efeae3]">
      {/* 舞台：竖屏 9:16，铺满可视高度并居中 */}
      <div
        className="relative overflow-hidden"
        style={{
          height: "100dvh",
          aspectRatio: `${STAGE_ASPECT}`,
          maxWidth: "100vw",
        }}
      >
        {/* 主场景组（L1+L2+L3+L4）：统一时间滤镜 + ±4px 视差 */}
        <motion.div
          className="absolute inset-0"
          style={{
            x: sceneX,
            y: sceneY,
            filter: mood.filter,
            transition: "filter 1.5s ease",
          }}
        >
          <MainScene onOpenSettings={() => router.push("/settings")} />
          <DoorCavity opening={opening} warm={WARM_BY_TOD[mood.tod]} />
          {!reduced && (
            <Door
              opening={opening}
              hasUnread={state.hasUnreadMessage}
              onPushDoor={pushDoor}
              onOpenMailbox={() => router.push("/mailbox")}
            />
          )}
        </motion.div>

        {/* 前景花草层（L5）本期按声声反馈撤掉——花草会遮门。素材与组件保留，后续如需再启。 */}

        {/* 时间色温叠色罩：盖在所有图层之上，整场统一染色（夜=蓝紫） */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: mood.tint, transition: "background 1.5s ease" }}
        />

        {/* 灯光层：在夜罩之上，让铜灯穿透夜色亮起。随主场景做 ±4px 视差。整层穿透点击，不挡门 */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ x: sceneX, y: sceneY }}
        >
          <GlowLayer porchLit={mood.porchLit} />
        </motion.div>

        {/* reduced-motion 降级：没有门可点时，整台舞台可点直接进入 */}
        {reduced && (
          <button
            type="button"
            aria-label="推门进入"
            className="absolute inset-0 cursor-pointer"
            onClick={pushDoor}
            disabled={opening}
          />
        )}
      </div>

      {/* 全屏暖光淹没罩（覆盖整窗，跨越舞台边界）→ 盖满后跳转平面图 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 55%, rgba(255,224,170,1) 0%, rgba(255,200,120,1) 45%, rgba(255,180,90,1) 100%)",
        }}
        variants={floodVariants}
        initial="hidden"
        animate={opening ? "open" : "hidden"}
        onAnimationComplete={(def) => {
          if (opening && def === "open") goFloorPlan();
        }}
      />
    </div>
  );
}
