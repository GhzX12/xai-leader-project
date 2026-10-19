import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { jsonError } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Overview: every group code, with its session progress and grading status (if any). */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const supabase = db();
  const [groups, sessions, submissions] = await Promise.all([
    supabase.from("groups").select("*").order("session_no").order("group_name"),
    supabase
      .from("sessions")
      .select("id, group_code, pic_name, stage, questions_used, started_at, agreed_at, submitted_at, last_seen_at"),
    supabase.from("submissions").select("session_id, grading_status, grading, page_count, submitted_at"),
  ]);
  if (groups.error || sessions.error || submissions.error) return jsonError(500, "Gagal memuat data.");

  const subBySession = new Map(submissions.data.map((s) => [s.session_id, s]));
  const sessionByCode = new Map(sessions.data.map((s) => [s.group_code, s]));

  const rows = groups.data.map((g) => {
    const s = sessionByCode.get(g.code);
    const sub = s ? subBySession.get(s.id) : undefined;
    const grading = (sub?.grading ?? null) as { TotalScore?: number; CampaignChosen?: string } | null;
    return {
      code: g.code,
      datasetVersion: g.dataset_version,
      active: g.active,
      session: s ?? null,
      submission: sub
        ? {
            gradingStatus: sub.grading_status,
            pageCount: sub.page_count,
            submittedAt: sub.submitted_at,
            totalScore: grading?.TotalScore ?? null,
            campaignChosen: grading?.CampaignChosen ?? null,
          }
        : null,
    };
  });
  return NextResponse.json({ rows });
}
