export type Topic = {
  id: string;
  title: string;
  color: string;
  /** Daily time budget in milliseconds. */
  goalMs: number;
  /** Epoch ms when the timer was started, or null when paused. */
  startedAt: number | null;
  /** Set when archived (or deleted); archived columns sort to the end by this time. */
  archivedAt?: number | null;
  /** Deleted topics vanish from Archives but keep their column in the history table. */
  deleted?: boolean;
  /** Hidden from the table: an active topic's column goes blank, an archived one disappears. */
  hidden?: boolean;
  /** When a break reminder is due. In the past = the alarm is ringing until stopped. */
  breakUntil?: number | null;
  /** Length of the current break, for its progress ring. */
  breakMs?: number;
};

export const isRinging = (t: Topic, now: number) => t.breakUntil != null && now >= t.breakUntil;

/** dateKey (YYYY-MM-DD) -> topicId -> milliseconds spent that day */
export type Log = Record<string, Record<string, number>>;

export const COLORS = [
  "#111111",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const pad = (n: number) => String(n).padStart(2, "0");

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const nextDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
};

/** Adds the span [from, to) to the log, splitting it across midnights. */
export function addSpan(log: Log, id: string, from: number, to: number): Log {
  if (to <= from) return log;
  const out: Log = { ...log };
  let cursor = from;
  while (cursor < to) {
    const end = Math.min(to, nextDay(cursor));
    const key = dayKey(cursor);
    out[key] = { ...(out[key] ?? {}), [id]: (out[key]?.[id] ?? 0) + (end - cursor) };
    cursor = end;
  }
  return out;
}

/** The log including time from timers that are currently running. */
export function liveLog(log: Log, topics: Topic[], now: number): Log {
  let out = log;
  for (const t of topics) {
    if (t.startedAt != null) out = addSpan(out, t.id, t.startedAt, now);
  }
  return out;
}

export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { hm: `${pad(h)}:${pad(m)}`, s: pad(s) };
}

/** "2h 15m", "45m" or "—" for (almost) nothing. */
export function fmtDuration(ms: number) {
  const mins = Math.round(ms / 60000);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const fmtGoal = (ms: number) => fmtDuration(ms).replace("—", "0m");

export const uid = () => Math.random().toString(36).slice(2, 10);

export function demoData(now = Date.now()): { topics: Topic[]; log: Log } {
  const topics: Topic[] = [
    { id: "deep", title: "Deep Work", color: "#3b82f6", goalMs: 4 * 3600e3, startedAt: null },
    { id: "read", title: "Reading", color: "#f59e0b", goalMs: 1 * 3600e3, startedAt: null },
    { id: "move", title: "Exercise", color: "#22c55e", goalMs: 1.5 * 3600e3, startedAt: null },
    { id: "side", title: "Side Project", color: "#8b5cf6", goalMs: 2 * 3600e3, startedAt: null },
  ];
  const log: Log = {};
  for (let i = 1; i <= 24; i++) {
    const key = dayKey(now - i * 86400e3);
    log[key] = {};
    topics.forEach((t, j) => {
      const r = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
      if (r < 0.18) return;
      log[key][t.id] = Math.round((t.goalMs * (0.35 + r * 0.9)) / 60000) * 60000;
    });
  }
  return { topics, log };
}
