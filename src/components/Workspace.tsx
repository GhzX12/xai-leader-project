"use client";

import {
  CONTEXT_LINES,
  DISCUSSION_RULES,
  MIN_PDF_PAGES,
  MISSION_QUESTION,
  OBJECTIVE,
  SUBMISSION_SECTIONS,
} from "@/lib/experiment";
import type { AppState } from "@/lib/types";
import Chat from "./Chat";
import DataTable from "./DataTable";

/** Tahap 2 (inti): misi + tabel data di kiri, chat dengan XAI Leader di kanan. */
export default function Workspace({
  state,
  onState,
  onSubmit,
}: {
  state: AppState;
  onState: (s: AppState) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="workspace">
      <div>
        <div className="card">
          <h2>Misi Tim</h2>
          <ul className="small">
            {CONTEXT_LINES.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="objective">Objective: {OBJECTIVE}</div>
          <p className="mission-q">{MISSION_QUESTION}</p>

          <h3>Data Campaign</h3>
          <DataTable rows={state.dataset} />
          <p className="small muted" style={{ marginTop: 8 }}>
            CTR = Click ÷ Impression · Conv. Rate = Conversion ÷ Click · CPA = Biaya total ÷ Conversion
          </p>
        </div>

        <div className="card">
          <h2>Aturan Diskusi</h2>
          <ol className="small">
            {DISCUSSION_RULES.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <h3>Yang harus dikumpulkan (PDF, min. {MIN_PDF_PAGES} halaman)</h3>
          <ol className="small">
            {SUBMISSION_SECTIONS.map((s) => (
              <li key={s.title}>{s.title}</li>
            ))}
          </ol>
        </div>
      </div>

      <Chat state={state} onState={onState} onSubmit={onSubmit} />
    </div>
  );
}
