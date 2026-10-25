import { prisma } from "@/lib/prisma";
import { isGooglePhoto } from "@/lib/avatars";

/**
 * On Google sign-in: remember the account's photo so the avatar picker can
 * offer it, and if the member is showing their Google photo, follow Google's
 * changes. Never overrides a default avatar, an upload or initials.
 */
export async function syncGooglePhoto(userId: string, picture: unknown) {
  if (!isGooglePhoto(picture)) return;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { image: true, providerImage: true } });
  if (!row) return;
  const showingGoogle = row.image !== null && (row.image === row.providerImage || (row.providerImage === null && row.image === picture));
  if (row.providerImage === picture && !showingGoogle) return;
  await prisma.user.update({ where: { id: userId }, data: { providerImage: picture, ...(showingGoogle && { image: picture }) } });
}
