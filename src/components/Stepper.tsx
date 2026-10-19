const STEPS = ["Validasi Kelompok", "Misi & Tanya Jawab", "Pengumpulan Proposal"];

export default function Stepper({ current, finished }: { current: number; finished?: boolean }) {
  return (
    <nav className="stepper" aria-label="Tahap eksperimen">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const cls = n < current || (finished && n === current) ? "done" : n === current ? "active" : "";
        return (
          <div key={label} className={`step ${cls}`} aria-current={n === current ? "step" : undefined}>
            <span className="num">{cls === "done" ? "✓" : n}</span>
            Tahap {n}: {label}
          </div>
        );
      })}
    </nav>
  );
}
