import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/http";
import { setSessionCookie } from "@/lib/session";
import { buildState } from "@/lib/state";
import { db, logEvent } from "@/lib/supabase";
import type { SessionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Tahap 1: verify "<Kelompok>-<Sesi>" against the database, then start or resume that group's session. */
export async function POST(req: Request) {
  const body = await readJson<{ groupName: string; sessionNo: number | string; picName: string }>(req);
  const groupName = String(body.groupName ?? "").trim();
  const sessionNo = Number(body.sessionNo);
  const picName = String(body.picName ?? "").trim().replace(/\s+/g, " ");

  if (!groupName || !Number.isInteger(sessionNo) || sessionNo < 1) {
    return jsonError(400, "Pilih kelompok dan sesi terlebih dahulu.");
  }
  if (picName.length < 2 || picName.length > 60) {
    return jsonError(400, "Isi nama PIC (2–60 karakter).");
  }

  const code = `${groupName}-${sessionNo}`;
  const supabase = db();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("code, active")
    .eq("code", code)
    .maybeSingle();
  if (groupError) return jsonError(500, "Gagal memverifikasi kode kelompok.");
  if (!group || !group.active) {
    return jsonError(404, `Kode ${code} tidak terdaftar. Periksa kembali kelompok dan sesi Anda, atau hubungi peneliti.`);
  }

  let { data: session } = await supabase.from("sessions").select("*").eq("group_code", code).maybeSingle();
  if (session) {
    await logEvent(session.id, "login_resume", { pic_name: picName });
  } else {
    const inserted = await supabase.from("sessions").insert({ group_code: code, pic_name: picName }).select("*").single();
    if (inserted.error) {
      // Another device of the same group may have created it a moment ago.
      const again = await supabase.from("sessions").select("*").eq("group_code", code).maybeSingle();
      if (!again.data) return jsonError(500, "Gagal membuat sesi.");
      session = again.data;
    } else {
      session = inserted.data;
      await logEvent(session.id, "login", { pic_name: picName });
    }
  }

  await setSessionCookie((session as SessionRow).access_token);
  return NextResponse.json(await buildState(session as SessionRow));
}
