import { MemoryShell } from "@/components/vault/MemoryShell";
import { MemoryList } from "@/components/vault/MemoryList";

export default function MemoriesPage() {
  return (
    <MemoryShell>
      <MemoryList />
    </MemoryShell>
  );
}
