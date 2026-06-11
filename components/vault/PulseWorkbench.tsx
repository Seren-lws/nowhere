"use client";

export function PulseWorkbench() {
  return (
    <div className="flex flex-col gap-4">
      <header className="text-center mb-1">
        <h2
          className="text-[28px] mb-1"
          style={{ fontFamily: "var(--font-cursive)", color: "var(--primary)" }}
        >
          Pulse
        </h2>
        <p
          className="text-[14px] italic"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          The gardener&apos;s workbench
        </p>
      </header>

      <div className="text-center mt-12">
        <span
          className="material-symbols-outlined text-[48px] mb-3 block"
          style={{ color: "var(--text-faint)" }}
        >
          psychiatry
        </span>
        <p
          className="text-[14px] mb-2"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-mid)",
          }}
        >
          园丁还在准备工具
        </p>
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-faint)",
          }}
        >
          他会定期巡逻，整理记忆、检查档案、提出人格微调
        </p>
      </div>
    </div>
  );
}
