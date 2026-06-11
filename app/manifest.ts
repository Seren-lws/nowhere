import type { MetadataRoute } from "next";

// PWA manifest：让家能"添加到主屏幕"，图标是那扇 No.0 的门。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nowhere",
    short_name: "nowhere",
    description: "There is nowhere like home — and he is now here.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eee9f0",
    theme_color: "#eee9f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
