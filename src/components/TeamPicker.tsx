"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TeamClass = { name: string; groups: string[] };

/** Themed dropdown: class headers with a tidy tile grid of teams (replaces the OS-native <select> list). */
export default function TeamPicker({
  classes,
  value,
  onChange,
}: {
  classes: TeamClass[] | null;
  value: string;
  onChange: (team: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => (classes ?? []).flatMap((c) => c.groups), [classes]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) setActive(Math.max(0, flat.indexOf(value)));
  }, [open, flat, value]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`team-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const pick = (team: string) => {
    onChange(team);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!classes) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) pick(flat[active]);
    }
  };

  let index = -1;
  return (
    <div className="dd" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        id="group"
        className={`dd-btn ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={!classes}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? "" : "ph"}>{value || (classes ? "Pilih kelompok kalian…" : "Memuat…")}</span>
        <svg className="chev" viewBox="0 0 12 8" width="12" height="8" aria-hidden>
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && classes && (
        <div className="dd-pop" role="listbox" aria-label="Daftar kelompok" aria-activedescendant={active >= 0 ? `team-opt-${active}` : undefined}>
          {classes.map((c) => (
            <div key={c.name}>
              <div className="dd-group">{c.name}</div>
              <div className="dd-opts">
                {c.groups.map((g) => {
                  index += 1;
                  const i = index;
                  return (
                    <div
                      key={g}
                      id={`team-opt-${i}`}
                      role="option"
                      aria-selected={g === value}
                      className={`dd-opt ${i === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(g)}
                    >
                      {g}
                      {g === value && <span className="tick">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
