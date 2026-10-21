"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { parseSessionLabel } from "@/lib/experiment";
import type { AppState } from "@/lib/types";
import TeamPicker, { type TeamClass } from "./TeamPicker";

const pad = (n: number) => String(n).padStart(2, "0");
function nowLabel() {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}: ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Tahap 1: pick the team → its members appear → pick the PIC, confirm the session start time and enter the paper token. */
export default function Login({ onState }: { onState: (s: AppState) => void }) {
  const [classes, setClasses] = useState<TeamClass[] | null>(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[] | null>(null);
  const [picName, setPicName] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSessionLabel(nowLabel());
    void api<{ classes: TeamClass[] }>("/api/groups").then((res) => {
      if (res.ok) setClasses(res.data.classes);
      else setError("Daftar kelompok gagal dimuat. Coba muat ulang halaman ini.");
    });
  }, []);

  useEffect(() => {
    setMembers(null);
    setPicName("");
    if (!groupName) return;
    let cancelled = false;
    void api<{ members: string[] }>(`/api/groups?team=${encodeURIComponent(groupName)}`).then((res) => {
      if (cancelled) return;
      setMembers(res.ok ? res.data.members : []);
    });
    return () => {
      cancelled = true;
    };
  }, [groupName]);

  const parsed = parseSessionLabel(sessionLabel);
  const labelInvalid = sessionLabel.trim().length > 0 && !parsed;
  const ready = !!groupName && picName.length >= 2 && !!parsed && token.trim().length >= 4;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setBusy(true);
    const res = await api<AppState>("/api/login", {
      json: { groupName, picName, sessionLabel, token: token.trim() },
    });
    setBusy(false);
    if (res.ok) onState(res.data);
    else setError(res.error);
  };

  return (
    <div className="login-stage">
      <div className="login-bg" aria-hidden />
      <form className="login-panel" onSubmit={submit} autoComplete="off">
        <div className="seal" aria-hidden>
          <span className="ring" />
          <span className="ring-2" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
        </div>
        <h1 className="login-title">CAMPAIGN LEADER ACCESS</h1>
        <p className="login-sub">Verifikasi kelompok diperlukan</p>

        <div className="form-block">
          <p className="block-title">1 · Identitas kelompok</p>
          <div className="field">
            <label htmlFor="group">Kelompok</label>
            <TeamPicker classes={classes} value={groupName} onChange={setGroupName} />
          </div>

          {groupName && (
            <div className="roster" key={groupName}>
              <div className="roster-head">
                <span className="label">Anggota kelompok · pilih PIC</span>
                {members && members.length > 0 && <span className="count">{members.length} anggota</span>}
              </div>
              {members === null ? (
                <div className="center-screen" style={{ minHeight: 90 }}>
                  <div className="loader" />
                </div>
              ) : members.length === 0 ? (
                <div className="alert warn">Data anggota kelompok ini belum tersedia. Hubungi peneliti.</div>
              ) : (
                <div className="roster-list">
                  {members.map((m, i) => (
                    <button
                      type="button"
                      key={m}
                      className={`roster-item ${picName === m ? "selected" : ""}`}
                      style={{ ["--i" as string]: i }}
                      onClick={() => setPicName(m)}
                    >
                      <span className="ini">{initials(m)}</span>
                      <span className="nm">{m}</span>
                      <span className="pic-tag">{picName === m ? "PIC" : "Pilih"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-block">
          <p className="block-title">2 · Waktu &amp; token</p>
          <div className="login-grid">
            <div className="field">
              <label htmlFor="sesi">Sesi (mulai mengerjakan)</label>
              <input
                id="sesi"
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                placeholder="DD/MM/YY: Jam.Menit"
                inputMode="numeric"
                maxLength={20}
                aria-invalid={labelInvalid}
                style={labelInvalid ? { borderColor: "var(--danger)" } : undefined}
              />
              <span className="hint">
                {labelInvalid ? "Formatnya belum pas. Contoh: 21/10/26: 14.30" : "Format DD/MM/YY: Jam.Menit. Terisi otomatis, boleh diubah."}
              </span>
            </div>
            <div className="field">
              <label htmlFor="token">Token kelompok</label>
              <input
                id="token"
                className="token-input"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\s/g, "").toUpperCase())}
                placeholder="Token dari kertas"
                maxLength={16}
                spellCheck={false}
                autoCapitalize="characters"
              />
              <span className="hint">Token dibagikan peneliti lewat kertas.</span>
            </div>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <button className="btn block" style={{ marginTop: 16 }} disabled={!ready || busy}>
          {busy ? "Memverifikasi…" : "Verify Access  →"}
        </button>

        <div className="secure-row" aria-hidden>
          <span className="secure-chip">
            <svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>
            Koneksi terenkripsi
          </span>
          <span className="secure-chip">
            <svg viewBox="0 0 16 16"><path d="M8 1.5 13.5 4v4c0 3.2-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11.2 2.5 8V4L8 1.5Z" /><path d="m5.8 8 1.6 1.6L10.4 6.6" /></svg>
            Token terverifikasi
          </span>
          <span className="secure-chip">
            <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" /><path d="M8 4.5V8l2.3 1.4" /></svg>
            Waktu tercatat
          </span>
        </div>
      </form>
    </div>
  );
}
