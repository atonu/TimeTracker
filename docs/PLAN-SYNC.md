# Tickwell: Shared Rooms and Live Sync

Status: implemented (rooms, SSE sync, optimistic updates, offline queue, legacy import, room time zone).

Differences from this plan as built:
- Storage is chosen by environment: with `MONGODB_URI` set it uses MongoDB (Oracle Autonomous JSON Database via its Mongo API); without it, rooms are saved as JSON files in `DATA_DIR` (default `.data`, a Docker volume in production). Both sit behind `src/lib/server/store.ts`.
- Day buckets use option A: one time zone per room (the creator's browser zone), stored as `tz`.
- `hide` is its own operation, and `save` only changes title, colour and goal, so a rename never overwrites someone else's archive or timer change.
- Not built yet: read-only links, per-room cleanup UI, load test. Rooms untouched for a year are removed by a TTL index when the database supports it.

Code map: `src/lib/room.ts` (shared operations), `src/lib/server/*` (store, hub, limits, room service), `src/app/api/r/[id]/*` (snapshot, op, stream), `src/lib/useTracker.ts` (client sync), `src/app/[id]/page.tsx` and `src/components/RoomRedirect.tsx` (routing).

## 1. Goal

A new visitor is redirected from `/` to `/<id>` (a short random ID). Everyone who opens the same URL sees and edits the same data, live:

- Topics, goals, archived and hidden state, history, break reminders and alarms are shared.
- Timers stay in sync across browsers: start or pause on one device and the others update within about a second.
- Data lives in a managed database, one document per room, keyed by the ID in the URL.
- No login. The link is the key.

Non-goals for this phase: accounts and SSO, read-only links, multi-region, end-to-end encryption. (See Section 13 for later options.)

## 2. Decisions

| Topic | Decision | Why |
|---|---|---|
| Database | Oracle Autonomous JSON Database (Always Free), MongoDB-compatible API | Managed and off the app VM, so no extra load on the instance. Documents match the room model. |
| Fallback DB | OCI NoSQL Database Cloud Service, behind the same `store` interface | Also managed and free. Used only if the Mongo API spike fails. |
| Sync transport | Server-Sent Events (SSE) for push, `fetch` POST for changes | Simple, auto-reconnects, works through Cloudflare Tunnel. No polling. |
| Pub/sub | In-memory per-room hub inside the single Node process | One app container, so no Redis needed. |
| Conflict model | Server-authoritative operations plus a revision number | Avoids lost updates when two devices act at once. |
| Timer sync | Sync `startedAt` timestamps, not ticks | Each client computes the countdown locally, so traffic is tiny. |
| Room ID | 12+ base62 characters (about 71 bits) | Unguessable enough that the URL acts as the secret. |

## 3. Architecture

```
Browser A / B / C
   |  POST /api/r/:id/op            (a change)
   |  GET  /api/r/:id               (snapshot)
   |  GET  /api/r/:id/stream (SSE)  (push)
   v
Next.js (Node runtime, single container, Cloudflare Tunnel in front)
   |-- room hub: Map<roomId, Set<SSE client>>   (in memory)
   |-- reducers: apply(state, op) -> state      (shared with the client)
   v
Oracle Autonomous JSON DB (Mongo API, TLS)      collection: rooms
```

Request flow for a change:

1. Client applies the op optimistically to its local state.
2. Client POSTs `{ opId, type, payload, baseRev }`.
3. Server loads the room, applies the reducer, writes with `rev + 1`, and returns the new state.
4. Server broadcasts `{ rev, state }` to every SSE client in that room, including the sender.
5. Clients replace their local state if `rev` is newer than what they hold.

## 4. Data model

Collection `rooms`, one document per room:

```jsonc
{
  "_id": "k3Zr9QpL2xVb",        // room ID, equals the URL segment
  "rev": 42,                     // increments on every accepted op
  "createdAt": 1731800000000,
  "updatedAt": 1731803600000,
  "topics": [ { "id": "...", "title": "...", "color": "...", "goalMs": 7200000,
                "startedAt": null, "breakUntil": null, "breakMs": null, "hidden": false } ],
  "archived": [ /* same shape as topics */ ],
  "history": { "2026-11-17": { "<topicId>": 5400000 } },
  "appliedOps": [ "opId1", "opId2" ]   // last ~200 op IDs, for idempotent replays
}
```

Notes:

- Reuse the existing types in `src/lib/tracker.ts`. The document is the same shape the app already keeps in `timetracker:v1`.
- Documents stay a few KB to a few hundred KB, far below the 16 MB document limit.
- Cap history length per room (for example 2 years) and cap topics per room (for example 100) to bound size.
- Per-device UI preferences (theme, dense mode, onboarding) stay in localStorage and are not shared.
- Index: `_id` only. Optionally an `updatedAt` index for cleanup jobs.

## 5. API

All room routes are Node-runtime route handlers under `src/app/api/r/[id]/`.

| Route | Purpose |
|---|---|
| `GET /api/r/:id` | Return `{ rev, state, serverTime }`. 404 if the room does not exist yet. |
| `POST /api/r/:id/op` | Apply one operation. Creates the room on first op. Returns `{ rev, state }`. |
| `GET /api/r/:id/stream` | SSE. Sends `snapshot` on connect, then `state` events. Heartbeat comment every 20 s. |
| `POST /api/rooms` | Optional: create an empty room explicitly and return its ID. |

Operation types (one reducer per op, shared by client and server):

`topic.create`, `topic.update`, `topic.archive`, `topic.restore`, `topic.hide`, `topic.show`, `topic.delete`, `timer.start`, `timer.pause`, `timer.stopAll`, `break.set`, `alarm.stop`, `history.adjust`, `topics.reorder`, `import.replace`.

Every op carries a client-generated `opId`. The server ignores an `opId` it has already applied, which makes retries and offline replays safe.

Timestamps: the server stamps `startedAt` and pause times itself using its own clock. The client never sends authoritative times. This prevents device clock skew from corrupting totals. Clients receive `serverTime` on connect and keep an offset for smooth local countdowns.

## 6. Sync details

### Server hub

- A module-level `Map<roomId, Set<Client>>` in a singleton (guard against Next dev hot reload creating duplicates by storing it on `globalThis`).
- `broadcast(roomId, payload)` writes an SSE event to each client.
- Heartbeat: send `: ping` every 20 s so Cloudflare and proxies do not close idle streams.
- Cleanup on `request.signal.abort`: remove the client from the set, delete the room entry when empty.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.

### Client

- A `useRoom(id)` hook replaces the localStorage store. It owns `state`, `rev`, `status` (`connecting | live | offline`) and `dispatch(op)`.
- `EventSource` handles reconnects. On every (re)connect the server sends a fresh snapshot, so no event replay is required.
- Optimistic update on dispatch, then reconcile when the server's `rev` arrives. If the server rejects an op, revert to the last confirmed state.
- Offline: keep the last confirmed state in localStorage, queue unsent ops, and replay them in order on reconnect. Idempotent `opId` makes replay safe.
- A small status dot (live, reconnecting, offline) in the header, so users know when they are not synced.

### Concurrency

- Ops are applied one at a time per room on the server. Within the single Node process, use a per-room async mutex so two simultaneous POSTs cannot interleave a read-modify-write.
- Additionally write with a conditional filter `{ _id, rev: expectedRev }`. If it fails, reload and retry the op (up to 3 times). This keeps correctness even if a second app instance is ever added.
- Last write wins for plain edits such as renaming a topic. Timer ops are naturally idempotent (starting an already-running timer is a no-op).

### Alarms and reminders

- `breakUntil` is an absolute server-side timestamp, so every client counts down to the same moment.
- When it elapses, every connected device rings. `alarm.stop` clears it for everyone.
- A device that opens the page after the reminder time simply shows the ringing state.
- Goal-reached chime: each client plays it once when its own computed progress crosses 100% (no network involvement). A `chimedFor` marker is not shared, so a late joiner does not replay old chimes. Keep the existing `doneBefore` guard.

## 7. Routing and first visit

- `/` (client component or middleware): read `timetracker:lastRoom` from localStorage. If present, redirect to `/<id>`. Otherwise generate an ID, store it, and redirect. The room document is created lazily on the first op, not on redirect.
- `/[id]`: validates the ID format (`^[A-Za-z0-9]{12,24}$`), renders the existing `Tickwell` UI backed by `useRoom(id)`. Invalid IDs show a friendly 404.
- A "Share" action in the header (or the existing share banner area) copies the room URL.
- Optional later: a "New room" button for a fresh start.
- Existing localStorage data: on first load of a new empty room, if `timetracker:v1` exists, show a one-time prompt "Import your existing data into this room?" which dispatches `import.replace`.
- PWA: `start_url` should stay `/` so the installed app resolves to the remembered room. Update `manifest.ts` and `sw.js` so API routes (`/api/*`) are never cached.

## 8. Backend implementation

New files:

- `src/lib/db.ts`: lazy singleton `MongoClient`, pool settings, env-based connection string, TLS on.
- `src/lib/store.ts`: interface `{ get(id), create(id, doc), applyConditional(id, expectedRev, next) }` with a Mongo implementation (and room for a NoSQL implementation).
- `src/lib/roomOps.ts`: pure reducers shared by server and client.
- `src/lib/roomHub.ts`: SSE hub.
- `src/lib/roomId.ts`: ID generation (crypto random, base62) and validation.
- `src/app/api/r/[id]/route.ts`, `op/route.ts`, `stream/route.ts`.
- `src/components/useRoom.ts`: the client hook.

Configuration:

- `MONGODB_URI` (secret), `MONGODB_DB`, in Docker env and GitHub Actions secrets.
- `next.config.mjs` already uses `output: "standalone"`. Add `serverExternalPackages: ["mongodb"]` if the bundler complains.
- The Docker image already runs Node. Confirm the ARM64 build includes the `mongodb` package (it is pure JS, so this is fine).

## 9. Security and abuse control

- The room URL is the credential. Use `crypto.randomBytes`, at least 12 base62 characters.
- `X-Robots-Tag: noindex` and `<meta name="robots" content="noindex">` on room pages. Add `Disallow` for `/` room paths is not possible by pattern, so rely on noindex plus unguessable IDs.
- No endpoint lists rooms. Unknown IDs return 404 on `GET`, and rooms are created only by `POST /op` or `POST /api/rooms`.
- Rate limit per IP (token bucket in memory): room creation (for example 10 per hour) and ops (for example 20 per second per room, 60 per second per IP). Behind Cloudflare, read the client IP from `CF-Connecting-IP`.
- Limit request body to about 64 KB, validate every op with a schema (zod or hand-rolled), and clamp strings (title 50 chars) and numbers.
- Cap SSE connections per room (for example 25) and per IP.
- CORS: same-origin only.
- Privacy note in the Help modal: "Anyone with this link can view and edit this room."
- Cleanup: a scheduled job (or lazy check) deletes rooms untouched for 12 months. Document this in the UI copy.

## 10. Deployment

- Same Docker image and workflow. Add the Mongo secrets to the deploy job's environment and pass them to `docker run` as env vars.
- Place the Autonomous database in the same OCI region as the app instance. Restrict its network access to the instance's public IP if possible (ACL), otherwise rely on TLS plus credentials.
- Cloudflare: SSE works through the Tunnel. Verify the `/api/r/*/stream` route is not cached or buffered, and that "Rocket Loader", compression buffering and similar features are off for that path.
- Free Autonomous databases can be stopped after inactivity. Add a lightweight keep-alive (a scheduled `ping` from the app every few hours) if the policy applies. Confirm the current rule in the OCI console.
- Backups: Autonomous handles them. Also add an optional export script that dumps `rooms` to Object Storage monthly.
- Rollout: deploy behind the existing URL. Old users keep their localStorage data until the import prompt moves it.

## 11. Implementation phases

| Phase | Scope | Est. |
|---|---|---|
| 0. Spike | Create the free Autonomous JSON database, connect from the instance with the `mongodb` driver, test `findOneAndUpdate` with a `rev` filter, measure latency, check idle/stop behaviour. Go / no-go on Mongo vs NoSQL. | 0.5 day |
| 1. Rooms skeleton | Room IDs, routing and redirect, `/[id]` page, `store.ts`, `GET`/`POST op`, lazy create, one or two ops (`timer.start/pause`). | 1 day |
| 2. Ops and reducers | Move all state changes in `Tickwell.tsx` into shared reducers and the full op set. Server-stamped times. Per-room mutex and conditional writes. | 1.5 days |
| 3. Live sync | SSE hub, heartbeat, reconnect, snapshot on connect, `useRoom` hook, status dot. | 1.5 days |
| 4. Client resilience | Optimistic updates with rollback, offline queue, localStorage cache, clock offset, import of old data. | 1.5 days |
| 5. Alarms and edge cases | Shared break reminders, stop-alarm sync, chime guard, midnight rollover, history day boundaries across timezones (see Section 12). | 1 day |
| 6. Hardening | Validation, rate limits, connection caps, noindex, size and history caps, error states, PWA/service worker exclusions. | 1 day |
| 7. Deploy and test | Secrets, Docker/Actions changes, Cloudflare SSE check, multi-browser and mobile tests, load test with about 100 simulated clients. | 1 day |

Total: about 8 to 9 working days for everything. A minimal first release (phases 0 to 3, basic hardening) is about 5 to 6 days. Phase 4's offline queue and the import prompt can follow in a second release.

## 12. Open questions and risks

| Item | Notes |
|---|---|
| Oracle Mongo API feature gaps | Change streams are not needed. Confirm `findOneAndUpdate` and `$set` paths in the spike. Fallback is NoSQL behind `store.ts`. |
| Free database idle stop | Check the current Always Free policy. Mitigate with a keep-alive. |
| Timezones | "Day" for history needs one rule per room. Proposal: store the room's timezone (taken from the creator's browser) in the document, and compute day keys server-side from it. Otherwise two users in different zones split one day into two. |
| Which state is shared | Proposal: shared = topics, archive, hidden, history, timers, reminders. Per-device = theme, dense mode, onboarding, window/scroll state. Confirm. |
| Hidden columns | Hidden state is a viewing preference as much as data. Decide whether it syncs or stays per-device. Default proposal: sync it. |
| Single-container limits | In-memory hub only works with one app process. Adding a second container later needs Redis pub/sub or Postgres LISTEN/NOTIFY. |
| Deploy blips | A redeploy drops SSE connections. Clients reconnect and fetch a snapshot automatically. |
| Link leakage | Anyone who obtains the link can edit. Mitigate later with read-only links or an optional PIN. |

## 13. Later options (not in scope)

- Read-only share link (separate random token) and an optional edit PIN.
- Optional accounts to claim rooms and list "my rooms".
- Per-room export (CSV, PNG) as already outlined in `docs/PLAN.md`.
- Redis pub/sub if the app ever runs as more than one container.
- Presence indicator ("2 devices connected").

## 14. Acceptance checklist

- [ ] Opening `/` redirects to `/<id>`, and reopening later returns to the same room.
- [ ] No database row is created until the first change.
- [ ] Three browsers on the same URL show the same topics and running timers.
- [ ] Start, pause, edit, archive, hide, reminder and stop-alarm on one device appear on the others in under 1 s on a good connection.
- [ ] Two simultaneous actions on different devices both end up applied, with no corruption.
- [ ] Killing the network for a minute and restoring it reconciles correctly and replays queued ops once.
- [ ] Device clock skew of several minutes does not change totals.
- [ ] Old localStorage data can be imported once into a new room.
- [ ] Invalid IDs, oversized bodies and floods are rejected.
- [ ] SSE survives 30+ minutes idle behind Cloudflare Tunnel.
- [ ] The app instance's CPU and memory stay flat while the database runs off-instance.
