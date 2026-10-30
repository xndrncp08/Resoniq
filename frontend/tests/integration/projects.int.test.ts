import { beforeEach, describe, expect, it } from "vitest";
import { getProject, listProjects, setProjectStage, suggestStage } from "@/lib/projects";
import { createRiff, riffProject } from "@/lib/riffs/service";
import { createCanvas } from "@/lib/canvas/service";
import { addProjectMember } from "@/lib/messaging";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("music projects", () => {
  it("count what's in them and suggest a stage until members set one", async () => {
    const me = await makeActor();
    const riff = await createRiff(me.id, { title: "Seed" });
    const { projectId } = await riffProject(me.id, riff.id);
    let p = await getProject(me.id, projectId);
    expect(p).toMatchObject({ stage: "IDEA", stageSet: false, counts: { riffs: 1, songs: 0, takes: 0 } });
    await createCanvas(me.id, { projectId });
    p = await getProject(me.id, projectId);
    expect(p).toMatchObject({ stage: "WRITING", counts: { songs: 1 } });
    expect(suggestStage({ riffs: 1, takes: 3, songs: 1, openRooms: 0, feedback: 0 })).toBe("RECORDING");
    expect(suggestStage({ riffs: 1, takes: 3, songs: 1, openRooms: 1, feedback: 0 })).toBe("REVIEWING");
  });

  it("let any member move the stage or finish it, announced in the thread; outsiders get nothing", async () => {
    const me = await makeActor();
    const bandmate = await makeActor();
    const outsider = await makeActor();
    const { projectId } = await riffProject(me.id, (await createRiff(me.id, { title: "Seed" })).id);
    await addProjectMember(me, projectId, bandmate.id);
    expect((await setProjectStage(bandmate.id, projectId, { stage: "RECORDING" })).stage).toBe("RECORDING");
    const done = await setProjectStage(me.id, projectId, { stage: "RELEASED", finished: true });
    expect(done.completedAt).toBeTruthy();
    expect((await setProjectStage(me.id, projectId, { finished: false })).completedAt).toBeNull();
    const notes = await prisma.message.findMany({ where: { conversationId: projectId, kind: "SYSTEM" }, orderBy: { createdAt: "asc" }, select: { body: true } });
    expect(notes.map((n) => n.body).slice(-3)).toEqual(["moved the project to Recording.", "marked the project finished.", "reopened the project."]);
    await expect(setProjectStage(outsider.id, projectId, { stage: "IDEA" })).rejects.toMatchObject({ status: 404 });
    await expect(setProjectStage(me.id, projectId, { stage: "VIRAL" })).rejects.toThrow(/Unknown stage/);
    expect(await listProjects(outsider.id)).toEqual([]);
    expect((await listProjects(bandmate.id)).map((x) => x.id)).toEqual([projectId]);
  });
});
