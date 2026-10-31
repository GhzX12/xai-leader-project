import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { currentSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import { toChatMessage, type MessageRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** While a question waits for the manager: new leader messages since `after`, plus whether they are typing right now. */
export async function GET(req: Request) {
  const session = await currentSession();
  if (!session) return jsonError(401, "Sesi berakhir. Silakan masuk kembali.");
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;

  const supabase = db();
  const [{ data: rows, error }, { data: fresh }] = await Promise.all([
    supabase.from("messages").select("*").eq("session_id", session.id).eq("role", "assistant").gt("id", after).order("id"),
    supabase.from("sessions").select("manager_typing_until").eq("id", session.id).single(),
  ]);
  if (error) return jsonError(500, "Gagal memuat pesan.");
  const until = fresh?.manager_typing_until ? new Date(fresh.manager_typing_until as string).getTime() : 0;
  return NextResponse.json({
    messages: ((rows ?? []) as MessageRow[]).map(toChatMessage),
    typing: until > Date.now(),
  });
}
