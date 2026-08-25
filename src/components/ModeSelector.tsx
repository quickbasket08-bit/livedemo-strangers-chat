"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMode } from "@/types";

const POLL_INTERVAL_MS = 1500;

export default function ModeSelector({ username }: { username: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<ChatMode | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "waiting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startMatchmaking(selected: ChatMode) {
    setMode(selected);
    setStatus("joining");
    setErrorMsg(null);

    const joinRes = await fetch("/api/matchmaking/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: selected }),
    });

    if (!joinRes.ok) {
      setStatus("error");
      setErrorMsg("Could not join the queue. Please try again.");
      return;
    }

    setStatus("waiting");
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/matchmaking/poll");
        if (!res.ok) return;
        const data = await res.json();
        if (data.roomId) {
          if (pollRef.current) clearInterval(pollRef.current);
          router.push(`/chat/${data.mode}/${data.roomId}`);
        }
      } catch {
        // transient network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  async function cancelWaiting() {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setMode(null);
    await fetch("/api/matchmaking/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  if (status === "waiting" || status === "joining") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        <p className="text-slate-300">
          Finding a stranger for {mode === "video" ? "video" : "text"} chat…
        </p>
        <button
          onClick={cancelWaiting}
          className="text-sm text-slate-400 hover:text-slate-200 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <p className="text-center text-slate-400">
        Hey <span className="text-slate-200 font-medium">{username}</span>, how do you want to chat?
      </p>
      {errorMsg && <p className="text-sm text-red-400 text-center">{errorMsg}</p>}
      <button
        onClick={() => startMatchmaking("text")}
        className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 transition-colors"
      >
        💬 Text chat
      </button>
      <button
        onClick={() => startMatchmaking("video")}
        className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-3 transition-colors"
      >
        🎥 Video chat
      </button>
    </div>
  );
}
