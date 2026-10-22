import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { localStorageDriver } from "@/lib/storage";
import { makeActor, prisma, resetDb } from "./db";

const root = await mkdtemp(path.join(tmpdir(), "resoniq-media-int-"));
const storage = localStorageDriver(root);
vi.mock("@/lib/storage", async (orig) => ({ ...(await orig<typeof import("@/lib/storage")>()), getStorage: () => storage }));

const { attachMedia, canViewMedia, completeUpload, createUpload, removeMedia, restoreMedia, uploadedLastDay } = await import("@/lib/media/service");
const { processMedia, purgeMedia, sweepMedia } = await import("@/lib/media/process");
const { createPost, getPost } = await import("@/lib/posts");
const { runOnce } = await import("@/worker/run");
const { deleteAccount } = await import("@/lib/account");

let hasFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  hasFfmpeg = false;
}

const fixtures = await mkdtemp(path.join(tmpdir(), "resoniq-fixtures-"));
const fx = (name: string) => path.join(fixtures, name);
beforeAll(() => {
  if (!hasFfmpeg) return;
  const ff = (...args: string[]) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
  // A 4-second 320x240 clip with a tone, an audio-only m4a, a PNG and a JPEG with GPS-ish metadata.
  ff("-f", "lavfi", "-i", "testsrc=size=320x240:rate=15", "-f", "lavfi", "-i", "sine=frequency=330", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", fx("clip.mp4"));
  ff("-f", "lavfi", "-i", "sine=frequency=220", "-t", "2", "-c:a", "aac", fx("tone.m4a"));
  ff("-f", "lavfi", "-i", "testsrc=size=64x48", "-frames:v", "1", fx("pic.png"));
  ff("-f", "lavfi", "-i", "testsrc=size=64x48", "-frames:v", "1", "-metadata", "comment=GPS 51.5N 0.12W", fx("pic.jpg"));
});
afterAll(() => Promise.all([rm(root, { recursive: true, force: true }), rm(fixtures, { recursive: true, force: true })]));
beforeEach(resetDb);

/** Uploads a local file the way the content route would. */
async function upload(actor: Awaited<ReturnType<typeof makeActor>>, file: string, kind: "VIDEO" | "AUDIO" | "IMAGE", purpose: "POST" | "AVATAR" = "POST") {
  const bytes = await readFile(file);
  const { id } = await createUpload(actor, { kind, size: bytes.length, mime: "application/octet-stream", purpose, alt: null });
  const media = await prisma.media.findUniqueOrThrow({ where: { id } });
  await storage.put(media.originalKey, bytes, "application/octet-stream");
  await completeUpload(actor, id);
  return id;
}

const post = (actor: Awaited<ReturnType<typeof makeActor>>, mediaIds: string[]) =>
  createPost(actor, { title: "Live take", body: "", category: "PERFORMANCE", communitySlug: null, toneId: null }, {
    requireContent: false,
    attach: (tx, postId) => attachMedia(tx, actor.id, postId, mediaIds),
  });

describe.skipIf(!hasFfmpeg)("media processing", () => {
  it("does not resurrect media removed while it is processing", async () => {
    const owner = await makeActor();
    const id = await upload(owner, fx("clip.mp4"), "VIDEO");
    const put = storage.uploadFrom.bind(storage);
    let removed = false;
    const spy = vi.spyOn(storage, "uploadFrom").mockImplementation(async (key, file, type) => {
      await put(key, file, type);
      if (!removed) {
        removed = true;
        await removeMedia({ ...owner, role: "ADMIN" }, id, "Takedown during processing", { asModerator: true });
      }
    });
    try { await processMedia(id); } finally { spy.mockRestore(); }
    expect(await prisma.media.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "REMOVED", playbackKey: null });
    expect(await prisma.song.count()).toBe(0);
    expect(await prisma.notification.count({ where: { type: "MEDIA_READY" } })).toBe(0);
    expect(await storage.stat(`media/${owner.id}/${id}/playback.mp4`)).toBeNull();
  });

  it("publishes a post attached after the worker starts processing", async () => {
    const owner = await makeActor();
    const id = await upload(owner, fx("clip.mp4"), "VIDEO");
    const put = storage.uploadFrom.bind(storage);
    let postId: string | null = null;
    const spy = vi.spyOn(storage, "uploadFrom").mockImplementation(async (key, file, type) => {
      await put(key, file, type);
      if (!postId) postId = (await post(owner, [id])).id;
    });
    try { await processMedia(id); } finally { spy.mockRestore(); }
    expect((await getPost(postId!, null))?.status).toBe("PUBLISHED");
  });

  it("turns a video upload into playable, stripped derivatives and publishes the post", async () => {
    const owner = await makeActor();
    const viewer = await makeActor();
    const id = await upload(owner, fx("clip.mp4"), "VIDEO");
    const p = await post(owner, [id]);
    expect(p.status).toBe("PROCESSING");
    expect(await getPost(p.id, viewer.id)).toBeNull();

    expect(await runOnce("w")).toBe("succeeded");
    const m = await prisma.media.findUniqueOrThrow({ where: { id } });
    expect(m).toMatchObject({ status: "READY", width: 320, height: 240, mime: "video/mp4" });
    expect(m.durationSec).toBeGreaterThan(3.5);
    for (const key of [m.playbackKey, m.posterKey, m.previewKey]) expect(await storage.stat(key!)).not.toBeNull();
    expect(await storage.stat(m.originalKey)).toBeNull();
    // The performance's audio is now an analyzable Song owned by the uploader.
    const song = await prisma.song.findUniqueOrThrow({ where: { id: m.songId! } });
    expect(song).toMatchObject({ userId: owner.id, status: "UPLOADED", title: "Live take" });

    const seen = await getPost(p.id, viewer.id);
    expect(seen?.status).toBe("PUBLISHED");
    expect(seen?.media[0]).toMatchObject({ kind: "VIDEO", src: `/api/media/${id}/playback`, songId: null });
    expect((await getPost(p.id, owner.id))?.media[0].songId).toBe(m.songId);
    expect(await canViewMedia(m, viewer)).toBe(true);
    expect(await prisma.notification.count({ where: { userId: owner.id, type: "MEDIA_READY" } })).toBe(1);
  });

  it("processes audio with waveform peaks, and images without their metadata", async () => {
    const owner = await makeActor();
    const audio = await upload(owner, fx("tone.m4a"), "AUDIO");
    const png = await upload(owner, fx("pic.png"), "IMAGE");
    const jpg = await upload(owner, fx("pic.jpg"), "IMAGE");
    while ((await runOnce("w")) !== "idle");
    const a = await prisma.media.findUniqueOrThrow({ where: { id: audio } });
    expect(a.status).toBe("READY");
    const peaks = JSON.parse((await storage.get(a.peaksKey!))!.bytes.toString()) as number[];
    expect(peaks.length).toBeGreaterThan(10);
    expect(Math.max(...peaks)).toBeGreaterThan(0.1);
    expect((await prisma.media.findUniqueOrThrow({ where: { id: png } })).playbackKey).toMatch(/display\.png$/);
    const j = await prisma.media.findUniqueOrThrow({ where: { id: jpg } });
    expect((await storage.get(j.playbackKey!))!.bytes.includes("GPS 51.5N")).toBe(false);
  });

  it("fails bad files with a clear reason instead of retrying", async () => {
    const owner = await makeActor();
    await writeFile(fx("fake.mp4"), "#!/bin/sh\necho not a video\n");
    const fake = await upload(owner, fx("fake.mp4"), "VIDEO");
    const audioAsVideo = await upload(owner, fx("tone.m4a"), "VIDEO");
    while ((await runOnce("w")) !== "idle");
    expect(await prisma.media.findUniqueOrThrow({ where: { id: fake } })).toMatchObject({ status: "FAILED", error: "That file isn't a supported video format." });
    expect((await prisma.media.findUniqueOrThrow({ where: { id: audioAsVideo } })).status).toBe("FAILED");
    expect(await prisma.job.count({ where: { status: "SUCCEEDED" } })).toBe(2);
  });

  it("blocks removed media at once, restores it, and purges it with its extracted audio", async () => {
    const owner = await makeActor();
    const mod = { ...(await makeActor()), role: "MODERATOR" as const };
    const id = await upload(owner, fx("clip.mp4"), "VIDEO");
    await post(owner, [id]);
    await runOnce("w");
    await removeMedia(mod, id, "Copyright: full studio track", { asModerator: true });
    const removed = await prisma.media.findUniqueOrThrow({ where: { id } });
    expect(await canViewMedia(removed, null)).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "media.remove" } })).toBe(1);
    expect((await prisma.job.findFirstOrThrow({ where: { type: "media.purge" } })).runAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    await restoreMedia(mod, id);
    expect((await prisma.media.findUniqueOrThrow({ where: { id } })).status).toBe("READY");
    expect(await prisma.job.count({ where: { type: "media.purge", status: "QUEUED" } })).toBe(0);

    await removeMedia(mod, id, "again", { asModerator: true });
    await purgeMedia(id);
    const purged = await prisma.media.findUniqueOrThrow({ where: { id } });
    expect(purged.playbackKey).toBeNull();
    expect(await prisma.song.count()).toBe(0);
  });
});

describe("upload rules", () => {
  it("queues processing only once when completion requests race", async () => {
    const owner = await makeActor();
    const { id } = await createUpload(owner, { kind: "IMAGE", size: 3, mime: "image/png", purpose: "POST", alt: null });
    const m = await prisma.media.findUniqueOrThrow({ where: { id } });
    await storage.put(m.originalKey, Buffer.from("abc"), "image/png");
    await Promise.all(Array.from({ length: 5 }, () => completeUpload(owner, id)));
    expect(await prisma.job.count({ where: { type: "media.process" } })).toBe(1);
  });
  it("enforces the daily allowance and only attaches your own finished uploads", async () => {
    const a = await makeActor();
    const b = await makeActor();
    const each = 500 * 1024 ** 2;
    await prisma.media.createMany({ data: Array.from({ length: 7 }, () => ({ ownerId: a.id, kind: "VIDEO" as const, mime: "video/mp4", sizeBytes: each, originalKey: "x" })) });
    expect(await uploadedLastDay(a.id)).toBe(7 * each);
    await expect(createUpload(a, { kind: "IMAGE", size: 1000, mime: "image/png", purpose: "POST", alt: null })).rejects.toThrow("allowance");

    const { id } = await createUpload(b, { kind: "IMAGE", size: 10, mime: "image/png", purpose: "POST", alt: null });
    await expect(post(a, [id])).rejects.toThrow("can't be used");
    await expect(post(b, [id])).rejects.toThrow("aren't uploaded yet");
    await expect(completeUpload(b, id)).rejects.toThrow("hasn't finished");
  });

  it("fails abandoned uploads in the sweep", async () => {
    const a = await makeActor();
    await prisma.media.create({ data: { ownerId: a.id, kind: "VIDEO", mime: "video/mp4", sizeBytes: 10, originalKey: "media/u/m/original.mp4", createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    expect(await sweepMedia()).toBe(1);
    expect((await prisma.media.findFirstOrThrow()).status).toBe("FAILED");
  });

  it("queues every stored file for deletion with the account", async () => {
    const a = await makeActor();
    await prisma.media.create({ data: { ownerId: a.id, kind: "VIDEO", mime: "video/mp4", sizeBytes: 10, status: "READY", originalKey: `media/${a.id}/m1/original.mp4`, playbackKey: `media/${a.id}/m1/playback.mp4`, posterKey: `media/${a.id}/m1/poster.jpg` } });
    expect((await deleteAccount(a.id)).queuedDeletes).toBe(3);
  });
});

it("is idempotent when a processing job runs twice", async () => {
  await expect(processMedia("does-not-exist")).resolves.toBeUndefined();
});
