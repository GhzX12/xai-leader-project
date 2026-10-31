import { NextResponse } from "next/server";
import { askLeader } from "@/lib/claude";
import { jsonError } from "@/lib/http";
import { currentManager, unansweredOf } from "@/lib/manager";
import { db, logEvent } from "@/lib/supabase";
import type { MessageRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hybrid mode: the AI manager writes a draft answer to what the team asked; the human reviews, edits or sends it. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const manager = await currentManager();
  if (!manager) return jsonError(401, "Sesi manager berakhir. Silakan masuk lagi.");
  const { id } = await params;

  const supabase = db();
  const { data: session } = await supabase.from("sessions").select("id, group_code").eq("id", id).maybeSingle();
  if (!session) return jsonError(404, "Sesi tidak ditemukan.");
  const { data: group } = await supabase
    .from("groups")
    .select("manager_mode, dataset_version")
    .eq("code", session.group_code)
    .single();
  if (!group || group.manager_mode !== "hybrid") return jsonError(403, "Draf AI hanya tersedia untuk kelompok mode Human + AI.");

  const { data: messages, error } = await supabase.from("messages").select("*").eq("session_id", id).order("id");
  if (error) return jsonError(500, error.message);
  const { pending, history } = unansweredOf((messages ?? []) as MessageRow[]);
  if (pending.length === 0) return jsonError(409, "Belum ada pertanyaan yang perlu dijawab.");

  try {
    const result = await askLeader({
      datasetVersion: group.dataset_version,
      groupCode: session.group_code,
      history,
      questionNo: pending[pending.length - 1].question_no ?? pending.length,
      question: pending.map((m) => m.content).join("\n"),
    });
    if (result.kind === "refused") return jsonError(422, "AI menolak membuat draf untuk pertanyaan ini. Tulis balasan sendiri.");
    await logEvent(id, "ai_draft_created", { manager_id: manager, mode: result.output.mode, execution_id: result.metadata.execution_id });
    return NextResponse.json({
      bubbles: result.output.bubbles,
      mode: result.output.mode,
      refusalCode: result.output.refusal_code,
      confidence: result.output.confidence,
      forQuestionIds: pending.map((m) => m.id),
    });
  } catch (err) {
    console.error("draft failed", err instanceof Error ? err.message : err);
    return jsonError(502, "Draf AI gagal dibuat. Coba lagi atau tulis balasan sendiri.");
  }
}
