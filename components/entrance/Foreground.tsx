"use client";

import { ASSETS } from "@/lib/entrance/layout";

/**
 * L5 前景花草（素材C）。纯白底，用 mix-blend-mode: multiply 叠加
 *（白底自动透明、保留水彩雾化边缘，不抠图）。夜间过暗时由 Scene 降低本层不透明度。
 */
export function Foreground({ dim = false }: { dim?: boolean }) {
  return (
    <img
      src={ASSETS.foreground}
      alt=""
      draggable={false}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      style={{ mixBlendMode: "multiply", opacity: dim ? 0.7 : 1 }}
    />
  );
}
