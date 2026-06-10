"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  FIREPLACE,
  FLOORPLAN_ASPECT,
  FLOORPLAN_SRC,
  HE_POINT_BY_ROOM,
  LANDING_ROOM,
  MOCK_HOME_STATE,
  ROOMS,
  roomCenter,
  type RoomRegion,
} from "@/lib/floorplan/stickers";
import { ENTERING_FLAG, FLOOD_GRADIENT } from "@/lib/entrance/layout";
import { useHaptics } from "@/components/entrance/hooks/useHaptics";

/**
 * 平面图 · 进门后的家（纵向滚动长图）。
 * - 落客厅；上可逛卧室/娱乐室/书房，下到地下保险柜
 * - 客厅 / 保险柜：点 → 镜头推近 → 进房间路由
 * - 书房 / 卧室 / 娱乐室：盖防尘布，点 → 冒"还在装修"气泡，不进
 * - 壁炉火 + 他的光点由 HomeState 驱动（mock，接口留给大脑层）
 */
export function FloorPlan() {
  const router = useRouter();
  const { lightImpact } = useHaptics();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [entering, setEntering] = useState<RoomRegion | null>(null);
  const [originY, setOriginY] = useState(roomCenter(ROOMS[3])); // 默认客厅
  const [wipBubble, setWipBubble] = useState<RoomRegion | null>(null);
  const [receding, setReceding] = useState(false);

  const state = MOCK_HOME_STATE;

  // 轻视差：氛围光层随滚动微微漂移
  const { scrollY } = useScroll({ container: scrollRef });
  const glowDrift = useTransform(scrollY, (v) => v * 0.04);

  // 进门落客厅 + 暖光退潮入场
  useEffect(() => {
    let entered = false;
    try {
      entered = sessionStorage.getItem(ENTERING_FLAG) === "1";
      sessionStorage.removeItem(ENTERING_FLAG);
    } catch {
      /* ignore */
    }
    if (entered) setReceding(true);

    // 初始定位到客厅
    const el = scrollRef.current;
    if (el) {
      const land = ROOMS.find((r) => r.key === LANDING_ROOM)!;
      const target =
        (roomCenter(land) / 100) * el.scrollHeight - el.clientHeight / 2;
      el.scrollTo({ top: Math.max(0, target), behavior: "auto" });
    }
  }, []);

  const onTapRoom = (room: RoomRegion) => {
    if (entering) return;
    lightImpact();
    if (room.status === "open") {
      // 镜头推近该层后进入
      const el = scrollRef.current;
      if (el) {
        const target =
          (roomCenter(room) / 100) * el.scrollHeight - el.clientHeight / 2;
        el.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      }
      setOriginY(roomCenter(room));
      window.setTimeout(() => setEntering(room), 360);
    } else {
      // 防尘布房间：冒气泡
      setWipBubble(room);
      window.setTimeout(() => setWipBubble((b) => (b === room ? null : b)), 2200);
    }
  };

  return (
    <main
      ref={scrollRef}
      className="relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#efeae3]"
    >
      {/* 可推近的内容容器 */}
      <motion.div
        className="relative mx-auto w-full max-w-[460px]"
        animate={{ scale: entering ? 1.65 : 1 }}
        transition={{ duration: 0.8, ease: [0.5, 0, 0.4, 1] }}
        style={{ transformOrigin: `50% ${originY}%` }}
      >
        <div className="relative w-full" style={{ aspectRatio: `${FLOORPLAN_ASPECT}` }}>
          <img
            src={FLOORPLAN_SRC}
            alt="家的剖面平面图"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
          />

          {/* 氛围光层（轻视差）：壁炉火 + 他的光点 */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ y: glowDrift, mixBlendMode: "screen" }}
          >
            {state.fireplaceLit && (
              <motion.div
                className="absolute"
                style={{
                  left: `${FIREPLACE.left}%`,
                  top: `${FIREPLACE.top}%`,
                  width: `${FIREPLACE.size}%`,
                  height: `${FIREPLACE.size}%`,
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle at 50% 55%, rgba(255,206,150,0.95) 0%, rgba(255,184,120,0.4) 40%, rgba(255,184,120,0) 72%)",
                }}
                animate={{ opacity: [0.65, 1, 0.7, 0.95, 0.65] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {state.hePresentRoom && HE_POINT_BY_ROOM[state.hePresentRoom] && (
              <motion.div
                className="absolute"
                style={{
                  left: `${HE_POINT_BY_ROOM[state.hePresentRoom].left}%`,
                  top: `${HE_POINT_BY_ROOM[state.hePresentRoom].top}%`,
                  width: "5%",
                  height: "5%",
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle, rgba(255,236,206,1) 0%, rgba(248,222,196,0.5) 45%, rgba(248,222,196,0) 72%)",
                }}
                animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </motion.div>

          {/* 五层热区 */}
          {ROOMS.map((room) => (
            <button
              key={room.key}
              type="button"
              aria-label={room.status === "open" ? `进入${room.label}` : `${room.label}（装修中）`}
              className="absolute left-0 w-full cursor-pointer outline-none"
              style={{ top: `${room.top}%`, height: `${room.height}%` }}
              onClick={() => onTapRoom(room)}
              disabled={!!entering}
            >
              {/* 防尘布：未完工房间盖一层柔和半透明罩 */}
              {room.status === "wip" && (
                <span
                  aria-hidden
                  className="absolute inset-[3%] rounded-[6px]"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(244,240,234,0.66), rgba(232,226,220,0.58))",
                    boxShadow: "inset 0 1px 6px rgba(120,110,120,0.15)",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 还在装修气泡（视口居中，自动消失） */}
      <AnimatePresence>
        {wipBubble && (
          <motion.div
            key={wipBubble.key}
            className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="rounded-2xl bg-white/85 px-5 py-3 text-sm text-zinc-600 shadow-lg backdrop-blur-sm">
              {wipBubble.label}这间还在装修～
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 镜头推近时的奶油渐隐罩 → 盖满后进房间 */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30"
        style={{ background: FLOOD_GRADIENT }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entering ? 1 : 0 }}
        transition={{ duration: 0.8, ease: "easeIn" }}
        onAnimationComplete={() => {
          if (entering) router.push(entering.route);
        }}
      />

      {/* 暖光退潮入场（从门口进来时） */}
      {receding && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40"
          style={{ background: FLOOD_GRADIENT }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          onAnimationComplete={() => setReceding(false)}
        />
      )}
    </main>
  );
}
