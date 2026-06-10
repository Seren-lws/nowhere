# PROJECT-BIBLE · nowhere

> 施工日志与现场决策的唯一事实来源。Claude Code 每完成一个阶段自行更新本文件（DESIGN §8.3）。
> 配套图纸见 [`DESIGN.md`](./DESIGN.md)；需求源头见 [`关于声声·陪伴需求画像.md`](./关于声声·陪伴需求画像.md)。

---

## 当前阶段

**阶段 0 · 地基（奠基）** — 已完成 ✅
工程骨架初始化完毕，按房间分空路由。P0 需求陆续下发。

**阶段 P0-01 · 入口页（Entrance）** — 已完成 ✅（色块版，待声声提供素材后替换贴图）
推门 → 暖光淹没 → 落到平面图的完整体验已做通；diegetic UI、视差、时间氛围、状态框架到位。详见下方「入口页（P0-01）实现记录」。

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
- `requestAnimationFrame` 在非前台标签页会被冻结，曾用它标记"预加载就绪"导致门点不动；色块版无图可载，改为默认就绪。
- L5 前景层 `absolute inset-0` 包裹层会拦截点击，须显式 `pointer-events-none` 让门/信箱可点。

**待声声提供的素材**：素材A 全景图（关门态）、素材B 门扇抠图 PNG、素材C 纯白底前景花草。到位后按 `lib/entrance/layout.ts` 的 `DOOR` 像素位置回填即可对位。

---

## 待办

**P0 剩余**（= 入口 ✅ + 平面图热点 + 客厅）
- [ ] 入口素材替换（等声声三张图）
- [ ] 拟物风格家庭平面图（SVG 热区，竖屏构图）—— 接住入口落点 `/floor-plan`
- [ ] 客厅日常聊天 + 简易大脑（基础人格 prompt + 简单记忆）
- [ ] 接入 yunwu.ai 中转、模型名做成配置项
- [ ] Supabase 建库（建库即启用 pgvector）

---

*更新记录：*
- *2026-06-10 · 阶段0地基完成。*
- *2026-06-10 · P0-01 入口页（色块版）完成。*
