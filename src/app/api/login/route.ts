import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { teamCode, parseSessionLabel } from "@/lib/experiment";
import { jsonError, readJson } from "@/lib/http";
import { setSessionCookie } from "@/lib/session";
import { buildState } from "@/lib/state";
import { db, logEvent } from "@/lib/supabase";
import type { SessionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Best-effort brute-force guard (per server instance): 6 wrong tokens per team + IP per 10 minutes.
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 6;
const fails = new Map<string, { count: number; since: number }>();

function failKey(req: Request, team: string) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return `${ip}|${team}`;
}
function tooManyFails(key: string) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.since > FAIL_WINDOW_MS) {
    fails.delete(key);
    return false;
  }
  return f.count >= MAX_FAILS;
}
function addFail(key: string) {
  const f = fails.get(key);
  if (!f || Date.now() - f.since > FAIL_WINDOW_MS) fails.set(key, { count: 1, since: Date.now() });
  else f.count++;
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a.toUpperCase());
  const y = Buffer.from(b.toUpperCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Tahap 1: verify team + paper token, record the session start time, then start or resume that team's session. */
export async function POST(req: Request) {
  const body = await readJson<{ groupName: string; token: string; sessionLabel: string; picName: string }>(req);
  const groupName = String(body.groupName ?? "").trim();
  const token = String(body.token ?? "").trim();
  const picName = String(body.picName ?? "").trim().replace(/\s+/g, " ");
  const parsedLabel = parseSessionLabel(String(body.sessionLabel ?? ""));

  if (!groupName) return jsonError(400, "Pilih kelompok kalian dulu.");
  if (picName.length < 2 || picName.length > 80) return jsonError(400, "Pilih atau isi nama PIC (2–80 karakter).");
  if (!parsedLabel) return jsonError(400, "Format sesi belum sesuai. Tulis seperti ini: 21/10/26: 14.30");
  if (token.length < 4 || token.length > 32) return jsonError(400, "Masukkan token dari kertas yang dibagikan peneliti.");

  const key = failKey(req, groupName);
  if (tooManyFails(key)) {
    return jsonError(429, "Terlalu banyak percobaan token yang salah. Tunggu beberapa menit, lalu coba lagi.");
  }

  const code = teamCode(groupName);
  const supabase = db();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("code, active, token")
    .eq("code", code)
    .maybeSingle();
  if (groupError) return jsonError(500, "Gagal memverifikasi kelompok.");

  // The same message for an unknown team and a wrong token, so tokens can't be probed.
  if (!group || !group.active || !group.token || !sameToken(token, group.token as string)) {
    addFail(key);
    await logEvent(null, "login_failed", { group: groupName });
    return jsonError(403, "Token tidak cocok dengan kelompok ini. Cek lagi kertas token kalian.");
  }
  fails.delete(key);

  let { data: session } = await supabase.from("sessions").select("*").eq("group_code", code).maybeSingle();
  if (session) {
    // A returning team: whoever logs in now is the PIC operating this device.
    if (session.pic_name !== picName) {
      await supabase.from("sessions").update({ pic_name: picName }).eq("id", session.id);
      await logEvent(session.id, "pic_changed", { from: session.pic_name, to: picName });
      session.pic_name = picName;
    }
    await logEvent(session.id, "login_resume", { pic_name: picName, session_label: parsedLabel.label });
  } else {
    const inserted = await supabase
      .from("sessions")
      .insert({ group_code: code, pic_name: picName, session_label: parsedLabel.label, session_batch: parsedLabel.batch })
      .select("*")
      .single();
    if (inserted.error) {
      // Another device of the same team may have created it a moment ago.
      const again = await supabase.from("sessions").select("*").eq("group_code", code).maybeSingle();
      if (!again.data) return jsonError(500, "Gagal membuat sesi.");
      session = again.data;
    } else {
      session = inserted.data;
      await logEvent(session.id, "login", { pic_name: picName, session_label: parsedLabel.label });
    }
  }

  await setSessionCookie((session as SessionRow).access_token);
  return NextResponse.json(await buildState(session as SessionRow));
}
