import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

// Polled every ~1.5s by the waiting-room UI. Returns { roomId: null } while
// waiting, or { roomId } once matched. Also returns the room's mode so the
// client knows whether to route to /chat/text/[roomId] or /chat/video/[roomId].
export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data: roomId, error } = await supabase.rpc("find_match", {
    p_session_id: session.sessionId,
  });

  if (error) {
    console.error("find_match error", error);
    return NextResponse.json({ error: "Matchmaking error." }, { status: 500 });
  }

  if (!roomId) {
    return NextResponse.json({ roomId: null });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, mode")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ roomId: null });
  }

  return NextResponse.json({ roomId: room.id, mode: room.mode });
}
