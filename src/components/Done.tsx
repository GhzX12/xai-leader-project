import { LEADER_NAME } from "@/lib/experiment";
import type { AppState } from "@/lib/types";

/** After Tahap 3: confirmation only. Grading happens behind the scenes and is never shown here. */
export default function Done({ state }: { state: AppState }) {
  const when = state.submission ? new Date(state.submission.submittedAt).toLocaleString("id-ID") : null;
  return (
    <div className="center-screen">
      <div className="card narrow" style={{ textAlign: "center", width: "100%" }}>
        <div className="big-check">✓</div>
        <h1 className="page-title">Proposal terkirim</h1>
        <p>
          Terima kasih, Kelompok <b>{state.groupCode}</b>. Proposal Anda sudah kami terima dan akan dievaluasi.
        </p>
        {state.submission && (
          <p className="small muted">
            {state.submission.fileName} · {state.submission.pageCount} halaman · {when}
          </p>
        )}
        <p className="small muted">
          Pertanyaan ke {LEADER_NAME} yang digunakan: {state.questionsUsed} dari {state.maxQuestions}. Silakan tunggu arahan
          peneliti berikutnya.
        </p>
      </div>
    </div>
  );
}
