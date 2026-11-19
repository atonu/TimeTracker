// Server only. Where rooms are saved.
//   MONGODB_URI set  -> MongoDB (Oracle Autonomous JSON Database's Mongo API, or any MongoDB)
//   otherwise        -> JSON files in DATA_DIR (default ./.data). Fine for development, but a container
//                       without a mounted volume loses them on every redeploy.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Alert, RoomState } from "../room";

/** What a device wants to be told about. */
export type PushPrefs = { done: boolean; brk: boolean; sync: boolean };

/** One browser or phone that agreed to notifications for a room. */
export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Random id kept in the device's storage, so it is not told about its own actions. */
  device: string;
  prefs: PushPrefs;
  createdAt: number;
};

export type RoomRecord = {
  id: string;
  /** Increases by one on every saved change. */
  rev: number;
  state: RoomState;
  createdAt: number;
  updatedAt: number;
  /** Devices to notify. Never sent to browsers. */
  subs?: PushSub[];
  /** Upcoming notifications (goal reached, break over). */
  alerts?: Alert[];
};

export interface Store {
  get(id: string): Promise<RoomRecord | null>;
  /** Inserts a new room. Returns false if it already exists. */
  create(rec: RoomRecord): Promise<boolean>;
  /** Saves `rec` only if the stored revision is still `expectedRev`. Returns false when it moved on. */
  update(rec: RoomRecord, expectedRev: number): Promise<boolean>;
  /** Changes only the notification fields, whatever the revision. */
  patch(id: string, fields: { subs?: PushSub[]; alerts?: Alert[] }): Promise<void>;
  /** Every room that has notifications waiting (used to restart the schedule after a restart). */
  withAlerts(): Promise<RoomRecord[]>;
}

// ---------- files ----------

class FileStore implements Store {
  private dir = path.resolve(process.env.DATA_DIR || ".data");
  private ready: Promise<unknown> | null = null;

  private file(id: string) {
    return path.join(this.dir, `${id}.json`); // ids are validated before they get here
  }

  private async init() {
    this.ready ??= fs.mkdir(this.dir, { recursive: true });
    await this.ready;
  }

  async get(id: string) {
    await this.init();
    try {
      return JSON.parse(await fs.readFile(this.file(id), "utf8")) as RoomRecord;
    } catch {
      return null;
    }
  }

  private async write(rec: RoomRecord) {
    const tmp = this.file(rec.id) + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(rec));
    await fs.rename(tmp, this.file(rec.id));
  }

  async create(rec: RoomRecord) {
    if (await this.get(rec.id)) return false;
    await this.write(rec);
    return true;
  }

  async update(rec: RoomRecord, expectedRev: number) {
    const cur = await this.get(rec.id);
    if (!cur || cur.rev !== expectedRev) return false;
    await this.write(rec);
    return true;
  }

  async patch(id: string, fields: { subs?: PushSub[]; alerts?: Alert[] }) {
    const cur = await this.get(id);
    if (cur) await this.write({ ...cur, ...fields });
  }

  async withAlerts() {
    await this.init();
    const out: RoomRecord[] = [];
    for (const f of await fs.readdir(this.dir).catch(() => [] as string[])) {
      if (!f.endsWith(".json")) continue;
      try {
        const rec = JSON.parse(await fs.readFile(path.join(this.dir, f), "utf8")) as RoomRecord;
        if (rec.alerts?.length) out.push(rec);
      } catch {}
    }
    return out;
  }
}

// ---------- MongoDB ----------

type Doc = {
  _id: string;
  rev: number;
  tz: string;
  topics: RoomState["topics"];
  log: RoomState["log"];
  applied: string[];
  createdAt: Date;
  updatedAt: Date;
  subs?: PushSub[];
  alerts?: Alert[];
};

const toDoc = (r: RoomRecord): Doc => ({
  _id: r.id,
  rev: r.rev,
  tz: r.state.tz,
  topics: r.state.topics,
  log: r.state.log,
  applied: r.state.applied,
  createdAt: new Date(r.createdAt),
  updatedAt: new Date(r.updatedAt),
  ...(r.subs ? { subs: r.subs } : {}),
  alerts: r.alerts ?? [],
});

const fromDoc = (d: Doc): RoomRecord => ({
  id: d._id,
  rev: d.rev,
  state: { tz: d.tz, topics: d.topics, log: d.log, applied: d.applied },
  createdAt: d.createdAt.getTime(),
  updatedAt: d.updatedAt.getTime(),
  subs: d.subs ?? [],
  alerts: d.alerts ?? [],
});

class MongoStore implements Store {
  private col: Promise<import("mongodb").Collection<Doc>> | null = null;

  private collection() {
    this.col ??= (async () => {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(process.env.MONGODB_URI as string, {
        maxPoolSize: 5,
        retryWrites: false, // Oracle's Mongo API does not support retryable writes
        serverSelectionTimeoutMS: 8000,
      });
      await client.connect();
      const col = client.db(process.env.MONGODB_DB || undefined).collection<Doc>(process.env.MONGODB_COLLECTION || "rooms");
      // Rooms untouched for a year are removed by the database itself. Best effort: not every server supports it.
      col.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 365 * 86400 }).catch(() => {});
      return col;
    })();
    this.col.catch(() => (this.col = null)); // try again on the next request after a failed connect
    return this.col;
  }

  async get(id: string) {
    const d = await (await this.collection()).findOne({ _id: id });
    return d ? fromDoc(d) : null;
  }

  async create(rec: RoomRecord) {
    try {
      await (await this.collection()).insertOne(toDoc(rec));
      return true;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return false;
      throw e;
    }
  }

  async update(rec: RoomRecord, expectedRev: number) {
    const { _id, ...fields } = toDoc(rec);
    const { createdAt: _c, subs: _s, ...set } = fields; // subscriptions are changed only through patch()
    const r = await (await this.collection()).updateOne({ _id, rev: expectedRev }, { $set: set });
    return r.matchedCount === 1;
  }

  async patch(id: string, fields: { subs?: PushSub[]; alerts?: Alert[] }) {
    await (await this.collection()).updateOne({ _id: id }, { $set: fields });
  }

  async withAlerts() {
    const docs = await (await this.collection()).find({ "alerts.0": { $exists: true } }).toArray();
    return docs.map(fromDoc);
  }
}

const g = globalThis as unknown as { __tickwellStore?: Store };

export function getStore(): Store {
  if (!g.__tickwellStore) {
    if (process.env.MONGODB_URI) {
      g.__tickwellStore = new MongoStore();
    } else {
      console.warn("[tickwell] MONGODB_URI is not set: saving rooms as JSON files in", process.env.DATA_DIR || ".data");
      g.__tickwellStore = new FileStore();
    }
  }
  return g.__tickwellStore;
}
