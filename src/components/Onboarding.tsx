"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { ArchiveIcon, BrushIcon, ChevronIcon, PlayIcon, PlusIcon } from "./icons";

const STEPS = [
  {
    icon: <span className="ob-logo" />,
    title: "Welcome to Tickwell",
    body: "A day only has so many hours. Tickwell helps you decide where they go, and gently keeps you inside those limits.",
  },
  {
    icon: <PlusIcon size={34} />,
    title: "Create a topic",
    body: "Tap Create Topic for anything you spend time on: study, work, gym, reading. Give it a colour and a daily time allowance.",
  },
  {
    icon: <PlayIcon />,
    title: "Start the clock",
    body: "Press play and the time left counts down. Run as many timers as you like at once. Pause to take a break and set a reminder to come back.",
  },
  {
    icon: <ArchiveIcon />,
    title: "Stay within the limit",
    body: "When a topic reaches its daily allowance it stops itself and gets a tick. The table below keeps every day's history.",
  },
  {
    icon: <BrushIcon />,
    title: "Make it yours",
    body: "Hide, archive or rename topics from the column headers, and pick a theme and background with the brush. That is all there is to it.",
  },
];

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const s = STEPS[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay">
      <div className="dialog onboarding" role="dialog" aria-label="Welcome tour">
        <button className="btn-text ob-skip" onClick={onClose}>
          Skip
        </button>
        <div className="ob-step" key={i}>
          <div className="ob-icon">{s.icon}</div>
          <h2>{s.title}</h2>
          <p>{s.body}</p>
          {i === 0 && <p className="ob-motto">{BRAND.motto}</p>}
        </div>
        <div className="ob-dots" aria-hidden>
          {STEPS.map((_, n) => (
            <i key={n} className={n === i ? "on" : ""} />
          ))}
        </div>
        <div className="ob-nav">
          <button
            className="btn-text"
            onClick={() => setI(i - 1)}
            style={{ visibility: i === 0 ? "hidden" : "visible" }}
          >
            Back
          </button>
          <button className="btn-primary" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? "Get started" : "Next"} {!last && <ChevronIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
