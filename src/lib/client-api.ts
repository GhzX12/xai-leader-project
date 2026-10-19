// Tiny fetch wrapper for the browser: always resolves, never throws.
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; data: any };

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};
  try {
    const res = await fetch(path, {
      ...rest,
      method: rest.method ?? (json !== undefined ? "POST" : "GET"),
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    return { ok: false, status: res.status, error: data?.error ?? `Terjadi kesalahan (${res.status}).`, data };
  } catch {
    return { ok: false, status: 0, error: "Koneksi terputus. Periksa internet Anda lalu coba lagi.", data: null };
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
