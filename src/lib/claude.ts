import "server-only";
import { randomUUID } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { MODULE_VERSION } from "./experiment";
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

// All model calls go through OpenRouter (https://openrouter.ai), an OpenAI-compatible API.
// Override with CHAT_MODEL / GRADER_MODEL env vars (any OpenRouter model id).
export const CHAT_MODEL = process.env.CHAT_MODEL || "anthropic/claude-haiku-5.5";
export const GRADER_MODEL = process.env.GRADER_MODEL || "anthropic/claude-sonnet-5.5";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string | unknown[] };

type ORResponse = {
  model?: string;
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
};

async function complete(opts: {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  schemaName: string;
  schema: unknown;
}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY belum diatur.");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
  };

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "XAI Leader",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as ORResponse;
    if (res.ok && !json.error) return json;
    lastError = `OpenRouter ${res.status}: ${json.error?.message ?? res.statusText}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(lastError);
}

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
}

function usageOf(r: ORResponse) {
  return { input_tokens: r.usage?.prompt_tokens ?? 0, output_tokens: r.usage?.completion_tokens ?? 0 };
}

// ---------------------------------------------------------------------------
// XAI Leader chat
// ---------------------------------------------------------------------------

export type LeaderResult =
  | { kind: "answer"; output: LeaderOutput; metadata: Record<string, unknown> }
  | { kind: "refused"; category: string | null; metadata: Record<string, unknown> };

/** Previous turns, replayed exactly as they were produced so the history stays append-only. */
function historyAsMessages(history: MessageRow[]): ChatMessage[] {
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

  const response = await complete({
    model: CHAT_MODEL,
    maxTokens: 4000,
    schemaName: "leader_output",
    schema: LEADER_OUTPUT_SCHEMA,
    messages: [
      { role: "system", content: buildLeaderSystemPrompt({ datasetVersion: opts.datasetVersion, groupCode: opts.groupCode }) },
      ...historyAsMessages(opts.history),
      { role: "user", content: leaderUserTurn(opts.questionNo, opts.question) },
    ],
  });

  const choice = response.choices?.[0];
  const metadata = {
    command: "AskLeader",
    version: MODULE_VERSION,
    execution_id: executionId,
    timestamp: new Date().toISOString(),
    language: "id",
    model: response.model ?? CHAT_MODEL,
    fallback_used: !!response.model && response.model !== CHAT_MODEL,
    stop_reason: choice?.finish_reason ?? null,
    latency_ms: Date.now() - started,
    usage: usageOf(response),
    question_no: opts.questionNo,
  };

  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
    return { kind: "refused", category: choice?.finish_reason ?? "refusal", metadata };
  }

  const text = choice?.message?.content ?? "";
  let output: LeaderOutput | null = null;
  try {
    output = cleanLeaderOutput(parseJson(text));
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

/** The proposal's text, page by page. Extracted here (not by the model provider) so grading needs no paid "file" feature. */
async function proposalText(pdfBase64: string): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(pdfBase64, "base64")));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `=== Halaman ${i + 1} ===\n${t.trim()}`);
  const joined = pages.join("\n\n");
  if (joined.replace(/=== Halaman \d+ ===/g, "").trim().length < 80) {
    throw new Error("Teks di PDF tidak terbaca (mungkin hasil scan/gambar). Minta kelompok mengekspor ulang PDF sebagai teks.");
  }
  return joined.slice(0, 120_000);
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
  const proposal = await proposalText(opts.pdfBase64);

  const response = await complete({
    model: GRADER_MODEL,
    maxTokens: 8000,
    schemaName: "grader_output",
    schema: GRADER_OUTPUT_SCHEMA,
    messages: [
      { role: "system", content: GRADER_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `ISI PROPOSAL KELOMPOK (teks diekstrak dari PDF, per halaman)

${proposal}

---

` + buildGraderUserText({
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
  });

  const choice = response.choices?.[0];
  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
    throw new Error("Model menolak menilai (content filter).");
  }
  if (choice?.finish_reason === "length") {
    throw new Error("Jawaban penilai terpotong (max_tokens). Coba nilai ulang.");
  }

  const parsed = parseJson(choice?.message?.content ?? "") as GraderOutput;

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
      model: response.model ?? GRADER_MODEL,
      fallback_used: !!response.model && response.model !== GRADER_MODEL,
      latency_ms: Date.now() - started,
      usage: usageOf(response),
    },
  };
}
