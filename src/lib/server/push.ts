// Server only. Web Push: who to notify, when to notify, and the sending itself.
// Uses standard Web Push with VAPID keys, so it works in Chrome, Edge, Firefox, Android and, for apps
// added to the Home Screen, Safari on iPhone and iPad. No Firebase account is involved.
//
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                          optional contact, a https: or mailto: address

import webpush from "web-push";
import { doneToday, emptyState, type Alert, type RoomState } from "../room";
import { fmtGoal, validZone } from "../tracker";
import { locked } from "./lock";
import { getStore, type PushPrefs, type PushSub, type RoomRecord } from "./store";

const MAX_SUBS = 12;
export const DEFAULT_PREFS: PushPrefs = { done: true, brk: true, sync: false };

// ---------- setup ----------

export const publicKey = () => process.env.VAPID_PUBLIC_KEY || null;
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function init() {
  if (ready) return true;
  if (!pushConfigured()) return false;
  const subject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://tickwell.atonu.online";
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY as string, process.env.VAPID_PRIVATE_KEY as string);
  ready = true;
  return true;
}

type Payload = { title: string; body: string; tag: string; url: string };

/** Sends one notification. "gone" means the device unsubscribed, so it should be forgotten. */
async function sendOne(sub: PushSub, payload: Payload, ttl = 600): Promise<"ok" | "gone" | "error"> {
  if (!init()) return "error";
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: ttl, urgency: "high" });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}

async function sendMany(roomId: string, subs: PushSub[], payload: Payload) {
  const results = await Promise.all(subs.map((s) => sendOne(s, payload)));
  const dead = new Set(subs.filter((_, i) => results[i] === "gone").map((s) => s.endpoint));
  if (dead.size) {
    await locked(roomId, async () => {
      const rec = await getStore().get(roomId);
      if (rec) await getStore().patch(roomId, { subs: (rec.subs ?? []).filter((s) => !dead.has(s.endpoint)) });
    });
  }
}

// ---------- subscriptions ----------

const B64URL = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

export function parseSub(x: unknown): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  if (!x || typeof x !== "object") return null;
  const o = x as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof o.endpoint !== "string" || o.endpoint.length > 600 || !o.endpoint.startsWith("https://")) return null;
  const p256dh = o.keys?.p256dh;
  const auth = o.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !B64URL.test(p256dh) || !B64URL.test(auth)) return null;
  return { endpoint: o.endpoint, keys: { p256dh, auth } };
}

export function parsePrefs(x: unknown, base: PushPrefs = DEFAULT_PREFS): PushPrefs {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof PushPrefs, unknown>>;
  const pick = (k: keyof PushPrefs) => (typeof o[k] === "boolean" ? (o[k] as boolean) : base[k]);
  return { done: pick("done"), brk: pick("brk"), sync: pick("sync") };
}

/** Adds or refreshes a device. Creates the room record if nothing was saved yet. */
export async function subscribe(
  roomId: string,
  sub: NonNullable<ReturnType<typeof parseSub>>,
  device: string,
  prefs: PushPrefs,
  tz: unknown,
) {
  return locked(roomId, async () => {
    const store = getStore();
    let rec = await store.get(roomId);
    if (!rec) {
      const now = Date.now();
      const fresh: RoomRecord = {
        id: roomId,
        rev: 0,
        state: emptyState(validZone(tz) ? tz : "UTC"),
        createdAt: now,
        updatedAt: now,
        subs: [],
        alerts: [],
      };
      await store.create(fresh);
      rec = (await store.get(roomId)) ?? fresh;
    }
    const others = (rec.subs ?? []).filter((s) => s.endpoint !== sub.endpoint);
    if (others.length >= MAX_SUBS) return { ok: false as const, error: "too many devices" };
    await store.patch(roomId, { subs: [...others, { ...sub, device, prefs, createdAt: Date.now() }] });
    return { ok: true as const };
  });
}

export async function setPrefs(roomId: string, endpoint: string, prefs: PushPrefs) {
  return locked(roomId, async () => {
    const rec = await getStore().get(roomId);
    if (!rec) return false;
    await getStore().patch(roomId, { subs: (rec.subs ?? []).map((s) => (s.endpoint === endpoint ? { ...s, prefs } : s)) });
    return true;
  });
}

export async function unsubscribe(roomId: string, endpoint: string) {
  return locked(roomId, async () => {
    const rec = await getStore().get(roomId);
    if (!rec) return;
    await getStore().patch(roomId, { subs: (rec.subs ?? []).filter((s) => s.endpoint !== endpoint) });
  });
}

export async function sendTest(roomId: string, endpoint: string) {
  const rec = await getStore().get(roomId);
  const sub = rec?.subs?.find((s) => s.endpoint === endpoint);
  if (!sub) return "unknown" as const;
  const r = await sendOne(
    sub,
    {
      title: "Notifications are on",
      body: "Tickwell will tell you when a goal is reached or a break is over.",
      tag: "tickwell-test",
      url: `/${roomId}`,
    },
    120,
  );
  if (r === "gone") await unsubscribe(roomId, endpoint);
  return r;
}

// ---------- notifications for timer changes made on another device ----------

export async function notifySync(roomId: string, kind: "start" | "pause", topicTitle: string, originDevice: string | undefined) {
  if (!pushConfigured()) return;
  const rec = await getStore().get(roomId);
  const targets = (rec?.subs ?? []).filter((s) => s.prefs.sync && s.device !== originDevice);
  if (!targets.length) return;
  await sendMany(roomId, targets, {
    title: kind === "start" ? "Timer started" : "Timer paused",
    body: `${topicTitle} was ${kind === "start" ? "started" : "paused"} on another device.`,
    tag: `tickwell-sync-${kind}`,
    url: `/${roomId}`,
  });
}

// ---------- scheduling: goal reached, break over ----------

type Job = { timer: ReturnType<typeof setTimeout>; alert: Alert };
const g = globalThis as unknown as { __tickwellJobs?: Map<string, Map<string, Job>> };
const jobs = (g.__tickwellJobs ??= new Map<string, Map<string, Job>>());
const MAX_DELAY = 2 ** 31 - 1;

/** Makes the scheduled notifications of a room match what its state says is coming. */
export function reconcile(roomId: string, desired: Alert[], state: RoomState, now = Date.now()) {
  if (!pushConfigured()) return;
  const mine = jobs.get(roomId) ?? new Map<string, Job>();
  jobs.set(roomId, mine);
  const want = new Map(desired.map((a) => [a.key, a]));

  for (const [key, job] of mine) {
    if (want.has(key)) continue;
    // A goal timer that just stopped because it finished must still announce itself.
    if (job.alert.kind === "done" && doneToday(state, job.alert.topicId, now + 2000)) continue;
    clearTimeout(job.timer);
    mine.delete(key);
  }
  for (const alert of desired) {
    if (mine.has(alert.key)) continue;
    const delay = Math.max(0, alert.at - now);
    if (delay > MAX_DELAY) continue;
    const timer = setTimeout(() => void fire(roomId, alert), delay);
    timer.unref?.();
    mine.set(alert.key, { timer, alert });
  }
  if (mine.size === 0) jobs.delete(roomId);
}

async function fire(roomId: string, alert: Alert) {
  jobs.get(roomId)?.delete(alert.key);
  if (jobs.get(roomId)?.size === 0) jobs.delete(roomId);
  const rec = await getStore().get(roomId);
  if (!rec) return;
  const now = Date.now();
  const t = rec.state.topics.find((x) => x.id === alert.topicId);
  // Still true? A paused timer or a cancelled reminder must stay quiet.
  const valid =
    !!t &&
    !t.archivedAt &&
    (alert.kind === "break"
      ? t.breakUntil === alert.at
      : (t.startedAt != null && `done:${t.id}:${t.startedAt}` === alert.key) || doneToday(rec.state, t.id, now));
  const remaining = (rec.alerts ?? []).filter((a) => a.key !== alert.key);
  if (remaining.length !== (rec.alerts ?? []).length) await getStore().patch(roomId, { alerts: remaining });
  if (!valid || !t) return;

  const want = alert.kind === "done" ? "done" : "brk";
  const targets = (rec.subs ?? []).filter((s) => s.prefs[want]);
  if (!targets.length) return;
  await sendMany(
    roomId,
    targets,
    alert.kind === "done"
      ? { title: "Goal reached", body: `${t.title}: ${fmtGoal(t.goalMs)} done for today.`, tag: `tickwell-done-${t.id}`, url: `/${roomId}` }
      : { title: "Break over", body: `Time to get back to ${t.title}.`, tag: `tickwell-break-${t.id}`, url: `/${roomId}` },
  );
}

/** Called once when the server starts: picks up notifications that were waiting before a restart. */
export async function bootScheduler() {
  if (!pushConfigured()) return;
  try {
    const now = Date.now();
    for (const rec of await getStore().withAlerts()) {
      // Anything more than ten minutes overdue was missed while the server was down: drop it.
      const live = (rec.alerts ?? []).filter((a) => a.at > now - 10 * 60_000);
      reconcile(rec.id, live, rec.state, now);
      if (live.length !== (rec.alerts ?? []).length) await getStore().patch(rec.id, { alerts: live });
    }
  } catch (e) {
    console.warn("[tickwell] could not restore scheduled notifications", e);
  }
}
