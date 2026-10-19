import { NextResponse } from "next/server";
import { MAX_PDF_BYTES } from "@/lib/experiment";
import { jsonError, readJson } from "@/lib/http";
import { currentSession } from "@/lib/session";
import { db, PROPOSALS_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Tahap 3, step 1: hand the browser a one-time signed upload URL so the PDF goes
 * straight to Supabase Storage (Vercel functions cap request bodies at ~4.5 MB).
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return jsonError(401, "Sesi berakhir. Silakan masuk kembali.");
  if (session.stage !== "workspace") return jsonError(409, "Proposal sudah dikumpulkan atau sesi belum dimulai.");

  const body = await readJson<{ fileName: string; fileSize: number }>(req);
  const fileName = String(body.fileName ?? "proposal.pdf");
  const fileSize = Number(body.fileSize);
  if (!fileName.toLowerCase().endsWith(".pdf")) return jsonError(400, "File harus berformat PDF.");
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_PDF_BYTES) {
    return jsonError(400, `Ukuran file maksimal ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
  }

  const path = `${session.group_code}/${Date.now()}.pdf`;
  const { data, error } = await db().storage.from(PROPOSALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return jsonError(500, "Gagal menyiapkan upload.");
  return NextResponse.json({ path: data.path, token: data.token });
}
