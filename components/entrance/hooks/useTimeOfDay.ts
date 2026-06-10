"use client";

import { useEffect, useState } from "react";
import type { TimeOfDay } from "@/lib/entrance/state";

/** 按本地小时分四档（P0-01 §4.2） */
function resolveTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 9) return "dawn"; // 清晨清亮
  if (hour >= 9 && hour < 16) return "day"; // 白天明净
  if (hour >= 16 && hour < 19) return "dusk"; // 黄昏镀金
  return "night"; // 夜晚压暗、门廊灯亮
}

/** 每档对应的整场色温叠加（CSS）：色相滤镜 + 一层半透明罩 */
export interface TimeMood {
  tod: TimeOfDay;
  /** 加在主场景组上的 filter */
  filter: string;
  /** 盖在主场景之上的半透明叠色（rgba） */
  tint: string;
  /** 夜间：门廊灯是否点亮 */
  porchLit: boolean;
}

const MOODS: Record<TimeOfDay, Omit<TimeMood, "tod">> = {
  dawn: {
    filter: "brightness(1.02) saturate(1.02)",
    tint: "rgba(180, 200, 230, 0.10)",
    porchLit: false,
  },
  day: {
    filter: "brightness(1.05) saturate(1.04)",
    tint: "rgba(255, 255, 255, 0.0)",
    porchLit: false,
  },
  dusk: {
    filter: "brightness(0.98) saturate(1.12) sepia(0.12)",
    tint: "rgba(255, 170, 90, 0.16)",
    porchLit: true,
  },
  night: {
    filter: "brightness(0.62) saturate(0.9)",
    tint: "rgba(20, 30, 70, 0.42)",
    porchLit: true,
  },
};

/**
 * 返回当前时间氛围，并每分钟复查一次，跨档时平滑切换由消费方的 CSS transition 负责。
 * SSR 安全：首帧固定 "day"，挂载后立即按真实时间校正。
 */
export function useTimeOfDay(): TimeMood {
  const [tod, setTod] = useState<TimeOfDay>("day");

  useEffect(() => {
    const update = () => setTod(resolveTimeOfDay(new Date().getHours()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return { tod, ...MOODS[tod] };
}
