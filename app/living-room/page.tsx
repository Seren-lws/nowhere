import { Suspense } from "react";
import { LivingRoom } from "@/components/livingroom/LivingRoom";

export default function LivingRoomPage() {
  return (
    <Suspense>
      <LivingRoom />
    </Suspense>
  );
}
