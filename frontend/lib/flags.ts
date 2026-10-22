import { prisma } from "@/lib/prisma";

/** Feature flags with their defaults; admins override them in the console (FeatureFlag rows). */
export const FLAGS = {
  "community.userCreation": { default: true, description: "Eligible members can create communities." },
  "uploads.video": { default: true, description: "Video uploads are accepted." },
  "uploads.enabled": { default: true, description: "Any media uploads are accepted." },
  signups: { default: true, description: "New accounts can register." },
  "auth.requireEmailVerification": { default: false, description: "Posting and community creation need a verified email." },
} as const;
export type FlagKey = keyof typeof FLAGS;

const TTL_MS = 30_000;
let cache: { at: number; values: Map<string, boolean> } | null = null;

export async function isEnabled(key: FlagKey): Promise<boolean> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } });
    cache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.enabled])) };
  }
  return cache.values.get(key) ?? FLAGS[key].default;
}

/** Call after an admin changes a flag so this instance sees it immediately. */
export function clearFlagCache() {
  cache = null;
}
