"use client";

import { useEffect } from "react";
import { BRAND } from "@/lib/brand";

export default function HelpModal({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog help" role="dialog" aria-label="About Tickwell">
        <div className="panel-head">
          <h2>About Tickwell</h2>
          <button className="btn-text" onClick={onClose}>
            Done
          </button>
        </div>

        <p className="help-motto">{BRAND.motto}</p>

        <section>
          <h3>Why it exists</h3>
          <p>
            A day has a limited number of hours, and it is easy to let one thing quietly eat the rest. Tickwell is built
            around one idea: <b>decide how much time each thing deserves, then live inside that budget.</b> It is kept
            deliberately simple, so it never becomes one more thing to manage.
          </p>
        </section>

        <section>
          <h3>How to use it</h3>
          <ol className="help-steps">
            <li>
              <b>Create a topic</b> with a colour and a daily allowance.
            </li>
            <li>
              <b>Press play</b> to count down. Several timers can run together.
            </li>
            <li>
              <b>Pause for a break</b> and pick 5, 10 or 15 to be reminded.
            </li>
            <li>
              <b>Hit the limit</b> and the timer stops itself and gets a tick.
            </li>
            <li>
              <b>Read the table</b> to see your days at a glance. Hover a column title to rename, hide or archive.
            </li>
          </ol>
        </section>

        <button className="btn-ghost help-tour" onClick={onTour}>
          Replay the welcome tour
        </button>

        <footer className="help-foot">
          <span>Developed by {BRAND.author}</span>
          <span>
            Visit:{" "}
            <a href={BRAND.site} target="_blank" rel="noopener noreferrer">
              {BRAND.site}
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
