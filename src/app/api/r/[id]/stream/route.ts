import { ROOM_ID_RE } from "@/lib/room";
import { subscribe } from "@/lib/server/hub";
import { clientIp } from "@/lib/server/rateLimit";
import { loadRoom, view } from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PING_MS = 20_000;

/** Server-Sent Events: a snapshot when you connect, then every change as it happens. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ROOM_ID_RE.test(id)) return new Response("bad id", { status: 400 });

  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      // Subscribe first so a change that lands while the snapshot loads is not missed.
      const unsubscribe = subscribe(id, clientIp(req), send);
      if (!unsubscribe) {
        controller.enqueue(enc.encode("event: full\ndata: {}\n\n"));
        controller.close();
        return;
      }
      const ping = setInterval(() => {
        try {
          send("ping", { t: Date.now() });
        } catch {
          cleanup();
        }
      }, PING_MS);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cleanup);

      try {
        const rec = await loadRoom(id);
        send("snapshot", { room: rec ? view(rec) : null, serverTime: Date.now() });
      } catch {
        send("snapshot", { room: null, error: true, serverTime: Date.now() });
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
