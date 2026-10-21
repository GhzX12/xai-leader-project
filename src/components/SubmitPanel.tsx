"use client";

import { useRef, useState } from "react";
import { countPdfPages, uploadWithSignedToken } from "@/lib/browser-upload";
import { api } from "@/lib/client-api";
import { MAX_PDF_BYTES, MIN_PDF_PAGES, SUBMISSION_SECTIONS, TEMPLATE_URL } from "@/lib/experiment";
import type { AppState } from "@/lib/types";

type Picked = { file: File; pages: number | null; problem: string | null };

/** Tahap 3: upload the team's proposal PDF (one time only). */
export default function SubmitPanel({ onState, onBack }: { onState: (s: AppState) => void; onBack: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "uploading" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPicked({ file, pages: null, problem: "File harus berformat PDF." });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setPicked({ file, pages: null, problem: `Ukuran file maksimal ${MAX_PDF_BYTES / 1024 / 1024} MB.` });
      return;
    }
    setStatus("checking");
    try {
      const pages = await countPdfPages(file);
      setPicked({
        file,
        pages,
        problem: pages < MIN_PDF_PAGES ? `PDF ini ${pages} halaman. Minimal ${MIN_PDF_PAGES} halaman.` : null,
      });
    } catch {
      setPicked({ file, pages: null, problem: "PDF tidak bisa dibaca. Ekspor ulang dokumen ke PDF lalu coba lagi." });
    }
    setStatus("idle");
  };

  const upload = async () => {
    if (!picked || picked.problem) return;
    setError(null);
    setStatus("uploading");
    const ticket = await api<{ path: string; token: string }>("/api/submission/upload-url", {
      json: { fileName: picked.file.name, fileSize: picked.file.size },
    });
    if (!ticket.ok) {
      setStatus("idle");
      setError(ticket.error);
      return;
    }
    try {
      await uploadWithSignedToken(ticket.data.path, ticket.data.token, picked.file);
    } catch (e) {
      setStatus("idle");
      setError(`Upload gagal: ${e instanceof Error ? e.message : "coba lagi"}.`);
      return;
    }
    setStatus("verifying");
    const done = await api<AppState>("/api/submission/complete", {
      json: { path: ticket.data.path, fileName: picked.file.name },
    });
    setStatus("idle");
    if (done.ok) onState(done.data);
    else setError(done.error);
  };

  const busy = status !== "idle";

  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <div className="card">
        <p className="eyebrow">Tahap terakhir</p>
        <h1 className="page-title">Pengumpulan Proposal</h1>
        <p className="lead">
          Unggah 1 file PDF minimal {MIN_PDF_PAGES} halaman, satu halaman untuk tiap bagian berikut:
        </p>
        <ol className="sections-list">
          {SUBMISSION_SECTIONS.map((s) => (
            <li key={s.title}>
              <div>
                <b>{s.title}</b>
                <div className="small muted">{s.hint}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="small muted">
          Belum punya PDF-nya? Buka{" "}
          <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer">
            template dokumen
          </a>
          , buat salinan (File, lalu Buat salinan), isi, lalu unduh lewat File, Download, Dokumen PDF (.pdf).
        </p>
      </div>

      <div className="card">
        <div
          className={`dropzone ${picked && !picked.problem ? "has-file" : ""}`}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void pick(e.dataTransfer.files[0]);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          {picked ? (
            <>
              <b>{picked.file.name}</b>
              <div className="small muted">
                {(picked.file.size / 1024 / 1024).toFixed(2)} MB
                {picked.pages !== null && ` · ${picked.pages} halaman`}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Klik untuk mengganti file
              </div>
            </>
          ) : (
            <>
              <b>{status === "checking" ? "Memeriksa PDF…" : "Klik atau tarik file PDF kalian ke sini"}</b>
              <div className="small muted">Format PDF · maks. {MAX_PDF_BYTES / 1024 / 1024} MB</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {picked?.problem && <div className="alert error">{picked.problem}</div>}
        {picked && !picked.problem && picked.pages !== null && (
          <div className="alert ok">PDF valid: {picked.pages} halaman.</div>
        )}

        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Kami sudah memeriksa isi proposal. Pengumpulan hanya bisa satu kali dan tidak bisa diubah setelahnya.</span>
        </label>

        {error && <div className="alert error">{error}</div>}

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn secondary" onClick={onBack} disabled={busy}>
            ← Kembali ke chat
          </button>
          <button
            className="btn accent"
            style={{ flex: 1 }}
            onClick={() => void upload()}
            disabled={!picked || !!picked.problem || !confirmed || busy}
          >
            {status === "uploading" ? "Mengunggah…" : status === "verifying" ? "Memverifikasi…" : "Kumpulkan Proposal"}
          </button>
        </div>
      </div>
    </div>
  );
}
