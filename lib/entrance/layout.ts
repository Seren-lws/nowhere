/**
 * 入口页 · 坐标常量（精简版）
 *
 * 舞台 = 素材A 全景图（public/entrance/scene.png，941×1672 ≈ 9:16），铺满可视高度居中。
 * 所有图层与热区用舞台百分比（0–100）表达。
 */

export const STAGE_ASPECT = 941 / 1672;

export const ASSETS = {
  scene: "/entrance/scene.png",
  doorLeaf: "/entrance/door-leaf.png",
} as const;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const DOOR: Box = {
  left: 29.9,
  top: 31.5,
  width: 33.6,
  height: 52.0,
};

export const CAVITY_DARK = "#4b4551";
export const CAVITY_INSET_PX = 1.5;

export const DOOR_MAILBOX: Box = {
  left: 33,
  top: 58,
  width: 32,
  height: 7,
};

export const DOORPLATE: Box = {
  left: 4,
  top: 45,
  width: 22,
  height: 8,
};

export const PORCH_LIGHT: Box = {
  left: 10,
  top: 35,
  width: 15,
  height: 11,
};

export const WINDOW: Box = {
  left: 79,
  top: 35,
  width: 22,
  height: 27,
};

export function boxToStyle(box: Box): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

export const DOOR_ROTATE_DEG = -70;
export const STAGE_PERSPECTIVE_PX = 1400;
export const DOOR_EASE: [number, number, number, number] = [0.6, 0.05, 0.3, 1];

export const ENTERING_FLAG = "nowhere:entering";
export const FLOOR_PLAN_ROUTE = "/floor-plan";
