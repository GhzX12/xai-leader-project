const STEPS = ["Validasi Kelompok", "Misi & Tanya Jawab", "Pengumpulan Proposal"];

/** Futuristic progress rail: hexagon nodes joined by a glowing track that fills as the team advances. */
export default function Stepper({ current, finished }: { current: number; finished?: boolean }) {
  return (
    <nav className="rail" aria-label="Tahap eksperimen">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isDone = n < current || (finished && n === current);
        const cls = isDone ? "done" : n === current ? "active" : "";
        return (
          <div key={label} className={`rail-step ${cls}`} aria-current={n === current ? "step" : undefined}>
            <span className="node">{isDone ? "✓" : n}</span>
            <span className="tag">Tahap 0{n}</span>
            <span className="label">{label}</span>
            <span className="rail-line" aria-hidden>
              <i />
            </span>
          </div>
        );
      })}
    </nav>
  );
}
