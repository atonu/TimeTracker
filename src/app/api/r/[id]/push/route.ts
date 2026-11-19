import { ROOM_ID_RE } from "@/lib/room";
import { parsePrefs, parseSub, pushConfigured, sendTest, setPrefs, subscribe, unsubscribe } from "@/lib/server/push";
import { allow, clientIp } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DEVICE_RE = /^[\w-]{6,40}$/;

/**
 * Notification settings of one device in a room.
 *   { action: "subscribe", sub, device, prefs, tz }   turn notifications on
 *   { action: "prefs", endpoint, prefs }              change what it is told about
 *   { action: "unsubscribe", endpoint }               turn them off
 *   { action: "test", endpoint }                      send a test notification
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ROOM_ID_RE.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  if (!pushConfigured()) return Response.json({ error: "not configured" }, { status: 503 });

  if (!allow(`push:${clientIp(req)}`, 30, 60_000)) {
    return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "30" } });
  }

  const text = await req.text();
  if (text.length > 4096) return Response.json({ error: "too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "subscribe": {
        const sub = parseSub(body.sub);
        if (!sub || typeof body.device !== "string" || !DEVICE_RE.test(body.device)) {
          return Response.json({ error: "bad subscription" }, { status: 400 });
        }
        const r = await subscribe(id, sub, body.device, parsePrefs(body.prefs), body.tz);
        return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.error }, { status: 409 });
      }
      case "prefs": {
        if (typeof body.endpoint !== "string") return Response.json({ error: "bad endpoint" }, { status: 400 });
        const ok = await setPrefs(id, body.endpoint, parsePrefs(body.prefs));
        return Response.json({ ok }, { status: ok ? 200 : 404 });
      }
      case "unsubscribe": {
        if (typeof body.endpoint !== "string") return Response.json({ error: "bad endpoint" }, { status: 400 });
        await unsubscribe(id, body.endpoint);
        return Response.json({ ok: true });
      }
      case "test": {
        if (typeof body.endpoint !== "string") return Response.json({ error: "bad endpoint" }, { status: 400 });
        const r = await sendTest(id, body.endpoint);
        return Response.json({ result: r }, { status: r === "ok" ? 200 : r === "unknown" ? 404 : 502 });
      }
      default:
        return Response.json({ error: "bad action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[tickwell] push request failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
