// A soft, synthesised chime: no audio files needed.
// Browsers only allow sound after a user gesture, so call unlockAudio() from one.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;

// C major pentatonic arpeggio (C5 E5 G5 C6): calm, never sharp.
const NOTES = [523.25, 659.25, 783.99, 1046.5];
const PATTERN_S = 2.5; // one arpeggio every 2.5 s

export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

function tone(c: AudioContext, out: AudioNode, freq: number, at: number) {
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.24, at + 0.03);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 2.0);
  env.connect(out);

  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.value = freq;
  const shimmer = c.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.value = freq * 2;
  const shimmerGain = c.createGain();
  shimmerGain.gain.value = 0.18;
  shimmer.connect(shimmerGain).connect(env);
  body.connect(env);

  for (const o of [body, shimmer]) {
    o.start(at);
    o.stop(at + 2.1);
  }
}

/** Plays the chime for `seconds`. Returns false if the browser still blocks audio. */
export function playBurst(seconds = 10): boolean {
  if (master) return true; // already sounding
  if (!ctx || ctx.state !== "running") return false;
  const c = ctx;

  const out = c.createGain();
  out.gain.value = 0.6;
  out.connect(c.destination);

  // gentle echo
  const delay = c.createDelay(1);
  delay.delayTime.value = 0.34;
  const feedback = c.createGain();
  feedback.gain.value = 0.32;
  const soften = c.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 2800;
  out.connect(delay);
  delay.connect(soften);
  soften.connect(feedback).connect(delay);
  soften.connect(c.destination);

  const t0 = c.currentTime + 0.05;
  for (let rep = 0; rep * PATTERN_S < seconds; rep++) {
    NOTES.forEach((f, i) => {
      const offset = rep * PATTERN_S + i * 0.3;
      if (offset < seconds) tone(c, out, f, t0 + offset);
    });
  }

  master = out;
  endTimer = setTimeout(() => stopSound(), seconds * 1000 + 1500);
  return true;
}

export function stopSound() {
  if (endTimer) clearTimeout(endTimer);
  endTimer = null;
  const m = master;
  master = null;
  if (!m || !ctx) return;
  try {
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  } catch {}
  setTimeout(() => m.disconnect(), 400);
}
