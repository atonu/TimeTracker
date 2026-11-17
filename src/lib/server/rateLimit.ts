// Server only. A small in-memory limiter (fixed window) and the client address behind Cloudflare.

const g = globalThis as unknown as { __tickwellRate?: Map<string, { n: number; reset: number }> };
const buckets = (g.__tickwellRate ??= new Map());

/** Returns true while `key` is under `limit` hits per `windowMs`. */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}

export function clientIp(req: Request) {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}
