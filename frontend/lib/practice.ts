export const PRACTICE_NOTE_KEY = "resoniq.practice.v1";
export const MIN_BPM = 30;
export const MAX_BPM = 240;

/** The fastest tempo played cleanly, or null before the first clean take. */
export function bestClean(takes: { bpm: number; clean: boolean }[]): number | null {
  return takes.reduce<number | null>((best, t) => (t.clean && (best === null || t.bpm > best) ? t.bpm : best), null);
}

/**
 * The tempo to practise next: start around 70% of the target, then climb a
 * few BPM past the best clean take, never beyond the target.
 */
export function nextRung(takes: { bpm: number; clean: boolean }[], target: number, step = 4): number {
  const best = bestClean(takes);
  const start = Math.max(MIN_BPM, Math.round(target * 0.7));
  return best === null ? Math.min(start, target) : Math.min(target, Math.max(best + step, MIN_BPM));
}

export function tappedTempo(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const gaps = taps.slice(1).map((t, i) => t - taps[i]);
  if (gaps.some((g) => !Number.isFinite(g) || g <= 0 || g > 2000)) return null;
  const bpm = Math.round(60_000 / (gaps.reduce((sum, g) => sum + g, 0) / gaps.length));
  return Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
}

export function validLoop(a: number, b: number, duration: number): boolean {
  return [a, b, duration].every(Number.isFinite) && a >= 0 && b <= duration && b - a >= 0.25;
}

export function readPracticeNote(raw: string | null): { goal: string; notes: string } {
  try {
    const value = JSON.parse(raw ?? "null");
    return {
      goal: typeof value?.goal === "string" ? value.goal.slice(0, 160) : "",
      notes: typeof value?.notes === "string" ? value.notes.slice(0, 2000) : "",
    };
  } catch {
    return { goal: "", notes: "" };
  }
}

/** Timers fill a short buffer; the audio clock determines when each click sounds. */
export function startClickTrack(context: AudioContext, bpm: number, beats: number, volume: number, onBeat: (beat: number) => void) {
  const nodes = new Set<OscillatorNode>();
  const visual: { time: number; beat: number }[] = [];
  let nextTime = context.currentTime + 0.04;
  let beat = 0;
  const tick = () => {
    if (context.state !== "running") return;
    // A stalled tab must never play all the missed beats in a burst.
    if (nextTime < context.currentTime) nextTime = context.currentTime + 0.04;
    while (nextTime < context.currentTime + 0.1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = beat === 0 ? 1200 : 800;
      gain.gain.setValueAtTime(0.0001, nextTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.25), nextTime + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, nextTime + 0.035);
      oscillator.connect(gain);
      gain.connect(context.destination);
      nodes.add(oscillator);
      oscillator.onended = () => { nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(nextTime);
      oscillator.stop(nextTime + 0.04);
      visual.push({ time: nextTime, beat });
      beat = (beat + 1) % beats;
      nextTime += 60 / bpm;
    }
    while (visual.length && visual[0].time <= context.currentTime) onBeat(visual.shift()!.beat);
  };
  tick();
  const timer = setInterval(tick, 25);
  return () => {
    clearInterval(timer);
    nodes.forEach((node) => { node.stop(); node.disconnect(); });
    nodes.clear();
  };
}
