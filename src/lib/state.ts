import "server-only";
import { DATASETS } from "./datasets";
import { groupOf } from "./session";
import { db } from "./supabase";
import { toChatMessage, type AppState, type MessageRow, type SessionRow, type SubmissionRow } from "./types";

/** Everything the participant page needs. The dataset version number itself is never sent. */
export async function buildState(session: SessionRow): Promise<AppState> {
  const supabase = db();
  const [group, { data: messages, error: msgError }, { data: submission, error: subError }] = await Promise.all([
    groupOf(session.group_code),
    supabase.from("messages").select("*").eq("session_id", session.id).order("id"),
    supabase.from("submissions").select("*").eq("session_id", session.id).maybeSingle(),
  ]);
  if (msgError) throw new Error(msgError.message);
  if (subError) throw new Error(subError.message);
  const sub = submission as SubmissionRow | null;

  return {
    groupCode: session.group_code,
    groupName: group.group_name,
    className: group.class_name,
    picName: session.pic_name,
    sessionLabel: session.session_label,
    stage: session.stage,
    questionsUsed: session.questions_used,
    dataset: session.stage === "briefing" ? [] : DATASETS[group.dataset_version],
    messages: ((messages ?? []) as MessageRow[]).map(toChatMessage),
    submission: sub ? { fileName: sub.file_name, pageCount: sub.page_count, submittedAt: sub.submitted_at } : null,
  };
}
