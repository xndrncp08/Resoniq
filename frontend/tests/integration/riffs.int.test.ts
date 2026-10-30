import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { audibleTake, completeTake, createRiff, deleteRiff, getRiff, listRiffs, parseTakeStart, riffProject, startTake, updateRiff } from "@/lib/riffs/service";
import { addProjectMember, leaveProject } from "@/lib/messaging";
import { getStorage } from "@/lib/storage";
import { createTone } from "@/lib/tones";
import { defaultPatch } from "@/lib/studio/patch";
import { makeActor, prisma, resetDb } from "./db";

process.env.RESONIQ_LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "riffs-"));

beforeEach(resetDb);

const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(100)]);

async function recordTake(ownerId: string, riffId: string, bytes = wav, mime = "audio/wav") {
  const { id } = await startTake(ownerId, riffId, parseTakeStart({ size: bytes.length, mime, durationSec: 3, peaks: [0.1, 1] }));
  const take = await prisma.riffTake.findUniqueOrThrow({ where: { id } });
  await getStorage().put(take.storageKey, bytes, mime);
  return id;
}

describe("Riff Vault", () => {
  it("keeps riffs private and lets only the owner change them", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const r = await createRiff(me.id, { title: "Night idea", tags: ["verse"] });
    expect(await getRiff(other.id, r.id)).toBeNull();
    expect(await listRiffs(other.id)).toEqual([]);
    await expect(updateRiff(other.id, r.id, { title: "Mine now" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteRiff(other.id, r.id)).rejects.toMatchObject({ status: 404 });
    // Someone else's private tone can't be linked.
    const theirs = await createTone(other, { name: "Theirs", data: { version: 2, studio: defaultPatch() }, visibility: "PRIVATE" });
    await expect(updateRiff(me.id, r.id, { toneId: theirs })).rejects.toThrow(/isn't available/);
  });

  it("accepts a real recording, refuses disguised files, and plays only for those allowed", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const r = await createRiff(me.id, { title: "Hook" });
    const ok = await recordTake(me.id, r.id);
    await expect(audibleTake(me.id, ok)).resolves.toBeNull(); // not complete yet
    expect((await completeTake(me.id, ok)).status).toBe("READY");
    expect(await audibleTake(me.id, ok)).toMatchObject({ mime: "audio/wav" });
    expect(await audibleTake(other.id, ok)).toBeNull();

    const bad = await recordTake(me.id, r.id, Buffer.from("<html><script>alert(1)</script></html>"));
    await expect(completeTake(me.id, bad)).rejects.toMatchObject({ status: 415 });
    expect(await prisma.riffTake.count({ where: { id: bad } })).toBe(0);

    const view = (await getRiff(me.id, r.id))!;
    expect(view.allTakes.map((t) => t.id)).toEqual([ok]);
    expect(view.allTakes[0].peaks).toEqual([0.1, 1]);
  });

  it("shares a riff through a project: members listen, can't edit, and lose access when they leave", async () => {
    const me = await makeActor();
    const bandmate = await makeActor();
    const r = await createRiff(me.id, { title: "Chorus" });
    const take = await recordTake(me.id, r.id);
    await completeTake(me.id, take);
    const { projectId } = await riffProject(me.id, r.id);
    expect((await riffProject(me.id, r.id)).projectId).toBe(projectId);
    await addProjectMember(me, projectId, bandmate.id);

    const seen = await getRiff(bandmate.id, r.id);
    expect(seen).toMatchObject({ canEdit: false, shared: true, project: { id: projectId } });
    expect(await audibleTake(bandmate.id, take)).not.toBeNull();
    expect((await listRiffs(bandmate.id)).map((x) => x.id)).toEqual([r.id]);
    await expect(updateRiff(bandmate.id, r.id, { title: "x" })).rejects.toMatchObject({ status: 404 });

    await leaveProject(bandmate, projectId);
    expect(await getRiff(bandmate.id, r.id)).toBeNull();
    expect(await audibleTake(bandmate.id, take)).toBeNull();
  });

  it("deletes a riff with its takes and their files", async () => {
    const me = await makeActor();
    const r = await createRiff(me.id, { title: "Gone" });
    const take = await recordTake(me.id, r.id);
    await completeTake(me.id, take);
    const key = (await prisma.riffTake.findUniqueOrThrow({ where: { id: take } })).storageKey;
    await deleteRiff(me.id, r.id);
    expect(await prisma.riffTake.count()).toBe(0);
    expect(await getStorage().stat(key)).toBeNull();
  });
});
