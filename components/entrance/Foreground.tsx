"use client";

import { ASSETS } from "@/lib/entrance/layout";

/**
 * L5 前景花草（素材C）。纯白底，用 mix-blend-mode: multiply 叠加
 *（白底自动透明、保留水彩雾化边缘，不抠图）。夜色由 Scene 的夜罩统一覆盖。
 */
export function Foreground() {
  return (
    <img
      src={ASSETS.foreground}
      alt=""
      draggable={false}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      style={{ mixBlendMode: "multiply" }}
    />
  );
}
