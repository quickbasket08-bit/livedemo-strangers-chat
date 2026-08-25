import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

// Leaves the queue (waiting room) and/or ends an active room.
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : null;

  const supabase = supabaseServer();
  await supabase.rpc("leave_queue", { p_session_id: session.sessionId });

  if (roomId) {
    await supabase.rpc("end_room", {
      p_room_id: roomId,
      p_session_id: session.sessionId,
    });
    const channel = supabase.channel(`room:${roomId}`);
    await channel.send({ type: "broadcast", event: "peer_left", payload: {} });
    await supabase.removeChannel(channel);
  }

  return NextResponse.json({ ok: true });
}
