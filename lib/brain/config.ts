/**
 * 大脑层 · 配置（DESIGN §6：三工种三档位，模型名一律做成配置项）
 *
 * 全部经 yunwu.ai 中转（OpenAI-compatible）。配置存在本地（localStorage），
 * 由设置页填写。默认值先填常见的，声声试模型时直接改字符串即可。
 */

export interface BrainSettings {
  /** 中转站 URL（OpenAI-compatible base，如 https://yunwu.ai/v1） */
  baseUrl: string;
  /** API Key（只存本地、只用于请你的中转站） */
  apiKey: string;
  /** 对话本体（旗舰，他的脸面） */
  chatModel: string;
  /** 记忆提取 / 园丁（便宜快速，后台苦力，P1 记忆系统启用） */
  gardenerModel: string;
  /** 语义检索（embedding，P1 启用） */
  embeddingModel: string;
  /** Bark 推送 Device Key（iOS 通知） */
  barkKey: string;
  /** Bark 推送头像（emoji 或图片 URL） */
  barkIcon: string;
  /** Tavily API Key（联网搜索） */
  tavilyKey: string;
  /** ElevenLabs API Key（语音消息） */
  elevenLabsKey: string;
  /** ElevenLabs Voice ID（音色） */
  elevenLabsVoiceId: string;
  /** 上下文消息条数（对话时带多少条历史） */
  historyWindow: number;
}

export const DEFAULT_SETTINGS: BrainSettings = {
  baseUrl: "https://yunwu.ai/v1",
  apiKey: "",
  chatModel: "gpt-4o",
  gardenerModel: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  barkKey: "",
  barkIcon: "🐘",
  tavilyKey: "",
  elevenLabsKey: "",
  elevenLabsVoiceId: "pU6Nb7V1jj4swj5j28sM",
  historyWindow: 30,
};

export const SETTINGS_KEY = "nowhere:settings";

/** 读设置（合并默认值，SSR 安全） */
export function loadSettings(): BrainSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<BrainSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: BrainSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** 是否已配置到"能说话"（至少有 url + key + 对话模型） */
export function isChatReady(s: BrainSettings): boolean {
  return Boolean(s.baseUrl.trim() && s.apiKey.trim() && s.chatModel.trim());
}
