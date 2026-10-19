import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { DATASETS } from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { db, PROPOSALS_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Full detail of one session: transcript, research events, submission + download link, grading. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;

  const supabase = db();
  const { data: session, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) return jsonError(500, error.message);
  if (!session) return jsonError(404, "Sesi tidak ditemukan.");

  const [group, messages, events, submission] = await Promise.all([
    supabase.from("groups").select("*").eq("code", session.group_code).single(),
    supabase.from("messages").select("*").eq("session_id", id).order("id"),
    supabase.from("events").select("*").eq("session_id", id).order("id"),
    supabase.from("submissions").select("*").eq("session_id", id).maybeSingle(),
  ]);

  let downloadUrl: string | null = null;
  if (submission.data) {
    const signed = await supabase.storage
      .from(PROPOSALS_BUCKET)
      .createSignedUrl(submission.data.file_path, 60 * 60, {
        download: `${session.group_code}-${submission.data.file_name ?? "proposal.pdf"}`,
      });
    downloadUrl = signed.data?.signedUrl ?? null;
  }

  return NextResponse.json({
    session,
    group: group.data,
    dataset: group.data ? DATASETS[group.data.dataset_version] : [],
    messages: messages.data ?? [],
    events: events.data ?? [],
    submission: submission.data,
    downloadUrl,
  });
}
