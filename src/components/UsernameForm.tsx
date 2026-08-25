"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("You must confirm you're 18+ and accept the rules to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push("/mode");
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
          Pick a username
        </label>
        <input
          id="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. blue_fox_92"
          maxLength={24}
          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I confirm I am 18 years or older and agree to the{" "}
          <a href="/terms" className="underline hover:text-slate-300" target="_blank">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-slate-300" target="_blank">
            Privacy Policy
          </a>
          . No nudity, harassment, or illegal content.
        </span>
      </label>
      <button
        type="submit"
        disabled={loading || username.trim().length < 2 || !agreed}
        className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 transition-colors"
      >
        {loading ? "Continuing…" : "Continue"}
      </button>
      <p className="text-xs text-slate-500">
        No email, no password. Your username is only used for this session and is
        shown to whoever you get matched with.
      </p>
    </form>
  );
}
