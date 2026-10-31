import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { checkManagerCredentials, setManagerCookie } from "@/lib/manager";
import { logEvent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Best-effort brute-force guard (per server instance): 8 wrong attempts per IP per 10 minutes.
const WINDOW = 10 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map<string, { count: number; since: number }>();

export async function POST(req: Request) {
  const body = await readJson<{ managerId: string; password: string }>(req);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const f = fails.get(ip);
  if (f && Date.now() - f.since <= WINDOW && f.count >= MAX_FAILS) {
    return jsonError(429, "Terlalu banyak percobaan. Tunggu beberapa menit.");
  }
  if (!process.env.MANAGER_ID || !process.env.MANAGER_PASSWORD) {
    return jsonError(500, "MANAGER_ID / MANAGER_PASSWORD belum di-set di environment variables.");
  }
  const id = String(body.managerId ?? "");
  const pw = String(body.password ?? "");
  if (!checkManagerCredentials(id, pw)) {
    const cur = fails.get(ip);
    if (!cur || Date.now() - cur.since > WINDOW) fails.set(ip, { count: 1, since: Date.now() });
    else cur.count++;
    return jsonError(401, "Manager ID atau password salah.");
  }
  fails.delete(ip);
  await setManagerCookie(process.env.MANAGER_ID!);
  await logEvent(null, "manager_login", { manager_id: process.env.MANAGER_ID });
  return NextResponse.json({ ok: true, managerId: process.env.MANAGER_ID });
}
