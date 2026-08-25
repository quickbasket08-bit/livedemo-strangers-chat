import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

// Very small in-memory throttle: max 5 messages / 3 seconds per session.
// Good enough to stop a runaway client loop; for real spam protection put
// this behind a durable store (Redis / Upstash) since this resets on
// every server restart / cold start / instance.
const recentSends = new Map<string, number[]>();
const WINDOW_MS = 3000;
const MAX_IN_WINDOW = 5;

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const timestamps = (recentSends.get(sessionId) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  recentSends.set(sessionId, timestamps);
  return timestamps.length > MAX_IN_WINDOW;
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  if (isRateLimited(session.sessionId)) {
    return NextResponse.json({ error: "You're sending messages too fast." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!roomId || !content || content.length > 2000) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }

  const supabase = supabaseServer();

  // Confirm this session is actually a participant in this (still active) room.
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, user1_id, user2_id, ended_at")
    .eq("id", roomId)
    .single();

  if (roomError || !room || room.ended_at) {
    return NextResponse.json({ error: "This chat has ended." }, { status: 410 });
  }
  if (room.user1_id !== session.sessionId && room.user2_id !== session.sessionId) {
    return NextResponse.json({ error: "Not a participant in this room." }, { status: 403 });
  }

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: session.sessionId,
      username: session.username,
      content,
    })
    .select()
    .single();

  if (insertError || !message) {
    console.error("insert message error", insertError);
    return NextResponse.json({ error: "Could not send message." }, { status: 500 });
  }

  // Broadcast to both participants over the room's realtime channel.
  const channel = supabase.channel(`room:${roomId}`);
  await channel.send({
    type: "broadcast",
    event: "message",
    payload: message,
  });
  await supabase.removeChannel(channel);

  return NextResponse.json({ ok: true, message });
}
