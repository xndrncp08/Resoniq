import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Author } from "@/lib/profiles";

/**
 * The reserved identity Resoniq-generated tones are published under.
 *
 * It's a User row only because every tone needs an owner; `kind = SYSTEM`
 * marks it as nobody's account. It has no email, password or OAuth link, so
 * nothing can sign in as it (and getActor() refuses it anyway); the database
 * forbids giving it a staff role or credentials; its handle is reserved so no
 * member can claim it; and it has no public profile. Publicly its tones show
 * the author as "Anonymous" plus a "Resoniq-generated" label.
 */
export const SYSTEM_PUBLISHER_HANDLE = "anonymous";
export const ANONYMOUS_NAME = "Anonymous";

/** What anonymous content shows instead of its owner. Links nowhere; leaks no id. */
export const ANONYMOUS_AUTHOR: Author = { id: "anonymous", handle: SYSTEM_PUBLISHER_HANDLE, name: ANONYMOUS_NAME, image: null };

// Names a member could use to pass their posts off as Resoniq's own.
const RESERVED_DISPLAY_NAMES = new Set(["anonymous", "resoniq", "resoniq team", "resoniq staff", "system"]);

export const isReservedDisplayName = (name: string) => RESERVED_DISPLAY_NAMES.has(name.trim().toLowerCase().replace(/\s+/g, " "));

type Db = PrismaClient | Prisma.TransactionClient;

/** The publisher's user id, created on first use. Refuses a member account that somehow holds the handle. */
export async function systemPublisherId(db: Db = prisma): Promise<string> {
  const row = await db.user.upsert({
    where: { handle: SYSTEM_PUBLISHER_HANDLE },
    create: { handle: SYSTEM_PUBLISHER_HANDLE, name: ANONYMOUS_NAME, kind: "SYSTEM" },
    update: {},
    select: { id: true, kind: true },
  });
  if (row.kind !== "SYSTEM") throw new Error(`@${SYSTEM_PUBLISHER_HANDLE} belongs to a member account; refusing to publish under it.`);
  return row.id;
}
