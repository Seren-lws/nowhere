/**
 * 入口页 · 统一坐标系（DESIGN P0-01 §2 / §6）
 *
 * 舞台 = 素材A 全景图（public/entrance/scene.png，941×1672 ≈ 9:16），铺满可视高度居中。
 * 所有图层与热区用舞台百分比（0–100）表达。门扇（L4）由素材A中按颜色扫描精确抠出
 *（public/entrance/door-leaf.png），故 DOOR 框即抠图时的像素 bbox 换算的百分比，
 * 门扇覆于背景同位，闭合时与画严丝合缝，转开时露出 L2 黑底 + L3 暖光。
 *
 * 像素 bbox（素材A 941×1672）：门板 L=281 R=597 T=526 B=1396。
 */

/** 舞台宽高比（竖屏，随素材A：941/1672） */
export const STAGE_ASPECT = 941 / 1672;

/** 素材路径 */
export const ASSETS = {
  scene: "/entrance/scene.png", // L1 全景背景
  doorLeaf: "/entrance/door-leaf.png", // L4 门扇（从A抠出）
  foreground: "/entrance/foreground.png", // L5 前景花草
} as const;

/** 一个矩形热区 / 图层框，单位均为舞台百分比 */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 门扇（L4 主角；L2 黑底 / L3 光层都与它同位对齐） */
export const DOOR: Box = {
  left: 29.9,
  top: 31.5,
  width: 33.6,
  height: 52.0,
};

/** 门洞内壁暗色（L2）：柔和低饱和的暗，不用死黑（贴合水彩、降对比） */
export const CAVITY_DARK = "#4b4551";

/** 门洞暗底（L2）相对门扇四边各向内收的像素余量，防露边 */
export const CAVITY_INSET_PX = 1.5;

/** 全屏暖光淹没 / 平面图退潮共用的渐变：奶油暖调、低饱和、低对比 */
export const FLOOD_GRADIENT =
  "radial-gradient(120% 90% at 50% 55%, rgba(250,240,226,1) 0%, rgba(244,228,208,1) 48%, rgba(238,222,204,1) 100%)";

/**
 * 信箱投信口：长在门扇上（铜色横口），坐标用"门扇内部百分比"。
 * 点它 → 留言；有信时露信角 + 门缝透光。随门一起转。
 */
export const DOOR_MAILBOX: Box = {
  left: 33,
  top: 58,
  width: 32,
  height: 7,
};

/** 门牌 No.0：在门左侧墙上（静态，不随门转）。长按 → 设置。舞台百分比。 */
export const DOORPLATE: Box = {
  left: 4,
  top: 45,
  width: 22,
  height: 8,
};

/** 门廊铜灯：门牌上方墙上。夜/黄昏点亮 + 光晕呼吸。舞台百分比。 */
export const PORCH_LIGHT: Box = {
  left: 10,
  top: 35,
  width: 15,
  height: 11,
};

/** 窗：右侧。他"在家"时窗内透暖光。舞台百分比。 */
export const WINDOW: Box = {
  left: 79,
  top: 35,
  width: 22,
  height: 27,
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
 * 推门动画时序（P0-01 §3）。单位毫秒；节奏感不可变，曲线可调。
 */
export const TIMELINE = {
  door: { start: 0, duration: 1300 }, // 门扇向内转开
  cavityLight: { start: 350, duration: 900 }, // 门洞光扩散
  flood: { start: 700, duration: 900 }, // 全屏暖光淹没（淡入）
  recede: { start: 1900, duration: 700 }, // 光退潮（在平面图页淡出）
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
