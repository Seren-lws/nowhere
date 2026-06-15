/**
 * 聊天头像 & 昵称（像微信那样）
 *
 * 只存在本机 localStorage，不上传云端。头像是压缩后的 base64 图片。
 * 在客厅右上角「头像昵称」设置页里编辑。
 */

export interface ChatProfile {
  /** 我的昵称（聊天里不显示，仅设置/备用） */
  userName: string;
  /** 我的头像（base64 data URL，空则用占位） */
  userAvatar: string;
  /** 他的昵称（显示在客厅页头标题） */
  companionName: string;
  /** 他的头像（base64 data URL，空则用占位） */
  companionAvatar: string;
}

export const DEFAULT_PROFILE: ChatProfile = {
  userName: "我",
  userAvatar: "",
  companionName: "裴斯年",
  companionAvatar: "",
};

export const PROFILE_KEY = "nowhere:chat-profile";

export function loadProfile(): ChatProfile {
  if (typeof window === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<ChatProfile>) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(p: ChatProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}
