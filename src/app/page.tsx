import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import UsernameForm from "@/components/UsernameForm";

export default function HomePage() {
  const session = getSession();
  if (session) {
    redirect("/mode");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Talk to a stranger</h1>
        <p className="mt-2 text-slate-400">Anonymous text & video chat. No sign-up.</p>
      </div>
      <UsernameForm />
    </main>
  );
}
