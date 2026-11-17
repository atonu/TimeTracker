"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playBurst, playChime, stopSound, unlockAudio } from "@/lib/alarm";
import { dayKey, fmtDuration, isRinging, startOfDay, type Topic } from "@/lib/tracker";
import { useAppearance } from "@/lib/useAppearance";
import { useTracker } from "@/lib/useTracker";
import AppearancePanel from "./AppearancePanel";
import HelpModal from "./HelpModal";
import Onboarding from "./Onboarding";
import ArchiveDialog from "./ArchiveDialog";
import ColumnLabel from "./ColumnLabel";
import ColumnsPanel from "./ColumnsPanel";
import { AlarmIcon, ArchiveIcon, BrushIcon, CollapseIcon, EyeIcon, ExpandIcon, HelpIcon, PlusIcon } from "./icons";
import TopicCard, { EmptyCard } from "./TopicCard";
import TopicDialog from "./TopicDialog";

const MIN_DAYS = 14;
// Two thresholds (hysteresis) so the layout can never flip back and forth while scrolling.
const COMPACT_AFTER = 30;
const TINY_AFTER = 260; // scroll distance of the whole phase: cards go from 85% to 20%
const FLY_MS = 320;
const FADE_MS = 260; // cross-fade out
const ENTER_MS = 400; // cross-fade in
const EYE_MS = 3000; // how long the floating eye button stays

type Modal =
  | { kind: "topic"; topic: Topic | null }
  | { kind: "archives" }
  | { kind: "appearance" }
  | { kind: "columns" }
  | { kind: "help" }
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
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [entering, setEntering] = useState<Set<string>>(new Set());
  const [tour, setTour] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("timetracker:onboarded")) setTour(true);
    } catch {}
  }, []);
  const endTour = useCallback(() => {
    setTour(false);
    try {
      localStorage.setItem("timetracker:onboarded", "1");
    } catch {}
  }, []);
  const scroller = useRef<HTMLDivElement>(null);
  const sheetScroll = useRef<HTMLDivElement>(null);
  const block = useRef<HTMLDivElement>(null);

  // Dense view (PC only): smaller cards, columns and text. Remembered per browser.
  const [dense, setDense] = useState(false);
  useEffect(() => {
    try {
      setDense(localStorage.getItem("timetracker:dense") === "1");
    } catch {}
  }, []);
  const toggleDense = () => {
    const next = !dense;
    setDense(next);
    try {
      localStorage.setItem("timetracker:dense", next ? "1" : "0");
    } catch {}
  };

  // Floating eye button above the table: shows on hover, stays 5 s, resets on interaction.
  const [eyeOn, setEyeOn] = useState(false);
  const eyeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeHold = () => {
    if (eyeTimer.current) clearTimeout(eyeTimer.current);
    setEyeOn(true);
  };
  const eyePoke = () => {
    eyeHold();
    eyeTimer.current = setTimeout(() => setEyeOn(false), EYE_MS);
  };
  useEffect(() => () => {
    if (eyeTimer.current) clearTimeout(eyeTimer.current);
  }, []);

  // Page controller. The page does not scroll by itself: wheel, touch and keys are read here.
  // While the cards are shrinking (phases 1 to 3) the history stays still. Only once the cards
  // reach their smallest size (phase 3) does further scrolling move the history rows.
  const phase = useRef(0); // 0 (top) .. TINY_AFTER (cards at 20%)
  useEffect(() => {
    const el = scroller.current;
    const sheet = sheetScroll.current;
    if (!el || !sheet) return;

    const applyPhase = () => {
      const p = phase.current;
      if (p >= COMPACT_AFTER) el.setAttribute("data-compact", "");
      else el.removeAttribute("data-compact");
      if (p >= TINY_AFTER) el.setAttribute("data-tiny", "");
      else el.removeAttribute("data-tiny");
    };

    const move = (dy: number, dx: number) => {
      if (dx) {
        sheet.scrollLeft += dx;
        if (block.current) block.current.scrollLeft = sheet.scrollLeft; // cards line up with the columns
      }
      if (dy > 0) {
        if (phase.current < TINY_AFTER) {
          phase.current = Math.min(TINY_AFTER, phase.current + dy);
          applyPhase();
        } else {
          sheet.scrollTop += dy;
        }
      } else if (dy < 0) {
        if (sheet.scrollTop > 0) {
          sheet.scrollTop += dy; // the history goes back first
        } else {
          phase.current = Math.max(0, phase.current + dy);
          applyPhase();
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom keeps working
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      if (e.shiftKey) {
        // Shift + wheel means sideways. Windows reports it on deltaY, so use whichever axis moved.
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        move(0, d * k);
        return;
      }
      move(e.deltaY * k, e.deltaX * k);
    };

    let tx = 0;
    let ty = 0;
    const onTouchStart = (e: TouchEvent) => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      move(ty - y, tx - x); // a finger moving up scrolls down
      tx = x;
      ty = y;
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const step = el.clientHeight * 0.6;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") move(step, 0);
      else if (e.key === "ArrowUp" || e.key === "PageUp") move(-step, 0);
      else if (e.key === "ArrowRight") move(0, 60);
      else if (e.key === "ArrowLeft") move(0, -60);
      else return;
      e.preventDefault();
    };

    // The history has its own scrollbars. Before phase 3 the table must not move, so a dragged
    // scrollbar is held at the top; the cards line up with the columns sideways.
    const onSheetScroll = () => {
      if (phase.current < TINY_AFTER && sheet.scrollTop > 0) sheet.scrollTop = 0;
      if (block.current) block.current.scrollLeft = sheet.scrollLeft;
    };
    sheet.addEventListener("scroll", onSheetScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    applyPhase();
    return () => {
      sheet.removeEventListener("scroll", onSheetScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [hydrated]);

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

  // Goal reached: play a soft chime once, the moment a topic's time for today runs out.
  // The first load only records what is already done, so opening the app stays silent.
  const doneBefore = useRef<Set<string> | null>(null);
  useEffect(() => {
    const key = dayKey(now);
    const doneNow = new Set(
      topics.filter((t) => !t.archivedAt && (log[key]?.[t.id] ?? 0) >= t.goalMs && t.goalMs > 0).map((t) => t.id),
    );
    if (doneBefore.current) {
      for (const id of doneNow) if (!doneBefore.current.has(id)) playChime();
    }
    doneBefore.current = doneNow;
  }, [log, topics, now]);

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

  const withId = (set: Set<string>, id: string, on: boolean) => {
    const n = new Set(set);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  };

  /** Fades the card and its column out, applies the change, then fades the column in at its new place. */
  const crossfade = useCallback((id: string, action: () => void) => {
    setFading((s) => withId(s, id, true));
    setTimeout(() => {
      action();
      setFading((s) => withId(s, id, false));
      setEntering((s) => withId(s, id, true));
      setTimeout(() => setEntering((s) => withId(s, id, false)), ENTER_MS);
    }, FADE_MS);
  }, []);

  /** Applies a change that makes a column appear, fading it in. */
  const reveal = useCallback((id: string, action: () => void) => {
    action();
    setEntering((s) => withId(s, id, true));
    setTimeout(() => setEntering((s) => withId(s, id, false)), ENTER_MS);
  }, []);

  const fx = (id: string) => (fading.has(id) ? " fading" : "") + (entering.has(id) ? " entering" : "");

  const today = dayKey(now);

  const activeAll = useMemo(() => topics.filter((t) => !t.archivedAt), [topics]);
  // Hiding a topic hides its card and its column.
  const active = useMemo(() => activeAll.filter((t) => !t.hidden), [activeAll]);
  // Archived (and deleted) topics keep a column at the end, oldest archive first.
  const inactive = useMemo(
    () => topics.filter((t) => t.archivedAt).sort((a, b) => (a.archivedAt ?? 0) - (b.archivedAt ?? 0)),
    [topics],
  );
  const archivedList = useMemo(() => inactive.filter((t) => !t.deleted), [inactive]);
  const cols = useMemo(() => [...active, ...inactive.filter((t) => !t.hidden)], [active, inactive]);
  const allColumns = useMemo(() => [...activeAll, ...inactive], [activeAll, inactive]);
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
  const archiveTopic = (t: Topic) => (t.archivedAt ? archive(t.id) : crossfade(t.id, () => archive(t.id)));
  const restoreTopic = (t: Topic) => crossfade(t.id, () => restore(t.id));
  const setHidden = (t: Topic, hidden: boolean) =>
    hidden ? crossfade(t.id, () => save({ ...t, hidden: true })) : reveal(t.id, () => save({ ...t, hidden: false }));
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

  /** One day of the history table. */
  const dayRow = ({ key, date }: { key: string; date: Date }) => {
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
                className={`cell${edge(i)}${dim ? " dim" : ""}${t.archivedAt ? " archived" : ""}${fx(t.id)}`}
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
  };

  /** first / last data column get no outer border */
  const edge = (i: number) => (i === 0 ? " first" : "") + (i === n - 1 ? " last" : "");

  return (
    <>
      <div className={`bg-art art-${bg}`} aria-hidden />

      <div className="scroller" ref={scroller} data-dense={dense ? "" : undefined}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            Tickwell
            <time>
              {new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </time>
          </div>
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
              onClick={() => setModal({ kind: "help" })}
              aria-label="Help"
              title="Help"
            >
              <HelpIcon />
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
              <ArchiveIcon /> <span className="btn-label">Archives</span>
              {archivedList.length > 0 && <span className="count">{archivedList.length}</span>}
            </button>
            <button className="btn-primary" onClick={create}>
              <PlusIcon size={16} /> <span className="btn-label">Create Topic</span>
            </button>
          </div>
        </header>

        {hydrated && (
          <div className="board" style={{ ["--n" as string]: Math.max(n, 1) }}>
            {/* Sticky block: the timer cards and the column labels */}
            <div className="sticky-top" ref={block}>
              <div className="grid cards-row">
                <div className="corner" />
                <div />
                {active.length === 0 ? (
                  <div className="card-cell">
                    <EmptyCard onCreate={create} />
                  </div>
                ) : (
                  active.map((t) => (
                    <div className={`card-cell${leaving.has(t.id) ? " leaving" : ""}${fx(t.id)}`} key={t.id}>
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
                        onCreate={create}
                        onArchive={() => archiveTopic(t)}
                      />
                    </div>
                  ))
                )}
                <div />
              </div>

              <div className="eye-rail">
                <button
                  className={`eye-float${eyeOn ? " on" : ""}`}
                  onMouseEnter={eyeHold}
                  onMouseLeave={eyePoke}
                  onClick={() => {
                    eyePoke();
                    setModal({ kind: "columns" });
                  }}
                  aria-label="Show or hide columns"
                  title="Show or hide columns"
                  tabIndex={eyeOn ? 0 : -1}
                >
                  <EyeIcon />
                </button>
              </div>
              <div
                className="grid head-row"
                onMouseEnter={eyeHold} // stays while the cursor is on the header row
                onMouseLeave={eyePoke}
                onPointerUp={(e) => e.pointerType === "touch" && eyePoke()} // touch has no hover
              >
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
                    <div className={`label-cell${edge(i)}${fx(t.id)}`} key={t.id}>
                      <ColumnLabel
                        topic={t}
                        onRename={(title) => save({ ...t, title })}
                        onToggleHidden={() => setHidden(t, !t.hidden)}
                        onArchive={() => archiveTopic(t)}
                        onRestore={() => restoreTopic(t)}
                        onDelete={() => deleteTopic(t)}
                        onPurge={() => purgeHistory(t.id)}
                      />
                    </div>
                  ))
                )}
                <div />
              </div>
            </div>

            {/* History: scrolled by the page controller, not the browser */}
            <div className="sheet-scroll" ref={sheetScroll}>
              <div className="sheet">
                {n > 0 && (
                  <div className="grid row total-row">
                    <div className="date-cell">
                      <b>All time</b>
                      <small>Total hours</small>
                    </div>
                    <div />
                    {cols.map((t, i) => (
                      <div className={`cell${edge(i)}${t.archivedAt ? " archived" : ""}${fx(t.id)}`} key={t.id}>
                        {t.hidden ? "" : fmtDuration(totals[t.id] ?? 0)}
                      </div>
                    ))}
                    <div />
                  </div>
                )}
                {days.map(dayRow)}
              </div>
            </div>
          </div>
        )}
      </div>

        {ringingCount > 0 && (
          <button className="stop-all" onClick={stopAll}>
            <span className="ring-icon">
              <AlarmIcon size={16} />
            </span>
            <span className="btn-label">Stop alarm{ringingCount > 1 ? "s" : ""}</span>
          </button>
        )}
      {/* Fixed to the screen, outside the scroller, so it never moves with the layout */}
      {hydrated && (
        <div className="dense-rail-fixed">
                <button
                  className="dense-toggle"
                  onClick={toggleDense}
                  aria-pressed={dense}
                  aria-label={dense ? "Normal size" : "Compact size"}
                  title={dense ? "Normal size" : "Compact size"}
                >
                  {dense ? <CollapseIcon /> : <ExpandIcon />}
                </button>
        </div>
      )}

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
          onRestore={(id) => {
            const t = topics.find((x) => x.id === id);
            if (t) restoreTopic(t);
            else restore(id);
          }}
          onDelete={remove}
          onClose={close}
        />
      )}
      {modal?.kind === "columns" && (
        <ColumnsPanel
          topics={allColumns}
          onToggle={(t) => setHidden(t, !t.hidden)}
          onShowAll={() => allColumns.filter((t) => t.hidden).forEach((t) => setHidden(t, false))}
          onClose={close}
        />
      )}
      {modal?.kind === "help" && (
        <HelpModal
          onClose={close}
          onTour={() => {
            close();
            setTour(true);
          }}
        />
      )}
      {tour && hydrated && <Onboarding onClose={endTour} />}
      {modal?.kind === "appearance" && (
        <AppearancePanel theme={theme} bg={bg} onTheme={setTheme} onBg={setBg} onClose={close} />
      )}
    </>
  );
}
