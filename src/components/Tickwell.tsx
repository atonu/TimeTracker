"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playBurst, stopSound, unlockAudio } from "@/lib/alarm";
import { dayKey, fmtDuration, isRinging, startOfDay, type Topic } from "@/lib/tracker";
import { useAppearance } from "@/lib/useAppearance";
import { useTracker } from "@/lib/useTracker";
import AppearancePanel from "./AppearancePanel";
import ArchiveDialog from "./ArchiveDialog";
import ColumnLabel from "./ColumnLabel";
import ColumnsPanel from "./ColumnsPanel";
import { AlarmIcon, ArchiveIcon, BrushIcon, EyeIcon, PlusIcon } from "./icons";
import TopicCard, { EmptyCard } from "./TopicCard";
import TopicDialog from "./TopicDialog";

const MIN_DAYS = 14;
// Two thresholds (hysteresis) so the layout can never flip back and forth while scrolling.
const COMPACT_AFTER = 30;
const EXPAND_BELOW = 5;
const FLY_MS = 320;

type Modal =
  | { kind: "topic"; topic: Topic | null }
  | { kind: "archives" }
  | { kind: "appearance" }
  | { kind: "columns" }
  | null;

export default function Tickwell() {
  const {
    topics,
    log,
    now,
    hydrated,
    start,
    pause,
    startBreak,
    clearBreak,
    stopAlarms,
    save,
    archive,
    restore,
    remove,
    purgeHistory,
    loadDemo,
  } = useTracker();
  const { theme, setTheme, bg, setBg } = useAppearance();
  const [modal, setModal] = useState<Modal>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  // Cards are either fully expanded or compact; CSS animates between the two.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      const compact = el.hasAttribute("data-compact");
      if (!compact && el.scrollTop > COMPACT_AFTER) el.setAttribute("data-compact", "");
      else if (compact && el.scrollTop < EXPAND_BELOW) el.removeAttribute("data-compact");
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  // Browsers only allow sound after a gesture: unlock audio on the first interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Alarm sound: a 10 s chime when the break ends, then again every 5 minutes until stopped.
  const played = useRef(new Map<string, number>());
  useEffect(() => {
    const ringing = topics.filter((t) => isRinging(t, now));
    const ids = new Set(ringing.map((t) => t.id));
    for (const id of [...played.current.keys()]) if (!ids.has(id)) played.current.delete(id);
    if (ringing.length === 0) {
      stopSound();
      return;
    }
    for (const t of ringing) {
      const elapsed = now - (t.breakUntil as number);
      const cycle = Math.floor(elapsed / 300000);
      const phase = elapsed % 300000;
      if (phase < 10000 && played.current.get(t.id) !== cycle && playBurst(10 - phase / 1000)) {
        played.current.set(t.id, cycle);
      }
    }
  }, [now, topics]);

  const ringingCount = topics.filter((t) => isRinging(t, now)).length;
  const stopAll = () => {
    stopSound();
    stopAlarms();
  };

  /** Flies the card away first, then applies the change so everything re-aligns. */
  const flyAway = useCallback((id: string, action: () => void) => {
    setLeaving((s) => new Set(s).add(id));
    setTimeout(() => {
      action();
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, FLY_MS);
  }, []);

  const today = dayKey(now);

  const active = useMemo(() => topics.filter((t) => !t.archivedAt), [topics]);
  // Archived (and deleted) topics keep a column at the end, oldest archive first.
  const inactive = useMemo(
    () => topics.filter((t) => t.archivedAt).sort((a, b) => (a.archivedAt ?? 0) - (b.archivedAt ?? 0)),
    [topics],
  );
  const archivedList = useMemo(() => inactive.filter((t) => !t.deleted), [inactive]);
  // Hidden archived columns vanish; hidden active ones stay in place but go blank.
  const cols = useMemo(() => [...active, ...inactive.filter((t) => !t.hidden)], [active, inactive]);
  const allColumns = useMemo(() => [...active, ...inactive], [active, inactive]);
  const n = cols.length;

  const days = useMemo(() => {
    const keys = Object.keys(log).sort();
    const earliest = keys.length ? new Date(keys[0] + "T00:00:00").getTime() : Infinity;
    const floor = startOfDay(now) - (MIN_DAYS - 1) * 86400e3;
    const out: { key: string; date: Date }[] = [];
    const d = new Date(startOfDay(now));
    const stop = Math.min(earliest, floor);
    while (d.getTime() >= stop) {
      out.push({ key: dayKey(d.getTime()), date: new Date(d) });
      d.setDate(d.getDate() - 1);
    }
    return out;
  }, [log, now]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of Object.values(log)) for (const [id, ms] of Object.entries(row)) t[id] = (t[id] ?? 0) + ms;
    return t;
  }, [log]);

  const close = useCallback(() => setModal(null), []);
  const create = () => setModal({ kind: "topic", topic: null });

  // Removing a card that is still on screen flies it away before the layout changes.
  const archiveTopic = (t: Topic) => (t.archivedAt ? archive(t.id) : flyAway(t.id, () => archive(t.id)));
  const deleteTopic = (t: Topic) => (t.archivedAt ? remove(t.id) : flyAway(t.id, () => remove(t.id)));

  const dateLabel = (key: string, date: Date) => {
    const yesterday = dayKey(now - 86400e3);
    const main =
      key === today
        ? "Today"
        : key === yesterday
          ? "Yesterday"
          : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const sub =
      key === today || key === yesterday
        ? date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
        : date.toLocaleDateString("en-GB", { weekday: "long" }) +
          (date.getFullYear() !== new Date(now).getFullYear() ? ` · ${date.getFullYear()}` : "");
    return { main, sub };
  };

  /** first / last data column get no outer border */
  const edge = (i: number) => (i === 0 ? " first" : "") + (i === n - 1 ? " last" : "");

  return (
    <>
      <div className={`bg-art art-${bg}`} aria-hidden />

      <div className="scroller" ref={scroller}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            Tickwell
            <time>
              {new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </time>
          </div>
          {ringingCount > 0 && (
            <button className="stop-all" onClick={stopAll}>
              <span className="ring-icon">
                <AlarmIcon size={16} />
              </span>
              Stop alarm{ringingCount > 1 ? "s" : ""}
            </button>
          )}
          <div className="topbar-actions">
            <button
              className="btn-ghost icon-only"
              onClick={() => setModal({ kind: "appearance" })}
              aria-label="Themes"
              title="Themes"
            >
              <BrushIcon />
            </button>
            <button
              className="btn-ghost icon-only"
              onClick={() => setModal({ kind: "columns" })}
              aria-label="Visible columns"
              title="Visible columns"
            >
              <EyeIcon />
            </button>
            <button className="btn-ghost" onClick={() => setModal({ kind: "archives" })}>
              <ArchiveIcon /> Archives
              {archivedList.length > 0 && <span className="count">{archivedList.length}</span>}
            </button>
            <button className="btn-primary" onClick={create}>
              <PlusIcon size={16} /> Create Topic
            </button>
          </div>
        </header>

        {hydrated && (
          <div className="board" style={{ ["--n" as string]: Math.max(n, 1) }}>
            {/* Sticky block: the timer cards and the column labels */}
            <div className="sticky-top">
              <div className="grid cards-row">
                <div className="corner" />
                <div />
                {active.length === 0 ? (
                  <div className="card-cell">
                    <EmptyCard onCreate={create} />
                  </div>
                ) : (
                  active.map((t) => (
                    <div className={`card-cell${leaving.has(t.id) ? " leaving" : ""}`} key={t.id}>
                      <TopicCard
                        topic={t}
                        now={now}
                        spentMs={log[today]?.[t.id] ?? 0}
                        onSetBreak={(m) => startBreak(t.id, m)}
                        onStopAlarm={() => {
                          stopSound();
                          clearBreak(t.id);
                        }}
                        onToggle={() => (t.startedAt != null ? pause(t.id) : start(t.id))}
                        onEdit={() => setModal({ kind: "topic", topic: t })}
                        onArchive={() => archiveTopic(t)}
                      />
                    </div>
                  ))
                )}
                <div />
              </div>

              <div className="grid head-row">
                <div className="date-cell">History</div>
                <div />
                {n === 0 ? (
                  <div className="hint">
                    Just looking around?
                    <button className="link" onClick={loadDemo}>
                      Load demo data
                    </button>
                  </div>
                ) : (
                  cols.map((t, i) => (
                    <div className={`label-cell${edge(i)}`} key={t.id}>
                      <ColumnLabel
                        topic={t}
                        onRename={(title) => save({ ...t, title })}
                        onToggleHidden={() => save({ ...t, hidden: !t.hidden })}
                        onArchive={() => archiveTopic(t)}
                        onRestore={() => restore(t.id)}
                        onDelete={() => deleteTopic(t)}
                        onPurge={() => purgeHistory(t.id)}
                      />
                    </div>
                  ))
                )}
                <div />
              </div>
            </div>

            {/* History */}
            <div className="sheet">
              {n > 0 && (
                <div className="grid row total-row">
                  <div className="date-cell">
                    <b>All time</b>
                    <small>Total hours</small>
                  </div>
                  <div />
                  {cols.map((t, i) => (
                    <div className={`cell${edge(i)}${t.archivedAt ? " archived" : ""}`} key={t.id}>
                      {t.hidden ? "" : fmtDuration(totals[t.id] ?? 0)}
                    </div>
                  ))}
                  <div />
                </div>
              )}

              {days.map(({ key, date }) => {
                const { main, sub } = dateLabel(key, date);
                return (
                  <div className={`grid row${key === today ? " today" : ""}`} key={key}>
                    <div className="date-cell">
                      <b>{main}</b>
                      <small>{sub}</small>
                    </div>
                    <div />
                    {n === 0 ? (
                      <div className="cell dim first last">—</div>
                    ) : (
                      cols.map((t, i) => {
                        const ms = log[key]?.[t.id] ?? 0;
                        const dim = Math.round(ms / 60000) <= 0;
                        return (
                          <div
                            className={`cell${edge(i)}${dim ? " dim" : ""}${t.archivedAt ? " archived" : ""}`}
                            key={t.id}
                          >
                            {t.hidden ? "" : fmtDuration(ms)}
                          </div>
                        );
                      })
                    )}
                    <div />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Outside the scroller: fixed positioning must not be trapped by its containment */}
      {modal?.kind === "topic" && (
        <TopicDialog
          topic={modal.topic}
          onSave={save}
          onDelete={(id) => {
            const t = topics.find((x) => x.id === id);
            if (t) deleteTopic(t);
          }}
          onClose={close}
        />
      )}
      {modal?.kind === "archives" && (
        <ArchiveDialog
          archived={archivedList}
          onRestore={restore}
          onDelete={remove}
          onClose={close}
        />
      )}
      {modal?.kind === "columns" && (
        <ColumnsPanel
          topics={allColumns}
          onToggle={(t) => save({ ...t, hidden: !t.hidden })}
          onClose={close}
        />
      )}
      {modal?.kind === "appearance" && (
        <AppearancePanel theme={theme} bg={bg} onTheme={setTheme} onBg={setBg} onClose={close} />
      )}
    </>
  );
}
