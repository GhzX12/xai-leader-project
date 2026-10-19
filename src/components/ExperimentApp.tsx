"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { LEADER_NAME, LEADER_ROLE } from "@/lib/experiment";
import type { AppState } from "@/lib/types";
import Briefing from "./Briefing";
import Done from "./Done";
import Login from "./Login";
import Stepper from "./Stepper";
import SubmitPanel from "./SubmitPanel";
import Workspace from "./Workspace";

/** Single URL, three stages: Tahap 1 login → Tahap 2 briefing + chat → Tahap 3 submission. */
export default function ExperimentApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<AppState>("/api/state");
    setState(res.ok ? res.data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    if (state?.stage === "workspace" && !window.confirm("Keluar dari sesi? Progres tim tetap tersimpan dan bisa dilanjutkan dengan login ulang.")) {
      return;
    }
    await api("/api/logout", { method: "POST" });
    setState(null);
    setShowSubmit(false);
  };

  const step = !state ? 1 : state.stage === "submitted" || (state.stage === "workspace" && showSubmit) ? 3 : 2;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          {LEADER_NAME}
          <small>{LEADER_ROLE} · Simulasi Performance Marketing</small>
        </div>
        <div className="spacer" />
        {state && (
          <>
            <div className="who">
              Kelompok <b>{state.groupCode}</b> · PIC {state.picName}
            </div>
            <button className="link-btn" onClick={logout}>
              Keluar
            </button>
          </>
        )}
      </header>

      <main className="container">
        <Stepper current={step} finished={state?.stage === "submitted"} />

        {loading ? (
          <div className="center-screen muted">Memuat…</div>
        ) : !state ? (
          <Login onState={setState} />
        ) : state.stage === "briefing" ? (
          <Briefing onState={setState} />
        ) : state.stage === "submitted" ? (
          <Done state={state} />
        ) : showSubmit ? (
          <SubmitPanel onState={setState} onBack={() => setShowSubmit(false)} />
        ) : (
          <Workspace state={state} onState={setState} onSubmit={() => setShowSubmit(true)} />
        )}
      </main>
    </>
  );
}
