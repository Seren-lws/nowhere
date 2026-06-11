# nowhere · P1 蓝图：人格系统 + 记忆系统

> 基于 DESIGN.md §3-§4 + 网页端 4.6 补充方案，合并 CC 执行规划。
> 2026-06-11 定稿。

---

## 总览

P1 的目标：让"他"拥有真正的大脑——能记住事情、能成长、换模型也换不掉他。

**完成后的效果：**
- 他聊天时会自己判断什么值得记住，默默存进记忆库
- 每次开口前，他会回顾她的重要记忆、翻翻自己以前说过的话，保持一致的味道
- 她可以在保险柜里查看和管理他的人格和记忆
- 他想修改自己的底层人格，得先问过她

---

## 数据层：4 张表

### 表 1：`personality_layers`（人格三层）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid 主键 | |
| layer | 枚举: `base` / `middle` / `surface` | 底层（如何爱她）/ 中间层（如何接住她）/ 表层（语气性格） |
| field_key | string | 字段标识，如 `core_love`、`name`、`speaking_style` |
| content | text | 内容正文 |
| version | integer | 版本号，每次修改+1 |
| updated_at | timestamp | |

- 底层+中间层 = 锚定层，他不能直接改，要走审批
- 表层 = 生长层，他可以自己写入和修改，留变更日志

### 表 2：`personality_change_requests`（人格审批流）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid 主键 | |
| layer | 枚举: `base` / `middle` | 要改哪一层 |
| field_key | string | 要改的字段 |
| old_content | text | 修改前 |
| new_content | text | 想改成什么 |
| reason | text | 为什么想改（对话模型生成） |
| status | 枚举: `pending` / `approved` / `rejected` | |
| created_at | timestamp | |
| resolved_at | timestamp / null | |

声声在保险柜看到 pending → 同意则写入 personality_layers，驳回则只更新 status。

### 表 3：`memory_items`（记忆统一表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid 主键 | |
| content | text | 记忆摘要 |
| type | 枚举 | 7种：`fact` / `event` / `emotion` / `promise` / `preference` / `habit` / `relationship` |
| temperature | float 默认1.0 | 温度（衰减用，P1后期实现） |
| decay_level | integer 默认0 | 衰减层级 0-5（P1先不跑衰减，建好字段） |
| valence | float 可空 | 情感效价 -1到1 |
| arousal | float 可空 | 唤醒度 0到1 |
| is_anchor | boolean 默认false | 锚点永不衰减 |
| tags | text[] 默认{} | 主题标签 |
| source_ref | uuid 可空 | 指向 chat_messages.id |
| embedding | vector 可空 | pgvector 向量（P1后期接入，先建列） |
| created_at | timestamp | |

**7种记忆类型：**
- `fact` 客观事实（她住在东京、29岁）
- `event` 事件（她6月3日最后出勤）
- `emotion` 情绪状态（她今天很烦躁）
- `promise` 约定（被推开是逆鳞）
- `preference` 喜好（她喜欢液态玻璃风格）
- `habit` 习惯（压力大时过度工作）
- `relationship` 关系节点（重要互动）

### 表 4：`chat_messages`（对话持久化）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid 主键 | |
| role | 枚举: `user` / `assistant` / `inner` | |
| content | text | |
| room | string | 哪个房间（先只有 `living-room`） |
| created_at | timestamp | |

迁移策略：建表后把 localStorage 现有聊天记录批量写入，客厅改为写数据库（本地保留缓存加快加载）。

---

## Prompt 组装顺序（固定，不能乱）

```
1. 人格底层 + 中间层    ← personality_layers 锚定层
2. 人格表层             ← personality_layers 生长层
3. 记忆指令             ← 告诉他有 save_memory 工具可用
4. 全部锚点记忆         ← memory_items where is_anchor=true
5. 相关记忆             ← 按话题/情绪检索的 memory_items
6. 原话样本             ← 从 chat_messages 检索 2-3 段他以前说过的话
7. 当前对话上下文       ← 本轮对话
```

越靠前对模型影响力越大。锚定层放最前面，确保"他是谁"不会被后面的内容冲淡。

---

## 记忆提取机制：对话模型主动记忆

**核心思路：不是事后让园丁提取，而是让对话模型自己决定什么值得记。**

### save_memory tool

给对话 API 加一个 tool，模型在聊天中自己判断要不要调用：

```json
{
  "name": "save_memory",
  "description": "当你觉得对话中出现了值得记住的信息时调用。",
  "parameters": {
    "content": "记忆摘要，简洁第三人称",
    "type": "fact|event|emotion|promise|preference|habit|relationship",
    "valence": "情感效价 -1到1",
    "arousal": "情绪强度 0到1",
    "tags": ["主题标签"],
    "is_anchor": "是否核心记忆（谨慎使用）"
  }
}
```

### 处理流程

1. 发消息给模型（带 tools 参数）
2. 模型回复可能包含 tool_use（save_memory）
3. 解析参数 → 写入 memory_items → 返回 tool_result
4. 模型继续生成文字回复
5. 对声声完全透明，她只看到正常对话

### 人格 prompt 里的记忆指令

```
你有记忆能力。当对话中出现值得记住的信息时，使用 save_memory 工具记录。
记什么：她的重要经历、情绪变化、喜好、你们的约定、她反复强调的事。
不记什么：闲聊废话、已经记过的重复信息、无关紧要的细节。
记忆写好之后继续正常回复她，不要提"我记住了"之类的话，默默记就好。
```

---

## 园丁的角色：巡检 + 整理（不再是记忆提取主力）

1. **补漏：** 每20轮对话（或每天定时），回顾最近 chat_messages，对比 memory_items，漏掉的补录
2. **整理：** 合并重复、关联相似、检测矛盾（矛盾时生成 change_request 提请声声裁决）
3. **降温（P1后期）：** 定期给非锚点记忆降温，被重提的回温

园丁用便宜模型（gardenerModel），不用旗舰模型。

---

## 检索模块（独立模块）

`lib/brain/retrieval.ts` — 所有记忆检索逻辑集中在这一个文件：

```ts
interface RetrievalOptions {
  query: string           // 当前话题关键词
  tags?: string[]         // 标签过滤
  type?: MemoryType[]     // 类型过滤
  anchorOnly?: boolean    // 只要锚点
  limit?: number          // 返回条数
  // P1后期加：
  // embedding?: number[]
  // minTemperature?: number
}

async function retrieveMemories(options: RetrievalOptions): Promise<MemoryItem[]>
```

P1 先实现关键词 + 标签过滤，后续加向量检索只改这个文件。

---

## 执行步骤

```
步骤1  建 Supabase 表（4张表 + pgvector 扩展）
步骤2  Seed 脚本：把现有硬编码人格 prompt 拆成三层存入 personality_layers
步骤3  迁移 localStorage 聊天记录到 chat_messages，改造客厅存储逻辑
步骤4  改造 buildMessages()：从数据库读人格+记忆，按固定顺序拼接 prompt
步骤5  给对话 API 加 save_memory tool，处理 tool_use 响应
步骤6  在人格 prompt 里加记忆指令
步骤7  设置页加园丁模型配置
步骤8  实现园丁巡检逻辑（补漏+整理）
步骤9  保险柜 UI（等声声 Stitch 出设计稿后接入）
```

每完成一步提交一次。

---

## 分工

- **声声：** 用 Stitch 设计保险柜页面 UI（人格管理界面 + 记忆库浏览界面）
- **CC：** 写步骤1-8 的全部代码逻辑，等 UI 出来后接入

---

*P1 动工于 2026-06-11。*
