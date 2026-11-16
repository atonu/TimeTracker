"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** Renders the normal delete control; call `ask` to swap it for the confirmation. */
  trigger: (ask: () => void) => ReactNode;
  onConfirm: () => void;
  message?: string;
  confirmLabel?: string;
};

/** Replaces a delete control, in the same place, with an inline "are you sure?". */
export default function ConfirmInline({ trigger, onConfirm, message = "Delete?", confirmLabel = "Delete" }: Props) {
  const [asking, setAsking] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAsking(false);
      }
    };
    // Clicking anywhere outside the confirmation counts as Cancel.
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAsking(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [asking]);

  if (!asking) return <>{trigger(() => setAsking(true))}</>;

  return (
    <span className="confirm" ref={ref} role="alertdialog" aria-label={message}>
      <span className="confirm-msg">{message}</span>
      <button
        type="button"
        className="chip solid-danger"
        autoFocus
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="chip" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
