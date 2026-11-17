"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, uid, type Topic } from "@/lib/tracker";
import ConfirmInline from "./ConfirmInline";
import { CheckIcon } from "./icons";

type Props = {
  /** Existing topic to edit, or null to create a new one. */
  topic: Topic | null;
  onSave: (t: Topic) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

const PRESETS = [30, 60, 120, 180, 240];

export default function TopicDialog({ topic, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(topic?.title ?? "");
  const [color, setColor] = useState(topic?.color ?? COLORS[0]);
  const initial = Math.round((topic?.goalMs ?? 2 * 3600e3) / 60000);
  const [hours, setHours] = useState(Math.floor(initial / 60));
  const [minutes, setMinutes] = useState(initial % 60);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalMin = hours * 60 + minutes;
  const valid = title.trim().length > 0 && totalMin > 0 && totalMin <= 24 * 60;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: topic?.id ?? uid(),
      title: title.trim(),
      color,
      goalMs: totalMin * 60000,
      startedAt: topic?.startedAt ?? null,
    });
    onClose();
  };

  const setTotal = (m: number) => {
    setHours(Math.floor(m / 60));
    setMinutes(m % 60);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal aria-label={topic ? "Edit topic" : "Create topic"}>
        <h2>{topic ? "Edit topic" : "Create topic"}</h2>

        <label className="field">
          <span>Title</span>
          <input
            ref={titleRef}
            value={title}
            maxLength={28}
            placeholder="e.g. Deep Work"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch${c === color ? " on" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={c === color}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <span>Time for the day</span>
          <div className="duration">
            <label>
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Math.min(24, Math.max(0, Number(e.target.value) || 0)))}
              />
              <small>hours</small>
            </label>
            <label>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
              />
              <small>min</small>
            </label>
          </div>
          <div className="chips">
            {PRESETS.map((m) => (
              <button type="button" key={m} className={`chip${m === totalMin ? " on" : ""}`} onClick={() => setTotal(m)}>
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            ))}
          </div>
        </div>

        <div className="actions">
          {topic && (
            <ConfirmInline
              message="Delete topic?"
              onConfirm={() => {
                onDelete(topic.id);
                onClose();
              }}
              trigger={(ask) => (
                <button type="button" className="btn-text danger" onClick={ask}>
                  Delete
                </button>
              )}
            />
          )}
          <span className="spacer" />
          <button type="button" className="btn-text cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary submit-btn" disabled={!valid} aria-label={topic ? "Save" : "Create"}>
            <span className="submit-text">{topic ? "Save" : "Create"}</span>
            <span className="submit-tick">
              <CheckIcon size={16} />
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
