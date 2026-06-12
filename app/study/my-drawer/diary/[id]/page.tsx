import { MyDiaryEditor } from "@/components/study/MyDiaryEditor";

export default async function EditDiaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MyDiaryEditor diaryId={id} />;
}
