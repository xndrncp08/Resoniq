import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { fail } from "@/lib/validation";

/** Public @handles. The database enforces the same pattern (User_handle_format). */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

// Route segments and staff-sounding names nobody should be able to claim.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin", "administrator", "api", "app", "c", "compare", "copyright", "explore", "feed", "gear", "help",
  "library", "login", "logout", "me", "mod", "moderator", "new", "notifications", "p", "resoniq", "root",
  "search", "settings", "signup", "staff", "support", "system", "t", "tag", "tones", "u", "analyze",
  "bookmarks", "official", "security", "terms", "privacy", "anonymous",
]);

export function normalizeHandle(v: unknown): string {
  if (typeof v !== "string") fail("Handle must be a string.");
  const handle = v.trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) fail("Handles are 3–30 characters: letters, numbers and underscores.");
  if (RESERVED_HANDLES.has(handle) || handle.startsWith("resoniq_")) fail("That handle is reserved.");
  return handle;
}

/** A handle suggestion from a display name, or null when nothing usable is left. Never from an email. */
export function handleFromName(name: string | null): string | null {
  if (!name) return null;
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/, "");
  return slug.length >= 3 && !RESERVED_HANDLES.has(slug) && !slug.startsWith("resoniq_") ? slug : null;
}

/** The first free handle of base, base_2 … base_9, then base_<random hex>. */
export async function assignHandle(db: PrismaClient | Prisma.TransactionClient, base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}_${i + 2}`)];
  const taken = new Set(
    (await db.user.findMany({ where: { handle: { in: candidates } }, select: { handle: true } })).map((u) => u.handle),
  );
  return candidates.find((c) => !taken.has(c)) ?? `${base}_${randomBytes(2).toString("hex")}`;
}
