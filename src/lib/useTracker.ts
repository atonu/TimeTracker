"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addSpan, dayKey, demoData, liveLog, startOfDay, type Log, type Topic } from "./tracker";

const KEY = "timetracker:v1";

type State = { topics: Topic[]; log: Log };

/** Stops a running topic and books its time. `endAt` lets us stop it retroactively. */
function stopTopic(s: State, id: string, endAt = Date.now()): State {
  const t = s.topics.find((x) => x.id === id);
  if (!t || t.startedAt == null) return s;
  return {
    topics: s.topics.map((x) => (x.id === id ? { ...x, startedAt: null } : x)),
    log: addSpan(s.log, id, t.startedAt, Math.max(t.startedAt, endAt)),
  };
}

export function useTracker() {
  const [state, setState] = useState<State>({ topics: [], log: {} });
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setNow(Date.now());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const live = useMemo(() => liveLog(state.log, state.topics, now), [state, now]);

  // A timer that reaches its daily goal stops itself, exactly at the goal.
  useEffect(() => {
    const today = dayKey(now);
    const finished = state.topics.some(
      (t) => t.startedAt != null && (live[today]?.[t.id] ?? 0) >= t.goalMs,
    );
    if (!finished) return;
    setState((s) => {
      const t2 = Date.now();
      const key = dayKey(t2);
      let next = s;
      for (const t of s.topics) {
        if (t.startedAt == null) continue;
        const running = t2 - Math.max(t.startedAt, startOfDay(t2));
        const spent = (s.log[key]?.[t.id] ?? 0) + running;
        if (spent >= t.goalMs) next = stopTopic(next, t.id, t2 - (spent - t.goalMs));
      }
      return next;
    });
  }, [live, now, state.topics]);

  const start = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      topics: s.topics.map((t) => (t.id === id && t.startedAt == null ? { ...t, startedAt: Date.now() } : t)),
    }));
  }, []);

  const pause = useCallback((id: string) => setState((s) => stopTopic(s, id)), []);

  const save = useCallback((topic: Topic) => {
    setState((s) =>
      s.topics.some((t) => t.id === topic.id)
        ? { ...s, topics: s.topics.map((t) => (t.id === topic.id ? { ...t, ...topic, startedAt: t.startedAt } : t)) }
        : { ...s, topics: [...s.topics, topic] },
    );
  }, []);

  const archive = useCallback((id: string) => {
    setState((s) => {
      const n = stopTopic(s, id);
      return { ...n, topics: n.topics.map((t) => (t.id === id ? { ...t, archivedAt: Date.now() } : t)) };
    });
  }, []);

  const restore = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      topics: s.topics.map((t) => (t.id === id ? { ...t, archivedAt: null, deleted: false, hidden: false } : t)),
    }));
  }, []);

  /** Removes the topic from the cards and Archives; its history column stays. */
  const remove = useCallback((id: string) => {
    setState((s) => {
      const n = stopTopic(s, id);
      return {
        ...n,
        topics: n.topics.map((t) =>
          t.id === id ? { ...t, deleted: true, archivedAt: t.archivedAt ?? Date.now() } : t,
        ),
      };
    });
  }, []);

  /** Deletes a topic's recorded hours. A deleted topic then loses its column too. */
  const purgeHistory = useCallback((id: string) => {
    setState((s) => {
      const log: Log = {};
      for (const [day, row] of Object.entries(s.log)) {
        const { [id]: _drop, ...rest } = row;
        if (Object.keys(rest).length) log[day] = rest;
      }
      const t = s.topics.find((x) => x.id === id);
      return { topics: t?.deleted ? s.topics.filter((x) => x.id !== id) : s.topics, log };
    });
  }, []);

  const loadDemo =useCallback(() => setState(demoData()), []);

  return { topics: state.topics, log: live, now, hydrated, start, pause, save, archive, restore, remove, purgeHistory, loadDemo };
}
