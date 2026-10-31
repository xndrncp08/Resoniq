import { prisma } from "@/lib/prisma";
import { suggestionPool } from "@/lib/discovery";

/** Where a new musician is in getting set up, read from what they've actually done (nothing extra is stored). */
export async function onboardingSteps(userId: string) {
  const [me, tones, riffs, posts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { instruments: true, genres: true, followingCount: true } }),
    prisma.tone.count({ where: { userId } }),
    prisma.riff.count({ where: { ownerId: userId } }),
    prisma.post.count({ where: { authorId: userId } }),
  ]);
  const steps = { interests: me.instruments.length > 0 && me.genres.length > 0, follows: me.followingCount > 0, created: tones + riffs + posts > 0 };
  return { ...steps, done: Object.values(steps).filter(Boolean).length, total: 3, instruments: me.instruments, genres: me.genres };
}

/** People worth following for a newcomer: most overlap with what they play and listen to, then most followed. */
export async function welcomeMusicians(userId: string, limit = 6) {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { instruments: true, genres: true } });
  const ids = await suggestionPool({ id: { not: userId }, status: "ACTIVE", kind: "PERSON", managedCreator: null }, me);
  const people = await prisma.user.findMany({
    where: { id: { in: ids } },
    orderBy: [{ followerCount: "desc" }, { createdAt: "asc" }],
    select: { id: true, handle: true, name: true, image: true, bio: true, followerCount: true, instruments: true, genres: true, followers: { where: { followerId: userId }, select: { followerId: true } } },
  });
  const overlap = (u: { instruments: string[]; genres: string[] }) => u.genres.filter((g) => me.genres.includes(g)).length * 2 + u.instruments.filter((i) => me.instruments.includes(i)).length;
  return people
    .map(({ followers, ...u }) => ({ ...u, viewerFollows: followers.length > 0, shared: u.genres.filter((g) => me.genres.includes(g)) }))
    .sort((a, b) => overlap(b) - overlap(a))
    .slice(0, limit);
}
