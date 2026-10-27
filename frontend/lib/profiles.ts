import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProfileLink } from "@/lib/profile-validation";
import { isOpenTo, type OpenTo } from "@/lib/portfolio-options";

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
  location: string | null;
  openTo: OpenTo[];
  influences: string[];
  availableUntil: string | null;
  availabilityNote: string | null;
  playingSince: number | null;
  highlights: string[];
  followerCount: number;
  followingCount: number;
  reputation: number;
  createdAt: string;
  viewerFollows: boolean;
  isSelf: boolean;
  managed: boolean;
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
  location: true,
  openTo: true,
  influences: true,
  availableUntil: true,
  availabilityNote: true,
  playingSince: true,
  highlights: true,
  followerCount: true,
  followingCount: true,
  reputation: true,
  createdAt: true,
  managedCreator: { select: { id: true } },
} satisfies Prisma.UserSelect;

/** The compact author shape used on posts, comments and lists. */
export const AUTHOR_SELECT = { id: true, handle: true, name: true, image: true, managedCreator: { select: { id: true } } } satisfies Prisma.UserSelect;
export type Author = Omit<Prisma.UserGetPayload<{ select: typeof AUTHOR_SELECT }>, "managedCreator"> & { managedCreator?: { id: string } | null };

type Row = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

export function toPublicProfile(u: Row, viewerId: string | null, viewerFollows: boolean): PublicProfile {
  const { managedCreator, ...profile } = u;
  return {
    ...profile,
    links: Array.isArray(u.links) ? (u.links as ProfileLink[]) : [],
    openTo: u.openTo.filter(isOpenTo),
    // An availability window that's over isn't shown.
    availableUntil: u.availableUntil && u.availableUntil >= new Date() ? u.availableUntil.toISOString() : null,
    availabilityNote: u.availableUntil && u.availableUntil >= new Date() ? u.availabilityNote : null,
    createdAt: u.createdAt.toISOString(),
    viewerFollows,
    isSelf: viewerId === u.id,
    managed: !!managedCreator,
  };
}

/** Null for unknown handles and for banned accounts. */
export async function getPublicProfile(handle: string, viewerId: string | null): Promise<PublicProfile | null> {
  const user = await prisma.user.findFirst({
    // System identities (lib/system-identity.ts) have no public profile.
    where: { handle: handle.toLowerCase(), status: { not: "BANNED" }, OR: [{ kind: "PERSON" }, { managedCreator: { isNot: null } }] },
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
