"use client";

export function GalleryPlaceholder() {
  return (
    <div className="flex flex-col gap-4">
      <header className="text-center mb-1">
        <h2
          className="text-[28px] mb-1"
          style={{ fontFamily: "var(--font-cursive)", color: "var(--primary)" }}
        >
          Gallery
        </h2>
        <p
          className="text-[14px] italic"
          style={{ fontFamily: "var(--font-serif-sc)", color: "var(--text-mid)" }}
        >
          A place for images and voices
        </p>
      </header>

      <div className="text-center mt-12">
        <span
          className="material-symbols-outlined text-[48px] mb-3 block"
          style={{ color: "var(--text-faint)" }}
        >
          photo_library
        </span>
        <p
          className="text-[14px] mb-2"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-mid)",
          }}
        >
          画廊还在布置中
        </p>
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-serif-sc)",
            color: "var(--text-faint)",
          }}
        >
          P2 阶段会支持图片、语音等多模态记忆
        </p>
      </div>
    </div>
  );
}
