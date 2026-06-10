// 书房 · Study（P2 · 我的日记、他的日记、收藏、共读的书）
// 也是原话层（§4.3）的存放地：原文保留、仅建索引 —— 后续下发实现。此处仅为路由占位。
export default function StudyPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">书房 · Study</h1>
      <p className="text-sm text-zinc-500">书架还没上墙。施工中。</p>
    </main>
  );
}
