import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { MessageRow } from "./types";

/** Human "General Manager" console: login with a Manager ID + password (env vars), kept in a signed cookie. */
export const MANAGER_COOKIE = "cl_manager";
const MAX_AGE = 60 * 60 * 12; // one working day

export type ManagerMode = "ai" | "human" | "hybrid";
export const isHumanMode = (m: string | null | undefined) => m === "human" || m === "hybrid";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function key() {
  const pw = process.env.MANAGER_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", "cl-manager-session-v1").update(`${process.env.MANAGER_ID ?? ""}|${pw}`).digest();
}

export function checkManagerCredentials(id: string, password: string) {
  const eid = process.env.MANAGER_ID;
  const epw = process.env.MANAGER_PASSWORD;
  if (!eid || !epw) return false;
  const idOk = safeEq(norm(id), norm(eid));
  const pwOk = safeEq(password, epw);
  return idOk && pwOk;
}

function sign(payload: string, k: Buffer) {
  return createHmac("sha256", k).update(payload).digest("base64url");
}

export async function setManagerCookie(managerId: string) {
  const k = key();
  if (!k) throw new Error("MANAGER_PASSWORD belum di-set.");
  const payload = Buffer.from(JSON.stringify({ id: managerId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(MANAGER_COOKIE, `${payload}.${sign(payload, k)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearManagerCookie() {
  (await cookies()).delete(MANAGER_COOKIE);
}

/** The signed-in manager's id, or null. */
export async function currentManager(): Promise<string | null> {
  const k = key();
  const raw = (await cookies()).get(MANAGER_COOKIE)?.value;
  if (!k || !raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEq(sig, sign(payload, k))) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id: string; exp: number };
    return typeof id === "string" && typeof exp === "number" && exp > Date.now() ? id : null;
  } catch {
    return null;
  }
}

/** Questions the team asked since the leader last replied (they are all waiting for an answer). */
export function unansweredOf(messages: MessageRow[]) {
  let lastAssistant = -1;
  messages.forEach((m, i) => {
    if (m.role === "assistant") lastAssistant = i;
  });
  const pending = messages.slice(lastAssistant + 1).filter((m) => m.role === "user");
  return { pending, history: messages.slice(0, lastAssistant + 1) };
}

/** Split a manager's text into chat bubbles: a blank line starts a new bubble (max 6). */
export function toBubbles(text: string): string[] {
  const parts = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 6) return parts;
  return [...parts.slice(0, 5), parts.slice(5).join("\n\n")];
}
