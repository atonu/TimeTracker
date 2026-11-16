"use client";

import { useEffect, useRef, useState } from "react";
import { clock, fmtGoal, isRinging, type Topic } from "@/lib/tracker";
import { AlarmIcon, BanIcon, CheckIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, StopIcon } from "./icons";
import TickFrame from "./TickFrame";

const ASK_MS = 5000; // how long "Set reminder?" stays
const FADE_MS = 500; // dissolve time
const BREAK_OPTIONS = [5, 10, 15];
// Quick options are in minutes.
const BREAK_UNIT = { ms: 60000, label: "minutes" };

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const hideAsk = () => {
    clearTimers();
    setAsk("off");
    setCustom(false);
  };

  // Custom reminder: "Set reminder?" turns into mm : ss fields + a confirm tick.
  const [custom, setCustom] = useState(false);
  const [mm, setMm] = useState("");
  const [ss, setSs] = useState("");
  const remRef = useRef<HTMLDivElement>(null);
  const customMs = (parseInt(mm || "0", 10) * 60 + parseInt(ss || "0", 10)) * 1000;

  const openCustom = () => {
    clearTimers(); // stays open until the user clicks away
    setAsk("on");
    setCustom(true);
  };
  const confirmCustom = () => {
    if (customMs <= 0) return;
    hideAsk();
    setMm("");
    setSs("");
    onSetBreak(customMs);
  };
  useEffect(() => {
    if (!custom) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (remRef.current && !remRef.current.contains(e.target as Node)) hideAsk();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom]);

  const field = (value: string, set: (v: string) => void, max: number, label: string, autoFocus?: boolean) => (
    <input
      className="rem-field"
      inputMode="numeric"
      placeholder={label}
      aria-label={label === "mm" ? "Minutes" : "Seconds"}
      value={value}
      autoFocus={autoFocus}
      maxLength={2}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
        set(v !== "" && parseInt(v, 10) > max ? String(max) : v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") confirmCustom();
        if (e.key === "Escape") hideAsk();
      }}
    />
  );

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
    <div
      className={`card${running ? " running" : ""}${done ? " complete" : ""}${ringing ? " ringing" : ""}${ask !== "off" ? " asking" : ""}${toolsOpen ? " tools-open" : ""}`}
    >
      <TickFrame progress={progress} />

      {/* On touch screens there is no hover: tapping the title row reveals the tools */}
      <div className="card-head" onClick={() => setToolsOpen((o) => !o)}>
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
              <span className="m-long">Break over</span>
              <span className="m-short">Over</span>
            </>
          ) : pending ? (
            <>
              <AlarmIcon /> <span className="m-long">Reminder in </span>
              {bm.hm.startsWith("00:") ? bm.hm.slice(3) : bm.hm}:{bm.s}
            </>
          ) : done ? (
            <>
              <CheckIcon /> <span className="m-long">Goal reached</span>
              <span className="m-short">Done</span>
            </>
          ) : (
            <>
              <span className="m-long">
                of {fmtGoal(topic.goalMs)} · {Math.round(progress * 100)}%
              </span>
              <span className="m-short">{Math.round(progress * 100)}%</span>
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
          onMouseLeave={() => !custom && scheduleDismiss()}
          ref={remRef}
        >
          {custom ? (
            <div className="rem-custom">
              {field(mm, setMm, 99, "mm", true)}
              <span className="rem-colon">:</span>
              {field(ss, setSs, 59, "ss")}
              <button
                className="rem-confirm"
                onClick={confirmCustom}
                disabled={customMs <= 0}
                aria-label="Start reminder"
                title="Confirm"
              >
                <CheckIcon size={14} />
              </button>
            </div>
          ) : (
            <>
              <button className="rem-title" onClick={openCustom} title="Set a custom time">
                Set reminder?
              </button>
              <div className="rem-opts">
                {BREAK_OPTIONS.map((m) => (
                  <button key={m} onClick={() => pickBreak(m)} aria-label={`Remind me in ${m} ${BREAK_UNIT.label}`}>
                    {m}
                  </button>
                ))}
                <span className="rem-unit">{BREAK_UNIT.label}</span>
              </div>
            </>
          )}
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
        <PlusIcon size={60} />
      </span>
      <span className="empty-label">Create Topic</span>
    </button>
  );
}
