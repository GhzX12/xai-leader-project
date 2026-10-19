import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { currentSession } from "@/lib/session";
import { buildState } from "@/lib/state";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session) return jsonError(401, "Belum masuk.");
  await db().from("sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);
  return NextResponse.json(await buildState(session));
}
