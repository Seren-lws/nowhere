# PROJECT-BIBLE · nowhere

> 施工日志与现场决策的唯一事实来源。Claude Code 每完成一个阶段自行更新本文件（DESIGN §8.3）。
> 配套图纸见 [`DESIGN.md`](./DESIGN.md)；需求源头见 [`关于声声·陪伴需求画像.md`](./关于声声·陪伴需求画像.md)。

---

## 当前阶段

**阶段 0 · 地基（奠基）** — 已完成 ✅
工程骨架初始化完毕，按房间分空路由。**未实现任何功能页面。** P0 需求等待下发。

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

## 待办（等声声下发 P0）

P0 = 入口 + 平面图热点 + 客厅（客厅先接简易大脑：基础人格 prompt + 简单记忆）。

- [ ] 推门进入动画（Framer Motion）
- [ ] 拟物风格家庭平面图（SVG 热区，竖屏构图）
- [ ] 客厅日常聊天 + 简易大脑
- [ ] 接入 yunwu.ai 中转、模型名做成配置项
- [ ] Supabase 建库（建库即启用 pgvector）

---

*更新记录：2026-06-10 · 阶段0地基完成。*
