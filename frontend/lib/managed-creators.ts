import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";

export const MANAGED_CREATORS = [
  { handle: "resoniq_clara", name: "Clara Clean", specialization: "Clean guitar, funk and jazz", genres: ["funk", "jazz", "country", "pop"], instrument: "electric-guitar", avatar: "clean" },
  { handle: "resoniq_bram", name: "Bram Breakup", specialization: "Blues and British crunch", genres: ["blues", "rock"], instrument: "electric-guitar", avatar: "blues" },
  { handle: "resoniq_onyx", name: "Onyx Riffs", specialization: "Metal rhythm and high-gain leads", genres: ["metal", "prog"], instrument: "extended-range", avatar: "metal" },
  { handle: "resoniq_aura", name: "Aura Swells", specialization: "Ambient and worship guitar", genres: ["ambient", "worship"], instrument: "electric-guitar", avatar: "ambient" },
  { handle: "resoniq_lowen", name: "Lowen Pocket", specialization: "Bass, from vintage thump to modern grind", genres: ["funk", "rock", "prog", "ambient"], instrument: "bass", avatar: "bass" },
  { handle: "resoniq_piper", name: "Piper Pedalboard", specialization: "Indie, fuzz and pedal routing", genres: ["indie", "shoegaze", "rock"], instrument: "electric-guitar", avatar: "pedals" },
] as const;

export function creatorHandleFor(key: string, instrument: string, genres: string[]) {
  if (instrument === "BASS") return "resoniq_lowen";
  if (genres.includes("worship") || (key.startsWith("tank-g-") && genres.includes("ambient"))) return "resoniq_aura";
  if (genres.includes("metal") || key.startsWith("high-gain")) return "resoniq_onyx";
  if (genres.includes("blues") || key.includes("crunch")) return "resoniq_bram";
  if (genres.includes("indie") || genres.includes("shoegaze")) return "resoniq_piper";
  return "resoniq_clara";
}

/** Only creates new reserved identities; never converts or overwrites a member. */
export async function ensureManagedCreators(tx: Prisma.TransactionClient) {
  for (const c of MANAGED_CREATORS) {
    const existing = await tx.user.findUnique({ where: { handle: c.handle }, include: { managedCreator: true } });
    if (existing) {
      if (existing.kind !== "SYSTEM" || existing.managedCreator?.owner !== "Resoniq") {
        throw new ApiError(409, `@${c.handle} is already in use. No account was changed.`);
      }
      continue;
    }
    await tx.user.create({ data: {
      handle: c.handle, name: `${c.name} · Demo Creator`, kind: "SYSTEM",
      image: `/creators/${c.avatar}.svg`, instruments: [c.instrument], genres: [...c.genres],
      bio: `Resoniq-managed demo creator for ${c.specialization.toLowerCase()}. An editorial identity owned by Resoniq, not an independent musician. Suggested settings are generated and have not been tested on the listed gear.`,
      managedCreator: { create: { owner: "Resoniq", specialization: c.specialization } },
    } });
  }
}
