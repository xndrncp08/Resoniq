/**
 * Structural seed data only: community spaces, default moderation rules (and,
 * from the tone phase, the gear catalog). It never creates users, posts or
 * engagement. Safe to re-run: everything is upserted.
 *
 *   npm run db:seed
 */
import { PrismaClient, type CommunityKind, type ModerationRuleKind, type Prisma } from "@prisma/client";
import { seedGear } from "./seed-gear";

const COMMUNITIES: { slug: string; name: string; kind: CommunityKind; description: string }[] = [
  { slug: "electric-guitar", name: "Electric Guitar", kind: "INSTRUMENT", description: "Six strings, pickups and everything between the jack and the amp." },
  { slug: "bass", name: "Bass", kind: "INSTRUMENT", description: "Low end: rigs, compression, DI vs. amp, and the pocket." },
  { slug: "acoustic-guitar", name: "Acoustic Guitar", kind: "INSTRUMENT", description: "Tonewoods, pickups, mic placement and fingerstyle." },
  { slug: "extended-range", name: "Extended Range", kind: "INSTRUMENT", description: "Seven, eight and nine strings, baritones and multiscale." },
  { slug: "blues", name: "Blues", kind: "GENRE", description: "Edge-of-breakup tones, dynamics and feel." },
  { slug: "metal", name: "Metal", kind: "GENRE", description: "High gain done tight: gates, boosts, cabs and tunings." },
  { slug: "jazz", name: "Jazz", kind: "GENRE", description: "Warm cleans, archtops and chord-melody." },
  { slug: "funk", name: "Funk", kind: "GENRE", description: "Clean rhythm, compression, wah and envelope filters." },
  { slug: "indie", name: "Indie", kind: "GENRE", description: "Jangle, fuzz, offsets and everything in between." },
  { slug: "shoegaze", name: "Shoegaze", kind: "GENRE", description: "Walls of reverb, reverse delays and fuzz." },
  { slug: "prog", name: "Prog", kind: "GENRE", description: "Odd meters and rigs to match." },
  { slug: "country", name: "Country", kind: "GENRE", description: "Telecaster twang, chicken pickin' and compressors." },
  { slug: "pedalboards", name: "Pedalboards", kind: "GEAR", description: "Board builds, power, routing and signal order." },
  { slug: "amps", name: "Amps & Cabs", kind: "GEAR", description: "Tube, solid state, speakers, mics and attenuators." },
  { slug: "modelers", name: "Modelers & Plugins", kind: "GEAR", description: "Helix, Quad Cortex, Kemper, Axe-Fx, Neural DSP and friends." },
  { slug: "diy-pedals", name: "DIY Pedals", kind: "GEAR", description: "Kits, mods, schematics and soldering." },
  { slug: "tone-matching", name: "Tone Matching", kind: "TOPIC", description: "Chasing a recorded sound: analyses, A/B clips and settings." },
  { slug: "recording", name: "Recording", kind: "TOPIC", description: "Re-amping, DI, mic'ing cabs and mixing guitars." },
  { slug: "fingerstyle", name: "Fingerstyle", kind: "STYLE", description: "Percussive, classical and travis picking." },
  { slug: "beginners", name: "First Rig", kind: "TOPIC", description: "No question too basic: start here." },
];

const RULES: { kind: ModerationRuleKind; label: string; config: Prisma.InputJsonValue; enabled: boolean }[] = [
  { kind: "REPORT_HOLD", label: "Multiple reports", config: { reports: 3 }, enabled: true },
  { kind: "LINK_HOLD_NEW_ACCOUNTS", label: "Link from a new account", config: { hours: 24 }, enabled: true },
  { kind: "MAX_MENTIONS", label: "Too many mentions", config: { max: 8 }, enabled: true },
  { kind: "BLOCKED_TERM", label: "Blocked term", config: { terms: [] }, enabled: true },
];

export async function seed(prisma: PrismaClient) {
  for (const c of COMMUNITIES) {
    await prisma.community.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, description: c.description, kind: c.kind } });
  }
  for (const r of RULES) {
    const existing = await prisma.moderationRule.findFirst({ where: { kind: r.kind, label: r.label } });
    if (!existing) await prisma.moderationRule.create({ data: r });
  }
  await seedGear(prisma);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log("Seeded communities, moderation rules and the gear catalog."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
