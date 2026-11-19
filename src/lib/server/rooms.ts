// Server only. Loads a room, applies one operation to it and tells everyone watching.

import { applyOp, dueAlerts, emptyState, type Op, type RoomState } from "../room";
import { validZone } from "../tracker";
import { broadcast } from "./hub";
import { locked } from "./lock";
import { notifySync, reconcile } from "./push";
import { getStore, type RoomRecord } from "./store";

export type RoomView = { rev: number; state: RoomState };

export const view = (r: RoomRecord): RoomView => ({ rev: r.rev, state: r.state });

export async function loadRoom(id: string) {
  return getStore().get(id);
}

/** Operations that may create a room. Others on a missing room are ignored, so nothing empty is stored. */
const CREATES = new Set(["save", "replace"]);

export async function applyRoomOp(id: string, op: Op, tz: unknown, device?: string): Promise<RoomView> {
  return locked(id, async () => {
    const store = getStore();
    for (let attempt = 0; attempt < 4; attempt++) {
      const rec = await store.get(id);
      const now = Date.now();
      const isNew = !rec;
      const base: RoomRecord = rec ?? {
        id,
        rev: 0,
        state: emptyState(validZone(tz) ? tz : "UTC"),
        createdAt: now,
        updatedAt: now,
      };
      if (isNew && !CREATES.has(op.t)) return view(base);

      const next = applyOp(base.state, op, now);
      if (next === base.state) return view(base); // nothing changed, or already applied

      // Notifications that will be due, so they survive a restart and can be scheduled.
      const alerts = dueAlerts(next, now);
      const saved: RoomRecord = { ...base, rev: base.rev + 1, state: next, updatedAt: now, alerts };
      const ok = isNew ? await store.create(saved) : await store.update(saved, base.rev);
      if (ok) {
        broadcast(id, "state", view(saved));
        reconcile(id, alerts, next, now);
        if (op.t === "start" || op.t === "pause") {
          const title = next.topics.find((t) => t.id === op.id)?.title;
          if (title) void notifySync(id, op.t, title, device).catch(() => {});
        }
        return view(saved);
      }
    }
    throw new Error("conflict");
  });
}
