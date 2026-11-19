// Tickwell service worker: makes the app open instantly and work offline.
// Room data comes live from the server (and is kept in localStorage for offline), so only the app shell is cached.
const CACHE = "tickwell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/pwa/icon/192?v=2", "/pwa/icon/512?v=2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live room data is never cached

  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname === "/" ? "/" : req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  // Static assets, fonts and generated images: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});

// ---- Push notifications: goal reached, break over, timers started or paused elsewhere ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const options = {
    body: data.body || "",
    icon: "/pwa/icon/192?v=2",
    badge: "/pwa/icon/192?v=2",
    data: { url: data.url || "/" },
  };
  if (data.tag) {
    options.tag = data.tag; // a newer notification of the same kind replaces the older one
    options.renotify = true;
  }
  // iOS and Chrome require a visible notification for every push.
  event.waitUntil(self.registration.showNotification(data.title || "Tickwell", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url === target && "focus" in w) return w.focus();
      }
      for (const w of windows) {
        if ("focus" in w && "navigate" in w) return w.focus().then((c) => (c && c.navigate ? c.navigate(target) : c));
      }
      return self.clients.openWindow(target);
    }),
  );
});

// The browser rotated its push credentials: tell the open pages so they can subscribe again.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      windows.forEach((w) => w.postMessage({ type: "push-resubscribe" }));
    }),
  );
});
