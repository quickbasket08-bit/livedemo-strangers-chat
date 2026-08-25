import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "No session. Pick a username first." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const mode = body?.mode;
  if (mode !== "text" && mode !== "video") {
    return NextResponse.json({ error: "mode must be 'text' or 'video'." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.rpc("join_queue", {
    p_session_id: session.sessionId,
    p_username: session.username,
    p_mode: mode,
  });

  if (error) {
    console.error("join_queue error", error);
    return NextResponse.json({ error: "Could not join queue." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
