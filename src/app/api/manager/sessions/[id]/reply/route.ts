import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { currentManager, isHumanMode, toBubbles, unansweredOf } from "@/lib/manager";
import { db, logEvent } from "@/lib/supabase";
import { toChatMessage, type MessageRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_REPLY_CHARS = 3000;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * The human manager answers a team in real time. When an AI draft was used (hybrid mode) we record whether it was
 * sent as is or edited first, so the research data shows exactly who wrote what.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const manager = await currentManager();
  if (!manager) return jsonError(401, "Sesi manager berakhir. Silakan masuk lagi.");
  const { id } = await params;

  const body = await readJson<{ text: string; draft: string[] | null }>(req);
  const text = String(body.text ?? "").trim();
  if (!text) return jsonError(400, "Balasan tidak boleh kosong.");
  if (text.length > MAX_REPLY_CHARS) return jsonError(400, `Balasan terlalu panjang (maksimal ${MAX_REPLY_CHARS} karakter).`);

  const supabase = db();
  const { data: session } = await supabase.from("sessions").select("id, group_code").eq("id", id).maybeSingle();
  if (!session) return jsonError(404, "Sesi tidak ditemukan.");
  const { data: group } = await supabase.from("groups").select("manager_mode").eq("code", session.group_code).single();
  if (!group || !isHumanMode(group.manager_mode)) return jsonError(403, "Kelompok ini tidak dijawab oleh manager manusia.");

  const { data: messages, error } = await supabase.from("messages").select("*").eq("session_id", id).order("id");
  if (error) return jsonError(500, error.message);
  const list = (messages ?? []) as MessageRow[];
  const { pending } = unansweredOf(list);
  const lastQuestion = [...list].reverse().find((m) => m.role === "user");

  const draft = group.manager_mode === "hybrid" && Array.isArray(body.draft) && body.draft.length ? body.draft.map(String) : null;
  const bubbles = toBubbles(text);
  const author = !draft ? "human" : flat(bubbles.join(" ")) === flat(draft.join(" ")) ? "human_ai_sent" : "human_ai_edited";
  const responseMs = pending[0] ? Date.now() - new Date(pending[0].created_at).getTime() : null;

  const { data: row, error: insertError } = await supabase
    .from("messages")
    .insert({
      session_id: id,
      role: "assistant",
      content: bubbles.join("\n\n"),
      bubbles,
      question_no: lastQuestion?.question_no ?? null,
      author,
      metadata: { source: author, manager_id: manager, ai_draft: draft, response_ms: responseMs, answered_questions: pending.length },
    })
    .select("*")
    .single();
  if (insertError || !row) return jsonError(500, insertError?.message ?? "Gagal mengirim balasan.");

  await supabase.from("sessions").update({ manager_typing_until: null }).eq("id", id);
  await logEvent(id, "manager_reply", { author, response_ms: responseMs, bubbles: bubbles.length });

  return NextResponse.json({ message: toChatMessage(row as MessageRow), author });
}
