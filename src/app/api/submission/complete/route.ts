import { after, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { MAX_PDF_BYTES, MIN_PDF_PAGES } from "@/lib/experiment";
import { runGrading } from "@/lib/grading";
import { jsonError, readJson } from "@/lib/http";
import { currentSession } from "@/lib/session";
import { buildState } from "@/lib/state";
import { db, logEvent, PROPOSALS_BUCKET } from "@/lib/supabase";
import type { SessionRow } from "@/lib/types";

export const dynamic = "force-dynamic";
// Grading runs after the response is sent (after()), inside this function's time budget.
export const maxDuration = 300;

/** Tahap 3, step 2: verify the uploaded PDF, record the submission, then grade it behind the scenes. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return jsonError(401, "Sesi berakhir. Silakan masuk kembali.");
  if (session.stage !== "workspace") return jsonError(409, "Proposal sudah dikumpulkan.");

  const body = await readJson<{ path: string; fileName: string }>(req);
  const path = String(body.path ?? "");
  const fileName = String(body.fileName ?? "proposal.pdf").slice(0, 200);
  if (!path.startsWith(`${session.group_code}/`) || path.includes("..")) return jsonError(400, "Path file tidak valid.");

  const supabase = db();
  const storage = supabase.storage.from(PROPOSALS_BUCKET);
  const { data: file, error: downloadError } = await storage.download(path);
  if (downloadError || !file) return jsonError(400, "File belum terunggah. Coba ulangi.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const reject = async (message: string) => {
    await storage.remove([path]);
    return jsonError(422, message);
  };
  if (bytes.byteLength > MAX_PDF_BYTES) return reject("Ukuran file melebihi batas.");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return reject("File bukan PDF yang valid.");

  let pageCount: number;
  try {
    pageCount = (await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  } catch {
    return reject("PDF tidak bisa dibaca. Ekspor ulang dokumen Anda ke PDF lalu coba lagi.");
  }
  if (pageCount < MIN_PDF_PAGES) {
    return reject(`PDF Anda ${pageCount} halaman. Minimal ${MIN_PDF_PAGES} halaman (satu halaman per bagian).`);
  }

  const { error: insertError } = await supabase.from("submissions").insert({
    session_id: session.id,
    file_path: path,
    file_name: fileName,
    file_size: bytes.byteLength,
    page_count: pageCount,
  });
  if (insertError) {
    await storage.remove([path]);
    return jsonError(409, "Proposal kelompok ini sudah pernah dikumpulkan.");
  }

  const { data: updated } = await supabase
    .from("sessions")
    .update({ stage: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", session.id)
    .select("*")
    .single();
  await logEvent(session.id, "submitted", { file_name: fileName, page_count: pageCount, size: bytes.byteLength });

  after(async () => {
    try {
      await runGrading(session.id);
    } catch (err) {
      console.error("grading failed", err);
    }
  });

  return NextResponse.json(await buildState((updated as SessionRow | null) ?? session));
}
