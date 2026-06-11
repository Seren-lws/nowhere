"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useTransform } from "motion/react";
import gsap from "gsap";
import {
  DOOR_CENTER_ORIGIN,
  ENTERING_FLAG,
  FLOOR_PLAN_ROUTE,
  STAGE_ASPECT,
  ZOOM_SCALE,
} from "@/lib/entrance/layout";
import { MOCK_ENTRANCE_STATE } from "@/lib/entrance/state";
import { MainScene } from "./MainScene";
import { DoorCavity } from "./DoorCavity";
import { Door } from "./Door";
import { GlowLayer } from "./GlowLayer";
import { useParallax } from "./hooks/useParallax";
import { useTimeOfDay } from "./hooks/useTimeOfDay";
import { useHaptics } from "./hooks/useHaptics";

const WARM_BY_TOD = {
  dawn: "rgba(248,234,214,1)",
  day: "rgba(250,236,216,1)",
  dusk: "rgba(246,226,200,1)",
  night: "rgba(242,224,198,1)",
} as const;

export function Scene() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { lightImpact } = useHaptics();
  const mood = useTimeOfDay();
  const tilt = useParallax();

  const [opening, setOpening] = useState(false);
  const [ready] = useState(true);

  const state = MOCK_ENTRANCE_STATE;

  const zoomRef = useRef<HTMLDivElement>(null);
  const softGlowRef = useRef<HTMLDivElement>(null);
  const whiteVeilRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    router.prefetch(FLOOR_PLAN_ROUTE);
    return () => {
      tlRef.current?.kill();
    };
  }, [router]);

  const sceneX = useTransform(tilt.x, [-1, 1], [-4, 4]);
  const sceneY = useTransform(tilt.y, [-1, 1], [-4, 4]);

  const goFloorPlan = () => {
    try {
      sessionStorage.setItem(ENTERING_FLAG, "1");
    } catch {
      /* 隐私模式下静默 */
    }
    router.push(FLOOR_PLAN_ROUTE);
  };

  const pushDoor = () => {
    if (opening || !ready) return;
    setOpening(true);
    lightImpact();

    if (reduced) {
      goFloorPlan();
      return;
    }

    const tl = gsap.timeline({ onComplete: goFloorPlan });
    tlRef.current = tl;

    tl.to(zoomRef.current, {
      scale: ZOOM_SCALE,
      duration: 1.15,
      ease: "power2.in",
    }, 0);

    tl.to(softGlowRef.current, {
      autoAlpha: 1,
      scale: 3,
      duration: 0.8,
      ease: "power1.in",
    }, 0.3);

    tl.to(whiteVeilRef.current, {
      autoAlpha: 1,
      duration: 0.5,
      ease: "power2.in",
    }, 0.7);
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#efeae3]">
      <div
        className="relative overflow-hidden"
        style={{
          height: "100dvh",
          aspectRatio: `${STAGE_ASPECT}`,
          maxWidth: "100vw",
        }}
      >
        <div
          ref={zoomRef}
          className="absolute inset-0"
          style={{
            transformOrigin: DOOR_CENTER_ORIGIN,
            willChange: "transform",
          }}
        >
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

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: mood.tint,
              transition: "background 1.5s ease",
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ x: sceneX, y: sceneY }}
          >
            <GlowLayer porchLit={mood.porchLit} />
          </motion.div>
        </div>

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

      <div
        ref={softGlowRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 28%, rgba(255,255,255,0.1) 52%, transparent 72%)",
          transformOrigin: "50% 55%",
          transform: "scale(0.5)",
          opacity: 0,
          visibility: "hidden",
          willChange: "transform, opacity",
        }}
      />

      <div
        ref={whiteVeilRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background: "#ffffff",
          opacity: 0,
          visibility: "hidden",
          willChange: "opacity",
        }}
      />
    </div>
  );
}
