// Server only. Loads a room, applies one operation to it and tells everyone watching.

import { applyOp, emptyState, type Op, type RoomState } from "../room";
import { validZone } from "../tracker";
import { broadcast } from "./hub";
import { getStore, type RoomRecord } from "./store";

export type RoomView = { rev: number; state: RoomState };

export const view = (r: RoomRecord): RoomView => ({ rev: r.rev, state: r.state });

export async function loadRoom(id: string) {
  return getStore().get(id);
}

// One change at a time per room, so two requests never read the same revision and overwrite each other.
const g = globalThis as unknown as { __tickwellLocks?: Map<string, Promise<unknown>> };
const locks = (g.__tickwellLocks ??= new Map());

async function locked<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  try {
    return await run;
  } finally {
    if (locks.get(id) === tail) locks.delete(id);
  }
}

/** Operations that may create a room. Others on a missing room are ignored, so nothing empty is stored. */
const CREATES = new Set(["save", "replace"]);

export async function applyRoomOp(id: string, op: Op, tz: unknown): Promise<RoomView> {
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

      const saved: RoomRecord = { ...base, rev: base.rev + 1, state: next, updatedAt: now };
      const ok = isNew ? await store.create(saved) : await store.update(saved, base.rev);
      if (ok) {
        broadcast(id, "state", view(saved));
        return view(saved);
      }
    }
    throw new Error("conflict");
  });
}
