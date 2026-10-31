import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { commentInRoom, controlRoom, createRoom, listRooms, parseControl, syncRoom, updateRoom } from "@/lib/rooms/service";
import { completeTake, createRiff, parseTakeStart, riffProject, startTake } from "@/lib/riffs/service";
import { addProjectMember, leaveProject } from "@/lib/messaging";
import { getStorage } from "@/lib/storage";
import { makeActor, prisma, resetDb } from "./db";

process.env.RESONIQ_LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "rooms-"));
beforeEach(resetDb);

const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(64)]);
async function take(ownerId: string, riffId: string) {
  const { id } = await startTake(ownerId, riffId, parseTakeStart({ size: wav.length, mime: "audio/wav", durationSec: 30 }));
  await getStorage().put((await prisma.riffTake.findUniqueOrThrow({ where: { id } })).storageKey, wav, "audio/wav");
  await completeTake(ownerId, id);
  return id;
}

async function band() {
  const host = await makeActor();
  const guest = await makeActor();
  const outsider = await makeActor();
  const riff = await createRiff(host.id, { title: "Demo" });
  const t1 = await take(host.id, riff.id);
  const { projectId } = await riffProject(host.id, riff.id);
  await addProjectMember(host, projectId, guest.id);
  return { host, guest, outsider, projectId, riff, t1 };
}

describe("Live Listening Rooms", () => {
  it("are for the project's current members only", async () => {
    const { host, guest, outsider, projectId } = await band();
    const id = await createRoom(host.id, { projectId, title: "Mix check" });
    await expect(syncRoom(outsider.id, id, null)).rejects.toMatchObject({ status: 404 });
    await expect(createRoom(outsider.id, { projectId })).rejects.toMatchObject({ status: 404 });
    const seen = await syncRoom(guest.id, id, null);
    expect(seen.present.map((p) => p.id).sort()).toEqual([host.id, guest.id].sort());
    expect((await listRooms(guest.id, projectId)).map((r) => r.id)).toEqual([id]);
    await leaveProject(guest, projectId);
    await expect(syncRoom(guest.id, id, null)).rejects.toMatchObject({ status: 404 });
  });

  it("keeps a server clock: play advances in real time, pause and seek pin it", async () => {
    const { host, guest, projectId, t1 } = await band();
    const id = await createRoom(host.id, { projectId });
    expect((await syncRoom(host.id, id, null)).take?.id).toBe(t1);
    await controlRoom(guest.id, id, parseControl({ action: "play", positionSec: 5 }));
    await new Promise((r) => setTimeout(r, 300));
    const s = await syncRoom(host.id, id, null);
    const now = 5 + (s.serverNow - s.stateAt) / 1000;
    expect(s.playing).toBe(true);
    expect(now).toBeGreaterThanOrEqual(5.25);
    await controlRoom(host.id, id, parseControl({ action: "pause" }));
    const paused = await syncRoom(host.id, id, null);
    expect(paused.playing).toBe(false);
    expect(paused.positionSec).toBeGreaterThanOrEqual(5.25);
    await controlRoom(host.id, id, parseControl({ action: "seek", positionSec: 12 }));
    expect((await syncRoom(host.id, id, null)).positionSec).toBe(12);
  });

  it("lets the host take sole control, and only loads the project's takes", async () => {
    const { host, guest, outsider, projectId } = await band();
    const id = await createRoom(host.id, { projectId });
    await updateRoom(host.id, id, { anyoneControls: false });
    await expect(controlRoom(guest.id, id, parseControl({ action: "play" }))).rejects.toMatchObject({ status: 403 });
    await expect(updateRoom(guest.id, id, { end: true })).rejects.toMatchObject({ status: 403 });
    const elsewhere = await createRiff(outsider.id, { title: "Not theirs" });
    const foreign = await take(outsider.id, elsewhere.id);
    await expect(controlRoom(host.id, id, parseControl({ action: "load", takeId: foreign }))).rejects.toThrow(/isn't in this project/);
  });

  it("keeps timestamped comments and reactions, delivered incrementally", async () => {
    const { host, guest, projectId } = await band();
    const id = await createRoom(host.id, { projectId });
    await commentInRoom(guest.id, id, { atSec: 12.34, body: "Bass is late here" });
    const first = await syncRoom(host.id, id, null);
    expect(first.comments).toMatchObject([{ atSec: 12.3, body: "Bass is late here", emoji: null }]);
    await commentInRoom(host.id, id, { atSec: 14, emoji: "🔥" });
    const next = await syncRoom(guest.id, id, new Date(first.comments[0].createdAt));
    expect(next.comments.map((c) => c.emoji)).toEqual(["🔥"]);
    await expect(commentInRoom(guest.id, id, { atSec: 1, emoji: "💩" })).rejects.toThrow(/reactions offered/);
    await expect(commentInRoom(guest.id, id, { atSec: 1, body: "  " })).rejects.toThrow(/Write something/);
  });

  it("closes itself after half an hour with nobody in it, and stops taking changes", async () => {
    const { host, projectId } = await band();
    const id = await createRoom(host.id, { projectId });
    await prisma.listeningRoom.update({ where: { id }, data: { lastActiveAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await listRooms(host.id, projectId)).toEqual([]);
    expect((await syncRoom(host.id, id, null)).ended).toBe(true);
    await expect(controlRoom(host.id, id, parseControl({ action: "play" }))).rejects.toMatchObject({ status: 409 });
  });

  it("answers briefly when nothing changed, and writes heartbeats sparingly", async () => {
    const { host, guest, projectId } = await band();
    const id = await createRoom(host.id, { projectId });
    const full = await syncRoom(guest.id, id, null);
    const again = await syncRoom(guest.id, id, null, full.version);
    expect(again).toMatchObject({ unchanged: true, version: full.version });
    expect("presentIds" in again && again.presentIds.sort()).toEqual([host.id, guest.id].sort());
    // Any change moves the version on, so the next poll gets the full state.
    await controlRoom(host.id, id, parseControl({ action: "play" }));
    const changed = await syncRoom(guest.id, id, null, full.version);
    expect("unchanged" in changed).toBe(false);
    await commentInRoom(host.id, id, { atSec: 1, emoji: "🔥" });
    expect("unchanged" in (await syncRoom(guest.id, id, null, (changed as { version: number }).version))).toBe(false);
    // Polls within a few seconds don't rewrite the heartbeat.
    const before = (await prisma.roomParticipant.findUniqueOrThrow({ where: { roomId_userId: { roomId: id, userId: guest.id } } })).lastSeenAt;
    await syncRoom(guest.id, id, null);
    expect((await prisma.roomParticipant.findUniqueOrThrow({ where: { roomId_userId: { roomId: id, userId: guest.id } } })).lastSeenAt).toEqual(before);
  });
});
