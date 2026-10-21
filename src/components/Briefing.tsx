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
  MIN_PDF_PAGES,
  OBJECTIVE,
  PARTICIPANT_RULES,
  SUBMISSION_SECTIONS,
  TEMPLATE_URL,
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
    <div className="narrow stagger" style={{ margin: "0 auto" }}>
      <div className="hero" style={{ ["--i" as string]: 0 }}>
        <div className="hero-body">
          <p className="eyebrow">Briefing misi</p>
          <h1>Sebelum mulai, kenalan dulu</h1>
          <p>Baca ini bareng-bareng satu tim. Cuma beberapa menit, dan akan sangat membantu kalian di sesi nanti.</p>
        </div>
      </div>

      <div className="card" style={{ ["--i" as string]: 1 }}>
        <h2>Gambaran situasinya</h2>
        <ul>
          {CONTEXT_LINES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="objective">Target perusahaan: {OBJECTIVE}</div>

        <h3>Soal kartu informasi</h3>
        <ul>
          {CARD_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="small muted">{CARD_PURPOSE}</p>

        <h3>Cara berdiskusi</h3>
        <ol>
          {DISCUSSION_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="card" style={{ ["--i" as string]: 2 }}>
        <h2>Bekerja bareng {LEADER_NAME}</h2>
        <p className="muted">
          {LEADER_NAME} berperan sebagai General Manager kalian. Dia siap menjelaskan konsep dan mengulas cara berpikir tim, tapi
          keputusan akhirnya tetap ada di tangan kalian.
        </p>
        <div className="grid-2">
          <div>
            <h3>Boleh ditanyakan</h3>
            <ul className="dos">
              {LEADER_DOS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Tidak akan dilakukan</h3>
            <ul className="donts">
              {LEADER_DONTS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <h3>Catatan buat tim</h3>
        <ul>
          {PARTICIPANT_RULES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ ["--i" as string]: 3 }}>
        <h2>Yang dikumpulkan nanti</h2>
        <p>
          Di akhir sesi, tim mengunggah <b>1 file PDF, minimal {MIN_PDF_PAGES} halaman</b>, dengan isi berikut:
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
        <h3>Yang kami perhatikan</h3>
        <ul>
          {EVALUATION_FOCUS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h3>Template jawaban</h3>
        <p>
          Semua kelompok menulis jawaban di template Google Docs yang sama (5 halaman, satu bagian per halaman). Template ini
          hanya bisa dilihat, jadi buat salinannya dulu:
        </p>
        <ol>
          <li>Buka template lewat tombol di bawah.</li>
          <li>
            Klik <b>File</b>, lalu <b>Buat salinan</b> (Make a copy), dan simpan di Google Drive kalian.
          </li>
          <li>Isi semua halaman pada salinan itu bersama tim.</li>
          <li>
            Kalau sudah selesai, klik <b>File</b>, lalu <b>Download</b>, lalu <b>Dokumen PDF (.pdf)</b>. File PDF itulah yang
            diunggah di akhir sesi.
          </li>
        </ol>
        <a className="btn secondary" href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", marginTop: 6 }}>
          Buka template dokumen ↗
        </a>
      </div>

      <div className="card" style={{ ["--i" as string]: 4 }}>
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            Kami sudah membaca dan memahami penjelasan di atas, dan setuju percakapan selama sesi ini direkam untuk
            keperluan penelitian.
          </span>
        </label>
        {error && <div className="alert error">{error}</div>}
        <div style={{ marginTop: 16 }}>
          <button className="btn block" disabled={!agreed || busy} onClick={proceed}>
            {busy ? "Menyimpan…" : "Siap, Mulai Misi  →"}
          </button>
        </div>
      </div>
    </div>
  );
}
