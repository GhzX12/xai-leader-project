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

/** Tahap 2 (inti): misi + tabel data di kiri (lega & nyaman dibaca), chat dengan Campaign Leader di kanan. */
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
      <div className="panel-stack stagger">
        <div className="card" style={{ ["--i" as string]: 0 }}>
          <div className="section-head">
            <span className="no">01</span>
            <h2>Misi Tim</h2>
          </div>
          <ul>
            {CONTEXT_LINES.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="objective">Objective: {OBJECTIVE}</div>
          <p className="mission-q">{MISSION_QUESTION}</p>
        </div>

        <div className="card" style={{ ["--i" as string]: 1 }}>
          <div className="section-head">
            <span className="no">02</span>
            <h2>Data Campaign</h2>
          </div>
          <DataTable rows={state.dataset} />
        </div>

        <div className="card" style={{ ["--i" as string]: 2 }}>
          <div className="section-head">
            <span className="no">03</span>
            <h2>Panduan Singkat</h2>
          </div>
          <details className="fold" open>
            <summary>Cara berdiskusi</summary>
            <div className="fold-body">
              <ol>
                {DISCUSSION_RULES.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          </details>
          <details className="fold">
            <summary>Yang dikumpulkan nanti (PDF, minimal {MIN_PDF_PAGES} halaman)</summary>
            <div className="fold-body">
              <ol>
                {SUBMISSION_SECTIONS.map((s) => (
                  <li key={s.title}>{s.title}</li>
                ))}
              </ol>
            </div>
          </details>
        </div>
      </div>

      <Chat state={state} onState={onState} onSubmit={onSubmit} />
    </div>
  );
}
