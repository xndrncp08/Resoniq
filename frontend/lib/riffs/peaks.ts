/** Waveform preview: the loudest sample in each of `n` equal slices, scaled so the loudest slice is 1. */
export function computePeaks(samples: Float32Array, n = 120): number[] {
  if (!samples.length) return [];
  const size = Math.max(1, Math.floor(samples.length / n));
  const raw: number[] = [];
  for (let i = 0; i < n && i * size < samples.length; i++) {
    let max = 0;
    const end = Math.min(samples.length, (i + 1) * size);
    for (let j = i * size; j < end; j++) max = Math.max(max, Math.abs(samples[j]));
    raw.push(max);
  }
  const top = Math.max(...raw);
  return raw.map((v) => (top > 0 ? Math.round((v / top) * 1000) / 1000 : 0));
}

/**
 * The recording format this browser can make, most compatible first. MP4/AAC
 * plays everywhere, iPhones included (Safari and current Chrome record it);
 * WebM/Opus (Firefox) and Ogg are the fallbacks.
 */
export function recorderMime(isSupported: (t: string) => boolean): string | null {
  return ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find(isSupported) ?? null;
}

/** Whether this browser can play a take's format; when it can't, the player offers the download instead of failing silently. */
export const canPlay = (mime: string, probe: (t: string) => string) => probe(mime) !== "";
