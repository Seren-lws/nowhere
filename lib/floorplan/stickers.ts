/**
 * 平面图 · 统一坐标 / 状态表（fable 建议的 stickers 表）
 *
 * 底画为竖向长图 public/floorplan/floorplan.jpg（1124×4250），页面纵向滚动。
 * 每层房间、氛围贴纸（他的位置 / 壁炉火）的位置与点击行为都集中在这里管理，
 * 坐标用"占长图全幅的百分比"表达，换画 / 微调只动这张表。
 */

export const FLOORPLAN_SRC = "/floorplan/floorplan.jpg";
/** 长图宽高比（1124/4250） */
export const FLOORPLAN_ASPECT = 1124 / 4250;

export type RoomStatus = "open" | "wip"; // open=可进；wip=还在装修（盖防尘布）

export interface RoomRegion {
  key: string;
  label: string;
  route: string;
  status: RoomStatus;
  /** 该层在长图中的纵向区间（% of 全幅高度） */
  top: number;
  height: number;
}

/**
 * 五层（从上到下）。区间按长图实测估值，可在此微调。
 * 层与层之间的白缝不可点（留白）。
 */
export const ROOMS: RoomRegion[] = [
  { key: "study", label: "书房", route: "/study", status: "wip", top: 0, height: 25 },
  { key: "playroom", label: "娱乐室", route: "/playroom", status: "wip", top: 27, height: 14 },
  { key: "bedroom", label: "卧室", route: "/bedroom", status: "wip", top: 42, height: 17 },
  { key: "living-room", label: "客厅", route: "/living-room", status: "open", top: 60, height: 18 },
  { key: "vault", label: "保险柜", route: "/vault", status: "open", top: 80, height: 20 },
];

/** 进门后落脚的房间（推门进来正好在客厅） */
export const LANDING_ROOM = "living-room";

/** 某层的纵向中心（% of 全幅），用于初始定位与镜头推近 */
export function roomCenter(room: RoomRegion): number {
  return room.top + room.height / 2;
}

/**
 * 家的实时状态（驱动氛围贴纸）。本期 mock，后续由大脑层提供同形状数据。
 */
export interface HomeState {
  /** 他此刻在哪间（房间 key），null=不在家 */
  hePresentRoom: string | null;
  /** 客厅壁炉是否燃着 */
  fireplaceLit: boolean;
}

export const MOCK_HOME_STATE: HomeState = {
  hePresentRoom: "living-room",
  fireplaceLit: true,
};

/** 壁炉火光位置（客厅，% of 全幅） */
export const FIREPLACE = { left: 87, top: 74.5, size: 9 };

/**
 * "他在某间"时落点位置（% of 房间区域）。
 * left/top 是相对于该房间 section 的百分比定位。
 */
export const HE_POINT_BY_ROOM: Record<string, { left: number; top: number }> = {
  "study": { left: 35, top: 55 },
  "playroom": { left: 50, top: 50 },
  "bedroom": { left: 40, top: 55 },
  "living-room": { left: 35, top: 50 },
  "vault": { left: 50, top: 45 },
};
