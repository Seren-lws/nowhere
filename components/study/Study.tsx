"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";

const CARDS = [
  {
    key: "my-drawer",
    title: "我的抽屉",
    subtitle: "日记与收藏，属于我的角落",
    icon: "lock_open",
    href: "/study/my-drawer",
    accent: "rgba(180,140,100,0.15)",
    iconColor: "#a07850",
  },
  {
    key: "his-drawer",
    title: "他的抽屉",
    subtitle: "他的日记与收藏，偷偷看一眼",
    icon: "lock",
    href: "/study/his-drawer",
    accent: "rgba(123,84,85,0.12)",
    iconColor: "var(--primary)",
  },
  {
    key: "bookshelf",
    title: "共读书架",
    subtitle: "一起读过的书，一起走过的字",
    icon: "auto_stories",
    href: "/study/bookshelf",
    accent: "rgba(103,87,126,0.12)",
    iconColor: "#67577e",
  },
] as const;

export function Study() {
  const router = useRouter();

  return (
    <div className="fixed inset-0" style={{ background: "#fcf8f7" }}>
      {/* Background */}
      <div
        className="fixed inset-0 w-full h-full z-0"
        style={{
          backgroundImage: "url('/rooms/study.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(252,248,247,0.4), rgba(245,235,225,0.3), rgba(252,248,247,0.5))",
            backdropFilter: "blur(2px)",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-5 h-16"
        style={{
          background: "rgba(252,248,247,0.3)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderBottom: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "rgba(255,255,255,0.1)" }}
          onClick={() => router.push("/floor-plan")}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "#a07850" }}
          >
            arrow_back
          </span>
        </button>
        <h1
          className="text-[24px] font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
          }}
        >
          书房
        </h1>
        <div className="w-10" />
      </header>

      {/* Cards */}
      <main className="relative z-10 w-full max-w-[800px] mx-auto pt-28 pb-12 px-5 flex flex-col gap-6">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
              delay: i * 0.1,
            }}
            className="rounded-[32px] p-6 cursor-pointer transition-all duration-300 relative group active:scale-[0.98]"
            style={{
              background: "#fcf8f7",
              boxShadow: "10px 10px 20px #e5dfda, -10px -10px 20px #ffffff",
            }}
            onClick={() => router.push(card.href)}
          >
            <div className="flex flex-col items-start gap-4 mt-2">
              <div
                className="w-14 h-14 rounded-[16px] flex items-center justify-center"
                style={{
                  background: card.accent,
                  boxShadow:
                    "inset 4px 4px 8px #e5dfda, inset -4px -4px 8px #ffffff",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <span
                  className="material-symbols-outlined text-[32px]"
                  style={{
                    color: card.iconColor,
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  {card.icon}
                </span>
              </div>
              <div>
                <h2
                  className="text-[28px] font-bold mb-1"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-deep)",
                    textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                  }}
                >
                  {card.title}
                </h2>
                <p
                  className="text-[16px] leading-6"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-mid)",
                    opacity: 0.8,
                  }}
                >
                  {card.subtitle}
                </p>
              </div>
            </div>

            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span
                className="material-symbols-outlined"
                style={{ color: "var(--text-mid)" }}
              >
                arrow_forward
              </span>
            </div>
          </motion.div>
        ))}
      </main>
    </div>
  );
}
