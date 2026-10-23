import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/mailer";
import { listedToneWhere } from "@/lib/tones";
import { TANK_G_SLUG } from "@/lib/devices/tank-g";

// Read at request time: the build shouldn't need a database, and sitemaps are fetched rarely.
export const dynamic = "force-dynamic";

/** Public, indexable pages only: tones, communities, gear (with the TANK-G library first) and policies. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appOrigin();
  // shortcut: one sitemap caps at 50,000 URLs; split with generateSitemaps() before tones get near that.
  const [tones, communities, gear] = await Promise.all([
    prisma.tone.findMany({ where: listedToneWhere, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 40_000 }),
    prisma.community.findMany({ where: { archivedAt: null }, select: { slug: true } }),
    prisma.gearItem.findMany({ where: { status: "APPROVED" }, select: { slug: true } }),
  ]);
  const page = (path: string, priority = 0.5, lastModified?: Date) => ({ url: `${origin}${path}`, priority, ...(lastModified && { lastModified }) });
  return [
    page("/", 1),
    page(`/gear/${TANK_G_SLUG}`, 0.9),
    ...["/tones", "/explore", "/c", "/gear"].map((p) => page(p, 0.8)),
    ...["/privacy", "/terms", "/copyright"].map((p) => page(p, 0.2)),
    ...tones.map((t) => page(`/t/${t.id}`, 0.6, t.updatedAt)),
    ...communities.map((c) => page(`/c/${c.slug}`, 0.6)),
    ...gear.filter((g) => g.slug !== TANK_G_SLUG).map((g) => page(`/gear/${g.slug}`, 0.4)),
  ];
}
