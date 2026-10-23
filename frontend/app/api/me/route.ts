import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { deleteAccount } from "@/lib/account";
import { parseProfilePatch } from "@/lib/profile-validation";
import { PUBLIC_USER_SELECT, toPublicProfile } from "@/lib/profiles";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/validation";

export const GET = route("me.get", async () => {
  const actor = await requireActor();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { ...PUBLIC_USER_SELECT, email: true, role: true, status: true, suspendedUntil: true },
  });
  const { email, role, status, suspendedUntil, ...rest } = user;
  return NextResponse.json({ profile: toPublicProfile(rest, actor.id, false), email, role, status, suspendedUntil });
});

export const PATCH = route("me.update", async (req) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("profile-write", actor.id, RATE_LIMITS.profileWrite);
  const body = await readJson(req);
  const { links, ...rest } = parseProfilePatch(body);
  // Avatars and banners are processed image uploads, served through the media route.
  const images: { image?: string | null; bannerUrl?: string | null } = {};
  for (const [field, purpose, target] of [["avatarMediaId", "AVATAR", "image"], ["bannerMediaId", "BANNER", "bannerUrl"]] as const) {
    const v = body[field];
    if (v === undefined) continue;
    if (v === null) {
      images[target] = null;
      continue;
    }
    if (typeof v !== "string") throw new ApiError(400, `${field} must be an id.`);
    const media = await prisma.media.findFirst({ where: { id: v, ownerId: actor.id, purpose, status: "READY" }, select: { id: true } });
    if (!media) throw new ApiError(400, "That image isn't ready yet.");
    images[target] = `/api/media/${media.id}/playback`;
  }
  try {
    const user = await prisma.user.update({
      where: { id: actor.id },
      data: { ...rest, ...images, ...(links && { links: links as Prisma.InputJsonValue }) },
      select: PUBLIC_USER_SELECT,
    });
    return NextResponse.json({ profile: toPublicProfile(user, actor.id, false) });
  } catch (err) {
    if (isUniqueViolation(err, "handle")) throw new ApiError(409, "That handle is taken.");
    throw err;
  }
});

/** Body: { confirmHandle, password? } — password is required for email/password accounts. */
export const DELETE = route("me.delete", async (req) => {
  const actor = await requireActor();
  await enforceRateLimit("profile-write", actor.id, RATE_LIMITS.profileWrite);
  const { confirmHandle, password } = await readJson(req);
  if (typeof confirmHandle !== "string" || confirmHandle.trim().replace(/^@/, "").toLowerCase() !== actor.handle) {
    throw new ApiError(400, "Type your handle to confirm.");
  }
  const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { passwordHash: true } });
  if (passwordHash && (typeof password !== "string" || !(await bcrypt.compare(password, passwordHash)))) {
    throw new ApiError(403, "Password is incorrect.");
  }
  await deleteAccount(actor.id);
  return NextResponse.json({ ok: true });
});
