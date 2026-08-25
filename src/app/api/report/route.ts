import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

const VALID_REASONS = [
  "nudity_or_sexual_content",
  "harassment_or_hate_speech",
  "underage_user",
  "spam_or_scam",
  "violence_or_threats",
  "other",
] as const;

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : null;
  const reason = body?.reason;
  const details = typeof body?.details === "string" ? body.details.slice(0, 1000) : null;
  const alsoBlock = Boolean(body?.block);

  if (!roomId || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, user1_id, user1_name, user2_id, user2_name")
    .eq("id", roomId)
    .single();

  if (!room || (room.user1_id !== session.sessionId && room.user2_id !== session.sessionId)) {
    return NextResponse.json({ error: "Not a participant in this room." }, { status: 403 });
  }

  const reportedId = room.user1_id === session.sessionId ? room.user2_id : room.user1_id;
  const reportedName = room.user1_id === session.sessionId ? room.user2_name : room.user1_name;

  const { error: insertError } = await supabase.from("reports").insert({
    room_id: roomId,
    reporter_id: session.sessionId,
    reporter_name: session.username,
    reported_id: reportedId,
    reported_name: reportedName,
    reason,
    details,
  });

  if (insertError) {
    console.error("insert report error", insertError);
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }

  if (alsoBlock) {
    await supabase
      .from("blocks")
      .upsert(
        { blocker_id: session.sessionId, blocked_id: reportedId },
        { onConflict: "blocker_id,blocked_id" }
      );
  }

  return NextResponse.json({ ok: true });
}
