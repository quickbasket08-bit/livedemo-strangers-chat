import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key, which bypasses Row Level
// Security. NEVER import this file from a Client Component — it would leak
// the service_role key to the browser. Only use it inside route handlers
// (src/app/api/**/route.ts) and Server Components.
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
