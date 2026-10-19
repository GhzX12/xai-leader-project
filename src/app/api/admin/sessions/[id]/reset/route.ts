import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { jsonError } from "@/lib/http";
import { db, PROPOSALS_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Delete a session (chat log, events, submission and its PDF) so the group code
 * can start fresh. Meant for pilot tests — this cannot be undone.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;

  const supabase = db();
  const { data: session } = await supabase.from("sessions").select("group_code").eq("id", id).maybeSingle();
  if (!session) return jsonError(404, "Sesi tidak ditemukan.");

  const storage = supabase.storage.from(PROPOSALS_BUCKET);
  const { data: files } = await storage.list(session.group_code);
  if (files?.length) await storage.remove(files.map((f) => `${session.group_code}/${f.name}`));

  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
