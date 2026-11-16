"use client";

import { useEffect } from "react";
import { BACKGROUNDS, THEMES } from "@/lib/themes";

type Props = {
  theme: string;
  bg: string;
  onTheme: (id: string) => void;
  onBg: (id: string) => void;
  onClose: () => void;
};

export default function AppearancePanel({ theme, bg, onTheme, onBg, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const themeGroup = (mode: "light" | "dark") => (
    <div className="tiles">
      {THEMES.filter((t) => t.mode === mode).map((t) => (
        <button
          key={t.id}
          className={`tile${t.id === theme ? " on" : ""}`}
          onClick={() => onTheme(t.id)}
          aria-pressed={t.id === theme}
        >
          <span className="swatch-prev" style={{ background: t.bg }}>
            <span className="sp-paper" style={{ background: t.paper }}>
              <i style={{ background: t.ink }} />
              <i style={{ background: t.accent }} />
            </span>
          </span>
          <span className="tile-name">{t.name}</span>
        </button>
      ))}
    </div>
  );

  const bgGroup = (group: "none" | "pattern" | "abstract") => (
    <div className="tiles">
      {BACKGROUNDS.filter((b) => b.group === group).map((b) => (
        <button
          key={b.id}
          className={`tile${b.id === bg ? " on" : ""}`}
          onClick={() => onBg(b.id)}
          aria-pressed={b.id === bg}
        >
          <span className="swatch-prev bgprev">
            <span className={`art art-${b.id}`} />
          </span>
          <span className="tile-name">{b.name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="overlay pop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog appearance" role="dialog" aria-label="Appearance">
        <div className="panel-head">
          <h2>Appearance</h2>
          <button className="btn-text" onClick={onClose}>
            Done
          </button>
        </div>

        <section>
          <h3>Light themes</h3>
          {themeGroup("light")}
        </section>
        <section>
          <h3>Dark themes</h3>
          {themeGroup("dark")}
        </section>
        <section>
          <h3>Background</h3>
          {bgGroup("none")}
          <h4>Patterns</h4>
          {bgGroup("pattern")}
          <h4>Abstract</h4>
          {bgGroup("abstract")}
        </section>
      </div>
    </div>
  );
}
