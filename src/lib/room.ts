// Shared by the browser and the server: what a room looks like and how every change is applied.
// The server applies each operation with its own clock and is the source of truth. The browser applies
// the same function optimistically so the screen reacts instantly, then adopts the server's answer.

import { addSpan, COLORS, dayKey, startOfDay, type Log, type Topic } from "./tracker";

export const ROOM_ID_RE = /^[A-Za-z0-9]{12,24}$/;
export const MAX_TOPICS = 100;
export const MAX_DAYS = 800;
const MAX_APPLIED = 200;
const DAY_MS = 86400e3;

export type RoomState = {
  topics: Topic[];
  log: Log;
  /** IANA zone that decides where each day starts and ends for everybody in the room. */
  tz: string;
  /** Recently applied operation ids, so a retried request is never applied twice. */
  applied: string[];
};

export type OpBody =
  | { t: "start"; id: string }
  | { t: "pause"; id: string }
  | { t: "break"; id: string; ms: number }
  | { t: "clearBreak"; id: string }
  | { t: "stopAlarms" }
  | { t: "save"; topic: Topic }
  | { t: "hide"; id: string; hidden: boolean }
  | { t: "archive"; id: string }
  | { t: "restore"; id: string }
  | { t: "remove"; id: string }
  | { t: "purge"; id: string }
  | { t: "reset"; id: string }
  | { t: "settle" }
  | { t: "replace"; topics: Topic[]; log: Log };

export type Op = OpBody & {
  opId: string;
  /** The browser's estimate of server time when the change was made. Only used for the optimistic preview. */
  at?: number;
};

export const emptyState = (tz: string): RoomState => ({ topics: [], log: {}, tz, applied: [] });

// ---------- validation ----------

const isNum = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const isId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,40}$/.test(v);
const TIME_MAX = 4102444800000; // year 2100

/** Cleans one topic from outside input. `full` keeps timer fields (imports); otherwise they are dropped. */
export function sanitizeTopic(x: unknown, full = false): Topic | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!isId(o.id)) return null;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 50) : "";
  if (!title) return null;
  if (!isNum(o.goalMs, 60000, 24 * 3600e3)) return null;
  const t: Topic = {
    id: o.id,
    title,
    color: typeof o.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(o.color) ? o.color : COLORS[0],
    goalMs: Math.round(o.goalMs),
    startedAt: null,
    kind: o.kind === "noise" ? "noise" : "signal",
  };
  if (full) {
    if (isNum(o.startedAt, 0, TIME_MAX)) t.startedAt = o.startedAt;
    if (isNum(o.archivedAt, 0, TIME_MAX)) t.archivedAt = o.archivedAt;
    if (o.deleted === true) t.deleted = true;
    if (o.hidden === true) t.hidden = true;
    if (isNum(o.breakUntil, 0, TIME_MAX)) t.breakUntil = o.breakUntil;
    if (isNum(o.breakMs, 0, 24 * 3600e3)) t.breakMs = o.breakMs;
  }
  return t;
}

export function sanitizeLog(x: unknown): Log {
  const out: Log = {};
  if (!x || typeof x !== "object") return out;
  const keys = Object.keys(x as object)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .slice(-MAX_DAYS);
  for (const k of keys) {
    const row = (x as Record<string, unknown>)[k];
    if (!row || typeof row !== "object") continue;
    const clean: Record<string, number> = {};
    for (const [id, ms] of Object.entries(row as object)) {
      if (isId(id) && isNum(ms, 0, DAY_MS)) clean[id] = Math.round(ms);
    }
    if (Object.keys(clean).length) out[k] = clean;
  }
  return out;
}

/** Checks and cleans an operation received over the network. */
export function parseOp(x: unknown): Op | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!isId(o.opId)) return null;
  const base = { opId: o.opId, at: isNum(o.at, 0, TIME_MAX) ? o.at : undefined };
  switch (o.t) {
    case "start":
    case "pause":
    case "clearBreak":
    case "archive":
    case "restore":
    case "remove":
    case "purge":
    case "reset":
      return isId(o.id) ? ({ ...base, t: o.t, id: o.id } as Op) : null;
    case "break":
      return isId(o.id) && isNum(o.ms, 1000, 24 * 3600e3) ? { ...base, t: "break", id: o.id, ms: Math.round(o.ms) } : null;
    case "hide":
      return isId(o.id) && typeof o.hidden === "boolean" ? { ...base, t: "hide", id: o.id, hidden: o.hidden } : null;
    case "stopAlarms":
    case "settle":
      return { ...base, t: o.t };
    case "save": {
      const topic = sanitizeTopic(o.topic);
      return topic ? { ...base, t: "save", topic } : null;
    }
    case "replace": {
      if (!Array.isArray(o.topics) || o.topics.length > MAX_TOPICS) return null;
      const topics = o.topics.map((t) => sanitizeTopic(t, true));
      if (topics.some((t) => !t)) return null;
      return { ...base, t: "replace", topics: topics as Topic[], log: sanitizeLog(o.log) };
    }
    default:
      return null;
  }
}

// ---------- applying operations ----------

/** Stops a running topic and books its time. `endAt` lets us stop it retroactively. */
function stopTopic(s: RoomState, id: string, endAt: number): RoomState {
  const t = s.topics.find((x) => x.id === id);
  if (!t || t.startedAt == null) return s;
  return {
    ...s,
    topics: s.topics.map((x) => (x.id === id ? { ...x, startedAt: null } : x)),
    log: addSpan(s.log, id, t.startedAt, Math.max(t.startedAt, endAt), s.tz),
  };
}

const mapTopic = (s: RoomState, id: string, f: (t: Topic) => Topic): RoomState =>
  s.topics.some((t) => t.id === id) ? { ...s, topics: s.topics.map((t) => (t.id === id ? f(t) : t)) } : s;

/** A timer that reaches its daily goal stops itself, exactly at the goal. */
function settle(s: RoomState, now: number): RoomState {
  const key = dayKey(now, s.tz);
  const dayStart = startOfDay(now, s.tz);
  let next = s;
  for (const t of s.topics) {
    if (t.startedAt == null) continue;
    const spent = (s.log[key]?.[t.id] ?? 0) + (now - Math.max(t.startedAt, dayStart));
    if (spent >= t.goalMs) next = stopTopic(next, t.id, now - (spent - t.goalMs));
  }
  return next;
}

function change(s: RoomState, op: Op, now: number): RoomState {
  switch (op.t) {
    case "start":
      // resuming work cancels any pending break reminder / silences its alarm
      return mapTopic(s, op.id, (t) => (t.startedAt == null ? { ...t, startedAt: now, breakUntil: null } : t));
    case "pause":
      return stopTopic(s, op.id, now);
    case "break":
      return mapTopic(s, op.id, (t) => ({ ...t, breakUntil: now + op.ms, breakMs: op.ms }));
    case "clearBreak":
      return mapTopic(s, op.id, (t) => (t.breakUntil != null ? { ...t, breakUntil: null } : t));
    case "stopAlarms":
      return s.topics.some((t) => t.breakUntil != null && now >= t.breakUntil)
        ? {
            ...s,
            topics: s.topics.map((t) => (t.breakUntil != null && now >= t.breakUntil ? { ...t, breakUntil: null } : t)),
          }
        : s;
    case "save": {
      const topic = op.topic;
      if (s.topics.some((t) => t.id === topic.id)) {
        // only the fields the dialog edits, so it never overwrites a timer, archive or hidden change made elsewhere
        return mapTopic(s, topic.id, (t) => ({ ...t, title: topic.title, color: topic.color, goalMs: topic.goalMs, kind: topic.kind }));
      }
      return s.topics.length >= MAX_TOPICS ? s : { ...s, topics: [...s.topics, { ...topic, startedAt: null }] };
    }
    case "hide":
      return mapTopic(s, op.id, (t) => ((t.hidden ?? false) === op.hidden ? t : { ...t, hidden: op.hidden }));
    case "archive": {
      const n = stopTopic(s, op.id, now);
      return mapTopic(n, op.id, (t) => (t.archivedAt ? t : { ...t, archivedAt: now, breakUntil: null }));
    }
    case "restore":
      return mapTopic(s, op.id, (t) => ({ ...t, archivedAt: null, deleted: false, hidden: false }));
    case "remove": {
      const n = stopTopic(s, op.id, now);
      return mapTopic(n, op.id, (t) => ({ ...t, deleted: true, archivedAt: t.archivedAt ?? now, breakUntil: null }));
    }
    case "purge": {
      const log: Log = {};
      for (const [day, row] of Object.entries(s.log)) {
        const { [op.id]: _drop, ...rest } = row;
        if (Object.keys(rest).length) log[day] = rest;
      }
      const t = s.topics.find((x) => x.id === op.id);
      return { ...s, topics: t?.deleted ? s.topics.filter((x) => x.id !== op.id) : s.topics, log };
    }
    case "reset": {
      // stop the timer, drop any break reminder and forget all the time booked for this topic
      const log: Log = {};
      for (const [day, row] of Object.entries(s.log)) {
        const { [op.id]: _drop, ...rest } = row;
        if (Object.keys(rest).length) log[day] = rest;
      }
      return {
        ...s,
        topics: s.topics.map((t) => (t.id === op.id ? { ...t, startedAt: null, breakUntil: null } : t)),
        log,
      };
    }
    case "settle":
      return settle(s, now);
    case "replace":
      return { ...s, topics: op.topics, log: op.log };
  }
}

/**
 * Applies one operation. Returns the very same object when nothing changed, so the server can skip
 * saving and broadcasting. A changed state records the op id in `applied`.
 */
export function applyOp(s: RoomState, op: Op, now: number): RoomState {
  if (s.applied.includes(op.opId)) return s;
  const next = change(s, op, now);
  if (next === s) return s;
  return { ...next, applied: [...s.applied, op.opId].slice(-MAX_APPLIED) };
}

// ---------- ids ----------

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** A random room id (about 71 bits). Works in the browser and on the server. */
export function newRoomId(len = 12) {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let id = "";
  for (const b of bytes) id += B62[b % 62];
  return id;
}

export function newOpId() {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- alerts: things worth a push notification ----------

export type AlertKind = "done" | "break";

export type Alert = {
  /** Stable id of this particular event, for example "done:<topic>:<startedAt>". */
  key: string;
  kind: AlertKind;
  /** When it is due (server clock, epoch ms). */
  at: number;
  topicId: string;
  title: string;
  /** For "done": the daily goal in ms. */
  goalMs?: number;
};

/** How much of today's goal is used, counting a running timer. */
export function spentToday(s: RoomState, topicId: string, now: number): number {
  const t = s.topics.find((x) => x.id === topicId);
  const key = dayKey(now, s.tz);
  const booked = s.log[key]?.[topicId] ?? 0;
  if (!t || t.startedAt == null) return booked;
  return booked + Math.max(0, now - Math.max(t.startedAt, startOfDay(now, s.tz)));
}

/** True when the topic has used up its goal today. */
export const doneToday = (s: RoomState, topicId: string, now: number) => {
  const t = s.topics.find((x) => x.id === topicId);
  return !!t && t.goalMs > 0 && spentToday(s, topicId, now) >= t.goalMs;
};

/**
 * Events that will need a notification, given the room as it is now:
 * - a running timer reaches its daily goal (only if that happens before the day ends)
 * - a break reminder comes due
 */
export function dueAlerts(s: RoomState, now: number): Alert[] {
  const out: Alert[] = [];
  const dayEnd = startOfDay(startOfDay(now, s.tz) + 26 * 3600e3, s.tz);
  for (const t of s.topics) {
    if (t.archivedAt) continue;
    if (t.startedAt != null) {
      const left = t.goalMs - spentToday(s, t.id, now);
      if (left > 0 && now + left < dayEnd) {
        out.push({ key: `done:${t.id}:${t.startedAt}`, kind: "done", at: now + left, topicId: t.id, title: t.title, goalMs: t.goalMs });
      }
    }
    if (t.breakUntil != null && t.breakUntil > now) {
      out.push({ key: `break:${t.id}:${t.breakUntil}`, kind: "break", at: t.breakUntil, topicId: t.id, title: t.title });
    }
  }
  return out;
}
