"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyOp, emptyState, newOpId, type Op, type OpBody, type RoomState } from "./room";
import { deviceId } from "./usePush";
import { browserZone, dayKey, demoData, liveLog, setZone, type Log, type Topic } from "./tracker";

const LEGACY_KEY = "timetracker:v1";
export const LAST_ROOM_KEY = "tickwell:lastRoom";
export const IMPORT_KEY = "tickwell:importInto";

export type SyncStatus = "connecting" | "live" | "offline";

type Confirmed = { rev: number; state: RoomState };

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

/**
 * The state of one shared room. Everything the screen shows comes from here.
 * - `confirmed` is what the server last told us.
 * - `pending` are changes made here that the server has not confirmed yet. They are shown at once
 *   (optimistically), kept in localStorage so they survive a reload, and re-sent until accepted.
 */
export function useTracker(roomId: string) {
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [pending, setPending] = useState<Op[]>([]);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [loaded, setLoaded] = useState(false); // cache read, and the server answered (or gave up waiting)
  const offset = useRef(0); // server clock minus this device's clock
  const [now, setNow] = useState(() => Date.now());
  const tz = useRef(browserZone());

  const cacheKey = `tickwell:room:${roomId}`;
  const queueKey = `tickwell:queue:${roomId}`;
  const pendingRef = useRef<Op[]>([]);
  const confirmedRef = useRef<Confirmed | null>(null);
  confirmedRef.current = confirmed;

  const setQueue = useCallback(
    (next: Op[]) => {
      pendingRef.current = next;
      setPending(next);
      write(queueKey, next);
    },
    [queueKey],
  );

  /** Adopts a newer server state and forgets the pending changes it already contains. */
  const accept = useCallback(
    (rev: number, state: RoomState) => {
      const cur = confirmedRef.current;
      if (!cur || rev > cur.rev || (rev === cur.rev && cur.state.applied.length < state.applied.length)) {
        const c = { rev, state };
        confirmedRef.current = c;
        setConfirmed(c);
        write(cacheKey, c);
      }
      const rest = pendingRef.current.filter((o) => !state.applied.includes(o.opId));
      if (rest.length !== pendingRef.current.length) setQueue(rest);
    },
    [cacheKey, setQueue],
  );

  const syncClock = (serverTime: unknown) => {
    if (typeof serverTime === "number") offset.current = serverTime - Date.now();
  };

  // ---------- sending ----------
  const sending = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      while (pendingRef.current.length) {
        const op = pendingRef.current[0];
        let res: Response;
        try {
          res = await fetch(`/api/r/${roomId}/op`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op, tz: tz.current, device: deviceId() }),
          });
        } catch {
          setStatus("offline");
          retry.current ??= setTimeout(() => {
            retry.current = null;
            void flush();
          }, 3000);
          return;
        }
        if (res.status === 429 || res.status >= 500) {
          retry.current ??= setTimeout(() => {
            retry.current = null;
            void flush();
          }, 3000);
          return;
        }
        if (res.ok) {
          const j = await res.json();
          syncClock(j.serverTime);
          accept(j.rev, j.state);
        }
        // Done with this op: accepted, or refused for good (a 4xx means retrying cannot help).
        setQueue(pendingRef.current.filter((o) => o.opId !== op.opId));
      }
    } finally {
      sending.current = false;
    }
  }, [roomId, accept, setQueue]);

  const dispatch = useCallback(
    (body: OpBody) => {
      const op = { ...body, opId: newOpId(), at: Date.now() + offset.current } as Op;
      setQueue([...pendingRef.current, op]);
      void flush();
    },
    [flush, setQueue],
  );

  // ---------- receiving ----------
  useEffect(() => {
    const cached = read<Confirmed>(cacheKey);
    if (cached?.state) {
      confirmedRef.current = cached;
      setConfirmed(cached);
    }
    const queued = read<Op[]>(queueKey);
    if (Array.isArray(queued) && queued.length) {
      pendingRef.current = queued;
      setPending(queued);
    }
    try {
      localStorage.setItem(LAST_ROOM_KEY, roomId);
    } catch {}
    if (cached?.state) setLoaded(true);
    const giveUp = setTimeout(() => setLoaded(true), 2500);

    let es: EventSource | null = null;
    let closed = false;
    let reopen: ReturnType<typeof setTimeout> | null = null;
    let lastSeen = Date.now();

    /** A brand-new room can adopt the data this browser kept before rooms existed. */
    const importLegacy = () => {
      try {
        if (localStorage.getItem(IMPORT_KEY) !== roomId) return;
        localStorage.removeItem(IMPORT_KEY);
        const old = read<{ topics?: Topic[]; log?: Log }>(LEGACY_KEY);
        if (old?.topics?.length) {
          dispatch({ t: "replace", topics: old.topics, log: old.log ?? {} });
          localStorage.setItem(LEGACY_KEY + ":migrated", localStorage.getItem(LEGACY_KEY) ?? "");
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch {}
    };

    const open = () => {
      if (closed) return;
      es?.close();
      setStatus("connecting");
      lastSeen = Date.now();
      es = new EventSource(`/api/r/${roomId}/stream`);
      es.addEventListener("snapshot", (ev) => {
        lastSeen = Date.now();
        const j = JSON.parse((ev as MessageEvent).data);
        syncClock(j.serverTime);
        if (j.error) return setStatus("offline");
        if (j.room) accept(j.room.rev, j.room.state);
        else {
          if (!confirmedRef.current) accept(0, emptyState(tz.current));
          importLegacy();
        }
        setStatus("live");
        setLoaded(true);
        void flush();
      });
      es.addEventListener("state", (ev) => {
        lastSeen = Date.now();
        const j = JSON.parse((ev as MessageEvent).data);
        accept(j.rev, j.state);
      });
      es.addEventListener("ping", (ev) => {
        lastSeen = Date.now();
        try {
          syncClock(JSON.parse((ev as MessageEvent).data).t);
        } catch {}
        setStatus("live");
      });
      es.addEventListener("full", () => {
        es?.close();
        setStatus("offline");
        reopen = setTimeout(open, 10_000);
      });
      es.onerror = () => {
        setStatus("offline");
        if (es?.readyState === EventSource.CLOSED) reopen = setTimeout(open, 3000);
      };
    };
    open();

    // A phone that slept leaves a dead stream behind: reconnect if nothing arrived for a while.
    const watchdog = setInterval(() => {
      if (Date.now() - lastSeen > 50_000) open();
    }, 10_000);
    const wake = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSeen > 30_000) open();
    };
    const online = () => {
      open();
      void flush();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", online);

    void flush(); // changes queued before a reload

    return () => {
      closed = true;
      clearTimeout(giveUp);
      clearInterval(watchdog);
      if (reopen) clearTimeout(reopen);
      if (retry.current) clearTimeout(retry.current);
      es?.close();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", online);
    };
  }, [roomId, cacheKey, queueKey, accept, flush, dispatch]);

  // ---------- derived state ----------
  const base = useMemo(() => confirmed?.state ?? emptyState(tz.current), [confirmed]);
  setZone(base.tz); // every day boundary below uses the room's zone

  const state = useMemo(
    () => pending.reduce((s, op) => applyOp(s, op, op.at ?? Date.now() + offset.current), base),
    [base, pending],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), 1000);
    setNow(Date.now() + offset.current);
    return () => clearInterval(id);
  }, []);

  const live = useMemo(() => liveLog(state.log, state.topics, now, state.tz), [state, now]);

  // A timer that reaches its daily goal stops itself. Every device may notice; the server only
  // acts once, so the others are no-ops.
  const lastSettle = useRef(0);
  useEffect(() => {
    const today = dayKey(now, state.tz);
    const finished = state.topics.some((t) => t.startedAt != null && (live[today]?.[t.id] ?? 0) >= t.goalMs);
    if (!finished || Date.now() - lastSettle.current < 2500) return;
    lastSettle.current = Date.now();
    dispatch({ t: "settle" });
  }, [live, now, state, dispatch]);

  // ---------- actions ----------
  const start = useCallback((id: string) => dispatch({ t: "start", id }), [dispatch]);
  const pause = useCallback((id: string) => dispatch({ t: "pause", id }), [dispatch]);
  const startBreak = useCallback((id: string, ms: number) => dispatch({ t: "break", id, ms }), [dispatch]);
  const clearBreak = useCallback((id: string) => dispatch({ t: "clearBreak", id }), [dispatch]);
  const stopAlarms = useCallback(() => dispatch({ t: "stopAlarms" }), [dispatch]);
  const save = useCallback((topic: Topic) => dispatch({ t: "save", topic }), [dispatch]);
  const hide = useCallback((id: string, hidden: boolean) => dispatch({ t: "hide", id, hidden }), [dispatch]);
  const archive = useCallback((id: string) => dispatch({ t: "archive", id }), [dispatch]);
  const restore = useCallback((id: string) => dispatch({ t: "restore", id }), [dispatch]);
  const remove = useCallback((id: string) => dispatch({ t: "remove", id }), [dispatch]);
  const purgeHistory = useCallback((id: string) => dispatch({ t: "purge", id }), [dispatch]);
  const loadDemo = useCallback(() => {
    const d = demoData(Date.now() + offset.current);
    dispatch({ t: "replace", topics: d.topics, log: d.log });
  }, [dispatch]);

  return {
    topics: state.topics,
    log: live,
    now,
    hydrated: loaded,
    status,
    start,
    pause,
    startBreak,
    clearBreak,
    stopAlarms,
    save,
    hide,
    archive,
    restore,
    remove,
    purgeHistory,
    loadDemo,
  };
}
