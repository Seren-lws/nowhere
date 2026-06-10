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
    filter: "brightness(1.02) saturate(1.0)",
    tint: "rgba(186, 200, 232, 0.12)",
    porchLit: false,
  },
  day: {
    filter: "brightness(1.03) saturate(1.02)",
    tint: "rgba(255, 255, 255, 0.0)",
    porchLit: false,
  },
  dusk: {
    filter: "brightness(0.99) saturate(1.08)",
    tint: "rgba(255, 178, 104, 0.16)",
    porchLit: true,
  },
  // 夜晚：蓝紫透明罩 + 点灯，不压暗（声声指定）
  night: {
    filter: "brightness(0.9) saturate(1.0)",
    tint: "rgba(96, 88, 168, 0.34)",
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
