import "server-only";
import { timingSafeEqual } from "node:crypto";
import { jsonError } from "./http";

/** Returns an error response when the request lacks the admin password, otherwise null. */
export function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return jsonError(500, "ADMIN_PASSWORD belum di-set di environment variables.");
  const given = req.headers.get("x-admin-password") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return jsonError(401, "Password admin salah.");
  return null;
}
