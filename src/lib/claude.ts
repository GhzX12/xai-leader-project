import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { MAX_QUESTIONS, MODULE_VERSION } from "./experiment";
import {
  GRADER_OUTPUT_SCHEMA,
  GRADER_SYSTEM_PROMPT,
  LEADER_OUTPUT_SCHEMA,
  SCORE_MAX,
  buildGraderUserText,
  buildLeaderSystemPrompt,
  leaderUserTurn,
  type GraderOutput,
  type LeaderOutput,
} from "./prompts";
import type { MessageRow } from "./types";

export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-5-5";
export const GRADER_MODEL = process.env.GRADER_MODEL || "claude-opus-5-5";

// Server-side fallback: if a safety classifier declines, the API retries on the
// model Anthropic recommends for that refusal category, inside the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  anthropic ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  return anthropic;
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function usageOf(msg: Anthropic.Beta.BetaMessage) {
  return {
    input_tokens: msg.usage.input_tokens,
    output_tokens: msg.usage.output_tokens,
    cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// XAI Leader chat
// ---------------------------------------------------------------------------

export type LeaderResult =
  | { kind: "answer"; output: LeaderOutput; metadata: Record<string, unknown> }
  | { kind: "refused"; category: string | null; metadata: Record<string, unknown> };

/** Previous turns, replayed exactly as they were produced so the history stays append-only. */
function historyAsMessages(history: MessageRow[]): Anthropic.Beta.BetaMessageParam[] {
  return history.map((m) =>
    m.role === "user"
      ? { role: "user", content: leaderUserTurn(m.question_no ?? 0, m.content) }
      : {
          role: "assistant",
          content: JSON.stringify({
            mode: m.mode ?? "clarification",
            refusal_code: m.refusal_code ?? "NONE",
            confidence: m.confidence ?? "NONE",
            bubbles: m.bubbles ?? [m.content],
          }),
        },
  );
}

function cleanLeaderOutput(raw: unknown): LeaderOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<LeaderOutput>;
  const bubbles = Array.isArray(o.bubbles)
    ? o.bubbles
        .filter((b): b is string => typeof b === "string")
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  if (bubbles.length === 0) return null;
  return {
    mode: o.mode ?? "clarification",
    refusal_code: o.refusal_code ?? "NONE",
    confidence: o.confidence ?? "NONE",
    bubbles,
  };
}

export async function askLeader(opts: {
  datasetVersion: number;
  groupCode: string;
  history: MessageRow[];
  questionNo: number;
  question: string;
}): Promise<LeaderResult> {
  const executionId = randomUUID();
  const started = Date.now();

  const response = await client().beta.messages.create({
    model: CHAT_MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [
      {
        type: "text",
        text: buildLeaderSystemPrompt({ datasetVersion: opts.datasetVersion, groupCode: opts.groupCode }),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      ...historyAsMessages(opts.history),
      { role: "user", content: leaderUserTurn(opts.questionNo, opts.question) },
    ],
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: LEADER_OUTPUT_SCHEMA },
    },
  });

  const metadata = {
    command: "AskLeader",
    version: MODULE_VERSION,
    execution_id: executionId,
    timestamp: new Date().toISOString(),
    language: "id",
    model: response.model,
    fallback_used: response.content.some((b) => b.type === "fallback"),
    stop_reason: response.stop_reason,
    latency_ms: Date.now() - started,
    usage: usageOf(response),
    question_no: opts.questionNo,
    max_questions: MAX_QUESTIONS,
  };

  if (response.stop_reason === "refusal") {
    return { kind: "refused", category: response.stop_details?.category ?? null, metadata };
  }

  const text = textOf(response.content);
  let output: LeaderOutput | null = null;
  try {
    output = cleanLeaderOutput(JSON.parse(text));
  } catch {
    output = null;
  }
  // If the JSON was cut off or malformed, keep the persona and show the raw text.
  output ??= {
    mode: "clarification",
    refusal_code: "NONE",
    confidence: "NONE",
    bubbles: [text.trim() || "Mohon ulangi pertanyaan Anda dengan lebih spesifik."],
  };
  return { kind: "answer", output, metadata };
}

// ---------------------------------------------------------------------------
// Behind-the-scenes grading
// ---------------------------------------------------------------------------

export function scoreInterpretation(total: number): string {
  if (total >= 90) return "Exceptional";
  if (total >= 75) return "Strong";
  if (total >= 60) return "Adequate";
  if (total >= 45) return "Developing";
  return "Insufficient";
}

export function transcriptForGrader(history: MessageRow[]): string {
  return history
    .map((m) =>
      m.role === "user"
        ? `Pertanyaan ${m.question_no ?? "?"} (tim): ${m.content}`
        : `XAI Leader [mode=${m.mode ?? "-"}, refusal=${m.refusal_code ?? "NONE"}]: ${(m.bubbles ?? [m.content]).join(" / ")}`,
    )
    .join("\n");
}

export async function gradeProposal(opts: {
  pdfBase64: string;
  groupCode: string;
  groupName: string;
  picName: string;
  datasetVersion: number;
  history: MessageRow[];
  questionsUsed: number;
  pageCount: number | null;
}) {
  const executionId = randomUUID();
  const started = Date.now();

  const response = await client().beta.messages.create({
    model: GRADER_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: GRADER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: opts.pdfBase64 },
            title: `Proposal kelompok ${opts.groupCode}`,
          },
          {
            type: "text",
            text: buildGraderUserText({
              groupCode: opts.groupCode,
              picName: opts.picName,
              datasetVersion: opts.datasetVersion,
              transcript: transcriptForGrader(opts.history),
              questionsUsed: opts.questionsUsed,
              pageCount: opts.pageCount,
            }),
          },
        ],
      },
    ],
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: GRADER_OUTPUT_SCHEMA },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Model menolak menilai (kategori: ${response.stop_details?.category ?? "tidak diketahui"}).`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Jawaban penilai terpotong (max_tokens). Coba nilai ulang.");
  }

  const parsed = JSON.parse(textOf(response.content)) as GraderOutput;

  const scores = { ...parsed.Scores };
  for (const k of Object.keys(SCORE_MAX) as (keyof GraderOutput["Scores"])[]) {
    scores[k] = Math.max(0, Math.min(SCORE_MAX[k], Math.round(Number(scores[k]) || 0)));
  }
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  // Output format from the prototype ("Output Format JSON untuk N8N → Google Sheets"), plus evidence fields.
  return {
    GroupName: opts.groupName,
    PIC: opts.picName,
    Token: opts.groupCode,
    DatasetVersion: `V${opts.datasetVersion}`,
    CampaignChosen: parsed.CampaignChosen,
    AnswerCorrect: parsed.CampaignChosen === "E",
    Scores: scores,
    TotalScore: total,
    ScoreInterpretation: scoreInterpretation(total),
    NarrativeSummary: parsed.NarrativeSummary,
    ConfidenceLevel: parsed.ConfidenceLevel,
    Timestamp: new Date().toISOString(),
    ExecutionID: executionId,
    Justifications: parsed.Justifications,
    SectionCheck: parsed.SectionCheck,
    MetricsUsed: parsed.MetricsUsed,
    Grader: {
      model: response.model,
      fallback_used: response.content.some((b) => b.type === "fallback"),
      latency_ms: Date.now() - started,
      usage: usageOf(response),
    },
  };
}
