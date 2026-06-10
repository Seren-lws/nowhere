/**
 * 入口页 · 状态接口（P0-01 §5）
 *
 * "长在画里"的通知所需要的数据。本期用 mock，后续由大脑层（lib/brain）
 * 提供同形状的数据即可，画面表现不动。
 */

export interface EntranceState {
  /** 他是否"在家"（默认 true）→ 窗内暖光 */
  isHome: boolean;
  /** 他是否有未读留言 → 门缝透光 + 信箱露出信角 */
  hasUnreadMessage: boolean;
  /** 未读留言条数（信箱角标 / 后续用） */
  unreadCount: number;
}

/** 一天四档时间氛围（P0-01 §4.2） */
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

/**
 * 本期 mock 状态。把 hasUnreadMessage 设为 true，
 * 方便声声在手机上直接看到"门缝透光 + 信箱有信"的表现。
 */
export const MOCK_ENTRANCE_STATE: EntranceState = {
  isHome: true,
  hasUnreadMessage: true,
  unreadCount: 1,
};
