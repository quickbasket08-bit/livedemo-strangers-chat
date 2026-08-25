import crypto from "crypto";
import { cookies } from "next/headers";
import type { SessionData } from "@/types";

const COOKIE_NAME = "strangers_session";
const MAX_USERNAME_LENGTH = 24;
const USERNAME_PATTERN = /^[a-zA-Z0-9_\-]{2,24}$/;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET env var.");
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username) && username.length <= MAX_USERNAME_LENGTH;
}

/** Builds a signed "payload.signature" cookie value. Tamper-evident, not encrypted. */
export function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function decodeSession(cookieValue: string | undefined): SessionData | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null; // tampered or stale secret
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.sessionId === "string" && typeof data.username === "string") {
      return data as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie in a Server Component or Route Handler. */
export function getSession(): SessionData | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  return decodeSession(raw);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours
