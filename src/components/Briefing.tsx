"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import {
  CARD_PURPOSE,
  CARD_RULES,
  CONTEXT_LINES,
  DISCUSSION_RULES,
  EVALUATION_FOCUS,
  LEADER_DONTS,
  LEADER_DOS,
  LEADER_NAME,
  MAX_QUESTIONS,
  MIN_PDF_PAGES,
  OBJECTIVE,
  PARTICIPANT_RULES,
  SUBMISSION_SECTIONS,
} from "@/lib/experiment";
import type { AppState } from "@/lib/types";

/** Tahap 2 (awal): penjelasan eksperimen + Do's & Don'ts, lalu centang setuju. */
export default function Briefing({ onState }: { onState: (s: AppState) => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proceed = async () => {
    setBusy(true);
    setError(null);
    const res = await api<AppState>("/api/agree", { method: "POST" });
    setBusy(false);
    if (res.ok) onState(res.data);
    else setError(res.error);
  };

  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <div className="card">
        <h1 className="page-title">Penjelasan Eksperimen</h1>
        <p className="lead">Baca bersama seluruh anggota tim sebelum melanjutkan.</p>

        <h3>Konteks simulasi</h3>
        <ul>
          {CONTEXT_LINES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="objective">Target perusahaan: {OBJECTIVE}</div>

        <h3>Mekanisme kartu informasi</h3>
        <ul>
          {CARD_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="small muted">{CARD_PURPOSE}</p>

        <h3>Aturan diskusi</h3>
        <ol>
          {DISCUSSION_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>Bekerja dengan {LEADER_NAME}</h2>
        <p className="muted small">
          {LEADER_NAME} berperan sebagai General Manager Anda. Ia memberi insight dan menjelaskan reasoning — keputusan tetap
          di tangan tim.
        </p>
        <div className="grid-2">
          <div>
            <h3>Yang bisa ditanyakan</h3>
            <ul className="dos">
              {LEADER_DOS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Yang tidak akan dilakukan</h3>
            <ul className="donts">
              {LEADER_DONTS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <h3>Aturan untuk tim</h3>
        <ul>
          {PARTICIPANT_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Output & penilaian</h2>
        <p>
          Tim mengumpulkan <b>1 file PDF minimal {MIN_PDF_PAGES} halaman</b> berisi:
        </p>
        <ol className="sections-list">
          {SUBMISSION_SECTIONS.map((s) => (
            <li key={s.title}>
              <div>
                <b>{s.title}</b>
                <div className="small muted">{s.hint}</div>
              </div>
            </li>
          ))}
        </ol>
        <h3>Fokus evaluasi</h3>
        <ul>
          {EVALUATION_FOCUS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            Kami telah membaca dan memahami penjelasan di atas, termasuk batas {MAX_QUESTIONS} pertanyaan ke {LEADER_NAME},
            dan setuju percakapan direkam untuk keperluan penelitian.
          </span>
        </label>
        {error && <div className="alert error">{error}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn block" disabled={!agreed || busy} onClick={proceed}>
            {busy ? "Menyimpan…" : "Setuju & Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
