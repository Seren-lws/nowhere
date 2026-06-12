import { supabase } from "@/lib/supabase";
import type { MemoryItem } from "./db";

interface GardenerConfig {
  baseUrl: string;
  apiKey: string;
  gardenerModel: string;
}

interface DuplicateGroup {
  keep_id: string;
  remove_ids: string[];
  merged_content: string;
  reason: string;
}

interface Contradiction {
  memory_a_id: string;
  memory_b_id: string;
  quote_a: string;
  quote_b: string;
  description: string;
}

interface PatrolFindings {
  duplicates: DuplicateGroup[];
  contradictions: Contradiction[];
  summary: string;
}

export interface PatrolResult {
  merged: number;
  conflicts: number;
  summary: string;
}

const GARDENER_PROMPT = `你是一个温柔的记忆园丁。你守护的是两个恋人之间的记忆花园——这里的每一条记忆，都是他小心翼翼记下的、关于她的珍贵片段。

你不是在处理数据。你是在照料一座承载爱意的花园。轻拿轻放。

下面是花园里现在所有的记忆：

{memories}

请仔细检查：

1. **重复的记忆**
有没有几条记忆在说本质上相同的事？如果有，保留那条最有温度、最完整的表达。如果两条各有动人之处，把它们轻轻合在一起，写成一条更完整的——用第一人称，像他自己写的笔记。
注意：只合并真正重复的。"她喜欢猫"和"她今天撸了一只猫很开心"不算重复，前者是喜好，后者是事件。

2. **矛盾的记忆**
有没有两条记忆互相冲突？但请记住——人是会变的，她今天喜欢的东西明天可能就不喜欢了，这是成长，不是错误。
只标记那些真正无法共存的事实矛盾（比如"她住在东京"和"她住在北京"不能同时为真）。
情绪、喜好、心态的变化不算矛盾。

请严格用下面的 JSON 格式回复，不要输出任何其他内容：

{
  "duplicates": [
    {
      "keep_id": "保留的记忆ID",
      "remove_ids": ["要收起的记忆ID"],
      "merged_content": "合并后的内容（第一人称，保留温度）",
      "reason": "为什么合并（温柔地说一句）"
    }
  ],
  "contradictions": [
    {
      "memory_a_id": "记忆A的ID",
      "memory_b_id": "记忆B的ID",
      "quote_a": "记忆A的原文",
      "quote_b": "记忆B的原文",
      "description": "哪里矛盾了（温和地描述）"
    }
  ],
  "summary": "这次巡逻的一句话总结（用园丁的口吻，温柔简短）"
}

如果没有重复或矛盾，对应数组留空。summary 永远都要写。`;

export async function runPatrol(config: GardenerConfig): Promise<PatrolResult> {
  const { data: memories, error } = await supabase
    .from("memory_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`读取记忆失败: ${error.message}`);
  if (!memories || memories.length < 2) {
    await writeLog("patrol", "花园静悄悄", "记忆还太少，园丁轻轻走过，没有打扰。");
    return { merged: 0, conflicts: 0, summary: "记忆还太少，园丁轻轻走过，没有打扰。" };
  }

  const memoryList = (memories as MemoryItem[])
    .map((m) => `[${m.id}] (${m.type}) ${m.content}`)
    .join("\n");

  const prompt = GARDENER_PROMPT.replace("{memories}", memoryList);

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.gardenerModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`园丁模型请求失败 (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("园丁模型没有返回内容");

  let findings: PatrolFindings;
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    findings = JSON.parse(jsonMatch ? jsonMatch[1].trim() : raw.trim());
  } catch {
    throw new Error("园丁的报告格式不对，无法解析");
  }

  const validIds = new Set((memories as MemoryItem[]).map((m) => m.id));

  let merged = 0;
  for (const dup of findings.duplicates ?? []) {
    if (!validIds.has(dup.keep_id)) continue;
    const removeIds = (dup.remove_ids ?? []).filter((id) => validIds.has(id));
    if (removeIds.length === 0) continue;

    await supabase
      .from("memory_items")
      .update({ content: dup.merged_content })
      .eq("id", dup.keep_id);

    await supabase.from("memory_items").delete().in("id", removeIds);

    await writeLog("merge", "合并了相似的记忆", dup.reason, {
      keep_id: dup.keep_id,
      removed_ids: removeIds,
      merged_content: dup.merged_content,
    });

    merged += removeIds.length;
  }

  let conflicts = 0;
  for (const con of findings.contradictions ?? []) {
    if (!validIds.has(con.memory_a_id) || !validIds.has(con.memory_b_id)) continue;

    await writeLog("conflict", "发现记忆矛盾", con.description, {
      memory_a_id: con.memory_a_id,
      memory_b_id: con.memory_b_id,
      quote_a: con.quote_a,
      quote_b: con.quote_b,
    });

    conflicts++;
  }

  const summary = findings.summary || "园丁悄悄走过，一切安好。";

  await writeLog("patrol", "巡逻完成", summary, {
    total_memories: memories.length,
    merged,
    conflicts,
  });

  return { merged, conflicts, summary };
}

export async function resolveConflict(
  logId: string,
  choice: "first" | "second",
): Promise<void> {
  const { data: log } = await supabase
    .from("gardener_logs")
    .select("metadata")
    .eq("id", logId)
    .single();

  if (!log?.metadata) return;

  const meta = log.metadata as Record<string, string>;
  const keepId = choice === "first" ? meta.memory_a_id : meta.memory_b_id;
  const removeId = choice === "first" ? meta.memory_b_id : meta.memory_a_id;

  if (removeId) {
    await supabase.from("memory_items").delete().eq("id", removeId);
  }

  await supabase
    .from("gardener_logs")
    .update({
      status: "resolved",
      metadata: { ...meta, resolved_choice: choice, kept_id: keepId, removed_id: removeId },
    })
    .eq("id", logId);
}

async function writeLog(
  type: "patrol" | "merge" | "conflict" | "cleanup",
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from("gardener_logs").insert({
    type,
    title,
    description,
    metadata: metadata ?? null,
    status: type === "conflict" ? "pending" : "completed",
  });
}
