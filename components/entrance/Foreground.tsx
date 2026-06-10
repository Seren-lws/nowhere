"use client";

/**
 * L5 前景花草（色块版占位）。
 * 真图替换：换成纯白底的前景花草图，用 mix-blend-mode: multiply 叠加
 *（白底自动透明、保留水彩雾化边缘，不抠图）。过暗时降低本层不透明度。
 * 素材C 缺席时按 P0-01 §4.1 降级——这里只放一缕极淡的底部草影示意层次。
 */
export function Foreground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ mixBlendMode: "multiply" }}
    >
      <div
        className="absolute bottom-0 left-0 h-[22%] w-full"
        style={{
          background:
            "radial-gradient(120% 100% at 20% 100%, rgba(40,60,40,0.55), rgba(40,60,40,0) 60%), radial-gradient(120% 100% at 85% 100%, rgba(35,55,35,0.5), rgba(35,55,35,0) 55%)",
        }}
      />
    </div>
  );
}
