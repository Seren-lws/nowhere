"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_PROFILE, loadProfile, saveProfile, type ChatProfile } from "@/lib/brain/profile";

/** 把选中的图片压缩成正方形 base64（256x256，居中裁切） */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("无法处理图片"));
        // 居中裁切成正方形
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("图片读取失败"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function AvatarPicker({
  label,
  name,
  avatar,
  onPick,
}: {
  label: string;
  name: string;
  avatar: string;
  onPick: (dataUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative w-20 h-20 rounded-full overflow-hidden active:scale-95 transition-transform"
        style={{
          border: "1px solid var(--card-border)",
          background: avatar ? "transparent" : "var(--input-bg)",
        }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center text-[26px]"
            style={{ color: "var(--accent-wisteria)" }}
          >
            {name.trim().slice(0, 1) || "?"}
          </span>
        )}
        <span
          className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-0.5"
          style={{ background: "rgba(0,0,0,0.35)", color: "white" }}
        >
          {busy ? "处理中" : "换头像"}
        </span>
      </button>
      <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const dataUrl = await compressImage(file);
            onPick(dataUrl);
          } catch {
            /* ignore */
          }
          setBusy(false);
        }}
      />
    </div>
  );
}

export function ProfileSettings() {
  const router = useRouter();
  const [p, setP] = useState<ChatProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setP(loadProfile());
  }, []);

  const update = (key: keyof ChatProfile, v: string) => {
    setP((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  };

  const onSave = () => {
    saveProfile(p);
    setSaved(true);
    window.setTimeout(() => router.back(), 600);
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: 11,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-deep)",
    fontFamily: "inherit",
  };

  return (
    <main
      className="min-h-[100dvh] w-full"
      style={{ background: "var(--bg-gradient)", color: "var(--text-deep)" }}
    >
      <div className="mx-auto w-full max-w-md px-5 py-7 pb-28">
        <header className="mb-6 flex items-center justify-between px-1">
          <h1 className="text-[19px] font-medium" style={{ letterSpacing: "3px", color: "var(--text-deep)" }}>
            头像 · 昵称
          </h1>
          <button
            onClick={() => router.back()}
            className="text-[13px] transition-opacity hover:opacity-70"
            style={{ color: "var(--accent-dusk)", letterSpacing: "1px", background: "none", border: "none", cursor: "pointer" }}
          >
            ‹ 返回
          </button>
        </header>

        <section
          className="mb-4 rounded-2xl p-6"
          style={{
            background: "var(--card-bg)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid var(--card-border)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          {/* 两个头像并排 */}
          <div className="flex justify-around mb-6">
            <AvatarPicker
              label="我"
              name={p.userName}
              avatar={p.userAvatar}
              onPick={(d) => update("userAvatar", d)}
            />
            <AvatarPicker
              label="他"
              name={p.companionName}
              avatar={p.companionAvatar}
              onPick={(d) => update("companionAvatar", d)}
            />
          </div>

          {/* 昵称 */}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px]" style={{ color: "var(--text-mid)", letterSpacing: "1px" }}>
                我的昵称
              </span>
              <input
                type="text"
                value={p.userName}
                onChange={(e) => update("userName", e.target.value)}
                placeholder="给自己起个名字"
                className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px]" style={{ color: "var(--text-mid)", letterSpacing: "1px" }}>
                他的昵称
              </span>
              <input
                type="text"
                value={p.companionName}
                onChange={(e) => update("companionName", e.target.value)}
                placeholder="他叫什么"
                className="w-full px-3.5 py-2.5 text-[13.5px] outline-none"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--input-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--input-border)")}
              />
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                会显示在客厅聊天的页头
              </span>
            </label>
          </div>
        </section>

        <p className="px-1 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
          头像和昵称都只存在你这台设备上。头像会自动压缩成小图，不会上传到云端。
        </p>
      </div>

      {/* 固定底部保存 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center py-4 px-5"
        style={{
          background: "linear-gradient(to top, rgba(252,247,242,0.95) 60%, rgba(252,247,242,0) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <button
          type="button"
          onClick={onSave}
          className="w-full max-w-md px-7 py-3 text-[14px] transition-all active:scale-[0.97]"
          style={{
            borderRadius: 16,
            border: "none",
            background: "linear-gradient(135deg, var(--blush) 0%, var(--accent-wisteria) 100%)",
            color: "rgba(255,255,255,.95)",
            letterSpacing: "2.5px",
            boxShadow: "0 4px 20px rgba(196,160,170,.3)",
            cursor: "pointer",
          }}
        >
          {saved ? "已保存 ✓" : "保存"}
        </button>
      </div>
    </main>
  );
}
