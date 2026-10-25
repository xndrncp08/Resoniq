import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { deleteAccount } from "@/lib/account";
import { kickJobs } from "@/lib/jobs/drain";
import { parseProfilePatch } from "@/lib/profile-validation";
import { PUBLIC_USER_SELECT, toPublicProfile } from "@/lib/profiles";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/validation";
import { avatarPath, parseAvatarChoice, type DefaultAvatarId } from "@/lib/avatars";

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
  const images: { image?: string | null; bannerUrl?: string | null; uploadedImage?: string | null } = {};
  for (const [field, purpose, target] of [["avatarMediaId", "AVATAR", "image"], ["bannerMediaId", "BANNER", "bannerUrl"]] as const) {
    const v = body[field];
    if (v === undefined) continue;
    if (v === null) {
      if (target === "image") {
        // Removing the uploaded photo forgets it; the avatar only clears if that photo is what's showing.
        const own = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { image: true, uploadedImage: true } });
        images.uploadedImage = null;
        if (!own.uploadedImage || own.image === own.uploadedImage) images.image = null;
      } else images[target] = null;
      continue;
    }
    if (typeof v !== "string") throw new ApiError(400, `${field} must be an id.`);
    const media = await prisma.media.findFirst({ where: { id: v, ownerId: actor.id, purpose, status: "READY" }, select: { id: true } });
    if (!media) throw new ApiError(400, "That image isn't ready yet.");
    images[target] = `/api/media/${media.id}/playback`;
    if (target === "image") images.uploadedImage = images.image;
  }
  // Switching avatars: only a default, the account's own upload or its own Google photo.
  if (body.avatar !== undefined) {
    const choice = parseAvatarChoice(body.avatar);
    if (!choice) throw new ApiError(400, "That isn't an avatar you can choose.");
    if (choice === "initials") images.image = null;
    else if (choice.startsWith("preset:")) images.image = avatarPath(choice.slice(7) as DefaultAvatarId);
    else {
      const own = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { uploadedImage: true, providerImage: true } });
      const url = choice === "google" ? own.providerImage : own.uploadedImage;
      if (!url) throw new ApiError(400, choice === "google" ? "There's no Google photo on this account." : "There's no uploaded photo to switch back to.");
      images.image = url;
    }
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
  // Stored files are deleted by queued jobs; without a worker, start on them right away.
  kickJobs();
  return NextResponse.json({ ok: true });
});
