"use client";

import { useEffect, useState } from "react";

const KEY = "timetracker:appearance";

export function useAppearance() {
  const [theme, setTheme] = useState("gray");
  const [bg, setBg] = useState("none");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (a.theme) setTheme(a.theme);
      if (a.bg) setBg(a.bg);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, bg }));
    } catch {}
  }, [theme, bg, loaded]);

  return { theme, setTheme, bg, setBg };
}
