"use client";

import "@livekit/components-styles";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import ReportButton from "@/components/ReportButton";

export default function VideoChatRoom({
  roomId,
  partnerName,
}: {
  roomId: string;
  partnerName: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/livekit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Could not join video room.");
        return;
      }
      setToken(data.token);
      setServerUrl(data.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`room:${roomId}`)
      .on("broadcast", { event: "peer_left" }, () => setPeerLeft(true))
      .subscribe();
    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [roomId]);

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

  const handleNext = useCallback(async () => {
    await fetch("/api/matchmaking/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, mode: "video" }),
    });
    router.push("/mode");
  }, [roomId, router]);

  const handleLeave = useCallback(async () => {
    await fetch("/api/matchmaking/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
    router.push("/mode");
  }, [roomId, router]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => router.push("/mode")}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950 z-10">
        <div>
          <p className="text-sm text-slate-400">Video chat with</p>
          <p className="font-medium">{partnerName}</p>
        </div>
        <div className="flex items-center gap-4">
          <ReportButton roomId={roomId} />
          <button onClick={handleLeave} className="text-sm text-slate-400 hover:text-slate-200">
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

      {peerLeft && (
        <div className="px-4 py-2 text-center text-sm text-amber-400 bg-amber-950/40 border-b border-amber-900">
          {partnerName} disconnected. Click Next to find someone new.
        </div>
      )}

      <div className="flex-1 min-h-0">
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect
          video
          audio
          data-lk-theme="default"
          style={{ height: "100%" }}
          onDisconnected={() => setPeerLeft(true)}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    </div>
  );
}
