"use client";

import { useRef } from "react";
import { ASSETS, DOORPLATE, boxToStyle } from "@/lib/entrance/layout";

/**
 * L1 主场景：素材A 全景图铺满舞台 + No.0 长按热区。
 * 夜灯 / 窗光不在这里——它们要透出夜色，故由 Scene 放在夜罩之上（见 GlowLayer）。
 * 门扇 / 门洞光见 Door / DoorCavity，与本层同属"主场景组"一起做视差。
 */
interface MainSceneProps {
  /** 长按门牌 No.0 → 设置 */
  onOpenSettings: () => void;
}

export function MainScene({ onOpenSettings }: MainSceneProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    timer.current = setTimeout(onOpenSettings, 550);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className="absolute inset-0">
      <img
        src={ASSETS.scene}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />

      {/* No.0 门牌长按热区（透明，落在画里的门牌上）→ 设置 */}
      <button
        type="button"
        aria-label="设置"
        className="absolute cursor-pointer rounded-md outline-none"
        style={boxToStyle(DOORPLATE)}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
