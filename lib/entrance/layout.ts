/**
 * 入口页 · 统一坐标系（DESIGN P0-01 §2 / §6）
 *
 * 所有图层（L1 主场景 / L2 门洞黑底 / L3 门洞光 / L4 门扇 / L5 前景）
 * 共用这一份位置尺寸常量。坐标以"舞台"为参照，用百分比（0–100）表达，
 * 舞台是一个手机优先的 9:16 竖屏画框，本身居中铺满可视高度。
 *
 * 换真图素材时：以素材A中门扇的实际像素位置，换算成百分比填回 DOOR 即可，
 * 其余图层（黑底 / 光 / 信箱 / 门牌）都从这里派生，不会对位崩。
 */

/** 舞台宽高比（竖屏 9:16） */
export const STAGE_ASPECT = 9 / 16;

/** 一个矩形热区 / 图层框，单位均为舞台百分比 */
export interface Box {
  /** 左边距（% of stage width） */
  left: number;
  /** 上边距（% of stage height） */
  top: number;
  /** 宽（% of stage width） */
  width: number;
  /** 高（% of stage height） */
  height: number;
}

/** 门扇（L4 主角；L2 黑底 / L3 光层都与它同位对齐） */
export const DOOR: Box = {
  left: 35,
  top: 38,
  width: 30,
  height: 48,
};

/**
 * 黑底（L2）相对门扇四边各向内收的像素余量，防止门开后露出白边。
 * 渲染时以 px 应用（inset），1–2px 即可。
 */
export const CAVITY_INSET_PX = 1.5;

/** 门牌 No.0（长按 → 设置占位页）。位于门扇上半部居中。 */
export const DOORPLATE: Box = {
  left: DOOR.left + DOOR.width / 2 - 6,
  top: DOOR.top + 8,
  width: 12,
  height: 6,
};

/** 信箱（点按 → 留言占位页；有信时露出信角）。门右侧、中段高度。 */
export const MAILBOX: Box = {
  left: DOOR.left + DOOR.width + 4,
  top: DOOR.top + DOOR.height * 0.42,
  width: 9,
  height: 7,
};

/** 窗（他"在家"时窗内透暖光）。门廊左上方。 */
export const WINDOW: Box = {
  left: 9,
  top: 20,
  width: 18,
  height: 15,
};

/** 门廊灯（夜间为你亮起 + 轻微光晕呼吸）。门正上方居中。 */
export const PORCH_LIGHT: Box = {
  left: DOOR.left + DOOR.width / 2 - 3,
  top: DOOR.top - 12,
  width: 6,
  height: 6,
};

/** 把 Box 转成可直接展开到 style 的绝对定位百分比对象 */
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

/**
 * 推门动画时序（P0-01 §3）。
 * 单位毫秒；节奏感不可变，曲线可调。
 */
export const TIMELINE = {
  /** 门扇向内转开 */
  door: { start: 0, duration: 1300 },
  /** 门洞光扩散 */
  cavityLight: { start: 350, duration: 900 },
  /** 全屏暖光淹没（淡入） */
  flood: { start: 700, duration: 900 },
  /** 光退潮（在平面图页淡出，见 floor-plan 页） */
  recede: { start: 1900, duration: 700 },
} as const;

/** 门开到的角度（绕左轴向内，rotateY 负值）与父容器透视 */
export const DOOR_ROTATE_DEG = -78;
export const STAGE_PERSPECTIVE_PX = 1400;

/** 门的"重量感"缓动：先慢后快再缓收 */
export const DOOR_EASE: [number, number, number, number] = [0.6, 0.05, 0.3, 1];

/** 进门时写入 sessionStorage 的标记：让平面图页知道要播"光退潮"入场 */
export const ENTERING_FLAG = "nowhere:entering";

/** 推门后落脚的路由（平面图，另单实现，现为占位） */
export const FLOOR_PLAN_ROUTE = "/floor-plan";
