"use client";

import { useCallback } from "react";

export function useHaptics() {
  const lightImpact = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        /* silent */
      }
    }
  }, []);

  return { lightImpact };
}
