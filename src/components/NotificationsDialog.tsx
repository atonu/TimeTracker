"use client";

import { useEffect } from "react";
import { usePush, type PushPrefs } from "@/lib/usePush";

type Props = { roomId: string; onClose: () => void };

const OPTIONS: { key: keyof PushPrefs; label: string; hint: string }[] = [
  { key: "done", label: "Goal reached", hint: "When a topic hits its time for today, even if the app is closed." },
  { key: "brk", label: "Break over", hint: "When a break ends and it is time to get back." },
  { key: "sync", label: "Started or paused elsewhere", hint: "When someone starts or pauses a timer from another device." },
];

/** Where notifications are turned on and off, with help for each situation. */
export default function NotificationsDialog({ roomId, onClose }: Props) {
  const p = usePush(roomId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog notify" role="dialog" aria-modal aria-label="Notifications">
        <h2>Notifications</h2>

        {p.status === "loading" && <p className="share-note">Checking this device…</p>}

        {p.status === "unconfigured" && (
          <p className="share-note">Notifications are not set up on this server yet. The owner needs to add push keys.</p>
        )}

        {p.status === "unsupported" && (
          <p className="share-note">This browser cannot show notifications. Try a recent Chrome, Edge, Firefox or Safari.</p>
        )}

        {p.status === "ios-install" && (
          <div className="notify-box">
            <strong>Add Tickwell to your Home Screen first</strong>
            <p>On iPhone and iPad, notifications only work for apps added to the Home Screen (iOS 16.4 or newer).</p>
            <ol>
              <li>Open this page in Safari.</li>
              <li>
                Tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.
              </li>
              <li>Open Tickwell from its new icon and come back to this screen.</li>
            </ol>
          </div>
        )}

        {p.status === "blocked" && (
          <div className="notify-box">
            <strong>Notifications are blocked</strong>
            <p>The browser remembers your choice, so it can only be changed there:</p>
            <ul>
              <li>
                <b>Chrome, Edge:</b> click the lock icon next to the address, then set Notifications to Allow.
              </li>
              <li>
                <b>Firefox:</b> click the lock icon, then Clear permission, and reload.
              </li>
              <li>
                <b>Safari on Mac:</b> Safari, Settings, Websites, Notifications.
              </li>
              <li>
                <b>iPhone or iPad:</b> Settings, Notifications, Tickwell, then Allow Notifications.
              </li>
              <li>
                <b>Android:</b> long-press the app icon, App info, Notifications.
              </li>
            </ul>
            <p>Then reload this page.</p>
          </div>
        )}

        {p.status === "off" && (
          <>
            <p className="share-note">
              Get a notification when a goal is reached or a break ends, even when Tickwell is closed.
              {p.ios && !p.standalone ? " Works best from the Home Screen app." : ""}
            </p>
            <button className="btn-primary notify-main" onClick={p.enable} disabled={p.busy}>
              {p.busy ? "Turning on…" : "Turn on notifications"}
            </button>
          </>
        )}

        {p.status === "on" && (
          <>
            <p className="share-note notify-on">
              <span className="sync-dot sync-live" aria-hidden /> On for this device in this room.
            </p>
            <div className="notify-opts">
              {OPTIONS.map((o) => (
                <label key={o.key} className="notify-opt">
                  <input type="checkbox" checked={p.prefs[o.key]} onChange={(e) => p.setPref(o.key, e.target.checked)} />
                  <span>
                    <b>{o.label}</b>
                    <small>{o.hint}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="notify-row">
              <button className="btn-ghost" onClick={p.test} disabled={p.busy}>
                Send a test
              </button>
              <button className="btn-ghost" onClick={p.disable} disabled={p.busy}>
                Turn off
              </button>
            </div>
            <p className="notify-help">
              <b>Turn off</b> stops alerts for this room on this device. <b>Reset</b> (below) removes this device completely and clears your choices.
            </p>
            <p className="notify-help">
              Not seeing them? Check that your system allows notifications from your browser (Windows: Settings, System,
              Notifications; Mac: System Settings, Notifications). Brave also needs "Use Google services for push
              messaging" turned on in brave://settings/privacy.
            </p>
          </>
        )}

        {(p.status === "on" || p.status === "off" || p.status === "blocked") && (
          <div className="notify-reset">
            <button className="btn-text" onClick={p.reset} disabled={p.busy}>
              Reset notifications on this device
            </button>
            <small>Unsubscribes this device and clears your choices. If the browser blocked Tickwell, you still change that in its site settings.</small>
          </div>
        )}

        {p.note && <p className="notify-note">{p.note}</p>}
        {p.error && <p className="notify-error">{p.error}</p>}

        <div className="actions">
          <span className="spacer" />
          <button type="button" className="btn-text cancel-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
