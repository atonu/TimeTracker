"use client";

import { clock, fmtGoal, type Topic } from "@/lib/tracker";
import { BanIcon, CheckIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon } from "./icons";
import TickFrame from "./TickFrame";

type Props = {
  topic: Topic;
  /** Milliseconds spent on this topic today, including the running timer. */
  spentMs: number;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export default function TopicCard({ topic, spentMs, onToggle, onEdit, onArchive }: Props) {
  const running = topic.startedAt != null;
  const progress = topic.goalMs > 0 ? spentMs / topic.goalMs : 0;
  const done = progress >= 1;
  const { hm, s } = clock(Math.max(0, topic.goalMs - spentMs));

  return (
    <div className={`card${running ? " running" : ""}${done ? " complete" : ""}`}>
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
        <span className="meta">
          {done ? (
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

      {done ? (
        <span className="play-btn done" aria-label="Completed" title="Completed">
          <CheckIcon size={20} />
        </span>
      ) : (
        <button
          className="play-btn"
          onClick={onToggle}
          aria-label={running ? `Pause ${topic.title}` : `Start ${topic.title}`}
          aria-pressed={running}
        >
          {running ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
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
