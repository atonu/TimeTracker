"use client";

import { useEffect, useRef, useState } from "react";
import { NotesIcon } from "./icons";

type Props = {
  roomId: string;
  /** Titles of the topics that already exist, so none is added twice. */
  existing: string[];
  /** Creates one topic per title and returns how many were really added. */
  onAdd: (titles: string[]) => number;
  onClose: () => void;
};

const key = (roomId: string) => `tickwell:notes:${roomId}`;
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function load(roomId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(roomId)) || "null");
    if (Array.isArray(v) && v.length) return v.map((x) => String(x).slice(0, 50));
  } catch {}
  return [""];
}

/** A notepad for the day's goals. One bullet per line; "Add as topics" turns them into topics. */
export default function GoalsDialog({ roomId, existing, onAdd, onClose }: Props) {
  const [lines, setLines] = useState<string[]>(() => load(roomId));
  const [note, setNote] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(key(roomId), JSON.stringify(lines));
    } catch {}
  }, [lines, roomId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (focusNext.current != null) {
      refs.current[focusNext.current]?.focus();
      focusNext.current = null;
    }
  });
  useEffect(() => {
    refs.current[lines.length - 1]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (i: number, v: string) => {
    setNote("");
    setLines((l) => l.map((x, j) => (j === i ? v : x)));
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNext.current = i + 1;
      setLines((l) => [...l.slice(0, i + 1), "", ...l.slice(i + 1)]);
    } else if (e.key === "Backspace" && lines[i] === "" && lines.length > 1) {
      e.preventDefault();
      focusNext.current = Math.max(0, i - 1);
      setLines((l) => l.filter((_, j) => j !== i));
    } else if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowDown" && i < lines.length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const onPaste = (i: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    const parts = text
      .split(/\r?\n/)
      .map((p) => p.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim().slice(0, 50))
      .filter(Boolean);
    if (!parts.length) return;
    focusNext.current = i + parts.length;
    setLines((l) => [...l.slice(0, i), ...(l[i].trim() ? [l[i]] : []), ...parts, ...l.slice(i + 1)]);
  };

  const entries = lines.map((l) => l.trim()).filter(Boolean);

  const add = () => {
    const seen = new Set(existing.map(norm));
    const fresh: string[] = [];
    for (const t of entries) {
      const k = norm(t);
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(t.slice(0, 50));
    }
    const added = fresh.length ? onAdd(fresh) : 0;
    const skipped = entries.length - added;
    setNote(
      added
        ? `${added} added${skipped ? `, ${skipped} already there` : ""}`
        : entries.length
          ? "Already in your topics"
          : "Write a goal first",
    );
  };

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog notepad" role="dialog" aria-modal aria-label="Goals">
        <div className="notepad-head">
          <h2>
            <NotesIcon size={18} /> Goals
          </h2>
          <small>{today}</small>
        </div>
        <div className="notepad-sheet">
          {lines.map((l, i) => (
            <div className="note-line" key={i}>
              <span className="note-dot" aria-hidden />
              <input
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={l}
                maxLength={50}
                placeholder={i === 0 && lines.length === 1 ? "Write a goal, press Enter for the next" : ""}
                aria-label={`Goal ${i + 1}`}
                onChange={(e) => set(i, e.target.value)}
                onKeyDown={onKeyDown(i)}
                onPaste={onPaste(i)}
              />
            </div>
          ))}
        </div>
        <div className="notepad-foot">
          <button type="button" className="btn-text cancel-btn" onClick={onClose}>
            Close
          </button>
          <span className="notepad-note" role="status">
            {note}
          </span>
          <button type="button" className="btn-primary" onClick={add} disabled={entries.length === 0}>
            Add as topics
          </button>
        </div>
      </div>
    </div>
  );
}
