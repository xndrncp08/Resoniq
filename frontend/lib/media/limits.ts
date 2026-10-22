import type { MediaKind } from "@prisma/client";

const MB = 1024 * 1024;

/** Per-file caps. Duration and pixel caps are enforced by the worker after probing. */
export const MEDIA_LIMITS: Record<MediaKind, { bytes: number; seconds?: number; megapixels?: number; label: string }> = {
  VIDEO: { bytes: 500 * MB, seconds: 600, label: "Videos up to 500 MB and 10 minutes" },
  AUDIO: { bytes: 50 * MB, seconds: 900, label: "Audio up to 50 MB and 15 minutes" },
  IMAGE: { bytes: 15 * MB, megapixels: 40, label: "Images up to 15 MB" },
};

export const DAILY_UPLOAD_BYTES = 3 * 1024 * MB;
export const MAX_ATTACHMENTS = 10;
/** Removed media is kept this long (so an upheld appeal can restore it), then purged. */
export const REMOVED_RETENTION_MS = 30 * 86_400_000;
/** Uploads never completed are cleaned up after this. */
export const ABANDONED_UPLOAD_MS = 24 * 3_600_000;

export const ACCEPTED_MIME: Record<MediaKind, string[]> = {
  VIDEO: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
  AUDIO: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac", "audio/mp4", "audio/x-m4a", "audio/aac"],
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
};
