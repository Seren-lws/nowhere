/**
 * 房间之间的"上下文交接"（room handoff）
 *
 * 解决跨房间的对话连续性：从卧室/睡眠陪伴离开后，下次回到客厅时，
 * 让他还记得"上次（可能是昨晚）在卧室聊到哪了"——哪怕当时没存成正式记忆。
 *
 * 做法：离开卧室时把最近几条原话存到本地，回客厅第一次回复前读出来注入系统提示，
 * 读完即清（只用一次）。带 24 小时时效，正好覆盖"晚上聊完睡、第二天白天来客厅"。
 */

export interface HandoffMsg {
  role: "user" | "assistant";
  content: string;
}

export type HandoffFrom = "bedroom" | "living-room";

const KEY = "nowhere:room-handoff";
/** 隔夜也算连得上：24 小时内的上次对话才注入 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface HandoffPayload {
  from: HandoffFrom;
  context: HandoffMsg[];
  ts: number;
}

/** 离开某个房间时写入最近几条对话（自动取末尾 6 条，空则不写） */
export function writeRoomHandoff(from: HandoffFrom, context: HandoffMsg[]): void {
  if (typeof window === "undefined") return;
  try {
    const tail = context.filter((m) => m.content.trim()).slice(-6);
    if (tail.length === 0) return;
    const payload: HandoffPayload = { from, context: tail, ts: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** 读取并清除交接上下文。只返回指定来源、且在时效内的；否则返回 null。 */
export function consumeRoomHandoff(expectFrom: HandoffFrom): HandoffMsg[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    window.localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as HandoffPayload;
    if (parsed.from !== expectFrom) return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return Array.isArray(parsed.context) && parsed.context.length > 0
      ? parsed.context
      : null;
  } catch {
    return null;
  }
}
