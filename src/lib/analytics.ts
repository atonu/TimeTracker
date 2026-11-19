"use client";

// Product analytics (PostHog). Everything here is a no-op until the server provides a project key.
// Privacy: no cookies, no session recording, and room links are replaced by "/room" before anything is sent,
// because anyone holding a room link can edit that room.


let ph: { capture: (name: string, props?: Record<string, unknown>) => void } | null = null;
const queue: [string, Record<string, unknown> | undefined][] = [];

const ROOM_PATH = /^\/[A-Za-z0-9_-]{12,}(?=\/|$|\?|#)/;

/** Replaces a room id in a path or full address with "/room". */
export function maskUrl(u: unknown): unknown {
  if (typeof u !== "string") return u;
  try {
    if (u.startsWith("http")) {
      const url = new URL(u);
      url.pathname = url.pathname.replace(ROOM_PATH, "/room");
      url.search = "";
      url.hash = "";
      return url.toString();
    }
  } catch {}
  return u.replace(ROOM_PATH, "/room").split("?")[0];
}

export async function initAnalytics() {
  if (ph || typeof window === "undefined") return;
  let key: string | null = null;
  try {
    key = (await (await fetch("/api/analytics/config", { cache: "no-store" })).json()).key;
  } catch {}
  if (!key) return;

  const { default: posthog } = await import("posthog-js");
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    persistence: "memory", // no cookies or storage: a new visit counts as a new visitor
    person_profiles: "identified_only",
    capture_pageview: false, // sent below with the masked address
    capture_pageleave: true,
    autocapture: true, // clicks feed the heatmaps
    enable_heatmaps: true,
    disable_session_recording: true,
    respect_dnt: true,
    mask_all_text: true,
    mask_all_element_attributes: true, // labels such as "Edit <topic name>" are never sent
    sanitize_properties: (props) => {
      for (const k of ["$current_url", "$referrer", "$pathname", "$initial_current_url", "$initial_referrer", "$session_entry_url", "$session_entry_pathname", "$session_entry_referrer"]) {
        if (k in props) props[k] = maskUrl(props[k]);
      }
      return props;
    },
    loaded: (p) => {
      ph = p;
      p.capture("$pageview", { $current_url: maskUrl(window.location.href) });
      for (const [name, props] of queue.splice(0)) p.capture(name, props);
    },
  });
}

/** Records one event. Properties must never contain topic names or room ids. */
export function track(name: string, props?: Record<string, unknown>) {
  if (ph) ph.capture(name, props);
  else if (queue.length < 20) queue.push([name, props]);
}
