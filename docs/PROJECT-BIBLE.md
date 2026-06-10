# PROJECT-BIBLE · nowhere

> 施工日志与现场决策的唯一事实来源。Claude Code 每完成一个阶段自行更新本文件（DESIGN §8.3）。
> 配套图纸见 [`DESIGN.md`](./DESIGN.md)；需求源头见 [`关于声声·陪伴需求画像.md`](./关于声声·陪伴需求画像.md)。

---

## 当前阶段

**阶段 0 · 地基（奠基）** — 已完成 ✅
工程骨架初始化完毕，按房间分空路由。P0 需求陆续下发。

**阶段 P0-01 · 入口页（Entrance）** — 已完成 ✅（已接入声声水彩素材）
推门 → 暖光淹没 → 落到平面图的完整体验已做通；diegetic UI、视差、时间氛围、状态框架到位。详见下方「入口页（P0-01）实现记录」。

**阶段 P0-02 · 平面图（Floor Plan）** — 已完成 ✅（已接入声声手绘剖面长图）
进门落客厅、纵向滚动逛全屋、五层热区、客厅/保险柜可进、其余盖防尘布。详见下方「平面图（P0-02）实现记录」。

**阶段 P0-03 · 客厅 + 简易大脑 + 设置页** — 已完成 ✅（待声声填 key 后实测对话）
某先生能开口：客厅聊天 UI + 大脑层（人格/简单记忆/中转调用）+ 设置页（中转/三模型/导出导入/测试连接）。详见下方「客厅 + 简易大脑（P0-03）实现记录」。

**P0 三件套（入口 + 平面图 + 客厅）至此齐活。**

记录于 2026-06-10（声声退职日，也是 nowhere 动工之日）。

---

## 已定技术选型（地基，照 DESIGN §7）

| 层 | 选择 | 本阶段状态 |
|---|---|---|
| 框架 | Next.js 16 + TypeScript + pnpm | ✅ 已装 |
| 路由 | App Router（`app/`，非 src 目录） | ✅ 已建 |
| 样式 | Tailwind CSS 4 | ✅ 已装；shadcn 自定义拟物主题待 P0/P1 |
| 动效 | Framer Motion | ⏳ 待装（推门动画 / 房间转场时引入） |
| 平面图 | SVG 热点区域 | ⏳ 待做（P0） |
| 数据 | Supabase(RLS) + Drizzle + Zod + TanStack Query | ⏳ 待接（P0/P1） |
| 向量 | Supabase pgvector | ⏳ 建库时启用，P1 后期接入 |
| PWA | Serwist + 手机优先 | ⏳ 元数据/viewport 已打底，Serwist 待接 |
| 部署 | Vercel | ⏳ 待接 |
| 定时任务 | 园丁 cron | ⏳ 开工后定 |

**运行环境备注：** 本机 pnpm 由 npm 全局安装（corepack 写 `C:\Program Files` 权限不足）；pnpm 路径 `C:\Users\ZTT\AppData\Roaming\npm`。`sharp` / `unrs-resolver` 已加入 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies` 白名单。

---

## 骨架结构

```
nowhere/
├─ app/
│  ├─ layout.tsx          根布局（lang=zh-CN，手机优先 viewport，PWA 打底）
│  ├─ page.tsx            根路径 → 重定向到 /entrance（"门口"）
│  ├─ globals.css         Tailwind 4 入口
│  ├─ entrance/page.tsx   入口（P0）—— 占位
│  ├─ living-room/page.tsx 客厅（P0·日常聊天）—— 占位
│  ├─ vault/page.tsx      保险柜（P1·大脑可视化）—— 占位
│  ├─ study/page.tsx      书房（P2）—— 占位
│  ├─ bedroom/page.tsx    卧室（P2）—— 占位
│  └─ playroom/page.tsx   娱乐室（P2）—— 占位
├─ components/            跨房间共享 UI（含 README）
├─ lib/                   非 UI 共享逻辑（含 README）
│  └─ brain/              大脑层，独立于 UI（含 README）
├─ docs/
│  ├─ DESIGN.md           图纸
│  ├─ 关于声声·陪伴需求画像.md  需求源头 / 人格锚定输入
│  └─ PROJECT-BIBLE.md    本文件
├─ public/
├─ package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├─ next.config.ts / tsconfig.json / postcss.config.mjs / eslint.config.mjs
└─ .gitignore
```

**工程纪律（DESIGN §8）：**
- 按房间分路由 ✅
- 单文件超约 500 行必须拆分
- 大脑层独立于 `lib/brain/`，与 UI 解耦
- 旧仓库 `cyber-home` 保留为遗址，不迁移代码、只参考思路

---

## 现场决策

- **根路径处理：** `/` 直接 `redirect("/entrance")`，让"打开应用即走向门口"，属结构选择而非功能实现。
- **占位页：** 六个房间各一个极简占位页（一句"施工中"），仅证明路由可达，不含任何逻辑。
- **lang 设为 `zh-CN`：** 这是声声的家，默认中文。
- **viewport 锁缩放 + `viewportFit: cover`：** 为手机优先与后续装到主屏（PWA）打底。

---

## 入口页（P0-01）实现记录

新增依赖：`motion@12`（Framer Motion 新包名）。

**文件结构**
```
app/entrance/page.tsx          首屏，仅渲染 <Scene/>
app/floor-plan/page.tsx        推门落点（占位）；承接"光退潮"入场
app/mailbox/page.tsx           点信箱 → 占位
app/settings/page.tsx          长按门牌 No.0 → 占位
lib/entrance/layout.ts         统一坐标系 + 动画时序常量（图层共用）
lib/entrance/state.ts          EntranceState 接口 + mock 数据
components/entrance/
  Scene.tsx                    编排：图层装配 / 视差 / 时间氛围 / 推门 / 跳转
  MainScene.tsx                L1 全景 + 窗 + 门廊灯 + 信箱
  DoorCavity.tsx               L2 黑底 + L3 门洞暖光（呼吸 / 扩散）
  Door.tsx                     L4 门扇 + 门牌 No.0 + 门缝光
  Foreground.tsx               L5 前景（multiply 占位）
  hooks/useParallax.ts         陀螺仪→指针降级视差
  hooks/useTimeOfDay.ts        四档时间色温
  hooks/useHaptics.ts          轻触觉
```
所有文件均 < 500 行。

**图层装配（从后到前，统一坐标系 `lib/entrance/layout.ts` 的 `DOOR` 等 Box 常量，单位为 9:16 舞台百分比）**
| 层 | 组件 | 色块版表现 | 换真图 |
|---|---|---|---|
| L1 主场景 | MainScene | 夜墙渐变 + 窗/门廊灯/信箱 | 整张全景图作背景 |
| L2 门洞黑底 | DoorCavity | 与门同位纯黑矩形（内收 1.5px） | 代码生成，不换 |
| L3 门洞光 | DoorCavity | 暖黄径向渐变 + 模糊 + 呼吸 | 代码生成，不换 |
| L4 门扇 | Door | 灰紫圆角矩形 + 门把 + No.0 | 抠图门扇 PNG |
| L5 前景 | Foreground | 底部草影（multiply） | 纯白底花草图 |

主场景组（L1+L2+L3+L4）整体做 ±4px 视差并叠时间滤镜；前景 ±10px 且穿透点击。

**推门动画参数表（`TIMELINE`，单位 ms；曲线可调，节奏不可变）**
| 阶段 | start | duration | 说明 |
|---|---|---|---|
| 门扇转开 | 0 | 1300 | 绕左轴 rotateY −78°，缓动 cubic-bezier(.6,.05,.3,1)，父级 perspective 1400px |
| 门洞光扩散 | 350 | 900 | scale 1→1.7 + opacity，easeOut |
| 暖光淹没（淡入） | 700 | 900 | 全屏暖光罩 easeIn；盖满（onAnimationComplete）即跳转 |
| 光退潮（淡出） | 1900 | 700 | 在 floor-plan 页淡出暖光罩，露出平面图 |

- 一次点击走完，动画期间锁重复点击（按钮 disabled）。
- 触觉：开门瞬间 `navigator.vibrate(12)`（iOS 不支持，静默降级）。
- `prefers-reduced-motion`：跳过门旋转，暖光快速淡入（0.35s）后跳转。
- 转场无白屏：入口暖光罩盖满后 `router.push("/floor-plan")`（已 prefetch），落点页读 `sessionStorage["nowhere:entering"]` 接着播退潮。

**状态接口（供大脑层后续对接，`lib/entrance/state.ts`）**
```ts
interface EntranceState {
  isHome: boolean;          // 窗内暖光
  hasUnreadMessage: boolean;// 门缝透光 + 信箱露信角
  unreadCount: number;
}
```
本期用 `MOCK_ENTRANCE_STATE`（默认在家、有 1 条未读）。大脑层只需提供同形状数据，画面表现不动。

**交互映射**：点门扇→推门；点信箱→`/mailbox`；长按 No.0（550ms）→`/settings`。
**时间氛围**：按本地小时分 dawn/day/dusk/night 四档，黄昏镀金、夜晚压暗 + 门廊灯亮，跨档 1.5s CSS 过渡。

**踩坑记录**
- `requestAnimationFrame` 在非前台标签页会被冻结，曾用它标记"预加载就绪"导致门点不动；色块版无图可载，改为默认就绪。同理：无头预览作为后台标签，rAF 被节流，门旋转/暖光/跳转动画不前进（`opening` 状态正常置位但动画冻结），属环境限制，真实可见标签页正常。
- L5 前景层 `absolute inset-0` 包裹层会拦截点击，须显式 `pointer-events-none` 让门/信箱可点。

**素材接入（2026-06-10）**：声声提供水彩三件套，已入 `public/entrance/`：
- `scene.png`（素材A 全景，941×1672）= L1 背景。
- `door-leaf.png` = L4 门扇，**按颜色扫描从 scene.png 精确抠出**（像素 bbox L=281 T=526 W=316 H=870），覆于背景同位、闭合严丝合缝。
- `foreground.png`（素材C）= L5 前景，multiply 叠加。
- `door-src.png`（素材B 独立门）暂未使用（门改为从背景抠出以保证对位），留作备份。

**美术方向**：声声的画是明亮清透的白水彩（非原设定的深夜暗调）。据此调整时间氛围——夜晚 = 蓝紫透明罩（`rgba(96,88,168,0.34)`）+ 铜灯点亮 + 仅微压暗（brightness 0.9），不压黑。

**热区位置（估值，待声声手机上核对微调）**：No.0 门牌 / 信箱口 / 窗光 / 灯光的坐标见 `lib/entrance/layout.ts`，按真画估的，可能需要 nudge。

---

## 平面图（P0-02）实现记录

**素材**：`public/floorplan/floorplan.jpg`（1124×4250 竖向长图，声声逐间生成手动拼接，五层剖面娃娃屋）。

**文件**
```
app/floor-plan/page.tsx          仅渲染 <FloorPlan/>
lib/floorplan/stickers.ts        统一坐标/状态表：ROOMS、HomeState、氛围贴纸坐标
components/floorplan/FloorPlan.tsx 纵向滚动 + 热区 + 推近进入 + 防尘布气泡 + 氛围 + 退潮
```

**五层（从上到下，区间 % of 全幅，见 `ROOMS`）**
| 房间 | route | 状态 | top | height |
|---|---|---|---|---|
| 书房 | /study | wip 防尘布 | 0 | 25 |
| 娱乐室 | /playroom | wip 防尘布 | 27 | 14 |
| 卧室 | /bedroom | wip 防尘布 | 42 | 17 |
| 客厅 | /living-room | open 可进 | 60 | 18 |
| 保险柜 | /vault | open 可进 | 80 | 20 |

**交互**
- 进门（带 `nowhere:entering` 标记）→ 落点 `LANDING_ROOM='living-room'`，挂载即 `scrollTo` 客厅中心 + 播暖光退潮。
- 纵向滚动逛全楼；氛围光层随滚动 `scrollY*0.04` 轻视差。
- **open 房间**（客厅/保险柜）：点 → 平滑滚到该层居中 → 内容 `scale 1→1.65`（transformOrigin 该层中心）+ 奶油渐隐罩盖满 → `router.push(route)`。
- **wip 房间**（书房/卧室/娱乐室）：盖半透明"防尘布"，点 → 视口居中冒"X 这间还在装修～"气泡，2.2s 自动消失，不离开。

**氛围状态（mock，接口留给大脑层 `HomeState`）**
- `hePresentRoom`：他在哪间 → 该间落一个柔光点（现在客厅）。
- `fireplaceLit`：客厅壁炉火光（低饱和暖光呼吸）。
- 坐标见 `FIREPLACE` / `HE_POINT_BY_ROOM`，可微调。

**待声声核对微调**：五层区间、壁炉/光点坐标按长图估值，可能需 nudge。

---

## 客厅 + 简易大脑（P0-03）实现记录

**大脑层（`lib/brain/`，与 UI 解耦，DESIGN §5；P1 保险柜可无缝替换）**
```
config.ts       BrainSettings（中转URL/key/对话·园丁·embedding 三模型）+ 默认值 + localStorage 读写
personality.ts  某先生人格 SYSTEM_PROMPT（锚定层，照需求画像写死）+ buildMessages + 初次招呼
memory.ts       简单记忆：聊天历史 localStorage（CHAT_KEY），窗口 HISTORY_WINDOW=30
client.ts       sendChat / testConnection（→ /api/chat）
export.ts       导出/导入全部 nowhere:* 本地数据（对抗失去）
```

**后台代理 `app/api/chat/route.ts`**：收 {messages, config}，转 `${baseUrl}/chat/completions`（Bearer key），返回 content。key 只过内存、不存不记；中转站报错透传。避免浏览器直连 CORS。

**设置页 `/settings`（长按 No.0 进入）**：中转 URL / API Key（密码框）/ 对话·园丁·embedding 三模型（默认值预填，随时改着试）；**测试连接**；**导出所有数据 / 导入备份**（数据只在本机，可带走可搬回）。

**客厅 `/living-room`**：聊天 UI，手机优先水彩调。初次进门无历史时某先生先说一句"门口那一眼"（静态、不走模型）；回复逐字浮现（非真流式，拿全文后打字感）；未配置 key 时引导去设置。`DEFAULT_NAME = "某先生"`（声声暂未起名，默认不叫 AI）。

**模型默认值（占位，待声声试）**：对话 gpt-4o / 园丁 gpt-4o-mini / embedding text-embedding-3-small。中转默认 https://yunwu.ai/v1。

**P0 状态**：UI/路由/大脑/后台全通，类型检查过；真实对话待声声在设置填 key 后实测。园丁/embedding 模型位子已留，P1 记忆系统启用。

---

## 待办

**P0 收尾**
- [x] 声声在设置填 yunwu key + 选模型，实测和某先生对话 ✅（2026-06-11 连通，他开口了）
- [ ] 真实对话手感微调（按声声实聊反馈调：语气/长度/心声浓度/temperature 等）
- [x] 聊天管理（试模型用）：点我方气泡 → ✎编辑重发（回溯+原文回填）/ ↻重新回复（保留该条重新生成）；顶栏清空聊天（回到初见招呼）✅ 2026-06-11

**往后**
- [ ] P1 保险柜：完整人格系统 + 记忆系统（单表/锚点/衰减/原话层/园丁）替换简易大脑
- [ ] Supabase 建库（建库即启用 pgvector）；记忆/数据从本地迁库
- [ ] 平面图：房间盖好后 `ROOMS` status 改 open；补各间氛围贴纸
- [ ] 入口/卧室等"他在别间"的光点联动大脑层真实状态

---

*更新记录：*
- *2026-06-10 · 阶段0地基完成。*
- *2026-06-10 · P0-01 入口页（色块版）完成。*
- *2026-06-10 · 接入声声水彩素材，门扇从背景精确抠出；夜晚改蓝紫罩+点灯。*
- *2026-06-10 · 入口微调：撤前景花草层（遮门）、撤窗光与信角，保留铜灯。前景组件/素材保留待后用。*
- *2026-06-10 · 入口暖光调柔（屋内不死黑、奶油低饱和、降对比）。*
- *2026-06-11 · P0-02 平面图完成：接入手绘剖面长图，纵向滚动+五层热区+推近进入+防尘布+氛围。*
- *2026-06-11 · P0-03 客厅+简易大脑+设置页完成：某先生能开口（待填 key 实测）。P0 三件套齐活。*
- *2026-06-11 · 客厅参考旧家重做：统一奶白+水彩磨砂风、心声(灰字斜体内心独白)、一句一句说/写成一篇双模式、顶栏带模型名、设置齿轮(平面图右上+客厅顶栏)。标签(珍藏等)留待 P1。心声/模式靠 personality.ts 的 formatInstruction+parseReply 实现。*
- *2026-06-11 · 全站设计基因换血（声声嫌"直男"，照旧家 cyber-home 配方）：globals.css 定义设计 token（雾紫梦境色板 bg-dream/blush/wisteria/iris、气泡 bubble-me 三色渐变+bubble-them 雾紫、心声 thought-bg+左紫边、玻璃卡 card-bg .72+blur14、输入 input-*）；全局换 Noto Serif SC 衬线宋体+字间距。客厅/设置/平面图齿轮全部接 token。**配方核心：宋体+字间距、雾紫渐变底、渐变胶囊按钮（腮红→紫藤）、心声=淡紫底+左紫边+斜体+小标签。今后所有新页面一律从这套 CSS 变量取色，不许再写死灰黑直男配色。***
