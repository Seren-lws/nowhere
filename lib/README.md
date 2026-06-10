# lib/

非 UI 的共享逻辑：数据访问、配置、工具函数等。

- Supabase 客户端、Drizzle schema、Zod 校验、TanStack Query 封装等后续落地于此。
- 模型配置（yunwu.ai 中转，三工种三档位，型号做成配置项，见 DESIGN §6）。
- **大脑层独立在 [`lib/brain/`](./brain/)，与 UI 完全解耦。**
