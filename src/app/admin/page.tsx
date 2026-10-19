"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { api } from "@/lib/client-api";
import { MAX_QUESTIONS, type CampaignRow } from "@/lib/experiment";

const PASSWORD_KEY = "xai-admin-password";

type OverviewRow = {
  code: string;
  datasetVersion: number;
  active: boolean;
  session: {
    id: string;
    pic_name: string;
    stage: string;
    questions_used: number;
    started_at: string;
    submitted_at: string | null;
    last_seen_at: string;
  } | null;
  submission: {
    gradingStatus: string;
    pageCount: number | null;
    submittedAt: string;
    totalScore: number | null;
    campaignChosen: string | null;
  } | null;
};

type Detail = {
  session: Record<string, any>;
  group: Record<string, any> | null;
  dataset: CampaignRow[];
  messages: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  submission: Record<string, any> | null;
  downloadUrl: string | null;
};

const SCORE_LABELS: Array<[string, string, number]> = [
  ["Communication", "Komunikasi antar anggota", 25],
  ["InformationIntegration", "Integrasi informasi terdistribusi", 25],
  ["QuestionQuality", "Kualitas pertanyaan ke leader", 20],
  ["DataArgumentation", "Argumentasi berbasis data", 20],
  ["RiskIdentification", "Identifikasi risiko", 10],
];

const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("id-ID") : "—");

function readStored() {
  try {
    return window.sessionStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}
function store(value: string) {
  try {
    if (value) window.sessionStorage.setItem(PASSWORD_KEY, value);
    else window.sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    /* ignore */
  }
}

function stageBadge(stage?: string) {
  if (!stage) return <span className="badge">belum login</span>;
  if (stage === "briefing") return <span className="badge yellow">briefing</span>;
  if (stage === "workspace") return <span className="badge blue">tanya jawab</span>;
  return <span className="badge green">submitted</span>;
}

function gradingBadge(status?: string) {
  if (!status) return null;
  const cls = status === "done" ? "green" : status === "error" ? "red" : status === "running" ? "blue" : "";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const headers = useCallback(() => ({ "x-admin-password": password }), [password]);

  const loadOverview = useCallback(
    async (pw = password) => {
      const res = await api<{ rows: OverviewRow[] }>("/api/admin/sessions", { headers: { "x-admin-password": pw } });
      if (!res.ok) {
        setError(res.error);
        if (res.status === 401) {
          setAuthed(false);
          store("");
        }
        return;
      }
      setError(null);
      setAuthed(true);
      store(pw);
      setRows(res.data.rows);
    },
    [password],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      setSelected(id);
      setDetail(null);
      const res = await api<Detail>(`/api/admin/sessions/${id}`, { headers: headers() });
      if (res.ok) setDetail(res.data);
      else setError(res.error);
    },
    [headers],
  );

  useEffect(() => {
    const pw = readStored();
    if (pw) {
      setPassword(pw);
      void loadOverview(pw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grade = async (id: string) => {
    setBusy("grade");
    setError(null);
    const res = await api(`/api/admin/sessions/${id}/grade`, { method: "POST", headers: headers() });
    setBusy(null);
    if (!res.ok) setError(res.error);
    await Promise.all([loadDetail(id), loadOverview()]);
  };

  const reset = async (id: string, code: string) => {
    if (!window.confirm(`Hapus seluruh sesi ${code} (chat, log, PDF, nilai)? Tidak bisa dibatalkan.`)) return;
    setBusy("reset");
    const res = await api(`/api/admin/sessions/${id}/reset`, { method: "POST", headers: headers() });
    setBusy(null);
    if (!res.ok) setError(res.error);
    setSelected(null);
    setDetail(null);
    await loadOverview();
  };

  const download = async (format: "json" | "csv") => {
    const res = await fetch(`/api/admin/export?format=${format}`, { headers: headers() });
    if (!res.ok) {
      setError("Export gagal.");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = format === "csv" ? "xai-leader-results.csv" : "xai-leader-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!authed) {
    return (
      <main className="container narrow">
        <div className="card">
          <h1 className="page-title">Dashboard Peneliti</h1>
          <p className="lead">Masukkan password admin (ADMIN_PASSWORD).</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadOverview();
            }}
          >
            <div className="field">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            {error && <div className="alert error">{error}</div>}
            <button className="btn block" disabled={!password}>
              Masuk
            </button>
          </form>
        </div>
      </main>
    );
  }

  const started = rows.filter((r) => r.session).length;
  const submitted = rows.filter((r) => r.submission).length;
  const sel = rows.find((r) => r.session?.id === selected);
  const grading = (detail?.submission?.grading ?? null) as Record<string, any> | null;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          XAI Leader <small>Dashboard Peneliti</small>
        </div>
        <div className="spacer" />
        <button className="link-btn" onClick={() => void download("csv")}>
          Export CSV nilai
        </button>
        <button className="link-btn" onClick={() => void download("json")}>
          Export JSON lengkap
        </button>
        <button
          className="link-btn"
          onClick={() => {
            store("");
            setAuthed(false);
            setPassword("");
          }}
        >
          Keluar
        </button>
      </header>

      <main className="container">
        {error && <div className="alert error">{error}</div>}
        <div className="admin-grid">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Kelompok</h2>
              <span className="small muted">
                {rows.length} kode · {started} mulai · {submitted} submit
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn secondary" onClick={() => void loadOverview()}>
                Muat ulang
              </button>
            </div>
            <div style={{ maxHeight: "75vh", overflow: "auto" }}>
              <table className="admin">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Versi</th>
                    <th>PIC</th>
                    <th>Tahap</th>
                    <th>Tanya</th>
                    <th>Pilihan</th>
                    <th>Nilai</th>
                    <th>Penilaian</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.code}
                      className={`${r.session ? "clickable" : ""} ${r.session && r.session.id === selected ? "selected" : ""}`}
                      onClick={() => r.session && void loadDetail(r.session.id)}
                    >
                      <td>
                        <b>{r.code}</b>
                        {!r.active && <span className="badge red"> nonaktif</span>}
                      </td>
                      <td>V{r.datasetVersion}</td>
                      <td>{r.session?.pic_name ?? "—"}</td>
                      <td>{stageBadge(r.session?.stage)}</td>
                      <td>{r.session ? `${r.session.questions_used}/${MAX_QUESTIONS}` : "—"}</td>
                      <td>{r.submission?.campaignChosen ?? "—"}</td>
                      <td>{r.submission?.totalScore ?? "—"}</td>
                      <td>{gradingBadge(r.submission?.gradingStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {!selected ? (
              <div className="card muted">Pilih kelompok yang sudah login untuk melihat transcript, PDF, dan nilai.</div>
            ) : !detail ? (
              <div className="card muted">Memuat…</div>
            ) : (
              <>
                <div className="card">
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0 }}>{detail.session.group_code}</h2>
                    <span className="badge blue">Dataset V{detail.group?.dataset_version}</span>
                    {stageBadge(detail.session.stage)}
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn danger"
                      disabled={!!busy}
                      onClick={() => void reset(detail.session.id, detail.session.group_code)}
                    >
                      {busy === "reset" ? "Menghapus…" : "Reset sesi"}
                    </button>
                  </div>
                  <p className="small muted">
                    PIC {detail.session.pic_name} · mulai {fmtTime(detail.session.started_at)} · setuju{" "}
                    {fmtTime(detail.session.agreed_at)} · submit {fmtTime(detail.session.submitted_at)}
                  </p>
                  <DataTable rows={detail.dataset} />
                </div>

                <div className="card">
                  <h2>Proposal & penilaian</h2>
                  {!detail.submission ? (
                    <p className="muted">Belum mengumpulkan.</p>
                  ) : (
                    <>
                      <p className="small">
                        {detail.submission.file_name} · {detail.submission.page_count} halaman ·{" "}
                        {fmtTime(detail.submission.submitted_at)}{" "}
                        {detail.downloadUrl && (
                          <a href={detail.downloadUrl} target="_blank" rel="noreferrer">
                            Unduh PDF
                          </a>
                        )}
                      </p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        Status: {gradingBadge(detail.submission.grading_status)}
                        <div style={{ flex: 1 }} />
                        <button className="btn secondary" disabled={!!busy} onClick={() => void grade(detail.session.id)}>
                          {busy === "grade" ? "Menilai… (±1 menit)" : grading ? "Nilai ulang dengan AI" : "Nilai dengan AI"}
                        </button>
                      </div>
                      {detail.submission.grading_error && (
                        <div className="alert error">{detail.submission.grading_error}</div>
                      )}
                      {grading && (
                        <>
                          <h3>
                            Total {grading.TotalScore}/100 · {grading.ScoreInterpretation} · pilihan {grading.CampaignChosen}{" "}
                            {grading.AnswerCorrect ? (
                              <span className="badge green">optimal</span>
                            ) : (
                              <span className="badge yellow">bukan optimal</span>
                            )}
                          </h3>
                          {SCORE_LABELS.map(([key, label, max]) => (
                            <div className="score-row" key={key}>
                              <span>{label}</span>
                              <b>
                                {grading.Scores?.[key]}/{max}
                              </b>
                              <div className="bar">
                                <span style={{ width: `${((grading.Scores?.[key] ?? 0) / max) * 100}%` }} />
                              </div>
                              <div className="why">{grading.Justifications?.[key]}</div>
                            </div>
                          ))}
                          <h3>Ringkasan</h3>
                          <p>{grading.NarrativeSummary}</p>
                          <p className="small muted">
                            Confidence {grading.ConfidenceLevel} · metrik dipakai: {(grading.MetricsUsed ?? []).join(", ") || "—"}
                          </p>
                          <details>
                            <summary className="small">JSON lengkap</summary>
                            <pre className="json">{JSON.stringify(grading, null, 2)}</pre>
                          </details>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="card transcript">
                  <h2>Transcript tanya jawab ({detail.session.questions_used}/{MAX_QUESTIONS})</h2>
                  {detail.messages.length === 0 && <p className="muted">Belum ada pertanyaan.</p>}
                  {detail.messages.map((m) => (
                    <div className="turn" key={m.id}>
                      <div className="who">
                        {m.role === "user" ? `Tim · Pertanyaan ${m.question_no}` : "XAI Leader"}
                        {m.mode && <span className="badge blue">{m.mode}</span>}
                        {m.refusal_code && m.refusal_code !== "NONE" && <span className="badge red">{m.refusal_code}</span>}
                        {m.confidence && m.confidence !== "NONE" && <span className="badge">confidence {m.confidence}</span>}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          {fmtTime(m.created_at)}
                        </span>
                      </div>
                      <div className="text">{m.role === "assistant" ? (m.bubbles ?? [m.content]).join("\n\n") : m.content}</div>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <details>
                    <summary>
                      <b>Log event ({detail.events.length})</b>
                    </summary>
                    <pre className="json">
                      {detail.events
                        .map((e) => `${fmtTime(e.created_at)}  ${e.type}  ${e.payload ? JSON.stringify(e.payload) : ""}`)
                        .join("\n")}
                    </pre>
                  </details>
                  {sel?.session && (
                    <p className="small muted">Terakhir aktif {fmtTime(sel.session.last_seen_at)}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
