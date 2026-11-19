"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Starts analytics once the page is idle, so it never slows the first paint on slow connections. */
export default function Analytics() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const run = () => void initAnalytics();
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 2000);
  }, []);
  return null;
}
