import { Suspense } from "react";
import { IntimateChat } from "@/components/bedroom/IntimateChat";

export default function IntimateChatPage() {
  return (
    <Suspense>
      <IntimateChat />
    </Suspense>
  );
}
