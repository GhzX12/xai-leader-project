import "server-only";
import { cookies } from "next/headers";
import { db } from "./supabase";
import type { SessionRow } from "./types";

export const SESSION_COOKIE = "xai_session";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours — one experiment sitting

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setSessionCookie(accessToken: string) {
  (await cookies()).set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The participant session bound to this browser, or null. */
export async function currentSession(): Promise<SessionRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !UUID_RE.test(token)) return null;
  const { data, error } = await db().from("sessions").select("*").eq("access_token", token).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionRow | null) ?? null;
}

export async function groupOf(
  code: string,
): Promise<{ dataset_version: number; group_name: string; session_no: number; class_name: string | null }> {
  const { data, error } = await db()
    .from("groups")
    .select("dataset_version, group_name, session_no, class_name")
    .eq("code", code)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
