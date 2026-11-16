"use client";

import { useEffect } from "react";
import type { Topic } from "@/lib/tracker";
import ConfirmInline from "./ConfirmInline";

type Props = {
  /** Archived topics that can be restored. */
  archived: Topic[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function ArchiveDialog({ archived, onRestore, onDelete, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal aria-label="Archives">
        <h2>Archives</h2>

        {archived.length === 0 ? (
          <p className="arch-empty">Nothing archived. Archived topics show up here.</p>
        ) : (
          <ul className="arch-list">
            {archived.map((t) => (
              <li key={t.id}>
                <span className="badge" style={{ background: t.color }} />
                <span className="arch-name">
                  {t.title}
                  <small>
                    Archived{" "}
                    {new Date(t.archivedAt ?? 0).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </small>
                </span>
                <span className="panel-actions">
                  <button className="chip" onClick={() => onRestore(t.id)}>
                    Restore
                  </button>
                  <ConfirmInline
                    onConfirm={() => onDelete(t.id)}
                    trigger={(ask) => (
                      <button className="chip danger" onClick={ask}>
                        Delete
                      </button>
                    )}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="actions">
          <span className="spacer" />
          <button className="btn-text" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
