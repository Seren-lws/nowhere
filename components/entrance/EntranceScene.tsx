"use client";

import { useState, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  STAGE_ASPECT,
  ASSETS,
  DOORPLATE,
  boxToStyle,
  ENTERING_FLAG,
  FLOOR_PLAN_ROUTE,
} from "@/lib/entrance/layout";
import { MOCK_ENTRANCE_STATE } from "@/lib/entrance/state";

import { DoorCavity } from "./DoorCavity";
import { DoorLayer } from "./DoorLayer";
import { PorchGlow } from "./PorchGlow";
import { AmbientMotes } from "./AmbientMotes";
import { useTimeOfDay } from "./useTimeOfDay";
import { useHaptics } from "./useHaptics";

export function EntranceScene() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const { filter, tint, porchLit } = useTimeOfDay();
  const { lightImpact } = useHaptics();
  const [opening, setOpening] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goFloorPlan = useCallback(() => {
    try {
      sessionStorage.setItem(ENTERING_FLAG, "1");
    } catch {
      /* incognito */
    }
    router.push(FLOOR_PLAN_ROUTE);
  }, [router]);

  const handlePush = useCallback(() => {
    if (opening) return;
    lightImpact();
    setOpening(true);
  }, [opening, lightImpact]);

  const handleMailbox = useCallback(() => {
    router.push("/mailbox");
  }, [router]);

  const handleDoorplateDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      router.push("/settings");
    }, 800);
  }, [router]);

  const handleDoorplateUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const warmVeilComplete = useCallback(() => {
    goFloorPlan();
  }, [goFloorPlan]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg-dream)]">
      {/* 舞台：固定比例容器居中 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          aspectRatio: STAGE_ASPECT,
          height: "100%",
          maxWidth: "100vw",
          filter,
          transition: "filter 2s ease",
        }}
      >
        {/* L1: 背景画 */}
        <Image
          src={ASSETS.scene}
          alt="入口水彩画"
          fill
          priority
          draggable={false}
          className="select-none object-cover"
        />

        {/* 时间氛围罩 */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{ background: tint, transition: "background 2s ease" }}
        />

        {/* L2 + L3: 门洞 */}
        <DoorCavity opening={opening} />

        {/* L4: 门扇 */}
        <DoorLayer
          opening={opening}
          onPush={handlePush}
          onMailbox={handleMailbox}
        />

        {/* 门廊灯 */}
        <PorchGlow porchLit={porchLit} />

        {/* 氛围光斑 */}
        <AmbientMotes count={6} />

        {/* 门牌 No.0 长按 → 设置 */}
        <button
          aria-label="门牌 — 长按进设置"
          className="absolute border-none bg-transparent p-0"
          style={boxToStyle(DOORPLATE)}
          onPointerDown={handleDoorplateDown}
          onPointerUp={handleDoorplateUp}
          onPointerLeave={handleDoorplateUp}
        />

        {/* "欢迎回家" */}
        <motion.p
          className="pointer-events-none absolute left-1/2 select-none"
          style={{
            bottom: "5%",
            transform: "translateX(-50%) rotate(-1.5deg)",
            fontFamily: "var(--font-handwrite)",
            fontSize: "clamp(0.7rem, 2.5vw, 0.85rem)",
            color: "rgba(107, 100, 144, 0.35)",
            letterSpacing: "3px",
            whiteSpace: "nowrap",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: opening ? 0 : 1 }}
          transition={
            opening
              ? { duration: 0.3, ease: "easeOut" }
              : { delay: 1, duration: 0.8 }
          }
        >
          欢迎回家
        </motion.p>
      </div>

      {/* 暖纱：推门后全屏暖色覆盖 → 跳转 */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-50"
        style={{ background: "rgba(250, 240, 226, 0.97)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: opening ? 1 : 0 }}
        transition={
          prefersReduced
            ? { duration: 0.35, ease: "easeIn" }
            : { duration: 0.7, ease: "easeIn", delay: 0.8 }
        }
        onAnimationComplete={() => {
          if (opening) warmVeilComplete();
        }}
      />
    </div>
  );
}
