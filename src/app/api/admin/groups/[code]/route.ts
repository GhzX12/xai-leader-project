import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { jsonError, readJson } from "@/lib/http";
import { db, logEvent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MODES = ["ai", "human", "hybrid"] as const;

/** Researcher assigns who answers a team: the AI manager, the human manager, or the human with AI drafts. */
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { code } = await params;
  const body = await readJson<{ managerMode: string }>(req);
  const mode = String(body.managerMode ?? "");
  if (!(MODES as readonly string[]).includes(mode)) return jsonError(400, "Mode manager tidak dikenal.");

  const supabase = db();
  const { data, error } = await supabase.from("groups").update({ manager_mode: mode }).eq("code", decodeURIComponent(code)).select("code, manager_mode").maybeSingle();
  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Kelompok tidak ditemukan.");

  const { data: session } = await supabase.from("sessions").select("id").eq("group_code", data.code).maybeSingle();
  if (session) await logEvent(session.id, "manager_mode_changed", { to: mode });
  return NextResponse.json({ code: data.code, managerMode: data.manager_mode });
}
