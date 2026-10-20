import { NextResponse } from "next/server";
import { askLeader } from "@/lib/claude";
import { MAX_QUESTIONS_DB_GUARD } from "@/lib/experiment";
import { jsonError, readJson } from "@/lib/http";
import { currentSession, groupOf } from "@/lib/session";
import { db, logEvent } from "@/lib/supabase";
import { toChatMessage, type MessageRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 1500;

/** Tahap 2: one question from the team → one XAI Leader answer (split into bubbles). */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return jsonError(401, "Sesi berakhir. Silakan masuk kembali.");
  if (session.stage !== "workspace") return jsonError(409, "Sesi tanya jawab tidak aktif.");

  const body = await readJson<{ message: string }>(req);
  const question = String(body.message ?? "").trim();
  if (!question) return jsonError(400, "Pertanyaan tidak boleh kosong.");
  if (question.length > MAX_MESSAGE_CHARS) {
    return jsonError(400, `Pertanyaan terlalu panjang (maksimal ${MAX_MESSAGE_CHARS} karakter).`);
  }

  const supabase = db();

  // Claim one of the team's questions atomically; refunded below if no answer is delivered.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_question", {
    p_session: session.id,
    p_max: MAX_QUESTIONS_DB_GUARD,
  });
  if (claimError) return jsonError(500, "Gagal memproses kuota pertanyaan.");
  const questionNo = typeof claimed === "number" ? claimed : null;
  if (!questionNo) {
    return jsonError(409, "Sesi tanya jawab tidak aktif.");
  }
  const refund = () => supabase.rpc("release_question", { p_session: session.id });

  try {
    const [group, { data: history, error: historyError }] = await Promise.all([
      groupOf(session.group_code),
      supabase.from("messages").select("*").eq("session_id", session.id).order("id"),
    ]);
    if (historyError) throw new Error(historyError.message);

    const result = await askLeader({
      datasetVersion: group.dataset_version,
      groupCode: session.group_code,
      history: (history ?? []) as MessageRow[],
      questionNo,
      question,
    });

    if (result.kind === "refused") {
      await refund();
      await logEvent(session.id, "model_refusal", { question, category: result.category, ...result.metadata });
      return jsonError(422, "Pertanyaan ini tidak bisa diproses. Coba ubah kalimatnya sedikit, ya.", {
        questionsUsed: questionNo - 1,
      });
    }

    const { output, metadata } = result;
    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert([
        { session_id: session.id, role: "user", content: question, question_no: questionNo },
        {
          session_id: session.id,
          role: "assistant",
          content: output.bubbles.join("\n\n"),
          bubbles: output.bubbles,
          question_no: questionNo,
          mode: output.mode,
          refusal_code: output.refusal_code,
          confidence: output.confidence,
          metadata,
        },
      ])
      .select("*")
      .order("id");
    if (insertError || !inserted) throw new Error(insertError?.message ?? "insert failed");

    if (output.refusal_code !== "NONE") {
      await logEvent(session.id, output.refusal_code === "FORBIDDEN_REQUEST" ? "forbidden_request" : "jailbreak_attempt", {
        refusal_code: output.refusal_code,
        question_no: questionNo,
        excerpt: question.slice(0, 300),
        execution_id: metadata.execution_id,
      });
    }

    return NextResponse.json({
      messages: (inserted as MessageRow[]).map(toChatMessage),
      questionsUsed: questionNo,
    });
  } catch (err) {
    await refund();
    const message = err instanceof Error ? err.message : String(err);
    console.error("chat failed", message);
    await logEvent(session.id, "leader_error", { question_no: questionNo, message });
    return jsonError(502, "XAI Leader lagi sulit dihubungi. Coba kirim ulang sebentar lagi, ya.", {
      questionsUsed: questionNo - 1,
    });
  }
}
