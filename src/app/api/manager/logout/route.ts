import { NextResponse } from "next/server";
import { clearManagerCookie } from "@/lib/manager";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearManagerCookie();
  return NextResponse.json({ ok: true });
}
