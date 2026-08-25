"use client";

import { createClient } from "@supabase/supabase-js";

// Browser client using the public anon key. This is only ever used for
// Supabase Realtime *broadcast* channels (room:<roomId>) — it never reads or
// writes any table directly, so the anon key doesn't need any table grants.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabaseBrowser = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
