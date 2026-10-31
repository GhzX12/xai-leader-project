"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DataTable from "@/components/DataTable";
import { api } from "@/lib/client-api";
import type { CampaignRow } from "@/lib/experiment";

type InboxItem = {
  sessionId: string;
  groupCode: string;
  groupName: string;
  className: string | null;
  mode: string;
  picName: string;
  stage: string;
  questionsUsed: number;
  unanswered: number;
  waitingSince: string | null;
  lastRole: string | null;
  lastPreview: string | null;
  lastAt: string;
};
type Inbox = {
  managerId: string;
  now: string;
  items: InboxItem[];
  notStarted: { groupName: string; className: string | null; mode: string }[];
};
type Msg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  bubbles: string[];
  questionNo: number | null;
  author: string | null;
  createdAt: string;
};
type Thread = {
  session: { id: string; picName: string; stage: string; questionsUsed: number; sessionLabel: string | null };
  group: { code: string; name: string; className: string | null; mode: string; datasetVersion: number };
  members: { name: string; gender: string | null }[];
  dataset: CampaignRow[];
  unanswered: number;
  waitingSince: string | null;
  messages: Msg[];
};
type Draft = { bubbles: string[]; mode: string; confidence: string; forLastId: number };

const SOUND_KEY = "cl-manager-sound";
const AUTO_KEY = "cl-manager-autodraft";

const modeLabel = (m: string) => (m === "hybrid" ? "Human + AI" : "Human");
const authorLabel: Record<string, string> = {
  human: "Anda",
  human_ai_sent: "Draf AI, dikirim apa adanya",
  human_ai_edited: "Draf AI, diedit",
  ai: "AI Manager (otomatis)",
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const waitText = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} dtk` : `${Math.floor(s / 60)} mnt ${s % 60} dtk`;
};

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* audio unavailable */
  }
}

function readPref(key: string, fallback: boolean) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export default function ManagerPage() {
  const [phase, setPhase] = useState<"checking" | "login" | "console">("checking");
  const [managerId, setManagerId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [autoDraft, setAutoDraft] = useState(false);
  const [sound, setSound] = useState(true);
  const [showData, setShowData] = useState(false);

  const draftRef = useRef<string[] | null>(null); // the AI draft the current reply started from
  const lastIdRef = useRef(0);
  const lastTypingRef = useRef(0);
  const autoFor = useRef<number>(-1);
  const prevWaiting = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSound(readPref(SOUND_KEY, true));
    setAutoDraft(readPref(AUTO_KEY, false));
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // -- inbox ------------------------------------------------------------------------------------
  const loadInbox = useCallback(async () => {
    const res = await api<Inbox>("/api/manager/inbox");
    if (!res.ok) {
      if (res.status === 401) setPhase("login");
      return;
    }
    setInbox(res.data);
    setPhase("console");
    const waiting = res.data.items.reduce((a, i) => a + i.unanswered, 0);
    if (waiting > prevWaiting.current && soundRef.current) beep();
    prevWaiting.current = waiting;
    document.title = waiting > 0 ? `(${waiting}) Manager Console` : "Manager Console";
  }, []);

  const soundRef = useRef(true);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);
  useEffect(() => {
    if (phase !== "console") return;
    const id = window.setInterval(() => void loadInbox(), 2500);
    return () => window.clearInterval(id);
  }, [phase, loadInbox]);

  // -- selected thread --------------------------------------------------------------------------
  const loadThread = useCallback(async (id: string, full: boolean) => {
    const after = full ? 0 : lastIdRef.current;
    const res = await api<Thread>(`/api/manager/sessions/${id}?after=${after}`);
    if (!res.ok) {
      if (res.status === 401) setPhase("login");
      else setError(res.error);
      return;
    }
    const fresh = res.data;
    if (fresh.messages.length) lastIdRef.current = Math.max(lastIdRef.current, ...fresh.messages.map((m) => m.id));
    setThread((prev) => {
      if (full || !prev || prev.session.id !== fresh.session.id) return fresh;
      const known = new Set(prev.messages.map((m) => m.id));
      return { ...fresh, messages: [...prev.messages, ...fresh.messages.filter((m) => !known.has(m.id))] };
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    lastIdRef.current = 0;
    setThread(null);
    setDraft(null);
    draftRef.current = null;
    setText("");
    autoFor.current = -1;
    void loadThread(selected, true);
  }, [selected, loadThread]);
  useEffect(() => {
    if (!selected || phase !== "console") return;
    const id = window.setInterval(() => void loadThread(selected, false), 1500);
    return () => window.clearInterval(id);
  }, [selected, phase, loadThread]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [thread?.messages.length]);

  const lastPendingId = (() => {
    if (!thread) return 0;
    let lastAssistant = -1;
    thread.messages.forEach((m, i) => {
      if (m.role === "assistant") lastAssistant = i;
    });
    const pending = thread.messages.slice(lastAssistant + 1).filter((m) => m.role === "user");
    return pending.length ? pending[pending.length - 1].id : 0;
  })();

  // -- AI draft (hybrid mode) -------------------------------------------------------------------
  const makeDraft = useCallback(async () => {
    if (!selected || drafting) return;
    setDrafting(true);
    setError(null);
    const res = await api<{ bubbles: string[]; mode: string; confidence: string }>(`/api/manager/sessions/${selected}/draft`, { method: "POST" });
    setDrafting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDraft({ bubbles: res.data.bubbles, mode: res.data.mode, confidence: res.data.confidence, forLastId: lastIdRef.current });
  }, [selected, drafting]);

  useEffect(() => {
    if (!autoDraft || !thread || thread.group.mode !== "hybrid" || !lastPendingId) return;
    if (autoFor.current === lastPendingId || drafting) return;
    autoFor.current = lastPendingId;
    void makeDraft();
  }, [autoDraft, thread, lastPendingId, drafting, makeDraft]);

  // -- sending ----------------------------------------------------------------------------------
  const send = useCallback(
    async (override?: { text: string; draft: string[] | null }) => {
      const body = override?.text ?? text;
      if (!selected || !body.trim() || sending) return;
      setSending(true);
      setError(null);
      const res = await api<{ message: { id: number; bubbles: string[]; createdAt: string }; author: string }>(`/api/manager/sessions/${selected}/reply`, {
        json: { text: body, draft: override ? override.draft : draftRef.current },
      });
      setSending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      setDraft(null);
      draftRef.current = null;
      lastTypingRef.current = 0;
      void loadThread(selected, false);
      void loadInbox();
    },
    [selected, text, sending, loadThread, loadInbox],
  );

  const onType = (value: string) => {
    setText(value);
    if (!selected) return;
    const t = Date.now();
    if (value.trim() && t - lastTypingRef.current > 2000) {
      lastTypingRef.current = t;
      void api(`/api/manager/sessions/${selected}/typing`, { json: { active: true } });
    } else if (!value.trim() && lastTypingRef.current) {
      lastTypingRef.current = 0;
      void api(`/api/manager/sessions/${selected}/typing`, { json: { active: false } });
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    const res = await api("/api/manager/login", { json: { managerId, password } });
    setLoginBusy(false);
    if (!res.ok) {
      setLoginError(res.error);
      return;
    }
    setPassword("");
    await loadInbox();
  };

  const logout = async () => {
    await api("/api/manager/logout", { method: "POST" });
    setPhase("login");
    setSelected(null);
    setThread(null);
    setInbox(null);
    document.title = "Manager Console";
  };

  // -- views ------------------------------------------------------------------------------------
  if (phase === "checking") {
    return (
      <main className="container narrow admin-login">
        <div className="loader" />
      </main>
    );
  }

  if (phase === "login") {
    return (
      <main className="container narrow admin-login">
        <form className="card stage-enter" style={{ width: "100%" }} onSubmit={login} autoComplete="off">
          <p className="eyebrow">Manager access</p>
          <h1 className="page-title">Manager Console</h1>
          <p className="lead">Masuk untuk menjawab percakapan kelompok secara langsung.</p>
          <div className="field">
            <label htmlFor="mid">Manager ID</label>
            <input id="mid" value={managerId} onChange={(e) => setManagerId(e.target.value)} autoFocus placeholder="Manager ID" />
          </div>
          <div className="field">
            <label htmlFor="mpw">Password</label>
            <input id="mpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          </div>
          {loginError && <div className="alert error">{loginError}</div>}
          <button className="btn block" disabled={!managerId.trim() || !password || loginBusy}>
            {loginBusy ? "Memverifikasi…" : "Masuk"}
          </button>
        </form>
      </main>
    );
  }

  const items = [...(inbox?.items ?? [])].sort((a, b) => {
    if (!!b.unanswered !== !!a.unanswered) return b.unanswered ? 1 : -1;
    if (a.unanswered && b.unanswered) return new Date(a.waitingSince ?? 0).getTime() - new Date(b.waitingSince ?? 0).getTime();
    return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
  });
  const totalWaiting = items.reduce((a, i) => a + i.unanswered, 0);
  const isHybrid = thread?.group.mode === "hybrid";
  const draftStale = !!draft && draft.forLastId < lastPendingId;

  return (
    <>
      <header className="topbar">
        <div className="brandmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
          <div>
            <div className="name">CAMPAIGN LEADER</div>
            <div className="role">Manager Console</div>
          </div>
        </div>
        <div className="spacer" />
        <button
          className="link-btn"
          onClick={() => {
            writePref(SOUND_KEY, !sound);
            setSound(!sound);
            if (!sound) beep();
          }}
        >
          Suara notifikasi: {sound ? "nyala" : "mati"}
        </button>
        <div className="who">
          Masuk sebagai <b>{inbox?.managerId}</b>
        </div>
        <button className="link-btn" onClick={() => void logout()}>
          Keluar
        </button>
      </header>

      <div className="mgr">
        {/* ------------------------------------------------------------------ inbox */}
        <aside className="mgr-inbox card">
          <div className="mgr-pane-head">
            <h2>Percakapan</h2>
            <span className={`badge ${totalWaiting ? "red" : "green"}`}>{totalWaiting ? `${totalWaiting} menunggu` : "semua terjawab"}</span>
          </div>
          <div className="mgr-list">
            {items.length === 0 && <div className="empty">Belum ada kelompok yang masuk sesi.</div>}
            {items.map((it) => (
              <button
                key={it.sessionId}
                className={`mgr-item ${selected === it.sessionId ? "selected" : ""} ${it.unanswered ? "waiting" : ""}`}
                onClick={() => setSelected(it.sessionId)}
              >
                <div className="mgr-item-top">
                  <b>{it.groupName}</b>
                  <span className={`badge ${it.mode === "hybrid" ? "gold" : "blue"}`}>{modeLabel(it.mode)}</span>
                  {it.unanswered > 0 && <span className="mgr-count">{it.unanswered}</span>}
                </div>
                <div className="small muted">
                  {it.className ?? ""} · PIC {it.picName} · {it.stage === "submitted" ? "sudah submit" : it.stage === "briefing" ? "briefing" : "chat"}
                </div>
                {it.lastPreview && (
                  <div className="mgr-preview">
                    {it.lastRole === "assistant" ? "Anda: " : ""}
                    {it.lastPreview}
                  </div>
                )}
                {it.unanswered > 0 && it.waitingSince && <div className="mgr-wait">Menunggu {waitText(now - new Date(it.waitingSince).getTime())}</div>}
              </button>
            ))}
            {(inbox?.notStarted.length ?? 0) > 0 && (
              <div className="mgr-pending">
                <div className="label">Belum masuk sesi</div>
                {inbox!.notStarted.map((t) => (
                  <span key={t.groupName} className="member-pill">
                    {t.groupName} · {modeLabel(t.mode)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------------------------ thread */}
        <section className="mgr-thread card">
          {!selected || !thread ? (
            <div className="empty" style={{ margin: "auto" }}>
              {selected ? <div className="loader" style={{ margin: "0 auto" }} /> : "Pilih kelompok di sebelah kiri untuk mulai menjawab."}
            </div>
          ) : (
            <>
              <div className="mgr-pane-head">
                <div>
                  <h2 style={{ margin: 0 }}>{thread.group.name}</h2>
                  <div className="small muted">
                    {thread.group.className} · PIC {thread.session.picName} · {thread.session.questionsUsed} pertanyaan · Dataset V{thread.group.datasetVersion}
                  </div>
                </div>
                <span className={`badge ${isHybrid ? "gold" : "blue"}`}>{modeLabel(thread.group.mode)}</span>
                {thread.unanswered > 0 && thread.waitingSince && (
                  <span className="badge red">menunggu {waitText(now - new Date(thread.waitingSince).getTime())}</span>
                )}
              </div>

              <div className="mgr-messages" ref={bodyRef}>
                {thread.messages.length === 0 && <div className="empty">Belum ada pesan dari kelompok ini.</div>}
                {thread.messages.map((m) => (
                  <div key={m.id} className={`mgr-msg ${m.role === "user" ? "from-team" : "from-me"}`}>
                    <div className="mgr-msg-meta">
                      {m.role === "user" ? `Tim · pertanyaan ${m.questionNo ?? ""}` : authorLabel[m.author ?? "human"] ?? "Anda"} · {timeOf(m.createdAt)}
                    </div>
                    {m.bubbles.map((b, i) => (
                      <div key={i} className="mgr-bubble">
                        {b}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mgr-compose">
                {error && <div className="alert error">{error}</div>}

                {isHybrid && (
                  <div className="mgr-ai">
                    <div className="mgr-ai-head">
                      <b>AI Manager</b>
                      <span className="small muted">Draf jawaban untuk Anda tinjau</span>
                      <div style={{ flex: 1 }} />
                      <label className="small" style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={autoDraft}
                          onChange={(e) => {
                            setAutoDraft(e.target.checked);
                            writePref(AUTO_KEY, e.target.checked);
                          }}
                        />
                        Buat draf otomatis tiap pertanyaan baru
                      </label>
                      <button className="btn secondary small-btn" onClick={() => void makeDraft()} disabled={drafting || !lastPendingId}>
                        {drafting ? "Membuat draf…" : draft ? "Buat ulang draf" : "Aktifkan jawaban AI"}
                      </button>
                    </div>
                    {draft && (
                      <div className="mgr-draft">
                        {draftStale && <div className="alert warn">Ada pertanyaan baru setelah draf ini dibuat. Buat ulang draf atau tulis sendiri.</div>}
                        {draft.bubbles.map((b, i) => (
                          <div key={i} className="mgr-bubble draft">
                            {b}
                          </div>
                        ))}
                        <div className="mgr-draft-actions">
                          <button className="btn accent small-btn" disabled={sending} onClick={() => void send({ text: draft.bubbles.join("\n\n"), draft: draft.bubbles })}>
                            Kirim apa adanya
                          </button>
                          <button
                            className="btn secondary small-btn"
                            onClick={() => {
                              setText(draft.bubbles.join("\n\n"));
                              draftRef.current = draft.bubbles;
                              setDraft(null);
                            }}
                          >
                            Edit dulu
                          </button>
                          <button className="link-btn" onClick={() => setDraft(null)}>
                            Buang draf
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="composer">
                  <textarea
                    value={text}
                    onChange={(e) => onType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={`Balas ${thread.group.name}…`}
                    rows={3}
                  />
                  <button className="btn" onClick={() => void send()} disabled={sending || !text.trim()}>
                    {sending ? "Mengirim…" : "Kirim"}
                  </button>
                </div>
                <div className="composer-hint">
                  <span>
                    Enter kirim · Shift+Enter baris baru · baris kosong = bubble baru
                    {draftRef.current && text.trim() ? " · berasal dari draf AI (akan dicatat sebagai diedit bila berubah)" : ""}
                  </span>
                  <span>{text.length}/3000</span>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ------------------------------------------------------------------ info */}
        <aside className="mgr-info card">
          {thread ? (
            <>
              <div className="mgr-pane-head">
                <h2>Info kelompok</h2>
              </div>
              <div className="members-line" style={{ marginTop: 0 }}>
                {thread.members.map((m) => (
                  <span key={m.name} className={`member-pill ${m.name === thread.session.picName ? "pic" : ""}`}>
                    {m.name}
                    {m.name === thread.session.picName ? " · PIC" : ""}
                  </span>
                ))}
              </div>
              <p className="small muted" style={{ margin: "10px 0" }}>
                Sesi {thread.session.sessionLabel ?? "-"} · tahap {thread.session.stage}
              </p>
              <button className="btn secondary small-btn" onClick={() => setShowData((v) => !v)}>
                {showData ? "Sembunyikan" : "Lihat"} data campaign kelompok ini
              </button>
              {showData && (
                <div style={{ marginTop: 12 }}>
                  <DataTable rows={thread.dataset} />
                </div>
              )}
            </>
          ) : (
            <div className="empty">Info kelompok muncul di sini.</div>
          )}
        </aside>
      </div>
    </>
  );
}
