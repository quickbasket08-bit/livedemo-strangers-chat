import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ModeSelector from "@/components/ModeSelector";

export default function ModePage() {
  const session = getSession();
  if (!session) {
    redirect("/");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <ModeSelector username={session.username} />
    </main>
  );
}
