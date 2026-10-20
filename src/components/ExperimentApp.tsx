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
    if (state?.stage === "workspace" && !window.confirm("Keluar dari sesi? Progres tim tetap tersimpan, dan bisa dilanjutkan dengan login ulang.")) {
      return;
    }
    await api("/api/logout", { method: "POST" });
    setState(null);
    setShowSubmit(false);
  };

  const step = !state ? 1 : state.stage === "submitted" || (state.stage === "workspace" && showSubmit) ? 3 : 2;
  const view = loading ? "loading" : !state ? "login" : state.stage === "briefing" ? "briefing" : state.stage === "submitted" ? "done" : showSubmit ? "submit" : "workspace";

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  return (
    <>
      <header className="topbar">
        <div className="brandmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
          <div>
            <div className="name">{LEADER_NAME.toUpperCase()}</div>
            <div className="role">{LEADER_ROLE}</div>
          </div>
        </div>
        <div className="spacer" />
        {state && (
          <>
            <div className="who">
              Kelompok <b>{state.groupName}</b> · PIC {state.picName}
              {state.sessionLabel ? ` · Sesi ${state.sessionLabel}` : ""}
            </div>
            <button className="link-btn" onClick={logout}>
              Keluar
            </button>
          </>
        )}
      </header>

      <main className="container">
        <Stepper current={step} finished={state?.stage === "submitted"} />

        <div key={view} className="stage-enter">
          {view === "loading" ? (
            <div className="center-screen">
              <div className="loader" />
            </div>
          ) : view === "login" ? (
            <Login onState={setState} />
          ) : view === "briefing" ? (
            <Briefing onState={setState} />
          ) : view === "done" ? (
            <Done state={state!} />
          ) : view === "submit" ? (
            <SubmitPanel onState={setState} onBack={() => setShowSubmit(false)} />
          ) : (
            <Workspace state={state!} onState={setState} onSubmit={() => setShowSubmit(true)} />
          )}
        </div>
      </main>
    </>
  );
}
