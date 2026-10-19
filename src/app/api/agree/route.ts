import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { currentSession } from "@/lib/session";
import { buildState } from "@/lib/state";
import { db, logEvent } from "@/lib/supabase";
import type { SessionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Tahap 2: the group ticked "Saya mengerti dan setuju" on the briefing screen. */
export async function POST() {
  const session = await currentSession();
  if (!session) return jsonError(401, "Sesi berakhir. Silakan masuk kembali.");
  if (session.stage !== "briefing") return NextResponse.json(await buildState(session));

  const { data, error } = await db()
    .from("sessions")
    .update({ stage: "workspace", agreed_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("stage", "briefing")
    .select("*")
    .maybeSingle();
  if (error) return jsonError(500, "Gagal menyimpan persetujuan.");
  await logEvent(session.id, "agreed");
  const fresh = (data as SessionRow | null) ?? (await currentSession()) ?? session;
  return NextResponse.json(await buildState(fresh));
}
