import { MyDiaryDetail } from "@/components/study/MyDiaryDetail";

export default async function DiaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MyDiaryDetail diaryId={id} />;
}
