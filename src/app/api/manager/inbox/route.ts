import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { currentManager, unansweredOf } from "@/lib/manager";
import { db } from "@/lib/supabase";
import type { MessageRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Every conversation the human manager handles (teams set to "human" or "hybrid"), with what is waiting for an answer. */
export async function GET() {
  const manager = await currentManager();
  if (!manager) return jsonError(401, "Sesi manager berakhir. Silakan masuk lagi.");

  const supabase = db();
  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("code, group_name, class_name, manager_mode, dataset_version")
    .eq("active", true)
    .in("manager_mode", ["human", "hybrid"]);
  if (gErr) return jsonError(500, "Gagal memuat daftar kelompok.");

  const codes = (groups ?? []).map((g) => g.code as string);
  const { data: sessions, error: sErr } = codes.length
    ? await supabase
        .from("sessions")
        .select("id, group_code, pic_name, stage, questions_used, started_at, last_seen_at")
        .in("group_code", codes)
    : { data: [], error: null };
  if (sErr) return jsonError(500, "Gagal memuat sesi.");

  const ids = (sessions ?? []).map((s) => s.id as string);
  const { data: msgs, error: mErr } = ids.length
    ? await supabase.from("messages").select("id, session_id, role, content, created_at").in("session_id", ids).order("id")
    : { data: [], error: null };
  if (mErr) return jsonError(500, "Gagal memuat percakapan.");

  const bySession = new Map<string, MessageRow[]>();
  for (const m of (msgs ?? []) as MessageRow[]) {
    if (!bySession.has(m.session_id)) bySession.set(m.session_id, []);
    bySession.get(m.session_id)!.push(m);
  }
  const groupByCode = new Map((groups ?? []).map((g) => [g.code as string, g]));

  const items = (sessions ?? []).map((s) => {
    const g = groupByCode.get(s.group_code as string)!;
    const list = bySession.get(s.id as string) ?? [];
    const { pending } = unansweredOf(list);
    const last = list[list.length - 1];
    return {
      sessionId: s.id as string,
      groupCode: s.group_code as string,
      groupName: g.group_name as string,
      className: g.class_name as string | null,
      mode: g.manager_mode as string,
      picName: s.pic_name as string,
      stage: s.stage as string,
      questionsUsed: s.questions_used as number,
      unanswered: pending.length,
      waitingSince: pending[0]?.created_at ?? null,
      lastRole: last?.role ?? null,
      lastPreview: last ? last.content.slice(0, 140) : null,
      lastAt: last?.created_at ?? (s.started_at as string),
    };
  });

  const started = new Set((sessions ?? []).map((s) => s.group_code as string));
  const notStarted = (groups ?? [])
    .filter((g) => !started.has(g.code as string))
    .map((g) => ({ groupName: g.group_name as string, className: g.class_name as string | null, mode: g.manager_mode as string }));

  return NextResponse.json({ managerId: manager, now: new Date().toISOString(), items, notStarted });
}
