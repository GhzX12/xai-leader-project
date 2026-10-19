import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { runGrading } from "@/lib/grading";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Re-run (or run for the first time) the AI grading of one submission. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json({ grading: await runGrading(id) });
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : "Penilaian gagal.");
  }
}
