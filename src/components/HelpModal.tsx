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

        <section>
          <h3>Share and sync</h3>
          <ol className="help-steps">
            <li>
              <b>Every room has its own link.</b> Your address, such as <code>tickwell…/AbC123…</code>, is your room.
              Bookmark it or install the app, and you always come back to it.
            </li>
            <li>
              <b>Press the share button</b> next to the theme button to see the link and a QR code.
            </li>
            <li>
              <b>Copy the link</b> with the Copy button, or <b>scan the QR code</b> with your phone camera to open the
              same room there.
            </li>
            <li>
              <b>Everything stays in sync.</b> Start, pause, edit or archive on one device and the others update within
              a second. The dot on the share button shows the state: green is synced, amber is connecting, red is
              offline (your changes are kept and sent when you are back).
            </li>
            <li>
              <b>There is no login.</b> Anyone with the link can see and change the room, so share it only with people
              you trust.
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
