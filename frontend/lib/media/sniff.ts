import type { MediaKind } from "@prisma/client";
import { sniffAudio } from "@/lib/storage";

export type Sniffed = { kind: MediaKind; ext: string; mime: string };

const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end));

// ISO base media brands we accept as video; M4A is audio. HEIF/AVIF are refused (not decodable everywhere).
const VIDEO_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "M4VP", "mmp4", "3gp4", "3gp5", "3g2a", "qt  "]);
const AUDIO_BRANDS = new Set(["M4A ", "M4B "]);

/**
 * Identifies an upload from its first bytes (4 KB is plenty). The name and
 * the browser's MIME type are never trusted. Null means "not something we accept".
 */
export function sniffMedia(b: Uint8Array): Sniffed | null {
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    if (brand === "qt  ") return { kind: "VIDEO", ext: "mov", mime: "video/quicktime" };
    if (VIDEO_BRANDS.has(brand)) return { kind: "VIDEO", ext: "mp4", mime: "video/mp4" };
    if (AUDIO_BRANDS.has(brand)) return { kind: "AUDIO", ext: "m4a", mime: "audio/mp4" };
    return null;
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // Matroska and WebM share EBML; the DocType says which.
    const head = ascii(b, 0, Math.min(b.length, 64));
    return head.includes("webm") ? { kind: "VIDEO", ext: "webm", mime: "video/webm" } : { kind: "VIDEO", ext: "mkv", mime: "video/x-matroska" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "IMAGE", ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { kind: "IMAGE", ext: "png", mime: "image/png" };
  }
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { kind: "IMAGE", ext: "webp", mime: "image/webp" };
  const audio = sniffAudio(b);
  if (audio) return { kind: "AUDIO", ext: audio, mime: { mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac" }[audio] };
  return null;
}
