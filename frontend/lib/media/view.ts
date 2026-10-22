import type { Media, MediaKind } from "@prisma/client";

/** Media as clients see it: URLs to this app's access-checked variant routes, never storage keys. */
export type MediaView = {
  id: string;
  kind: MediaKind;
  status: Media["status"];
  width: number | null;
  height: number | null;
  durationSec: number | null;
  alt: string | null;
  src: string | null;
  poster: string | null;
  preview: string | null;
  peaks: string | null;
  error: string | null;
  songId: string | null;
};

export function toMediaView(m: Media, viewerId: string | null = null): MediaView {
  const url = (v: string, key: string | null) => (key ? `/api/media/${m.id}/${v}` : null);
  return {
    id: m.id,
    kind: m.kind,
    status: m.status,
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    alt: m.alt,
    src: m.status === "READY" ? url("playback", m.playbackKey) : null,
    poster: url("poster", m.posterKey),
    preview: url("preview", m.previewKey),
    peaks: url("peaks", m.peaksKey),
    error: viewerId === m.ownerId ? m.error : null,
    // Only the owner can open the extracted audio's analysis.
    songId: viewerId === m.ownerId ? m.songId : null,
  };
}

