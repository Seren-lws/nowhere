import { redirect } from "next/navigation";

// 根路径即"门口"：打开应用直接走向入口。功能后续在 /entrance 落地。
export default function Home() {
  redirect("/entrance");
}
