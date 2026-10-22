import { randomUUID } from "node:crypto";
import { mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Media } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getStorage } from "@/lib/storage";
import { ABANDONED_UPLOAD_MS, MEDIA_LIMITS } from "@/lib/media/limits";
import { sniffMedia } from "@/lib/media/sniff";
import * as ff from "@/lib/media/ffmpeg";

/** A problem with the file itself: retrying won't help, so the upload fails with this message. */
export class MediaRejected extends Error {}

const MAX_DIMENSION = 8192;
const ANALYSIS_MAX_SEC = 900;

async function head(file: string, n = 4096): Promise<Uint8Array> {
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

type Outputs = Partial<Pick<Media, "playbackKey" | "posterKey" | "previewKey" | "peaksKey" | "width" | "height" | "durationSec" | "mime">> & { flac?: string };

async function processFile(media: Media, dir: string, input: string): Promise<Outputs> {
  const sniffed = sniffMedia(await head(input));
  if (!sniffed || sniffed.kind !== media.kind) throw new MediaRejected(`That file isn't a supported ${media.kind.toLowerCase()} format.`);
  const limits = MEDIA_LIMITS[media.kind];
  let info: ff.Probe;
  try {
    info = await ff.probe(input);
  } catch {
    throw new MediaRejected("That file couldn't be read. It may be damaged.");
  }
  if (limits.seconds && info.durationSec !== null && info.durationSec > limits.seconds) throw new MediaRejected(`${limits.label}.`);
  if (info.video && (info.video.width > MAX_DIMENSION || info.video.height > MAX_DIMENSION)) throw new MediaRejected("That file's dimensions are too large.");

  const base = `media/${media.ownerId}/${media.id}`;
  const store = getStorage();
  const put = async (name: string, file: string, type: string) => {
    const key = `${base}/${name}`;
    await store.uploadFrom(key, file, type);
    return key;
  };
  const out: Outputs = { mime: sniffed.mime };

  try {
    if (media.kind === "VIDEO") {
      if (!info.video) throw new MediaRejected("That file has no video track.");
      const playback = path.join(dir, "playback.mp4");
      await ff.transcodeVideo(input, playback, !!info.audio);
      const poster = path.join(dir, "poster.jpg");
      const duration = info.durationSec ?? 0;
      await ff.posterFrame(playback, poster, Math.min(duration * 0.1, 5));
      out.playbackKey = await put("playback.mp4", playback, "video/mp4");
      out.posterKey = await put("poster.jpg", poster, "image/jpeg");
      if (duration >= 3) {
        const preview = path.join(dir, "preview.mp4");
        await ff.previewClip(playback, preview, Math.min(duration * 0.2, Math.max(0, duration - 4)));
        out.previewKey = await put("preview.mp4", preview, "video/mp4");
      }
      Object.assign(out, { width: info.video.width, height: info.video.height, durationSec: info.durationSec });
    } else if (media.kind === "AUDIO") {
      if (!info.audio) throw new MediaRejected("That file has no audio.");
      const playback = path.join(dir, "playback.m4a");
      await ff.transcodeAudio(input, playback);
      out.playbackKey = await put("playback.m4a", playback, "audio/mp4");
      const file = path.join(dir, "peaks.json");
      await writeFile(file, JSON.stringify(await ff.peaks(input)));
      out.peaksKey = await put("peaks.json", file, "application/json");
      out.durationSec = info.durationSec;
    } else {
      if (!info.video) throw new MediaRejected("That image couldn't be read.");
      if ((info.video.width * info.video.height) / 1e6 > (limits.megapixels ?? Infinity)) throw new MediaRejected("That image has too many pixels (40 MP max).");
      const ext = sniffed.ext === "png" ? "png" : "jpg";
      const display = path.join(dir, `display.${ext}`);
      await ff.reencodeImage(input, display);
      out.playbackKey = await put(`display.${ext}`, display, ext === "png" ? "image/png" : "image/jpeg");
      Object.assign(out, { width: info.video.width, height: info.video.height });
    }
    if (media.kind !== "IMAGE" && info.audio && media.purpose === "POST") {
      out.flac = path.join(dir, "analysis.flac");
      await ff.extractFlac(input, out.flac, ANALYSIS_MAX_SEC);
    }
  } catch (err) {
    // ffmpeg failures come from the file, not the system (missing binaries fail at startup checks).
    if (err instanceof ff.FfmpegError) throw new MediaRejected("We couldn't process that file. Try exporting it again as MP4/H.264.");
    throw err;
  }
  return out;
}

/** media.process: the whole pipeline for one upload. Safe to re-run. */
export async function processMedia(mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.status !== "PROCESSING") return;
  const dir = await mkdtemp(path.join(tmpdir(), "resoniq-media-"));
  const input = path.join(dir, "original");
  const store = getStorage();
  try {
    await store.downloadTo(media.originalKey, input);
    if ((await stat(input)).size > MEDIA_LIMITS[media.kind].bytes) throw new MediaRejected(`${MEDIA_LIMITS[media.kind].label}.`);
    const { flac, ...out } = await processFile(media, dir, input);

    let audioKey: string | null = null;
    if (flac) {
      audioKey = `${media.ownerId}/${randomUUID()}.flac`;
      await store.uploadFrom(audioKey, flac, "audio/flac");
    }
    const ready = await prisma.$transaction(async (tx) => {
      // A concurrent removal or account deletion wins over a completed transcode.
      const { count } = await tx.media.updateMany({ where: { id: media.id, status: "PROCESSING" }, data: { ...out, status: "READY", readyAt: new Date(), error: null } });
      if (!count) return null;
      const current = await tx.media.findUniqueOrThrow({ where: { id: media.id }, select: { postId: true } });
      if (audioKey) {
        const post = current.postId ? await tx.post.findUnique({ where: { id: current.postId }, select: { title: true } }) : null;
        const song = await tx.song.create({ data: { userId: media.ownerId, storageKey: audioKey, title: post?.title ?? "Performance audio", durationSec: out.durationSec ?? null }, select: { id: true } });
        await tx.media.update({ where: { id: media.id }, data: { songId: song.id } });
      }
      return current;
    });
    if (!ready) {
      for (const key of [out.playbackKey, out.posterKey, out.previewKey, out.peaksKey, audioKey]) if (key) await store.remove(key);
      return;
    }
    // The original can carry location metadata; only stripped derivatives are kept.
    await store.remove(media.originalKey);
    await settlePost(ready.postId);
    await notify({ userId: media.ownerId, type: "MEDIA_READY", postId: ready.postId, data: { mediaId: media.id, kind: media.kind } });
  } catch (err) {
    if (!(err instanceof MediaRejected)) throw err;
    const { count } = await prisma.media.updateMany({ where: { id: media.id, status: "PROCESSING" }, data: { status: "FAILED", error: err.message } });
    if (!count) return;
    await store.remove(media.originalKey);
    await settlePost(media.postId);
    await notify({ userId: media.ownerId, type: "MEDIA_FAILED", postId: media.postId, data: { mediaId: media.id, kind: media.kind, error: err.message } });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** A post waiting on media goes live once nothing attached is still processing. */
export async function settlePost(postId: string | null) {
  if (!postId) return;
  const pending = await prisma.media.count({ where: { postId, status: { in: ["UPLOADING", "PROCESSING"] } } });
  if (pending === 0) await prisma.post.updateMany({ where: { id: postId, status: "PROCESSING" }, data: { status: "PUBLISHED" } });
}

/** media.purge: delete every stored file of a removed upload (and its extracted audio). */
export async function purgeMedia(mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({ where: { id: mediaId }, include: { song: { select: { id: true, storageKey: true } } } });
  if (!media || media.status !== "REMOVED") return;
  const store = getStorage();
  for (const key of [media.originalKey, media.playbackKey, media.posterKey, media.previewKey, media.peaksKey]) {
    if (key && key !== "pending") await store.remove(key);
  }
  if (media.song?.storageKey) await store.remove(media.song.storageKey);
  if (media.song) await prisma.song.delete({ where: { id: media.song.id } });
  await prisma.media.update({ where: { id: mediaId }, data: { playbackKey: null, posterKey: null, previewKey: null, peaksKey: null } });
}

/** Periodic cleanup: abandoned uploads, and processing that lost its job. Returns how many were failed. */
export async function sweepMedia(now = new Date()): Promise<number> {
  const store = getStorage();
  const abandoned = await prisma.media.findMany({ where: { status: "UPLOADING", createdAt: { lt: new Date(now.getTime() - ABANDONED_UPLOAD_MS) } }, select: { id: true, originalKey: true }, take: 200 });
  for (const m of abandoned) {
    await store.remove(m.originalKey).catch(() => {});
    await prisma.media.update({ where: { id: m.id }, data: { status: "FAILED", error: "The upload never finished." } });
  }
  return abandoned.length;
}
