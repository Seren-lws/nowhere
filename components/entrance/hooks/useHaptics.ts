"use client";

import { useCallback } from "react";

/**
 * 轻触觉反馈（P0-01 §3）。开门瞬间一次 light impact。
 * Web 只有 navigator.vibrate（Android 系浏览器支持；iOS Safari 不支持，静默降级）。
 */
export function useHaptics() {
  const lightImpact = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        /* 不支持就算了 */
      }
    }
  }, []);

  return { lightImpact };
}
