import { beforeEach, describe, expect, it } from "vitest";
import { createCanvas, deleteCanvas, getCanvas, listCanvases, listRevisions, parseContent, saveCanvas, setCanvasProject } from "@/lib/canvas/service";
import { createRiff, riffProject } from "@/lib/riffs/service";
import { addProjectMember, leaveProject } from "@/lib/messaging";
import { makeActor, resetDb } from "./db";

beforeEach(resetDb);

const content = (title: string, lyrics: string) => parseContent({ title, key: "Am", bpm: 92, sections: [{ id: "v1", kind: "verse", name: "Verse 1", lyrics }], arrangement: ["v1", "v1"] });

describe("Songwriting Canvas", () => {
  it("is private to its owner until it joins a project; members edit, leavers lose access", async () => {
    const me = await makeActor();
    const bandmate = await makeActor();
    const c = await createCanvas(me.id, { title: "Northbound" });
    expect(await getCanvas(bandmate.id, c.id)).toBeNull();
    await expect(saveCanvas(bandmate.id, c.id, c.version, content("x", "y"))).rejects.toMatchObject({ status: 404 });

    const riff = await createRiff(me.id, { title: "Hook" });
    const { projectId } = await riffProject(me.id, riff.id);
    await addProjectMember(me, projectId, bandmate.id);
    await setCanvasProject(me.id, c.id, projectId);
    const theirs = (await getCanvas(bandmate.id, c.id))!;
    expect(theirs).toMatchObject({ canEdit: true, isOwner: false });
    const saved = await saveCanvas(bandmate.id, c.id, theirs.version, content("Northbound", "[Am]Bandmate's line"));
    expect(saved.updatedBy?.handle).toBeTruthy();
    expect((await listCanvases(bandmate.id)).map((x) => x.id)).toEqual([c.id]);
    // Only the owner deletes or moves it.
    await expect(deleteCanvas(bandmate.id, c.id)).rejects.toMatchObject({ status: 404 });
    await expect(setCanvasProject(bandmate.id, c.id, null)).rejects.toMatchObject({ status: 404 });

    await leaveProject(bandmate, projectId);
    expect(await getCanvas(bandmate.id, c.id)).toBeNull();
  });

  it("refuses a save made from an old version, so the client can merge", async () => {
    const me = await makeActor();
    const c = await createCanvas(me.id, { title: "Race" });
    const first = await saveCanvas(me.id, c.id, c.version, content("Race", "one"));
    await expect(saveCanvas(me.id, c.id, c.version, content("Race", "stale"))).rejects.toMatchObject({ status: 409 });
    expect((await getCanvas(me.id, c.id))!.sections[0].lyrics).toBe("one");
    expect(first.version).toBe(c.version + 1);
  });

  it("keeps revisions, folding quick successive saves by one person into one", async () => {
    const me = await makeActor();
    const other = await makeActor();
    const riff = await createRiff(me.id, { title: "Shared" });
    const { projectId } = await riffProject(me.id, riff.id);
    await addProjectMember(me, projectId, other.id);
    const c = await createCanvas(me.id, { title: "Revs", projectId });
    let v = c.version;
    for (const l of ["a", "ab", "abc"]) v = (await saveCanvas(me.id, c.id, v, content("Revs", l))).version;
    v = (await saveCanvas(other.id, c.id, v, content("Revs", "abc!"))).version;
    const revs = await listRevisions(me.id, c.id);
    expect(revs.map((r) => r.content.sections[0]?.lyrics ?? "")).toEqual(["abc!", "abc"]);
    expect(revs[0].version).toBe(v);
  });

  it("starts from a riff in the riff's project, and won't link riffs you can't hear", async () => {
    const me = await makeActor();
    const stranger = await makeActor();
    const riff = await createRiff(me.id, { title: "Seed", key: "E", bpm: 128 });
    const c = await createCanvas(me.id, { fromRiffId: riff.id });
    expect(c).toMatchObject({ title: "Seed", key: "E", bpm: 128 });
    expect(c.sections[0].riffId).toBe(riff.id);
    expect(c.riffs[riff.id].title).toBe("Seed");
    const theirs = await createRiff(stranger.id, { title: "Private" });
    const bad = parseContent({ title: "x", sections: [{ id: "v", kind: "verse", name: "V", lyrics: "", riffId: theirs.id }], arrangement: ["v"] });
    await expect(saveCanvas(me.id, c.id, c.version, bad)).rejects.toThrow(/isn't available/);
    await expect(createCanvas(me.id, { fromRiffId: theirs.id })).rejects.toMatchObject({ status: 404 });
  });

  it("validates content at the boundary", () => {
    expect(() => parseContent({ title: "", sections: [], arrangement: [] })).toThrow(/title/);
    expect(() => parseContent({ title: "x", sections: [{ id: "a", kind: "kazoo", name: "", lyrics: "" }], arrangement: [] })).toThrow(/kind/);
    expect(() => parseContent({ title: "x", sections: [], arrangement: ["ghost"] })).toThrow(/doesn't exist/);
    expect(() => parseContent({ title: "x", sections: [{ id: "a", kind: "verse", name: "V", lyrics: "x".repeat(7000) }], arrangement: [] })).toThrow(/at most/);
  });
});
