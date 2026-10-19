import "server-only";
import { gradeProposal } from "./claude";
import { db, logEvent, PROPOSALS_BUCKET } from "./supabase";
import type { MessageRow, SessionRow, SubmissionRow } from "./types";

/** Grades one session's submitted PDF and stores the result on the submission row. */
export async function runGrading(sessionId: string) {
  const supabase = db();

  const [{ data: session }, { data: submission }, { data: messages }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).single(),
    supabase.from("submissions").select("*").eq("session_id", sessionId).single(),
    supabase.from("messages").select("*").eq("session_id", sessionId).order("id"),
  ]);
  if (!session || !submission) throw new Error("Sesi atau submission tidak ditemukan.");
  const s = session as SessionRow;
  const sub = submission as SubmissionRow;

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("group_name, dataset_version")
    .eq("code", s.group_code)
    .single();
  if (groupError || !group) throw new Error(groupError?.message ?? "Kode kelompok tidak ditemukan.");

  await supabase
    .from("submissions")
    .update({ grading_status: "running", grading_error: null })
    .eq("id", sub.id);

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from(PROPOSALS_BUCKET)
      .download(sub.file_path);
    if (downloadError || !file) throw new Error(downloadError?.message ?? "PDF tidak bisa diunduh.");
    const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const grading = await gradeProposal({
      pdfBase64,
      groupCode: s.group_code,
      groupName: group.group_name,
      picName: s.pic_name,
      datasetVersion: group.dataset_version,
      history: (messages ?? []) as MessageRow[],
      questionsUsed: s.questions_used,
      pageCount: sub.page_count,
    });

    await supabase
      .from("submissions")
      .update({ grading_status: "done", grading, graded_at: new Date().toISOString() })
      .eq("id", sub.id);
    await logEvent(sessionId, "graded", { total: grading.TotalScore, execution_id: grading.ExecutionID });
    return grading;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("submissions")
      .update({ grading_status: "error", grading_error: message })
      .eq("id", sub.id);
    await logEvent(sessionId, "grading_error", { message });
    throw err;
  }
}
