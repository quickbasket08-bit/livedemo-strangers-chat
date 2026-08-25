import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : null;
  if (!roomId) {
    return NextResponse.json({ error: "roomId required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, mode, user1_id, user2_id, ended_at")
    .eq("id", roomId)
    .single();

  if (!room || room.mode !== "video" || room.ended_at) {
    return NextResponse.json({ error: "Room not found or ended." }, { status: 404 });
  }
  if (room.user1_id !== session.sessionId && room.user2_id !== session.sessionId) {
    return NextResponse.json({ error: "Not a participant in this room." }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit is not configured." }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: `${session.sessionId}:${session.username}`,
    name: session.username,
    // Short-lived: just long enough for a chat session.
    ttl: "15m",
  });
  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // Room only ever has 2 participants; this keeps a stray third join from
    // happening if a room id somehow leaked.
    roomCreate: false,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL });
}
