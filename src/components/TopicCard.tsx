"use client";

import { useEffect, useRef, useState } from "react";
import { clock, fmtGoal, isRinging, type Topic } from "@/lib/tracker";
import { AlarmIcon, BanIcon, CheckIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, StopIcon } from "./icons";
import TickFrame from "./TickFrame";

const ASK_MS = 5000; // how long "Set reminder?" stays
const FADE_MS = 500; // dissolve time
const BREAK_OPTIONS = [5, 10, 15];
// Testing: the options are seconds. For real use set { ms: 60000, label: "minutes" }.
const BREAK_UNIT = { ms: 1000, label: "seconds" };

type Props = {
  topic: Topic;
  now: number;
  /** Milliseconds spent on this topic today, including the running timer. */
  spentMs: number;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onSetBreak: (ms: number) => void;
  onStopAlarm: () => void;
};

export default function TopicCard({ topic, now, spentMs, onToggle, onEdit, onArchive, onSetBreak, onStopAlarm }: Props) {
  const running = topic.startedAt != null;
  const progress = topic.goalMs > 0 ? spentMs / topic.goalMs : 0;
  const done = progress >= 1;
  const { hm, s } = clock(Math.max(0, topic.goalMs - spentMs));

  const ringing = isRinging(topic, now);
  const pending = topic.breakUntil != null && !ringing;
  const breakLeft = pending ? topic.breakUntil! - now : 0;
  const breakFrac = pending && topic.breakMs ? Math.min(1, Math.max(0, breakLeft / topic.breakMs)) : 0;
  const bm = clock(breakLeft);

  // "Set reminder?" appears after pausing, then dissolves.
  const [ask, setAsk] = useState<"off" | "on" | "fade">("off");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const hideAsk = () => {
    clearTimers();
    setAsk("off");
  };

  // Dissolve ASK_MS after it appears, or ASK_MS after the cursor leaves it.
  const scheduleDismiss = () => {
    clearTimers();
    timers.current.push(
      setTimeout(() => {
        setAsk("fade");
        timers.current.push(setTimeout(() => setAsk("off"), FADE_MS));
      }, ASK_MS),
    );
  };

  const toggle = () => {
    const wasRunning = running;
    onToggle();
    clearTimers();
    if (wasRunning) {
      setAsk("on");
      scheduleDismiss();
    } else {
      setAsk("off");
    }
  };

  const pickBreak = (m: number) => {
    hideAsk();
    onSetBreak(m * BREAK_UNIT.ms);
  };

  return (
    <div className={`card${running ? " running" : ""}${done ? " complete" : ""}${ringing ? " ringing" : ""}`}>
      <TickFrame progress={progress} />

      <div className="card-head">
        <span className="badge" style={{ background: topic.color }} />
        <span className="card-title" title={topic.title}>
          {topic.title}
        </span>
        <div className="card-tools">
          <button className="icon-btn" onClick={onArchive} aria-label={`Archive ${topic.title}`} title="Archive">
            <BanIcon />
          </button>
          <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${topic.title}`} title="Edit">
            <PencilIcon />
          </button>
        </div>
      </div>

      <div className="card-body">
        <div className="time" aria-label={`${hm} remaining`}>
          {hm}
          <span className="sec">:{s}</span>
        </div>
      </div>

      <div className="card-foot">
        <span className={`meta${pending ? " break" : ""}`}>
          {ringing ? (
            <>
              <span className="ring-icon">
                <AlarmIcon size={15} />
              </span>
              Break over
            </>
          ) : pending ? (
            <>
              <AlarmIcon /> Reminder in {bm.hm.startsWith("00:") ? bm.hm.slice(3) : bm.hm}:{bm.s}
            </>
          ) : done ? (
            <>
              <CheckIcon /> Goal reached
            </>
          ) : (
            <>
              of {fmtGoal(topic.goalMs)} · {Math.round(progress * 100)}%
            </>
          )}
        </span>
      </div>

      {/* Sits right beside the play / pause button */}
      {ask !== "off" && (
        <div
          className={`reminder${ask === "fade" ? " fade" : ""}`}
          role="group"
          aria-label="Set reminder"
          onMouseEnter={() => {
            clearTimers(); // hovering keeps it open
            setAsk("on");
          }}
          onMouseLeave={scheduleDismiss}
        >
          <div className="rem-title">Set reminder?</div>
          <div className="rem-opts">
            {BREAK_OPTIONS.map((m) => (
              <button key={m} onClick={() => pickBreak(m)} aria-label={`Remind me in ${m} ${BREAK_UNIT.label}`}>
                {m}
              </button>
            ))}
            <span className="rem-unit">{BREAK_UNIT.label}</span>
          </div>
        </div>
      )}

      {ringing && (
        <button className="stop-btn" onClick={onStopAlarm} aria-label="Stop alarm" title="Stop alarm">
          <StopIcon />
        </button>
      )}

      <div className="play-wrap">
        {pending && (
          <svg className="break-ring" viewBox="0 0 100 100" aria-hidden>
            <circle className="ring-track" cx="50" cy="50" r="46" />
            <circle
              className="ring-fill"
              cx="50"
              cy="50"
              r="46"
              pathLength={100}
              strokeDasharray={`${breakFrac * 100} 100`}
            />
          </svg>
        )}
        {done ? (
          <span className="play-btn done" aria-label="Completed" title="Completed">
            <CheckIcon size={20} />
          </span>
        ) : (
          <button
            className="play-btn"
            onClick={toggle}
            aria-label={running ? `Pause ${topic.title}` : `Start ${topic.title}`}
            aria-pressed={running}
          >
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button className="card empty-card" onClick={onCreate}>
      <span className="empty-plus">
        <PlusIcon size={26} />
      </span>
      <span className="empty-label">Create Topic</span>
    </button>
  );
}
