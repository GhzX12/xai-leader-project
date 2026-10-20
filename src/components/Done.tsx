import { LEADER_NAME } from "@/lib/experiment";
import type { AppState } from "@/lib/types";

/** After Tahap 3: confirmation only. Grading happens behind the scenes and is never shown here. */
export default function Done({ state }: { state: AppState }) {
  const when = state.submission ? new Date(state.submission.submittedAt).toLocaleString("id-ID") : null;
  return (
    <div className="center-screen">
      <div className="card narrow done-card">
        <div className="done-art" role="img" aria-label="Misi selesai" />
        <div className="done-body">
          <p className="eyebrow">Mission complete</p>
          <h1 className="page-title">Proposal terkirim</h1>
          <p>
            Terima kasih, Kelompok <b>{state.groupName}</b>. Proposal kalian sudah kami terima dan akan segera dievaluasi.
          </p>
          {state.submission && (
            <p className="small muted">
              {state.submission.fileName} · {state.submission.pageCount} halaman · {when}
            </p>
          )}
          <p className="small muted">
            Kalian mengajukan {state.questionsUsed} pertanyaan ke {LEADER_NAME}. Silakan tunggu arahan peneliti berikutnya.
          </p>
        </div>
      </div>
    </div>
  );
}
