"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import { api } from "@/lib/client-api";
import type { CampaignRow } from "@/lib/experiment";

const PASSWORD_KEY = "xai-admin-password";

type OverviewRow = {
  code: string;
  groupName: string;
  className: string | null;
  token: string | null;
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
    session_label: string | null;
    session_batch: string | null;
  } | null;
  submission: {
    gradingStatus: string;
    pageCount: number | null;
    submittedAt: string;
    totalScore: number | null;
    campaignChosen: string | null;
    interpretation: string | null;
  } | null;
};

type Detail = {
  session: Record<string, any>;
  group: Record<string, any> | null;
  members: string[];
  dataset: CampaignRow[];
  messages: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  submission: Record<string, any> | null;
  downloadUrl: string | null;
  previewUrl: string | null;
};

const SCORE_LABELS: Array<[string, string, number]> = [
  ["Communication", "Komunikasi antar anggota", 25],
  ["InformationIntegration", "Integrasi informasi terdistribusi", 25],
  ["QuestionQuality", "Kualitas pertanyaan ke leader", 20],
  ["DataArgumentation", "Argumentasi berbasis data", 20],
  ["RiskIdentification", "Identifikasi risiko", 10],
];

const NOT_STARTED = "Belum mulai";
const NO_LABEL = "Tanpa label sesi";
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
  const label = status === "done" ? "dinilai" : status === "error" ? "gagal" : status === "running" ? "menilai…" : "antre";
  return <span className={`badge ${cls}`}>{label}</span>;
}

const verdictOf = (score: number) =>
  score >= 90 ? "Exceptional" : score >= 75 ? "Strong" : score >= 60 ? "Adequate" : score >= 45 ? "Developing" : "Insufficient";

function Kpi({ i, label, value, suffix, pct }: { i: number; label: string; value: string | number; suffix?: string; pct?: number }) {
  return (
    <div className="card kpi" style={{ ["--i" as string]: i }}>
      <div className="k-label">{label}</div>
      <div className="k-value">
        {value}
        {suffix && <small> {suffix}</small>}
      </div>
      {pct !== undefined && (
        <div className="k-bar">
          <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
      setShowPdf(false);
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

  const reset = async (id: string, label: string) => {
    if (!window.confirm(`Hapus seluruh sesi ${label} (chat, log, PDF, nilai)? Tidak bisa dibatalkan.`)) return;
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

  const batchOf = (r: OverviewRow) => (r.session ? (r.session.session_batch ?? NO_LABEL) : NOT_STARTED);
  const batches = useMemo(() => [...new Set(rows.map(batchOf))].sort((a, b) => (a === NOT_STARTED ? 1 : b === NOT_STARTED ? -1 : a.localeCompare(b))), [rows]);
  const classes = useMemo(() => [...new Set(rows.map((r) => r.className ?? "Lainnya"))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (batchFilter && batchOf(r) !== batchFilter) return false;
      if (classFilter && (r.className ?? "Lainnya") !== classFilter) return false;
      if (statusFilter) {
        const st = !r.session ? "idle" : r.submission ? "submitted" : r.session.stage;
        if (st !== statusFilter) return false;
      }
      if (needle && !`${r.groupName} ${r.session?.pic_name ?? ""} ${r.token ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, batchFilter, classFilter, statusFilter]);

  const grouped = useMemo(() => {
    const out = new Map<string, Map<string, OverviewRow[]>>();
    for (const r of filtered) {
      const b = batchOf(r);
      const c = r.className ?? "Lainnya";
      if (!out.has(b)) out.set(b, new Map());
      const byClass = out.get(b)!;
      if (!byClass.has(c)) byClass.set(c, []);
      byClass.get(c)!.push(r);
    }
    const order = [...out.keys()].sort((a, b) => (a === NOT_STARTED ? 1 : b === NOT_STARTED ? -1 : a.localeCompare(b)));
    return order.map((b) => ({ batch: b, classes: [...out.get(b)!.entries()].sort(([x], [y]) => x.localeCompare(y)) }));
  }, [filtered]);

  if (!authed) {
    return (
      <main className="container narrow admin-login">
        <form
          className="card stage-enter"
          style={{ width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            void loadOverview();
          }}
        >
          <p className="eyebrow">Researcher access</p>
          <h1 className="page-title">Dashboard Peneliti</h1>
          <p className="lead">Masukkan password admin untuk melihat laporan.</p>
          <div className="field">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus placeholder="Password admin" />
          </div>
          {error && <div className="alert error">{error}</div>}
          <button className="btn block" disabled={!password}>
            Masuk
          </button>
        </form>
      </main>
    );
  }

  const started = rows.filter((r) => r.session).length;
  const submitted = rows.filter((r) => r.submission).length;
  const scored = rows.filter((r) => r.submission?.totalScore != null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.submission!.totalScore ?? 0), 0) / scored.length) : null;
  const grading = (detail?.submission?.grading ?? null) as Record<string, any> | null;
  const total = grading ? Number(grading.TotalScore ?? 0) : 0;
  const verdict = grading ? String(grading.ScoreInterpretation ?? verdictOf(total)) : "";
  const detailLabel = detail?.group?.group_name ?? detail?.session.group_code;

  return (
    <>
      <header className="topbar">
        <div className="brandmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
          <div>
            <div className="name">XAI LEADER</div>
            <div className="role">Dashboard Peneliti</div>
          </div>
        </div>
        <div className="spacer" />
        <button className="link-btn" onClick={() => void loadOverview()}>
          Muat ulang
        </button>
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

      <main className="adm-main">
        {error && <div className="alert error">{error}</div>}

        <section className="kpis">
          <Kpi i={0} label="Kelompok terdaftar" value={rows.length} pct={100} />
          <Kpi i={1} label="Sudah login" value={started} suffix={`/ ${rows.length}`} pct={rows.length ? (started / rows.length) * 100 : 0} />
          <Kpi i={2} label="Proposal terkumpul" value={submitted} suffix={`/ ${rows.length}`} pct={rows.length ? (submitted / rows.length) * 100 : 0} />
          <Kpi i={3} label="Rata-rata skor AI" value={avg ?? "—"} suffix={avg !== null ? "/ 100" : ""} pct={avg ?? 0} />
        </section>

        <section className="card adm-toolbar">
          <div className="field grow">
            <label htmlFor="q">Cari</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama kelompok, PIC, atau token" />
          </div>
          <div className="field">
            <label htmlFor="fb">Batch sesi</label>
            <select id="fb" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">Semua batch</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fc">Kelas</label>
            <select id="fc" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Semua kelas</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fs">Status</label>
            <select id="fs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua status</option>
              <option value="idle">Belum login</option>
              <option value="briefing">Briefing</option>
              <option value="workspace">Tanya jawab</option>
              <option value="submitted">Sudah submit</option>
            </select>
          </div>
        </section>

        <div className="adm-grid">
          <div>
            {grouped.length === 0 && <div className="card empty">Tidak ada kelompok yang cocok dengan filter.</div>}
            {grouped.map(({ batch, classes: byClass }) => {
              const count = byClass.reduce((a, [, list]) => a + list.length, 0);
              return (
                <section className="batch" key={batch}>
                  <div className="batch-head">
                    <h3>{batch === NOT_STARTED || batch === NO_LABEL ? batch : `Batch sesi ${batch}`}</h3>
                    <span className="pill">{count} kelompok</span>
                    <span className="rule" />
                  </div>
                  <div className="card tbl-card">
                    <div className="tbl-scroll">
                      {byClass.map(([cls, list]) => (
                        <div key={cls}>
                          <div className="kelas-label">{cls}</div>
                          <table className="admin">
                            <thead>
                              <tr>
                                <th>Kelompok</th>
                                <th>Token</th>
                                <th>PIC</th>
                                <th>Status</th>
                                <th>Tanya</th>
                                <th>Pilihan</th>
                                <th>Skor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((r) => (
                                <tr
                                  key={r.code}
                                  className={`${r.session ? "clickable" : ""} ${r.session && r.session.id === selected ? "selected" : ""}`}
                                  onClick={() => r.session && void loadDetail(r.session.id)}
                                >
                                  <td>
                                    <b>{r.groupName}</b> <span className="muted small">V{r.datasetVersion}</span>
                                  </td>
                                  <td className="token-chip">{r.token ?? "—"}</td>
                                  <td>{r.session?.pic_name ?? "—"}</td>
                                  <td>
                                    {r.submission ? gradingBadge(r.submission.gradingStatus) : stageBadge(r.session?.stage)}
                                  </td>
                                  <td>{r.session ? r.session.questions_used : "—"}</td>
                                  <td>{r.submission?.campaignChosen ?? "—"}</td>
                                  <td>
                                    {r.submission?.totalScore != null ? (
                                      <>
                                        <span className="mini-bar">
                                          <i style={{ width: `${r.submission.totalScore}%` }} />
                                        </span>
                                        <b>{r.submission.totalScore}</b>
                                      </>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="adm-detail" key={selected ?? "none"}>
            {!selected ? (
              <div className="card empty">Pilih kelompok yang sudah login untuk melihat laporan, PDF, dan transkrip percakapannya.</div>
            ) : !detail ? (
              <div className="card empty">
                <div className="loader" style={{ margin: "0 auto" }} />
              </div>
            ) : (
              <>
                <div className="card">
                  <div className="detail-title">
                    <h2>{detailLabel}</h2>
                    {detail.group?.class_name && <span className="badge gold">{detail.group.class_name}</span>}
                    <span className="badge blue">Dataset V{detail.group?.dataset_version}</span>
                    {stageBadge(detail.session.stage)}
                    <div style={{ flex: 1 }} />
                    <button className="btn danger small-btn" disabled={!!busy} onClick={() => void reset(detail.session.id, String(detailLabel))}>
                      {busy === "reset" ? "Menghapus…" : "Reset sesi"}
                    </button>
                  </div>
                  <p className="small muted" style={{ margin: "10px 0 0" }}>
                    Sesi {detail.session.session_label ?? "—"} · login {fmtTime(detail.session.started_at)} · setuju {fmtTime(detail.session.agreed_at)} · submit{" "}
                    {fmtTime(detail.session.submitted_at)}
                  </p>
                  {detail.members.length > 0 && (
                    <div className="members-line">
                      {detail.members.map((m) => (
                        <span key={m} className={`member-pill ${m === detail.session.pic_name ? "pic" : ""}`}>
                          {m}
                          {m === detail.session.pic_name ? " · PIC" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h2>Laporan penilaian AI</h2>
                  {!detail.submission ? (
                    <p className="muted">Kelompok ini belum mengumpulkan proposal.</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                        Status: {gradingBadge(detail.submission.grading_status)}
                        <div style={{ flex: 1 }} />
                        <button className="btn accent small-btn" disabled={!!busy} onClick={() => void grade(detail.session.id)}>
                          {busy === "grade" ? "Menilai… (±1 menit)" : grading ? "Nilai ulang dengan AI" : "Nilai dengan AI"}
                        </button>
                      </div>
                      {detail.submission.grading_error && <div className="alert error">{detail.submission.grading_error}</div>}

                      {grading && (
                        <>
                          <div className="verdict">
                            <div className="score">
                              {total}
                              <small> / 100</small>
                            </div>
                            <div>
                              <div className="v-label">Verdict keseluruhan</div>
                              <div className={`v-title verdict-pill ${verdict}`}>{verdict}</div>
                              <div className="small muted">
                                Pilihan campaign {grading.CampaignChosen}{" "}
                                {grading.AnswerCorrect ? <span className="badge green">optimal</span> : <span className="badge yellow">bukan optimal</span>}
                              </div>
                            </div>
                            <div className="meter" aria-label={`Skor ${total} dari 100`}>
                              <i style={{ width: `${total}%` }} />
                              {[45, 60, 75, 90].map((t) => (
                                <b key={t} style={{ left: `${t}%` }} />
                              ))}
                            </div>
                            <div className="meter-scale">
                              <span>Insufficient</span>
                              <span>Developing</span>
                              <span>Adequate</span>
                              <span>Strong</span>
                              <span>Exceptional</span>
                            </div>
                          </div>

                          <h3>Rincian &amp; reasoning</h3>
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

                          <h3>Ringkasan AI</h3>
                          <p>{grading.NarrativeSummary}</p>
                          <p className="small muted">
                            Confidence {grading.ConfidenceLevel} · metrik dipakai: {(grading.MetricsUsed ?? []).join(", ") || "—"}
                          </p>
                          <details>
                            <summary className="small muted" style={{ cursor: "pointer" }}>
                              JSON lengkap
                            </summary>
                            <pre className="json">{JSON.stringify(grading, null, 2)}</pre>
                          </details>
                        </>
                      )}
                    </>
                  )}
                </div>

                {detail.submission && (
                  <div className="card">
                    <h2>File proposal (PDF)</h2>
                    <div className="pdf-card">
                      <div className="ico">PDF</div>
                      <div className="meta">
                        <b>{detail.submission.file_name ?? "proposal.pdf"}</b>
                        <span className="small muted">
                          {detail.submission.page_count ?? "?"} halaman · {fmtTime(detail.submission.submitted_at)}
                        </span>
                      </div>
                      {detail.previewUrl && (
                        <button className="btn secondary small-btn" onClick={() => setShowPdf((v) => !v)}>
                          {showPdf ? "Tutup pratinjau" : "Pratinjau"}
                        </button>
                      )}
                      {detail.downloadUrl && (
                        <a className="btn small-btn" href={detail.downloadUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          Unduh
                        </a>
                      )}
                    </div>
                    {showPdf && detail.previewUrl && <iframe className="pdf-frame" src={detail.previewUrl} title="Pratinjau proposal" />}
                  </div>
                )}

                <div className="card">
                  <h2>Data campaign yang dilihat tim</h2>
                  <DataTable rows={detail.dataset} />
                </div>

                <div className="card transcript">
                  <h2>Transkrip tanya jawab ({detail.session.questions_used} pertanyaan)</h2>
                  {detail.messages.length === 0 && <p className="muted">Belum ada pertanyaan.</p>}
                  {detail.messages.map((m) => (
                    <div className={`turn ${m.role}`} key={m.id}>
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
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
