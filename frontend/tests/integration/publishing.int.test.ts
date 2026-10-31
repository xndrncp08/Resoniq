import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/authz";
import { buildRelease, parseReleaseInput, releaseData } from "@/lib/publishing";
import { createPost, deletePost, getPost, listPosts, musicWhere } from "@/lib/posts";
import { audibleTake, completeTake, createRiff, parseTakeStart, riffProject, startTake } from "@/lib/riffs/service";
import { createCanvas, parseContent, saveCanvas } from "@/lib/canvas/service";
import { addProjectMember, leaveProject } from "@/lib/messaging";
import { getProject } from "@/lib/projects";
import { getStorage } from "@/lib/storage";
import { makeActor, prisma, resetDb } from "./db";

process.env.RESONIQ_LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "publish-"));
beforeEach(resetDb);

const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(64)]);
async function take(ownerId: string, riffId: string) {
  const { id } = await startTake(ownerId, riffId, parseTakeStart({ size: wav.length, mime: "audio/wav", durationSec: 3 }));
  await getStorage().put((await prisma.riffTake.findUniqueOrThrow({ where: { id } })).storageKey, wav, "audio/wav");
  await completeTake(ownerId, id);
  return id;
}
async function publish(actor: Actor, release: unknown, title = "Released") {
  const r = await buildRelease(actor.id, parseReleaseInput(release));
  return createPost(actor, { title, body: "", category: "ORIGINAL", communitySlug: null, toneId: null }, { attach: async (tx, postId) => void (await tx.post.update({ where: { id: postId }, data: releaseData(r) })), requireContent: false });
}

describe("music publishing", () => {
  it("publishes a project's song with a take and credits, frozen as released", async () => {
    const me = await makeActor();
    const bandmate = await makeActor();
    const outsider = await makeActor();
    const riff = await createRiff(me.id, { title: "Seed" });
    const t = await take(me.id, riff.id);
    const { projectId } = await riffProject(me.id, riff.id);
    await addProjectMember(me, projectId, bandmate.id);
    const song = await createCanvas(me.id, { projectId, title: "Northbound" });
    const handles = await prisma.user.findMany({ where: { id: { in: [me.id, bandmate.id, outsider.id] } }, select: { id: true, handle: true } });
    const h = (id: string) => handles.find((x) => x.id === id)!.handle;

    // A private take is only for the project until it's published.
    expect(await audibleTake(null, t)).toBeNull();
    expect(await audibleTake(outsider.id, t)).toBeNull();

    await expect(publish(me, { canvasId: song.id, takeId: t, credits: [{ handle: h(outsider.id), role: "Bass" }] })).rejects.toThrow(/isn't in this project/);
    await expect(publish(bandmate, { canvasId: song.id })).rejects.toMatchObject({ status: 403 });

    // A member who has since left can still be credited for what they played.
    await leaveProject(bandmate, projectId);
    const post = await publish(me, { canvasId: song.id, takeId: t, credits: [{ handle: h(me.id), role: "Songwriter" }, { handle: h(bandmate.id), role: "Drums" }] });
    expect(post.release).toMatchObject({ kind: "song", title: "Northbound", take: { id: t }, credits: [{ role: "Songwriter" }, { role: "Drums" }] });
    expect(post.release?.src).toBe(`/api/riff-takes/${t}/audio`);
    expect(await audibleTake(null, t)).not.toBeNull();

    // Later edits to the song don't change what was released.
    await saveCanvas(me.id, song.id, song.version, parseContent({ title: "Northbound (v2)", sections: [], arrangement: [] }));
    expect((await getPost(post.id, null))?.release?.title).toBe("Northbound");

    // It shows on both musicians' Music tabs and counts toward the project.
    for (const id of [me.id, bandmate.id]) expect((await listPosts(musicWhere(id), null, { sort: "new", cursor: null, limit: 10 })).items.map((p) => p.id)).toEqual([post.id]);
    expect((await getProject(me.id, projectId)).counts.published).toBe(1);

    // Deleting the post makes the take private again.
    await deletePost(me, post.id);
    expect(await audibleTake(null, t)).toBeNull();
  });

  it("only publishes your own takes outside a project", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const theirs = await take(other.id, (await createRiff(other.id, { title: "Theirs" })).id);
    await expect(publish(me, { takeId: theirs })).rejects.toMatchObject({ status: 403 });
    const mine = await take(me.id, (await createRiff(me.id, { title: "Mine" })).id);
    const post = await publish(me, { takeId: mine });
    expect(post.release).toMatchObject({ kind: "take", title: "Mine", chart: null });
  });

  it("validates the release at the boundary", () => {
    expect(() => parseReleaseInput({})).toThrow(/song, a take/);
    expect(() => parseReleaseInput({ takeId: "../../x" })).toThrow(/invalid/);
    expect(() => parseReleaseInput({ takeId: "abcdefghijkl", credits: [{ handle: "x", role: "" }] })).toThrow(/handle|role/);
  });
});
