"use client";

import { useEffect } from "react";
import type { Topic } from "@/lib/tracker";

type Props = {
  /** Active topics first, then archived / deleted ones. */
  topics: Topic[];
  onToggle: (topic: Topic) => void;
  /** Checks every box: shows all hidden columns. */
  onShowAll: () => void;
  onClose: () => void;
};

/** Checklist of table columns. Unchecked columns are hidden. */
export default function ColumnsPanel({ topics, onToggle, onShowAll, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay pop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog columns-panel" role="dialog" aria-label="Visible columns">
        <div className="panel-head">
          <h2>Columns</h2>
          <button className="btn-text" onClick={onClose}>
            Done
          </button>
        </div>

        {topics.length === 0 ? (
          <p className="arch-empty">No columns yet.</p>
        ) : (
          <ul className="check-list">
            {topics.map((t) => (
              <li key={t.id}>
                <label>
                  <input type="checkbox" checked={!t.hidden} onChange={() => onToggle(t)} />
                  <span className="badge sm" style={{ background: t.color }} />
                  <span className="check-name">{t.title}</span>
                  {t.archivedAt && <small>{t.deleted ? "deleted" : "archived"}</small>}
                </label>
              </li>
            ))}
          </ul>
        )}

        {topics.some((t) => t.hidden) && (
          <button className="select-all" onClick={onShowAll}>
            Select all
          </button>
        )}
      </div>
    </div>
  );
}
