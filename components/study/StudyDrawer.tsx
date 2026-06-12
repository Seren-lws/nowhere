"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";

interface DrawerItem {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  iconColor: string;
  accent: string;
}

interface StudyDrawerProps {
  title: string;
  description: string;
  items: DrawerItem[];
}

export function StudyDrawer({ title, description, items }: StudyDrawerProps) {
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
              "linear-gradient(to bottom, rgba(252,248,247,0.5), rgba(245,235,225,0.4), rgba(252,248,247,0.6))",
            backdropFilter: "blur(3px)",
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
          onClick={() => router.back()}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: "#a07850" }}
          >
            arrow_back_ios
          </span>
        </button>
        <h1
          className="text-[24px] font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-deep)",
          }}
        >
          {title}
        </h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <main className="relative z-10 w-full max-w-[800px] mx-auto pt-28 pb-12 px-5 flex flex-col gap-6">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[15px] text-center mb-2"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-mid)",
          }}
        >
          {description}
        </motion.p>

        {items.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
              delay: i * 0.1,
            }}
            className="rounded-[28px] p-5 cursor-pointer transition-all duration-300 relative group active:scale-[0.98]"
            style={{
              background: "rgba(252,248,247,0.92)",
              boxShadow: "8px 8px 16px #e5dfda, -8px -8px 16px #ffffff, 0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
            onClick={() => router.push(item.href)}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0"
                style={{
                  background: item.accent,
                  boxShadow:
                    "inset 3px 3px 6px #e5dfda, inset -3px -3px 6px #ffffff",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <span
                  className="material-symbols-outlined text-[26px]"
                  style={{
                    color: item.iconColor,
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  {item.icon}
                </span>
              </div>
              <div className="flex-1">
                <h3
                  className="text-[20px] font-semibold"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-deep)",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  className="text-[14px] mt-0.5"
                  style={{
                    fontFamily: "var(--font-serif-sc)",
                    color: "var(--text-mid)",
                    opacity: 0.7,
                  }}
                >
                  {item.subtitle}
                </p>
              </div>
              <span
                className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-faint)" }}
              >
                arrow_forward_ios
              </span>
            </div>
          </motion.div>
        ))}
      </main>
    </div>
  );
}
