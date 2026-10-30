import { sniffAudio } from "@/lib/storage";

export type RiffAudio = { ext: "webm" | "ogg" | "m4a" | "mp3" | "wav" | "flac"; mime: string };

const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end));

/**
 * What a riff recording really is, from its first bytes: browser recordings
 * (WebM/Opus from Chrome and Firefox, MP4/AAC from Safari, Ogg/Opus) and the
 * usual audio files. The browser's MIME type is never trusted.
 */
export function sniffRiffAudio(b: Uint8Array): RiffAudio | null {
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return ascii(b, 0, Math.min(b.length, 64)).includes("webm") ? { ext: "webm", mime: "audio/webm" } : null;
  if (b.length >= 4 && ascii(b, 0, 4) === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  // Safari's MediaRecorder writes MP4 with brands like iso5/mp42; M4A files use M4A.
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp" && ascii(b, 8, 12) !== "qt  ") return { ext: "m4a", mime: "audio/mp4" };
  const audio = sniffAudio(b);
  return audio ? { ext: audio, mime: { mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac" }[audio] } : null;
}

/** The storage extension a browser's declared type suggests (checked against the bytes on completion). */
export function extForMime(mime: string): RiffAudio["ext"] | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m === "audio/webm" || m === "video/webm") return "webm";
  if (m === "audio/ogg") return "ogg";
  if (m === "audio/mp4" || m === "audio/x-m4a" || m === "audio/aac" || m === "video/mp4") return "m4a";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav" || m === "audio/wave") return "wav";
  if (m === "audio/flac" || m === "audio/x-flac") return "flac";
  return null;
}
