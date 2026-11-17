import { ROOM_ID_RE } from "@/lib/room";
import { loadRoom, view } from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The current state of a room. `room` is null while nothing has been saved yet. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ROOM_ID_RE.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    const rec = await loadRoom(id);
    return Response.json({ room: rec ? view(rec) : null, serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
