"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import ReportButton from "@/components/ReportButton";
import type { MessageRow } from "@/types";

export default function TextChatRoom({
  roomId,
  myId,
  myName,
  partnerName,
}: {
  roomId: string;
  myId: string;
  myName: string;
  partnerName: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [peerLeft, setPeerLeft] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`room:${roomId}`)
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as MessageRow]);
      })
      .on("broadcast", { event: "peer_left" }, () => {
        setPeerLeft(true);
      })
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function handleUnload() {
      navigator.sendBeacon?.(
        "/api/matchmaking/leave",
        new Blob([JSON.stringify({ roomId })], { type: "application/json" })
      );
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [roomId]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, content }),
    });
    if (res.ok) {
      const { message } = await res.json();
      setMessages((prev) => [...prev, message as MessageRow]);
    }
    setSending(false);
  }

  async function handleNext() {
    await fetch("/api/matchmaking/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, mode: "text" }),
    });
    router.push("/mode");
  }

  async function handleLeave() {
    await fetch("/api/matchmaking/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
    router.push("/mode");
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <p className="text-sm text-slate-400">Chatting with</p>
          <p className="font-medium">{partnerName}</p>
        </div>
        <div className="flex items-center gap-4">
          <ReportButton roomId={roomId} />
          <button
            onClick={handleLeave}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Leave
          </button>
          <button
            onClick={handleNext}
            className="text-sm rounded-lg bg-brand-600 hover:bg-brand-700 px-3 py-1.5 font-medium"
          >
            Next
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-500 mt-8">
            Say hi to {partnerName} 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {peerLeft && (
        <div className="px-4 py-2 text-center text-sm text-amber-400 bg-amber-950/40 border-t border-amber-900">
          {partnerName} disconnected. Click Next to find someone new.
        </div>
      )}

      <form onSubmit={sendMessage} className="flex gap-2 p-3 border-t border-slate-800">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={peerLeft ? "Stranger left the chat" : "Type a message…"}
          disabled={peerLeft}
          maxLength={2000}
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={peerLeft || !draft.trim()}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-4 py-2 text-sm font-medium"
        >
          Send
        </button>
      </form>
    </div>
  );
}
