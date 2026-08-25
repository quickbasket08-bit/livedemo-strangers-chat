import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  encodeSession,
  isValidUsername,
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

// Creates (or replaces) the username-only session cookie. No password, no
// Supabase Auth — the cookie itself, signed with SESSION_SECRET, is the
// identity for the lifetime of the visit.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";

  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username must be 2-24 characters: letters, numbers, underscores, or hyphens only.",
      },
      { status: 400 }
    );
  }

  const sessionId = randomUUID();
  const cookieValue = encodeSession({ sessionId, username });

  const res = NextResponse.json({ sessionId, username });
  res.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
