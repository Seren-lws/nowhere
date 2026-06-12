import { StudyDrawer } from "@/components/study/StudyDrawer";

const ITEMS = [
  {
    key: "diary",
    title: "我的日记",
    subtitle: "写给自己的话",
    icon: "edit_note",
    href: "/study/my-drawer/diary",
    iconColor: "#a07850",
    accent: "rgba(180,140,100,0.15)",
  },
  {
    key: "favorites",
    title: "我的收藏",
    subtitle: "值得反复翻看的",
    icon: "bookmark",
    href: "/study/my-drawer/favorites",
    iconColor: "#c4956a",
    accent: "rgba(196,149,106,0.12)",
  },
];

export default function MyDrawerPage() {
  return (
    <StudyDrawer
      title="我的抽屉"
      description="这是你的私人角落，只有你能打开。"
      items={ITEMS}
    />
  );
}
