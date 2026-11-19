"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserZone } from "./tracker";

export type PushPrefs = { done: boolean; brk: boolean; sync: boolean };
export const DEFAULT_PREFS: PushPrefs = { done: true, brk: true, sync: false };

export type PushState = {
  /** Where this device stands. */
  status:
    | "loading"
    | "unconfigured" // the server has no VAPID keys
    | "ios-install" // iPhone or iPad, not yet added to the Home Screen
    | "unsupported" // the browser cannot do push
    | "blocked" // the user said no (or the browser did)
    | "off" // can be turned on
    | "on";
  ios: boolean;
  standalone: boolean;
  prefs: PushPrefs;
  busy: boolean;
  error: string;
  /** Result text of the last test, for display. */
  note: string;
};

const DEVICE_KEY = "tickwell:device";
const PREFS_KEY = "tickwell:push:prefs";
const onKey = (roomId: string) => `tickwell:push:on:${roomId}`;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

/** A random id for this browser, so it is not told about what it did itself. */
export function deviceId() {
  let id = read(DEVICE_KEY);
  if (!id) {
    const b = new Uint8Array(9);
    crypto.getRandomValues(b);
    id = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    write(DEVICE_KEY, id);
  }
  return id;
}

function urlBase64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const detectIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const detectStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

async function registration() {
  // The service worker is normally registered by PwaRegister (production). In development it is added on demand.
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export function usePush(roomId: string) {
  const [state, setState] = useState<PushState>({
    status: "loading",
    ios: false,
    standalone: false,
    prefs: DEFAULT_PREFS,
    busy: false,
    error: "",
    note: "",
  });
  const key = useRef<string | null>(null);
  const patch = (p: Partial<PushState>) => setState((s) => ({ ...s, ...p }));

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/r/${roomId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res;
    },
    [roomId],
  );

  const subscribeNow = useCallback(
    async (prefs: PushPrefs) => {
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        if (!key.current) throw new Error("Notifications are not set up on this server.");
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key.current) as BufferSource,
        });
      }
      const res = await post({ action: "subscribe", sub: sub.toJSON(), device: deviceId(), prefs, tz: browserZone() });
      if (!res.ok) throw new Error(res.status === 409 ? "Too many devices are already subscribed to this room." : "Could not turn notifications on.");
      write(onKey(roomId), "1");
      return sub;
    },
    [post, roomId],
  );

  // Work out what this device can do.
  useEffect(() => {
    let live = true;
    (async () => {
      const ios = detectIos();
      const standalone = detectStandalone();
      let prefs = DEFAULT_PREFS;
      try {
        prefs = { ...DEFAULT_PREFS, ...JSON.parse(read(PREFS_KEY) || "{}") };
      } catch {}
      const done = (status: PushState["status"]) => live && setState((s) => ({ ...s, status, ios, standalone, prefs }));

      let cfg: { configured?: boolean; publicKey?: string | null } = {};
      try {
        cfg = await (await fetch("/api/push/config", { cache: "no-store" })).json();
      } catch {}
      key.current = cfg.publicKey ?? null;
      if (!cfg.configured) return done("unconfigured");

      const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!capable) return done(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return done("blocked");
      if (Notification.permission === "granted" && read(onKey(roomId)) === "1") {
        try {
          const reg = await registration();
          if (await reg.pushManager.getSubscription()) return done("on");
        } catch {}
      }
      return done("off");
    })();
    return () => {
      live = false;
    };
  }, [roomId]);

  // The browser rotated its credentials: subscribe again quietly.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "push-resubscribe" && read(onKey(roomId)) === "1") {
        void subscribeNow(state.prefs).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [roomId, subscribeNow, state.prefs]);

  const enable = useCallback(async () => {
    patch({ busy: true, error: "", note: "" });
    try {
      const perm = await Notification.requestPermission(); // must run straight from the tap
      if (perm !== "granted") {
        patch({ busy: false, status: perm === "denied" ? "blocked" : "off" });
        return;
      }
      await subscribeNow(state.prefs);
      patch({ busy: false, status: "on" });
    } catch (e) {
      patch({ busy: false, error: e instanceof Error ? e.message : "Could not turn notifications on." });
    }
  }, [subscribeNow, state.prefs]);

  /** Turns notifications off for this device in this room. */
  const disable = useCallback(async () => {
    patch({ busy: true, error: "", note: "" });
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await post({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
        // The browser subscription is shared by every room on this device, so only drop it with the last one.
        const others = Object.keys(localStorage).filter((k) => k.startsWith("tickwell:push:on:") && k !== onKey(roomId));
        if (others.length === 0) await sub.unsubscribe();
      }
    } catch {}
    write(onKey(roomId), null);
    patch({ busy: false, status: Notification.permission === "denied" ? "blocked" : "off" });
  }, [post, roomId]);

  /** Forgets everything about notifications on this device. The browser itself keeps the permission. */
  const reset = useCallback(async () => {
    patch({ busy: true, error: "", note: "" });
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await post({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch {}
    for (const k of Object.keys(localStorage)) if (k.startsWith("tickwell:push:")) write(k, null);
    patch({
      busy: false,
      prefs: DEFAULT_PREFS,
      status: Notification.permission === "denied" ? "blocked" : "off",
      note: "Notifications were reset on this device.",
    });
  }, [post]);

  const setPref = useCallback(
    async (k: keyof PushPrefs, v: boolean) => {
      const prefs = { ...state.prefs, [k]: v };
      patch({ prefs });
      write(PREFS_KEY, JSON.stringify(prefs));
      try {
        const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
        if (sub) await post({ action: "prefs", endpoint: sub.endpoint, prefs });
      } catch {}
    },
    [post, state.prefs],
  );

  const test = useCallback(async () => {
    patch({ busy: true, note: "", error: "" });
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (!sub) throw new Error("This device is not subscribed.");
      const res = await post({ action: "test", endpoint: sub.endpoint });
      patch({
        busy: false,
        note: res.ok ? "Test sent. It should arrive in a moment." : "The test could not be delivered. Try turning notifications off and on.",
      });
    } catch (e) {
      patch({ busy: false, error: e instanceof Error ? e.message : "The test failed." });
    }
  }, [post]);

  return { ...state, enable, disable, reset, setPref, test };
}
