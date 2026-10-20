import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Dropdown options for Tahap 1: classes with their teams, plus the session numbers that exist in the database. */
export async function GET() {
  const { data, error } = await db().from("groups").select("group_name, session_no, class_name").eq("active", true);
  if (error) {
    console.error("groups query failed", error.message);
    return jsonError(500, "Gagal memuat daftar kelompok.");
  }
  const classMap = new Map<string, Set<string>>();
  for (const g of data) {
    const cls = (g.class_name as string | null) ?? "";
    if (!classMap.has(cls)) classMap.set(cls, new Set());
    classMap.get(cls)!.add(g.group_name as string);
  }
  const classes = [...classMap.entries()]
    .sort(([a], [b]) => byName(a, b))
    .map(([name, groups]) => ({ name, groups: [...groups].sort(byName) }));
  const groupNames = [...new Set(data.map((g) => g.group_name as string))].sort(byName);
  const sessions = [...new Set(data.map((g) => g.session_no as number))].sort((a, b) => a - b);
  return NextResponse.json({ classes, groupNames, sessions });
}
