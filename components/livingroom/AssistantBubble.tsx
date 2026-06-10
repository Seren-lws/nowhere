"use client";

import { useEffect, useState } from "react";

/**
 * 某先生的话。animate=true 时逐字浮现（拿到完整回复后的打字感，
 * 不走真流式，简单稳妥）；否则直接显示全文（历史消息）。
 */
export function AssistantBubble({
  content,
  animate,
}: {
  content: string;
  animate: boolean;
}) {
  const [shown, setShown] = useState(animate ? "" : content);

  useEffect(() => {
    if (!animate) {
      setShown(content);
      return;
    }
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 1;
      setShown(content.slice(0, i));
      if (i >= content.length) clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, [content, animate]);

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/85 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-700 shadow-sm">
        {shown}
        {animate && shown.length < content.length && (
          <span className="ml-0.5 inline-block h-4 w-[2px] -translate-y-[1px] animate-pulse bg-zinc-400 align-middle" />
        )}
      </div>
    </div>
  );
}
