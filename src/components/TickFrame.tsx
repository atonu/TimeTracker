"use client";

import { useEffect, useId, useRef, useState } from "react";

const INSET = 10; // distance from card edge to the outer end of the ticks
const BAND = 9; // tick length
const TICK = 1.7; // tick thickness
const PITCH = 8; // distance between ticks

/**
 * Clock-style radial ticks that run around the inside edge of the card.
 * Dark ticks fill clockwise from the top-centre as `progress` goes 0 -> 1.
 */
export default function TickFrame({ progress }: { progress: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const maskId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  let body = null;
  if (w > 0 && h > 0) {
    // The ticks are a wide dashed stroke centred on this path.
    const o = INSET + BAND / 2;
    const rw = w - 2 * o;
    const rh = h - 2 * o;
    const r = Math.max(4, Math.min(26, rh / 2 - 1));
    const L = 2 * (rw - 2 * r) + 2 * (rh - 2 * r) + 2 * Math.PI * r;
    const n = Math.round(L / PITCH);
    const gap = L / n - TICK;
    const d = [
      `M ${w / 2} ${o}`,
      `H ${w - o - r}`,
      `A ${r} ${r} 0 0 1 ${w - o} ${o + r}`,
      `V ${h - o - r}`,
      `A ${r} ${r} 0 0 1 ${w - o - r} ${h - o}`,
      `H ${o + r}`,
      `A ${r} ${r} 0 0 1 ${o} ${h - o - r}`,
      `V ${o + r}`,
      `A ${r} ${r} 0 0 1 ${o + r} ${o}`,
      `Z`,
    ].join(" ");
    const p = Math.min(1, Math.max(0, progress));
    const common = { d, fill: "none", strokeWidth: BAND, pathLength: L } as const;
    body = (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <defs>
          <mask id={maskId}>
            <path {...common} stroke="#fff" strokeDasharray={`${p * L} ${L}`} />
          </mask>
        </defs>
        <path {...common} className="tick-base" strokeDasharray={`${TICK} ${gap}`} />
        <path {...common} className="tick-done" strokeDasharray={`${TICK} ${gap}`} mask={`url(#${maskId})`} />
      </svg>
    );
  }

  return (
    <div ref={ref} className="tickframe">
      {body}
    </div>
  );
}
