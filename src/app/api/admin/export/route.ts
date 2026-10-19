import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { jsonError } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * ?format=json (default): every table, for analysis.
 * ?format=csv: one row per group with the grading result (Google Sheets friendly).
 */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const supabase = db();
  const [groups, sessions, messages, events, submissions] = await Promise.all([
    supabase.from("groups").select("*").order("code"),
    supabase.from("sessions").select("*"),
    supabase.from("messages").select("*").order("id"),
    supabase.from("events").select("*").order("id"),
    supabase.from("submissions").select("*"),
  ]);
  for (const r of [groups, sessions, messages, events, submissions]) {
    if (r.error) return jsonError(500, r.error.message);
  }

  if (format === "csv") {
    const header = [
      "GroupCode", "PIC", "DatasetVersion", "Stage", "QuestionsUsed", "JailbreakFlags", "StartedAt", "SubmittedAt",
      "PageCount", "GradingStatus", "CampaignChosen", "AnswerCorrect", "Communication", "InformationIntegration",
      "QuestionQuality", "DataArgumentation", "RiskIdentification", "TotalScore", "ScoreInterpretation",
      "ConfidenceLevel", "NarrativeSummary",
    ];
    const lines = [header.join(",")];
    for (const g of groups.data!) {
      const s = sessions.data!.find((x) => x.group_code === g.code);
      if (!s) continue;
      const sub = submissions.data!.find((x) => x.session_id === s.id);
      const gr = (sub?.grading ?? {}) as Record<string, any>;
      const flags = events.data!.filter((e) => e.session_id === s.id && e.type === "jailbreak_attempt").length;
      lines.push(
        [
          g.code, s.pic_name, `V${g.dataset_version}`, s.stage, s.questions_used, flags, s.started_at, s.submitted_at,
          sub?.page_count, sub?.grading_status, gr.CampaignChosen, gr.AnswerCorrect, gr.Scores?.Communication,
          gr.Scores?.InformationIntegration, gr.Scores?.QuestionQuality, gr.Scores?.DataArgumentation,
          gr.Scores?.RiskIdentification, gr.TotalScore, gr.ScoreInterpretation, gr.ConfidenceLevel, gr.NarrativeSummary,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="xai-leader-results.csv"`,
      },
    });
  }

  return NextResponse.json(
    {
      exported_at: new Date().toISOString(),
      groups: groups.data,
      sessions: sessions.data!.map(({ access_token: _token, ...rest }) => rest),
      messages: messages.data,
      events: events.data,
      submissions: submissions.data,
    },
    { headers: { "content-disposition": `attachment; filename="xai-leader-export.json"` } },
  );
}
