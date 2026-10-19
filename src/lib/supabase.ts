import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PROPOSALS_BUCKET = "proposals";

let client: SupabaseClient | null = null;

/** Server-side Supabase client (service_role key, bypasses RLS). Never import from client code. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function logEvent(sessionId: string | null, type: string, payload?: unknown) {
  const { error } = await db().from("events").insert({ session_id: sessionId, type, payload: payload ?? null });
  if (error) console.error("logEvent failed", type, error.message);
}
