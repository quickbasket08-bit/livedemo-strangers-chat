import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

// "Next": end the current room (if any) and immediately re-join the queue
// for the same mode, so the waiting-room polling can find a new partner.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : null;
  const mode = body?.mode;
  if (mode !== "text" && mode !== "video") {
    return NextResponse.json({ error: "mode must be 'text' or 'video'." }, { status: 400 });
  }

  const supabase = supabaseServer();

  if (roomId) {
    await supabase.rpc("end_room", {
      p_room_id: roomId,
      p_session_id: session.sessionId,
    });
    const channel = supabase.channel(`room:${roomId}`);
    await channel.send({ type: "broadcast", event: "peer_left", payload: {} });
    await supabase.removeChannel(channel);
  }

  const { error } = await supabase.rpc("join_queue", {
    p_session_id: session.sessionId,
    p_username: session.username,
    p_mode: mode,
  });

  if (error) {
    console.error("join_queue (next) error", error);
    return NextResponse.json({ error: "Could not re-join queue." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
