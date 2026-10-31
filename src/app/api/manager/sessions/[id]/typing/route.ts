import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { currentManager } from "@/lib/manager";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TYPING_TTL_MS = 6000;

/** Heartbeat while the manager types, so the team sees a typing indicator. Sent every ~2s; expires on its own. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const manager = await currentManager();
  if (!manager) return jsonError(401, "Sesi manager berakhir. Silakan masuk lagi.");
  const { id } = await params;
  const body = await readJson<{ active: boolean }>(req);
  const until = body.active === false ? null : new Date(Date.now() + TYPING_TTL_MS).toISOString();
  const { error } = await db().from("sessions").update({ manager_typing_until: until }).eq("id", id);
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
