import { beforeEach, describe, expect, it } from "vitest";
import { onboardingSteps, welcomeMusicians } from "@/lib/onboarding";
import { makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

describe("onboarding", () => {
  it("tracks the steps from real activity and suggests people who share your interests", async () => {
    const me = await makeActor();
    const jazz = await makeActor();
    const popular = await makeActor();
    expect(await onboardingSteps(me.id)).toMatchObject({ interests: false, follows: false, created: false, done: 0 });

    await prisma.user.update({ where: { id: me.id }, data: { instruments: ["bass"], genres: ["jazz"] } });
    await prisma.user.update({ where: { id: jazz.id }, data: { genres: ["jazz"] } });
    await prisma.user.update({ where: { id: popular.id }, data: { followerCount: 50 } });
    const people = await welcomeMusicians(me.id);
    expect(people.map((u) => u.id)).not.toContain(me.id);
    expect(people[0]).toMatchObject({ id: jazz.id, shared: ["jazz"], viewerFollows: false });
    expect(people[1].id).toBe(popular.id);

    await prisma.follow.create({ data: { followerId: me.id, followingId: jazz.id } });
    await prisma.user.update({ where: { id: me.id }, data: { followingCount: 1 } });
    await prisma.riff.create({ data: { ownerId: me.id, title: "Walking line" } });
    expect(await onboardingSteps(me.id)).toMatchObject({ interests: true, follows: true, created: true, done: 3 });
    expect((await welcomeMusicians(me.id)).find((u) => u.id === jazz.id)?.viewerFollows).toBe(true);
  });
});
