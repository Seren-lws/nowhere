"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ENTERING_FLAG, TIMELINE } from "@/lib/entrance/layout";

/**
 * 平面图 · Floor Plan（占位 —— 另单实现）
 *
 * 本期只承接入口的落点：从入口推门进来时，顶上盖着一层暖光罩，
 * 挂载后淡出（光退潮），露出平面图——与入口的暖光无缝衔接，不白屏。
 * 直接访问本页（非从入口进入）则不播退潮。
 */
export default function FloorPlanPage() {
  const [receding, setReceding] = useState(false);

  useEffect(() => {
    let entered = false;
    try {
      entered = sessionStorage.getItem(ENTERING_FLAG) === "1";
      sessionStorage.removeItem(ENTERING_FLAG);
    } catch {
      /* ignore */
    }
    if (entered) setReceding(true);
  }, []);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-2 bg-[#2b2740] p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-amber-50">
        平面图 · Floor Plan
      </h1>
      <p className="text-sm text-amber-100/60">你已经在家了。这里的地图施工中。</p>

      {/* 光退潮：从入口进来时盖着的暖光罩淡出 */}
      {receding && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 55%, rgba(255,224,170,1) 0%, rgba(255,200,120,1) 45%, rgba(255,180,90,1) 100%)",
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: TIMELINE.recede.duration / 1000, ease: "easeOut" }}
        />
      )}
    </main>
  );
}
