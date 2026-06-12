import { StudyDrawer } from "@/components/study/StudyDrawer";

const ITEMS = [
  {
    key: "diary",
    title: "他的日记",
    subtitle: "他悄悄写下的心事",
    icon: "menu_book",
    href: "/study/his-drawer/diary",
    iconColor: "var(--primary)",
    accent: "rgba(123,84,85,0.12)",
  },
  {
    key: "favorites",
    title: "他的收藏",
    subtitle: "他觉得重要的瞬间",
    icon: "favorite",
    href: "/study/his-drawer/favorites",
    iconColor: "#d4a5a5",
    accent: "rgba(212,165,165,0.12)",
  },
];

export default function HisDrawerPage() {
  return (
    <StudyDrawer
      title="他的抽屉"
      description="这是他的角落。他说你可以随时翻看。"
      items={ITEMS}
    />
  );
}
