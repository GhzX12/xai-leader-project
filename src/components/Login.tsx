"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { EXPERIMENT_TITLE } from "@/lib/experiment";
import type { AppState } from "@/lib/types";

type Options = { groupNames: string[]; sessions: number[] };

/** Tahap 1: pick group + session from the dropdowns; the server verifies "<Kelompok>-<Sesi>". */
export default function Login({ onState }: { onState: (s: AppState) => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [groupName, setGroupName] = useState("");
  const [sessionNo, setSessionNo] = useState("");
  const [picName, setPicName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Options>("/api/groups").then((res) => {
      if (res.ok) setOptions(res.data);
      else setError("Daftar kelompok gagal dimuat. Muat ulang halaman ini.");
    });
  }, []);

  const code = groupName && sessionNo ? `${groupName}-${sessionNo}` : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api<AppState>("/api/login", { json: { groupName, sessionNo: Number(sessionNo), picName } });
    setBusy(false);
    if (res.ok) onState(res.data);
    else setError(res.error);
  };

  return (
    <div className="container narrow" style={{ padding: 0 }}>
      <div className="card">
        <h1 className="page-title">{EXPERIMENT_TITLE}</h1>
        <p className="lead">Tahap 1 — pilih kelompok dan sesi Anda. Sistem akan memverifikasi kode kelompok sebelum sesi dimulai.</p>

        <form onSubmit={submit}>
          <div className="row">
            <div className="field">
              <label htmlFor="group">Kelompok</label>
              <select id="group" value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={!options}>
                <option value="">{options ? "Pilih kelompok…" : "Memuat…"}</option>
                {options?.groupNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="session">Sesi</label>
              <select id="session" value={sessionNo} onChange={(e) => setSessionNo(e.target.value)} disabled={!options}>
                <option value="">Pilih sesi…</option>
                {options?.sessions.map((s) => (
                  <option key={s} value={s}>
                    Sesi {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="pic">Nama PIC kelompok</label>
            <input
              id="pic"
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              placeholder="Nama orang yang mengoperasikan perangkat ini"
              maxLength={60}
              autoComplete="name"
            />
          </div>

          <p className="small muted">
            Kode kelompok: {code ? <span className="code-preview">{code}</span> : <span>—</span>}
          </p>

          {error && <div className="alert error">{error}</div>}

          <button className="btn block" disabled={!code || picName.trim().length < 2 || busy}>
            {busy ? "Memverifikasi…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
