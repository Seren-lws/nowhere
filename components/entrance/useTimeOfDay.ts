"use client";

import { useEffect, useState } from "react";
import type { TimeOfDay } from "@/lib/entrance/state";

function resolveTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "dusk";
  return "night";
}

export interface TimeMood {
  tod: TimeOfDay;
  filter: string;
  tint: string;
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
  night: {
    filter: "brightness(0.9) saturate(1.0)",
    tint: "rgba(96, 88, 168, 0.34)",
    porchLit: true,
  },
};

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
