// Shapes shared by the API routes and the browser.
import type { CampaignRow } from "./experiment";

export type Stage = "briefing" | "workspace" | "submitted";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  /** user: the question text; assistant: one entry per chat bubble */
  bubbles: string[];
  questionNo: number | null;
  /** assistant only: which response mode the leader used (drives the mode banner) */
  mode: string | null;
  refusalCode: string | null;
  createdAt: string;
};

export type AppState = {
  groupCode: string;
  groupName: string;
  className: string | null;
  picName: string;
  sessionLabel: string | null;
  stage: Stage;
  questionsUsed: number;
  dataset: CampaignRow[];
  messages: ChatMessage[];
  submission: { fileName: string | null; pageCount: number | null; submittedAt: string } | null;
};

export type SessionRow = {
  id: string;
  group_code: string;
  pic_name: string;
  access_token: string;
  stage: Stage;
  questions_used: number;
  started_at: string;
  agreed_at: string | null;
  submitted_at: string | null;
  last_seen_at: string;
  session_label: string | null;
  session_batch: string | null;
};

export type MessageRow = {
  id: number;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  bubbles: string[] | null;
  question_no: number | null;
  mode: string | null;
  refusal_code: string | null;
  confidence: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  session_id: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  page_count: number | null;
  submitted_at: string;
  grading_status: "pending" | "running" | "done" | "error";
  grading: Record<string, unknown> | null;
  grading_error: string | null;
  graded_at: string | null;
};

export function toChatMessage(m: MessageRow): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    bubbles: m.role === "assistant" ? (m.bubbles ?? [m.content]) : [m.content],
    questionNo: m.question_no,
    mode: m.role === "assistant" ? m.mode : null,
    refusalCode: m.role === "assistant" ? m.refusal_code : null,
    createdAt: m.created_at,
  };
}
