import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProfileLink } from "@/lib/profile-validation";

/** What anyone may see about a user. Never includes email, role or account status. */
export type PublicProfile = {
  id: string;
  handle: string;
  name: string | null;
  image: string | null;
  bannerUrl: string | null;
  bio: string | null;
  instruments: string[];
  genres: string[];
  links: ProfileLink[];
  followerCount: number;
  followingCount: number;
  reputation: number;
  createdAt: string;
  viewerFollows: boolean;
  isSelf: boolean;
};

export const PUBLIC_USER_SELECT = {
  id: true,
  handle: true,
  name: true,
  image: true,
  bannerUrl: true,
  bio: true,
  instruments: true,
  genres: true,
  links: true,
  followerCount: true,
  followingCount: true,
  reputation: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** The compact author shape used on posts, comments and lists. */
export const AUTHOR_SELECT = { id: true, handle: true, name: true, image: true } satisfies Prisma.UserSelect;
export type Author = Prisma.UserGetPayload<{ select: typeof AUTHOR_SELECT }>;

type Row = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

export function toPublicProfile(u: Row, viewerId: string | null, viewerFollows: boolean): PublicProfile {
  return {
    ...u,
    links: Array.isArray(u.links) ? (u.links as ProfileLink[]) : [],
    createdAt: u.createdAt.toISOString(),
    viewerFollows,
    isSelf: viewerId === u.id,
  };
}

/** Null for unknown handles and for banned accounts. */
export async function getPublicProfile(handle: string, viewerId: string | null): Promise<PublicProfile | null> {
  const user = await prisma.user.findFirst({
    // System identities (lib/system-identity.ts) have no public profile.
    where: { handle: handle.toLowerCase(), status: { not: "BANNED" }, kind: "PERSON" },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) return null;
  const follows =
    viewerId && viewerId !== user.id
      ? !!(await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          select: { createdAt: true },
        }))
      : false;
  return toPublicProfile(user, viewerId, follows);
}
