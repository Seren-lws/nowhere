"use client";

import { useEffect } from "react";
import {
  useMotionValue,
  useSpring,
  type MotionValue,
} from "motion/react";

/**
 * 视差倾斜（P0-01 §4.1）。
 *
 * 返回归一化的 tilt（-1..1）两个轴。消费方各自乘以不同幅度：
 * 前景约 ±10px、主场景组约 ±4px——"呼吸"而非"晃动"，故用 spring 柔化。
 *
 * 优先用陀螺仪（DeviceOrientation）。iOS 需用户手势触发授权，
 * 故首次 pointer/touch 时尝试 requestPermission；无权限或不支持时
 * 降级为指针/触摸滑动视差。
 */
export interface Tilt {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

const SPRING = { stiffness: 60, damping: 18, mass: 0.6 } as const;

export function useParallax(): Tilt {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);

  useEffect(() => {
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    let usingGyro = false;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      usingGyro = true;
      // gamma 左右倾斜 [-90,90]，beta 前后倾斜；取小范围映射到 [-1,1]
      rawX.set(clamp(e.gamma / 30));
      rawY.set(clamp((e.beta - 45) / 30));
    };

    const onPointer = (e: PointerEvent) => {
      if (usingGyro) return; // 有陀螺仪就不用指针
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      rawX.set(clamp((e.clientX / w - 0.5) * 2));
      rawY.set(clamp((e.clientY / h - 0.5) * 2));
    };

    type IOSOrientation = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const DOE =
      typeof DeviceOrientationEvent !== "undefined"
        ? (DeviceOrientationEvent as IOSOrientation)
        : undefined;

    const enableGyro = () => {
      if (!DOE) return;
      if (typeof DOE.requestPermission === "function") {
        DOE.requestPermission()
          .then((res) => {
            if (res === "granted")
              window.addEventListener("deviceorientation", onOrient);
          })
          .catch(() => {});
      } else {
        window.addEventListener("deviceorientation", onOrient);
      }
      window.removeEventListener("pointerdown", enableGyro);
    };

    // 非 iOS 直接挂；iOS 等首次交互再申请权限
    if (DOE && typeof DOE.requestPermission !== "function") {
      window.addEventListener("deviceorientation", onOrient);
    } else {
      window.addEventListener("pointerdown", enableGyro);
    }
    window.addEventListener("pointermove", onPointer);

    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", enableGyro);
    };
  }, [rawX, rawY]);

  return { x, y };
}
