/**
 * 娱乐室 · 轻量版钓鱼小游戏（客户端引擎）
 *
 * 纯前端、存 localStorage。裴斯年和她共用同一份存档（同一台设备）。
 * 玩法：抛竿 → 按稀有度抽鱼 → 进鱼篓 → 卖掉换钱 → 集图鉴。
 * 文案写得有点味道，毕竟是要给他玩、也给她看的。
 */

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface FishDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** 卖价区间 */
  value: [number, number];
  /** 钓到时的那句话 */
  flavor: string;
}

export interface CaughtFish {
  id: string;
  name: string;
  rarity: Rarity;
  value: number;
}

export type CastOutcome =
  | { kind: "fish"; fish: CaughtFish; def: FishDef; firstTime: boolean }
  | { kind: "junk"; name: string; value: number; text: string }
  | { kind: "empty"; text: string };

export interface LogEntry {
  ts: number;
  who: "me" | "him";
  /** 主结果文字 */
  text: string;
  rarity?: Rarity;
  /** 他的解说（仅 who==="him" 时可能有） */
  remark?: string;
}

export interface FishingState {
  coins: number;
  casts: number;
  basket: CaughtFish[];
  dex: string[];
  log: LogEntry[];
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "常见",
  uncommon: "少见",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9bb3a8",
  uncommon: "#6fa8dc",
  rare: "#b07ad0",
  epic: "#e0a13c",
  legendary: "#e0625e",
};

/** 各稀有度的相对抽中权重 */
const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  uncommon: 42,
  rare: 16,
  epic: 5,
  legendary: 1.2,
};

export const FISH: FishDef[] = [
  // ── 常见 ──
  { id: "crucian", name: "鲫鱼", rarity: "common", value: [3, 6], flavor: "一条胖墩墩的鲫鱼，扑腾了两下，溅了你一脸水。" },
  { id: "whitebait", name: "小白鲦", rarity: "common", value: [2, 5], flavor: "银亮的小白鲦，像一片被风吹落的月光。" },
  { id: "wheatfish", name: "麦穗鱼", rarity: "common", value: [2, 4], flavor: "细细小小的麦穗鱼，钓上来还以为是片叶子。" },
  { id: "loach", name: "泥鳅", rarity: "common", value: [3, 7], flavor: "滑不溜手的泥鳅，差点又钻回水里去。" },
  // ── 少见 ──
  { id: "carp", name: "鲤鱼", rarity: "uncommon", value: [9, 16], flavor: "红尾的鲤鱼，沉甸甸的，竿子弯成了一张弓。" },
  { id: "bass", name: "鲈鱼", rarity: "uncommon", value: [11, 19], flavor: "鲈鱼一个翻身，水花炸开，手感真好。" },
  { id: "osmanthus", name: "桂花鱼", rarity: "uncommon", value: [13, 22], flavor: "桂花鱼，身上的斑点像撒了一层金粉。" },
  // ── 稀有 ──
  { id: "koi", name: "锦鲤", rarity: "rare", value: [28, 45], flavor: "是锦鲤！红白相间，游动时像一团慢慢化开的晚霞。" },
  { id: "moonfish", name: "月光鳉", rarity: "rare", value: [30, 50], flavor: "通体半透明的月光鳉，离了水竟还在微微发亮。" },
  { id: "silverknife", name: "银刀鱼", rarity: "rare", value: [26, 42], flavor: "银刀鱼细长如刃，划开水面那一下，漂亮得让人屏息。" },
  // ── 史诗 ──
  { id: "angel", name: "七彩神仙鱼", rarity: "epic", value: [70, 110], flavor: "七彩神仙鱼，鳍像一面被风鼓起的彩色丝帆，舍不得卖。" },
  { id: "dragoneye", name: "龙睛金鱼", rarity: "epic", value: [80, 130], flavor: "龙睛金鱼睁着一双圆鼓鼓的眼，正一脸无辜地看着你。" },
  // ── 传说 ──
  { id: "koiking", name: "锦鲤王", rarity: "legendary", value: [220, 360], flavor: "水面忽然安静了——锦鲤王。鳞片上仿佛驮着整片星空。" },
  { id: "kun", name: "鲲（幼体）", rarity: "legendary", value: [260, 420], flavor: "传说里那条能化成鹏的鲲，居然只有巴掌大，却重得拉不动竿。" },
  { id: "starfall", name: "星落鱼", rarity: "legendary", value: [300, 500], flavor: "据说它是落进水里的星星变的。捞起来的瞬间，整片池塘都亮了一下。" },
];

const JUNK = [
  { name: "旧靴子", value: 1, text: "……一只湿透的旧靴子。里面还有只惊魂未定的小螃蟹。" },
  { name: "空瓶子", value: 1, text: "一个漂流瓶，里面的纸条早被水泡烂了，可惜。" },
  { name: "水草团", value: 0, text: "缠了一大团水草上来，费了好大劲才解开。" },
  { name: "铜板", value: 4, text: "钓上来一枚绿了的旧铜板，不知是谁许愿丢下的。" },
];

const EMPTY = [
  "鱼漂晃了晃，又静下来了。空钩。",
  "感觉有东西碰了一下，提竿——什么都没有。它溜了。",
  "风把鱼漂吹得一圈圈打转，这一竿落了空。",
  "等了好一会儿，水面平静得像面镜子。再来一竿吧。",
];

export const TOTAL_FISH = FISH.length;
const FISH_BY_ID = new Map(FISH.map((f) => [f.id, f]));
export function getFishDef(id: string): FishDef | undefined {
  return FISH_BY_ID.get(id);
}

const STORE_KEY = "nowhere:fishing";

export function emptyState(): FishingState {
  return { coins: 0, casts: 0, basket: [], dex: [], log: [] };
}

export function loadFishing(): FishingState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...(JSON.parse(raw) as Partial<FishingState>) };
  } catch {
    return emptyState();
  }
}

export function saveFishing(s: FishingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickFish(): FishDef {
  const total = FISH.reduce((sum, f) => sum + RARITY_WEIGHT[f.rarity], 0);
  let r = Math.random() * total;
  for (const f of FISH) {
    r -= RARITY_WEIGHT[f.rarity];
    if (r <= 0) return f;
  }
  return FISH[0];
}

/** 抛一竿，直接改传入的 state（不落盘），返回这一竿的结果 */
export function cast(state: FishingState): CastOutcome {
  state.casts += 1;

  const roll = Math.random();
  // 18% 空钩，12% 杂物，70% 钓到鱼
  if (roll < 0.18) {
    return { kind: "empty", text: EMPTY[randInt(0, EMPTY.length - 1)] };
  }
  if (roll < 0.3) {
    const j = JUNK[randInt(0, JUNK.length - 1)];
    state.coins += j.value;
    return { kind: "junk", name: j.name, value: j.value, text: j.text };
  }

  const def = pickFish();
  const value = randInt(def.value[0], def.value[1]);
  const firstTime = !state.dex.includes(def.id);
  if (firstTime) state.dex.push(def.id);
  const fish: CaughtFish = { id: def.id, name: def.name, rarity: def.rarity, value };
  state.basket.push(fish);
  return { kind: "fish", fish, def, firstTime };
}

/** 卖光鱼篓，返回 {count, gained} */
export function sellAll(state: FishingState): { count: number; gained: number } {
  const count = state.basket.length;
  const gained = state.basket.reduce((sum, f) => sum + f.value, 0);
  state.coins += gained;
  state.basket = [];
  return { count, gained };
}

/** 把一次结果压成一行给 log 用的文字 */
export function outcomeText(o: CastOutcome): string {
  if (o.kind === "empty") return o.text;
  if (o.kind === "junk") return o.text;
  const tag = o.firstTime ? "【图鉴+1】" : "";
  return `${tag}${o.def.flavor}（${o.fish.name}·${RARITY_LABEL[o.fish.rarity]}，可卖 ${o.fish.value} 枚）`;
}

export function pushLog(state: FishingState, entry: LogEntry): void {
  state.log.push(entry);
  if (state.log.length > 40) state.log = state.log.slice(-40);
}
