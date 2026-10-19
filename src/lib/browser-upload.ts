import { createClient } from "@supabase/supabase-js";

/**
 * Uploads the proposal straight to Supabase Storage using the one-time signed
 * token issued by /api/submission/upload-url. The publishable/anon key only
 * identifies the project; the signed token is what authorises this one upload.
 */
export async function uploadWithSignedToken(path: string, token: string, file: File) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Konfigurasi Supabase belum lengkap (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  // Some systems report an empty file.type; the bucket only accepts application/pdf.
  const pdf = new File([file], file.name, { type: "application/pdf" });
  const { error } = await supabase.storage
    .from("proposals")
    .uploadToSignedUrl(path, token, pdf, { contentType: "application/pdf" });
  if (error) throw new Error(error.message);
}

/** Page count in the browser, so the team gets instant feedback before uploading. */
export async function countPdfPages(file: File): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  return doc.getPageCount();
}
