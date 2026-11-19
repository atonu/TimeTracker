// Server only. One change at a time per room, so two requests never read the same revision and overwrite each other.

const g = globalThis as unknown as { __tickwellLocks?: Map<string, Promise<unknown>> };
const locks = (g.__tickwellLocks ??= new Map());

export async function locked<T>(id: string, fn: () => Promise<T>): Promise<T> {
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
