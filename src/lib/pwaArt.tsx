import { ImageResponse } from "next/og";
import { BRAND } from "./brand";

const INK = "#0b0b0c";
const PAPER = "#ffffff";

/** The Tickwell mark: a clock-tick ring, three quarters filled, with a dot in the middle. */
export function Mark({ size, fg = PAPER, dim = "rgba(255,255,255,0.28)" }: { size: number; fg?: string; dim?: string }) {
  const ticks = 60;
  const filled = 45;
  const c = 50;
  const lines = [];
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    const r1 = 46;
    const r2 = major ? 37 : 41;
    lines.push(
      <line
        key={i}
        x1={c + Math.cos(a) * r1}
        y1={c + Math.sin(a) * r1}
        x2={c + Math.cos(a) * r2}
        y2={c + Math.sin(a) * r2}
        stroke={i < filled ? fg : dim}
        strokeWidth={major ? 3 : 2}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {lines}
      <circle cx={c} cy={c} r={9} fill={fg} />
    </svg>
  );
}

/** Square app icon. `pad` is the fraction of the canvas kept clear around the mark. */
export function iconImage(size: number, pad = 0.16, rounded = false) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <Mark size={Math.round(size * (1 - pad * 2))} />
      </div>
    ),
    { width: size, height: size },
  );
}

/** Launch screen shown while an installed iOS app starts up. */
export function splashImage(w: number, h: number) {
  const unit = Math.min(w, h);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          color: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: unit * 0.3,
            height: unit * 0.3,
            borderRadius: unit * 0.3 * 0.22,
            background: INK,
          }}
        >
          <Mark size={unit * 0.3 * 0.68} />
        </div>
        <div style={{ display: "flex", marginTop: unit * 0.06, fontSize: unit * 0.075, fontWeight: 700 }}>
          {BRAND.name}
        </div>
        <div style={{ display: "flex", marginTop: unit * 0.02, fontSize: unit * 0.035, color: "#8b8b92" }}>
          {BRAND.motto}
        </div>
      </div>
    ),
    { width: w, height: h },
  );
}

/** Social share banner, 1200x630. */
export function bannerImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: "linear-gradient(135deg, #ffffff 0%, #f1f1f3 100%)",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, letterSpacing: -3 }}>{BRAND.name}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 40, fontWeight: 600 }}>{BRAND.motto}</div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#6b6b73", lineHeight: 1.4 }}>
            A calm daily time budget for the things that matter.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 340,
            height: 340,
            borderRadius: 78,
            background: INK,
            boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
          }}
        >
          <Mark size={240} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
