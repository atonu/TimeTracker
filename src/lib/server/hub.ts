// Server only. Keeps the open event streams of each room and pushes changes to them.
// Works because the app runs as one process. With several app containers this needs a shared
// channel (for example Redis pub/sub) so a change on one reaches the viewers of the others.

type Send = (event: string, data: unknown) => void;

type Hub = {
  rooms: Map<string, Set<Send>>;
  perIp: Map<string, number>;
};

const g = globalThis as unknown as { __tickwellHub?: Hub };
const hub: Hub = (g.__tickwellHub ??= { rooms: new Map(), perIp: new Map() });

const MAX_PER_ROOM = 25;
const MAX_PER_IP = 20;

/** Adds a viewer. Returns an unsubscribe function, or null when a limit is reached. */
export function subscribe(roomId: string, ip: string, send: Send): (() => void) | null {
  const set = hub.rooms.get(roomId) ?? new Set<Send>();
  if (set.size >= MAX_PER_ROOM || (hub.perIp.get(ip) ?? 0) >= MAX_PER_IP) return null;
  set.add(send);
  hub.rooms.set(roomId, set);
  hub.perIp.set(ip, (hub.perIp.get(ip) ?? 0) + 1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    set.delete(send);
    if (set.size === 0 && hub.rooms.get(roomId) === set) hub.rooms.delete(roomId);
    const left = (hub.perIp.get(ip) ?? 1) - 1;
    if (left <= 0) hub.perIp.delete(ip);
    else hub.perIp.set(ip, left);
  };
}

export function broadcast(roomId: string, event: string, data: unknown) {
  for (const send of hub.rooms.get(roomId) ?? []) {
    try {
      send(event, data);
    } catch {
      // a dead stream is removed by its own abort handler
    }
  }
}
