import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Tahap 1 dropdown data.
 *  - GET /api/groups            → classes with their team names
 *  - GET /api/groups?team=Alpha 1 → the member names of that team (shown after picking a team)
 * Tokens are never returned here.
 */
export async function GET(req: Request) {
  const supabase = db();
  const team = new URL(req.url).searchParams.get("team");

  if (team) {
    const { data: group } = await supabase.from("groups").select("group_name").eq("group_name", team).eq("active", true).maybeSingle();
    if (!group) return jsonError(404, "Kelompok tidak ditemukan.");
    const { data: teamRow } = await supabase.from("teams").select("id").eq("team_code", team).maybeSingle();
    if (!teamRow) return NextResponse.json({ members: [] });
    const { data: members, error } = await supabase.from("members").select("name").eq("team_id", teamRow.id).order("id");
    if (error) return jsonError(500, "Gagal memuat anggota kelompok.");
    return NextResponse.json({ members: members.map((m) => m.name as string) });
  }

  const { data, error } = await supabase.from("groups").select("group_name, class_name").eq("active", true);
  if (error) {
    console.error("groups query failed", error.message);
    return jsonError(500, "Gagal memuat daftar kelompok.");
  }
  const classMap = new Map<string, Set<string>>();
  for (const g of data) {
    const cls = (g.class_name as string | null) ?? "Kelompok";
    if (!classMap.has(cls)) classMap.set(cls, new Set());
    classMap.get(cls)!.add(g.group_name as string);
  }
  const classes = [...classMap.entries()]
    .sort(([a], [b]) => byName(a, b))
    .map(([name, groups]) => ({ name, groups: [...groups].sort(byName) }));
  return NextResponse.json({ classes });
}
