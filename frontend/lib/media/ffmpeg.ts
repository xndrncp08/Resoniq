import { spawn } from "node:child_process";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
// A runaway or malicious file must not pin the worker.
const TIMEOUT_MS = 15 * 60_000;

export class FfmpegError extends Error {}

function run(bin: string, args: string[], { capture = false } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-protocol_whitelist", "file,pipe", ...args], { stdio: ["ignore", capture ? "pipe" : "ignore", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout?.on("data", (d: Buffer) => out.push(d));
    child.stderr?.on("data", (d: Buffer) => {
      err = (err + d.toString()).slice(-4000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new FfmpegError(`${bin} could not start: ${e.message}`));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new FfmpegError(`${bin} exited ${signal ?? code}: ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

export type Probe = {
  durationSec: number | null;
  video: { width: number; height: number; codec: string } | null;
  audio: { codec: string; channels: number } | null;
};

export async function probe(file: string): Promise<Probe> {
  const raw = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { capture: true });
  const json = JSON.parse(raw.toString()) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; channels?: number; disposition?: { attached_pic?: number }; side_data_list?: { rotation?: number }[] }[];
  };
  const streams = json.streams ?? [];
  // Cover art in audio files shows up as a one-frame "video" stream; it isn't video.
  const v = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === "audio");
  const rotated = Math.abs(v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) % 180 === 90;
  const duration = Number(json.format?.duration);
  return {
    durationSec: Number.isFinite(duration) ? duration : null,
    video: v?.width && v.height ? { width: rotated ? v.height : v.width, height: rotated ? v.width : v.height, codec: v.codec_name ?? "" } : null,
    audio: a ? { codec: a.codec_name ?? "", channels: a.channels ?? 0 } : null,
  };
}

const even = "force_divisible_by=2";

/** H.264/AAC MP4 at most 1080p, metadata stripped, moov atom first so playback starts before download ends. */
export const transcodeVideo = (input: string, output: string, hasAudio: boolean) =>
  run(FFMPEG, [
    "-y", "-v", "error", "-i", input, "-map", "0:v:0", ...(hasAudio ? ["-map", "0:a:0"] : []),
    "-vf", `scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:${even}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
    ...(hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : []),
    "-map_metadata", "-1", "-movflags", "+faststart", "-threads", "2", output,
  ]);

export const posterFrame = (input: string, output: string, atSec: number) =>
  run(FFMPEG, ["-y", "-v", "error", "-ss", atSec.toFixed(2), "-i", input, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", output]);

/** A short muted loop for hover previews in feeds. */
export const previewClip = (input: string, output: string, startSec: number, seconds = 4) =>
  run(FFMPEG, [
    "-y", "-v", "error", "-ss", startSec.toFixed(2), "-t", String(seconds), "-i", input, "-an",
    "-vf", `scale='min(480,iw)':-2:${even}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
    "-map_metadata", "-1", "-movflags", "+faststart", output,
  ]);

/** FLAC for the analysis engine (the existing Song pipeline accepts it). */
export const extractFlac = (input: string, output: string, maxSec: number) =>
  run(FFMPEG, ["-y", "-v", "error", "-i", input, "-vn", "-t", String(maxSec), "-ac", "2", "-ar", "44100", "-c:a", "flac", output]);

export const transcodeAudio = (input: string, output: string) =>
  run(FFMPEG, ["-y", "-v", "error", "-i", input, "-vn", "-c:a", "aac", "-b:a", "192k", "-map_metadata", "-1", "-movflags", "+faststart", output]);

/** Re-encoding is what strips EXIF (including GPS). PNG stays PNG to keep transparency. */
export const reencodeImage = (input: string, output: string) =>
  run(FFMPEG, [
    "-y", "-v", "error", "-i", input, "-frames:v", "1", "-vf", "scale='min(2560,iw)':'min(2560,ih)':force_original_aspect_ratio=decrease",
    "-map_metadata", "-1", ...(output.endsWith(".jpg") ? ["-q:v", "3"] : []), output,
  ]);

/** Waveform peaks (0–1) for the audio player, from 8 kHz mono PCM. */
export async function peaks(input: string, buckets = 800): Promise<number[]> {
  const pcm = await run(FFMPEG, ["-v", "error", "-i", input, "-vn", "-ac", "1", "-ar", "8000", "-t", "900", "-f", "s16le", "-"], { capture: true });
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const size = Math.max(1, Math.floor(samples.length / buckets));
  const out: number[] = [];
  for (let i = 0; i < samples.length && out.length < buckets; i += size) {
    let max = 0;
    for (let j = i; j < Math.min(i + size, samples.length); j++) max = Math.max(max, Math.abs(samples[j]));
    out.push(Math.round((max / 32768) * 1000) / 1000);
  }
  return out;
}
