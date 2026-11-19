import { parseOp, ROOM_ID_RE } from "@/lib/room";
import { allow, clientIp } from "@/lib/server/rateLimit";
import { applyRoomOp } from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BODY = 64 * 1024;
const MAX_IMPORT = 512 * 1024;

/** Applies one change to a room and answers with the new state. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ROOM_ID_RE.test(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const ip = clientIp(req);
  if (!allow(`ip:${ip}`, 120, 10_000) || !allow(`room:${id}`, 200, 10_000)) {
    return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "5" } });
  }

  const text = await req.text();
  if (text.length > MAX_IMPORT) return Response.json({ error: "too large" }, { status: 413 });
  let body: { op?: unknown; tz?: unknown; device?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const op = parseOp(body.op);
  if (!op) return Response.json({ error: "bad op" }, { status: 400 });
  if (op.t !== "replace" && text.length > MAX_BODY) return Response.json({ error: "too large" }, { status: 413 });

  try {
    const device = typeof body.device === "string" && /^[w-]{6,40}$/.test(body.device) ? body.device : undefined;
    const room = await applyRoomOp(id, op, body.tz, device);
    return Response.json({ ...room, serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "busy" }, { status: 503, headers: { "Retry-After": "2" } });
  }
}
