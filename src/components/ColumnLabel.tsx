"use client";

import { useState } from "react";
import type { Topic } from "@/lib/tracker";
import ConfirmInline from "./ConfirmInline";
import { BanIcon, EyeIcon, EyeOffIcon, PencilIcon, RestoreIcon, TrashIcon } from "./icons";

type Props = {
  topic: Topic;
  onRename: (title: string) => void;
  onToggleHidden: () => void;
  onArchive: () => void;
  onRestore: () => void;
  /** Delete the topic (its history stays). */
  onDelete: () => void;
  /** Delete the history of an already-deleted topic (removes the column). */
  onPurge: () => void;
};

/** Column title in the history header. Hover for rename, archive/restore and delete. */
export default function ColumnLabel({ topic, onRename, onToggleHidden, onArchive, onRestore, onDelete, onPurge }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(topic.title);

  const commit = () => {
    const v = value.trim();
    if (v && v !== topic.title) onRename(v);
    setEditing(false);
  };

  const state = topic.deleted ? "deleted" : topic.archivedAt ? "archived" : "active";

  return (
    <div className={`label${state !== "active" || topic.hidden ? " archived" : ""}`}>
      <span className="badge sm" style={{ background: topic.color }} />
      {editing ? (
        <input
          className="label-input"
          autoFocus
          value={value}
          maxLength={28}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <>
          <span className="label-text" title={topic.title}>
            {topic.title}
          </span>
          <span className="label-tools">
            <button
              className="icon-btn"
              aria-label={`Rename ${topic.title}`}
              title="Rename"
              onClick={() => {
                setValue(topic.title);
                setEditing(true);
              }}
            >
              <PencilIcon />
            </button>

            <button
              className="icon-btn"
              aria-label={topic.hidden ? `Show ${topic.title}` : `Hide ${topic.title}`}
              title={topic.hidden ? "Show column" : "Hide column"}
              onClick={onToggleHidden}
            >
              {topic.hidden ? <EyeIcon /> : <EyeOffIcon />}
            </button>

            {state === "active" && (
              <button className="icon-btn" aria-label={`Archive ${topic.title}`} title="Archive" onClick={onArchive}>
                <BanIcon />
              </button>
            )}
            {state === "archived" && (
              <button className="icon-btn" aria-label={`Restore ${topic.title}`} title="Restore" onClick={onRestore}>
                <RestoreIcon />
              </button>
            )}

            <ConfirmInline
              message={state === "deleted" ? "Delete history?" : "Delete?"}
              onConfirm={state === "deleted" ? onPurge : onDelete}
              trigger={(ask) => (
                <button
                  className="icon-btn"
                  aria-label={state === "deleted" ? `Delete history of ${topic.title}` : `Delete ${topic.title}`}
                  title={state === "deleted" ? "Delete history" : "Delete"}
                  onClick={ask}
                >
                  <TrashIcon />
                </button>
              )}
            />
          </span>
        </>
      )}
    </div>
  );
}
