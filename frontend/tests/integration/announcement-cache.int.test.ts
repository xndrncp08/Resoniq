import { beforeEach, expect, it } from "vitest";
import { createAnnouncement, currentAnnouncement, endAnnouncement, parseAnnouncement } from "@/lib/admin/announcements";
import { actorFor, makeActor, prisma, resetDb } from "./db";

beforeEach(resetDb);

// The bar is cached per instance; writes on this instance must show up at once, not after the TTL.
it("serves the cached announcement but reflects create and end immediately", async () => {
  const user = await makeActor();
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  const admin = await actorFor(user);
  expect(await currentAnnouncement()).toBeNull();
  const a = await createAnnouncement(admin, parseAnnouncement({ title: "Maintenance tonight", body: "", level: "INFO" }));
  expect((await currentAnnouncement())?.id).toBe(a.id);
  // Cached: a row changed behind the cache's back isn't re-read within the TTL.
  await prisma.announcement.update({ where: { id: a.id }, data: { title: "Changed directly" } });
  expect((await currentAnnouncement())?.title).toBe("Maintenance tonight");
  await endAnnouncement(admin, a.id);
  expect(await currentAnnouncement()).toBeNull();
});
