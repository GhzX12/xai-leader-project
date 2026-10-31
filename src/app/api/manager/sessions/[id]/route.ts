import { NextResponse } from "next/server";
import { DATASETS } from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { currentManager, isHumanMode, unansweredOf } from "@/lib/manager";
import { db } from "@/lib/supabase";
import type { MessageRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** One conversation for the manager: messages, who is in the team and the data table the team is looking at. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const manager = await currentManager();
  if (!manager) return jsonError(401, "Sesi manager berakhir. Silakan masuk lagi.");
  const { id } = await params;

  const supabase = db();
  const { data: session, error } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) return jsonError(500, error.message);
  if (!session) return jsonError(404, "Sesi tidak ditemukan.");
  const { data: group } = await supabase.from("groups").select("*").eq("code", session.group_code).single();
  if (!group || !isHumanMode(group.manager_mode)) return jsonError(403, "Kelompok ini tidak dijawab oleh manager manusia.");

  const { data: messages, error: mErr } = await supabase.from("messages").select("*").eq("session_id", id).order("id");
  if (mErr) return jsonError(500, mErr.message);
  const list = (messages ?? []) as MessageRow[];

  const { data: teamRow } = await supabase.from("teams").select("id").eq("team_code", group.group_name).maybeSingle();
  const members = teamRow
    ? (((await supabase.from("members").select("name, gender").eq("team_id", teamRow.id).order("id")).data ?? []) as {
        name: string;
        gender: string | null;
      }[])
    : [];

  const { pending } = unansweredOf(list);
  const sinceId = Number(new URL(req.url).searchParams.get("after") ?? 0);

  return NextResponse.json({
    session: {
      id: session.id,
      picName: session.pic_name,
      stage: session.stage,
      questionsUsed: session.questions_used,
      sessionLabel: session.session_label,
    },
    group: {
      code: group.code,
      name: group.group_name,
      className: group.class_name,
      mode: group.manager_mode,
      datasetVersion: group.dataset_version,
    },
    members,
    dataset: DATASETS[group.dataset_version] ?? [],
    unanswered: pending.length,
    waitingSince: pending[0]?.created_at ?? null,
    messages: list
      .filter((m) => m.id > sinceId)
      .map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        bubbles: m.role === "assistant" ? (m.bubbles ?? [m.content]) : [m.content],
        questionNo: m.question_no,
        author: m.author,
        createdAt: m.created_at,
      })),
  });
}
