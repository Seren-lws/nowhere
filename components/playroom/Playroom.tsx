"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { isChatReady, loadSettings, type BrainSettings } from "@/lib/brain/config";
import { sendChat } from "@/lib/brain/client";
import { loadProfile, type ChatProfile, DEFAULT_PROFILE } from "@/lib/brain/profile";
import {
  loadFishing,
  saveFishing,
  emptyState,
  cast,
  sellAll,
  outcomeText,
  pushLog,
  FISH,
  TOTAL_FISH,
  RARITY_LABEL,
  RARITY_COLOR,
  type FishingState,
  type CastOutcome,
  type LogEntry,
} from "@/lib/playroom/fishing";

export function Playroom() {
  const router = useRouter();
  const [state, setState] = useState<FishingState>(emptyState());
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [profile, setProfile] = useState<ChatProfile>(DEFAULT_PROFILE);
  const [busy, setBusy] = useState<null | "me" | "him">(null);
  const [showDex, setShowDex] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState(loadFishing());
    setSettings(loadSettings());
    setProfile(loadProfile());
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [state.log]);

  const ready = settings ? isChatReady(settings) : false;
  const himName = profile.companionName || "裴斯年";

  /** 让他用自己的口吻解说这一竿 */
  const narrate = async (o: CastOutcome): Promise<string> => {
    if (!settings) return "";
    let what: string;
    if (o.kind === "fish") {
      what = `钓到了一条「${o.fish.name}」（${RARITY_LABEL[o.fish.rarity]}，能卖 ${o.fish.value} 枚）。${o.firstTime ? "这还是第一次钓到这种。" : ""}`;
    } else if (o.kind === "junk") {
      what = `没钓到鱼，钩上来的是「${o.name}」。`;
    } else {
      what = "这一竿落了空，什么都没钓到。";
    }
    const sys = `你是${himName}，她的恋人——温柔里带点痞气，偶尔傲娇。你正和她一起在你们家的池塘边钓鱼，气氛慵懒惬意。
用你的口吻对这一竿说一两句话（口语、自然、简短，不超过30字），像真的在她身边边钓边聊。不要用括号写动作，不要解释，直接说话。`;
    try {
      const resp = await sendChat(
        [
          { role: "system", content: sys },
          { role: "user", content: `${what}\n你会说什么？` },
        ],
        settings,
      );
      return (resp.content || "").trim().split("\n")[0].slice(0, 60);
    } catch {
      return "";
    }
  };

  const doCast = async (who: "me" | "him") => {
    if (busy) return;
    if (who === "him" && !ready) {
      setToast("还没接上他的大脑，先去设置填好 API～");
      setTimeout(() => setToast(null), 2200);
      return;
    }
    setBusy(who);

    const next = structuredClone(stateRef.current);
    const outcome = cast(next);
    const entry: LogEntry = {
      ts: Date.now(),
      who,
      text: outcomeText(outcome),
      rarity: outcome.kind === "fish" ? outcome.fish.rarity : undefined,
    };
    pushLog(next, entry);
    saveFishing(next);
    setState(next);

    if (who === "him") {
      const remark = await narrate(outcome);
      if (remark) {
        const after = structuredClone(stateRef.current);
        const target = after.log.find((l) => l.ts === entry.ts);
        if (target) target.remark = remark;
        saveFishing(after);
        setState(after);
      }
    }
    setBusy(null);
  };

  const doSell = () => {
    if (busy) return;
    const next = structuredClone(stateRef.current);
    const { count, gained } = sellAll(next);
    if (count === 0) {
      setToast("鱼篓是空的，先钓两条吧～");
      setTimeout(() => setToast(null), 1800);
      return;
    }
    pushLog(next, { ts: Date.now(), who: "me", text: `卖掉了鱼篓里的 ${count} 条鱼，进账 ${gained} 枚。` });
    saveFishing(next);
    setState(next);
    setToast(`卖了 ${count} 条，+${gained} 枚`);
    setTimeout(() => setToast(null), 1800);
  };

  const basketCount = state.basket.length;
  const basketValue = state.basket.reduce((s, f) => s + f.value, 0);

  return (
    <main
      className="fixed inset-0 flex flex-col"
      style={{
        background: "linear-gradient(180deg, #cfe6e4 0%, #a9cfcf 38%, #6f9fab 100%)",
        fontFamily: "var(--font-serif-sc)",
      }}
    >
      {/* 水光氛围 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: "linear-gradient(180deg, transparent, rgba(60,110,120,0.25))" }} />
      </div>

      {/* 页头 */}
      <header className="relative z-10 flex items-center justify-between px-4 h-14 shrink-0" style={{ backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.25)" }}>
        <button className="p-2 active:scale-90" style={{ color: "#2f4f57" }} onClick={() => router.push("/floor-plan")}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[18px]" style={{ fontFamily: "'Pinyon Script', cursive", color: "#2f4f57" }}>Little Pond</span>
          <span className="text-[10px]" style={{ color: "rgba(47,79,87,0.6)" }}>娱乐室 · 钓鱼</span>
        </div>
        <button className="p-2 active:scale-90" style={{ color: "#2f4f57" }} onClick={() => setShowDex(true)} aria-label="图鉴">
          <span className="material-symbols-outlined">menu_book</span>
        </button>
      </header>

      {/* 状态条 */}
      <div className="relative z-10 flex items-center justify-around px-4 py-2 shrink-0 text-[13px]" style={{ color: "#2f4f57" }}>
        <span className="flex items-center gap-1">🪙 <b>{state.coins}</b> 枚</span>
        <span className="flex items-center gap-1">📖 图鉴 <b>{state.dex.length}</b>/{TOTAL_FISH}</span>
        <span className="flex items-center gap-1">🎣 抛竿 <b>{state.casts}</b> 次</span>
      </div>

      {/* 记录区 */}
      <div ref={logRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {state.log.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2" style={{ color: "rgba(47,79,87,0.55)" }}>
            <span className="text-[40px]">🎣</span>
            <p className="text-[14px]">池塘很安静。</p>
            <p className="text-[12px]">点下面的「抛竿」自己钓，或者叫{himName}陪你钓一竿。</p>
          </div>
        ) : (
          state.log.map((l) => <LogRow key={l.ts} entry={l} profile={profile} himName={himName} />)
        )}
        {busy === "him" && (
          <div className="flex items-center gap-2 text-[12px] italic" style={{ color: "rgba(47,79,87,0.6)" }}>
            <span className="material-symbols-outlined text-[16px] animate-pulse">more_horiz</span>
            {himName}正盯着鱼漂…
          </div>
        )}
      </div>

      {/* 操作区 */}
      <div className="relative z-10 shrink-0 px-4 pt-2 pb-6 space-y-2" style={{ background: "linear-gradient(0deg, rgba(255,255,255,0.35), transparent)" }}>
        <div className="flex gap-2">
          <ActionButton onClick={() => doCast("me")} disabled={!!busy} primary>
            🎣 抛竿（我钓）
          </ActionButton>
          <ActionButton onClick={() => doCast("him")} disabled={!!busy}>
            {busy === "him" ? "他在钓…" : `🌊 叫${himName}钓`}
          </ActionButton>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={doSell} disabled={!!busy}>
            🪣 卖鱼篓{basketCount > 0 ? `（${basketCount}条·${basketValue}枚）` : ""}
          </ActionButton>
          <ActionButton onClick={() => setShowDex(true)} disabled={false}>
            📖 图鉴
          </ActionButton>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-[13px]"
            style={{ background: "rgba(47,79,87,0.92)", color: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图鉴 */}
      <AnimatePresence>
        {showDex && <Encyclopedia dex={state.dex} onClose={() => setShowDex(false)} />}
      </AnimatePresence>
    </main>
  );
}

/* ─── Log Row ─── */

function LogRow({ entry, profile, himName }: { entry: LogEntry; profile: ChatProfile; himName: string }) {
  const mine = entry.who === "me";
  const avatar = mine ? profile.userAvatar : profile.companionAvatar;
  const fallback = mine ? (profile.userName || "我").slice(0, 1) : himName.slice(0, 1);
  const accent = entry.rarity ? RARITY_COLOR[entry.rarity] : "rgba(47,79,87,0.5)";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)" }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[12px]" style={{ color: "#2f4f57" }}>{fallback}</span>
        )}
      </div>
      <div
        className="flex-1 min-w-0 rounded-2xl px-3.5 py-2"
        style={{
          background: "rgba(255,255,255,0.7)",
          border: `1px solid ${entry.rarity ? accent + "66" : "rgba(255,255,255,0.6)"}`,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <p className="text-[12.5px] leading-relaxed" style={{ color: "#274047" }}>{entry.text}</p>
        {entry.remark && (
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: RARITY_COLOR.rare }}>
            {himName}：{entry.remark}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Action Button ─── */

function ActionButton({ onClick, disabled, primary, children }: { onClick: () => void; disabled: boolean; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 rounded-2xl text-[13.5px] active:scale-[0.97] transition-transform disabled:opacity-50"
      style={{
        background: primary ? "rgba(47,79,87,0.92)" : "rgba(255,255,255,0.75)",
        color: primary ? "white" : "#2f4f57",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 4px 14px rgba(60,110,120,0.18)",
      }}
    >
      {children}
    </button>
  );
}

/* ─── Encyclopedia ─── */

function Encyclopedia({ dex, onClose }: { dex: string[]; onClose: () => void }) {
  const got = new Set(dex);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: "rgba(40,60,66,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto"
        style={{ background: "#f3f8f7" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold" style={{ color: "#2f4f57" }}>
            鱼类图鉴 <span className="text-[12px] font-normal" style={{ color: "rgba(47,79,87,0.6)" }}>{got.size}/{TOTAL_FISH}</span>
          </h2>
          <button onClick={onClose} className="p-1 active:scale-90"><span className="material-symbols-outlined" style={{ color: "#2f4f57" }}>close</span></button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {FISH.map((f) => {
            const has = got.has(f.id);
            return (
              <div
                key={f.id}
                className="rounded-xl px-3.5 py-2.5"
                style={{
                  background: has ? "white" : "rgba(47,79,87,0.05)",
                  border: `1px solid ${has ? RARITY_COLOR[f.rarity] + "55" : "rgba(47,79,87,0.08)"}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-medium" style={{ color: has ? "#274047" : "rgba(47,79,87,0.4)" }}>
                    {has ? f.name : "？？？"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: RARITY_COLOR[f.rarity] + (has ? "22" : "11"), color: has ? RARITY_COLOR[f.rarity] : "rgba(47,79,87,0.35)" }}>
                    {RARITY_LABEL[f.rarity]}
                  </span>
                </div>
                {has && <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "rgba(39,64,71,0.7)" }}>{f.flavor}</p>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
