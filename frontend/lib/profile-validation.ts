import { MAX_NAME_LENGTH } from "@/lib/credentials";
import { normalizeHandle } from "@/lib/handles";
import { fail } from "@/lib/validation";
import { isReservedDisplayName } from "@/lib/system-identity";
import { INSTRUMENTS } from "@/lib/instruments";
import { isOpenTo, MAX_INFLUENCES, MAX_LOCATION, type OpenTo } from "@/lib/portfolio-options";

export { INSTRUMENTS, type Instrument } from "@/lib/instruments";

export const MAX_BIO = 500;
const GENRE = /^[a-z0-9][a-z0-9 -]{0,23}$/;

export type ProfileLink = { label: string; url: string };
export type ProfilePatch = Partial<{
  name: string | null;
  handle: string;
  bio: string | null;
  instruments: string[];
  genres: string[];
  links: ProfileLink[];
  location: string | null;
  openTo: OpenTo[];
  influences: string[];
  pinnedPostId: string | null;
  signatureToneId: string | null;
}>;

function list(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) fail(`${field} must be a list.`);
  return v;
}

function optionalText(v: unknown, field: string, max: number): string | null {
  if (v === null) return null;
  if (typeof v !== "string") fail(`${field} must be text.`);
  const s = v.trim();
  if (s.length > max) fail(`${field} must be at most ${max} characters.`);
  return s || null;
}

export function parseLink(v: unknown): ProfileLink {
  const o = (v ?? {}) as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const raw = typeof o.url === "string" ? o.url.trim() : "";
  if (!label || label.length > 40) fail("Link labels are 1–40 characters.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail("Links must be full web addresses.");
  }
  if (raw.length > 200 || (url.protocol !== "https:" && url.protocol !== "http:")) fail("Links must be http(s) addresses.");
  return { label, url: url.toString() };
}

/** Validates a profile edit. Unknown keys are ignored. */
export function parseProfilePatch(body: Record<string, unknown>): ProfilePatch {
  const out: ProfilePatch = {};
  if (body.name !== undefined) {
    out.name = optionalText(body.name, "Name", MAX_NAME_LENGTH);
    if (out.name && isReservedDisplayName(out.name)) fail("That name is reserved.");
  }
  if (body.handle !== undefined) out.handle = normalizeHandle(body.handle);
  if (body.bio !== undefined) out.bio = optionalText(body.bio, "Bio", MAX_BIO);
  if (body.instruments !== undefined) {
    const items = [...new Set(list(body.instruments, "Instruments"))];
    if (items.length > 4) fail("Pick up to 4 instruments.");
    if (!items.every((i) => (INSTRUMENTS as readonly unknown[]).includes(i))) fail("Unknown instrument.");
    out.instruments = items as string[];
  }
  if (body.genres !== undefined) {
    const items = [...new Set(list(body.genres, "Genres").map((g) => (typeof g === "string" ? g.trim().toLowerCase() : "")))];
    if (items.length > 8) fail("Pick up to 8 genres.");
    if (!items.every((g) => GENRE.test(g))) fail("Genres are up to 24 letters, numbers, spaces or dashes.");
    out.genres = items;
  }
  if (body.links !== undefined) {
    const items = list(body.links, "Links");
    if (items.length > 5) fail("Add up to 5 links.");
    out.links = items.map(parseLink);
  }
  if (body.location !== undefined) out.location = optionalText(body.location, "Location", MAX_LOCATION);
  if (body.openTo !== undefined) {
    const items = [...new Set(list(body.openTo, "Open to"))];
    if (!items.every(isOpenTo)) fail("Unknown collaboration option.");
    out.openTo = items;
  }
  if (body.influences !== undefined) {
    const seen = new Set<string>();
    const items = list(body.influences, "Influences").flatMap((v) => {
      const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
      if (!s || s.length > 40 || /[\p{Cc}<>]/u.test(s)) fail("Influences are names of up to 40 characters.");
      if (seen.has(s.toLowerCase())) return [];
      seen.add(s.toLowerCase());
      return [s];
    });
    if (items.length > MAX_INFLUENCES) fail(`Add up to ${MAX_INFLUENCES} influences.`);
    out.influences = items;
  }
  for (const key of ["pinnedPostId", "signatureToneId"] as const) {
    const v = body[key];
    if (v === undefined) continue;
    if (v !== null && (typeof v !== "string" || !v || v.length > 40)) fail(`${key} must be an id or null.`);
    out[key] = v;
  }
  return out;
}
