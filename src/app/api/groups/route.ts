import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Dropdown options for Tahap 1: the group names and session numbers that exist in the database. */
export async function GET() {
  const { data, error } = await db().from("groups").select("group_name, session_no").eq("active", true);
  if (error) return jsonError(500, "Gagal memuat daftar kelompok.");
  const groupNames = [...new Set(data.map((g) => g.group_name as string))].sort((a, b) => a.localeCompare(b));
  const sessions = [...new Set(data.map((g) => g.session_no as number))].sort((a, b) => a - b);
  return NextResponse.json({ groupNames, sessions });
}
