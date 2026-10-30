import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { fail } from "@/lib/validation";
import { viewableToneWhere } from "@/lib/tones";
import { editableCanvasWhere, parseContent } from "@/lib/canvas/service";
import type { CanvasContent } from "@/lib/canvas/merge";

/**
 * Gig Mode setlists: the songs for a show, in order, each with what you need
 * on stage (tempo, key, the tone to load, an optional MIDI program change).
 * Private to their owner.
 */

export const MAX_SETLISTS = 100;
export const MAX_SONGS = 80;
import { SONG_KEYS } from "@/lib/song-keys";
export { SONG_KEYS };

export type SetlistSong = { id: string; title: string; artist?: string; bpm?: number; key?: string; toneId?: string; canvasId?: string; minutes?: number; midiProgram?: number; notes?: string };
export type SetlistInput = { name: string; venue: string | null; date: string | null; notes: string | null; items: SetlistSong[] };
export type SetlistSummary = { id: string; name: string; venue: string | null; date: string | null; songs: number; minutes: number; updatedAt: string };
export type SetlistView = SetlistSummary & { notes: string | null; items: (SetlistSong & { tone: { id: string; name: string } | null; chart: CanvasContent | null })[] };

const record = (v: unknown, field: string): Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(`${field} must be an object.`);
  return v as Record<string, unknown>;
};
function text(v: unknown, field: string, max: number, required = false): string | undefined {
  if (v === undefined || v === null || v === "") {
    if (required) fail(`${field} is required.`);
    return undefined;
  }
  if (typeof v !== "string") fail(`${field} must be text.`);
  const t = v.trim();
  if (required && !t) fail(`${field} is required.`);
  if (t.length > max) fail(`${field} is at most ${max} characters.`);
  return t || undefined;
}
function int(v: unknown, field: string, lo: number, hi: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) fail(`${field} must be a whole number from ${lo} to ${hi}.`);
  return v;
}

export function parseSong(raw: unknown, i: number): SetlistSong {
  const s = record(raw, `items[${i}]`);
  const at = `Song ${i + 1}`;
  const id = typeof s.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : fail(`${at} needs an id.`);
  const key = text(s.key, `${at} key`, 3);
  if (key && !SONG_KEYS.includes(key)) fail(`${at} key must be like C, F#, Bb or Am.`);
  const toneId = text(s.toneId, `${at} tone`, 40);
  if (toneId && !/^[a-z0-9]{10,40}$/.test(toneId)) fail(`${at} tone is invalid.`);
  const canvasId = text(s.canvasId, `${at} song`, 40);
  if (canvasId && !/^[a-z0-9]{10,40}$/.test(canvasId)) fail(`${at} song is invalid.`);
  const minutes = s.minutes === undefined || s.minutes === null || s.minutes === "" ? undefined : typeof s.minutes === "number" && s.minutes > 0 && s.minutes <= 60 ? Math.round(s.minutes * 10) / 10 : fail(`${at} length must be up to 60 minutes.`);
  const song: SetlistSong = { id, title: text(s.title, `${at} title`, 120, true)! };
  const artist = text(s.artist, `${at} artist`, 80);
  const bpm = int(s.bpm, `${at} tempo`, 20, 300);
  const midiProgram = int(s.midiProgram, `${at} MIDI program`, 1, 128);
  const notes = text(s.notes, `${at} notes`, 1000);
  return { ...song, ...(artist && { artist }), ...(bpm !== undefined && { bpm }), ...(key && { key }), ...(toneId && { toneId }), ...(canvasId && { canvasId }), ...(minutes !== undefined && { minutes }), ...(midiProgram !== undefined && { midiProgram }), ...(notes && { notes }) };
}

function parseItems(v: unknown): SetlistSong[] {
  if (!Array.isArray(v)) fail("items must be a list of songs.");
  if (v.length > MAX_SONGS) fail(`A setlist holds at most ${MAX_SONGS} songs.`);
  const items = v.map(parseSong);
  if (new Set(items.map((s) => s.id)).size !== items.length) fail("Each song needs its own id.");
  return items;
}
function date(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) fail("date must be YYYY-MM-DD.");
  return v;
}

export function parseSetlist(body: Record<string, unknown>): SetlistInput {
  return { name: text(body.name, "Name", 120, true)!, venue: text(body.venue, "Venue", 120) ?? null, date: date(body.date), notes: text(body.notes, "Notes", 2000) ?? null, items: body.items === undefined ? [] : parseItems(body.items) };
}

export function parseSetlistPatch(body: Record<string, unknown>): Partial<SetlistInput> {
  const out: Partial<SetlistInput> = {};
  if (body.name !== undefined) out.name = text(body.name, "Name", 120, true)!;
  if (body.venue !== undefined) out.venue = text(body.venue, "Venue", 120) ?? null;
  if (body.date !== undefined) out.date = date(body.date);
  if (body.notes !== undefined) out.notes = text(body.notes, "Notes", 2000) ?? null;
  if (body.items !== undefined) out.items = parseItems(body.items);
  if (!Object.keys(out).length) fail("Nothing to change.");
  return out;
}

/** Stored items are re-read leniently: anything malformed is dropped rather than breaking the page. */
function storedItems(v: Prisma.JsonValue): SetlistSong[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((raw, i) => {
    try {
      return [parseSong(raw, i)];
    } catch {
      return [];
    }
  });
}

type Row = { id: string; name: string; venue: string | null; date: Date | null; notes: string | null; items: Prisma.JsonValue; updatedAt: Date };
const SELECT = { id: true, name: true, venue: true, date: true, notes: true, items: true, updatedAt: true } as const;

function summary(r: Row): SetlistSummary {
  const items = storedItems(r.items);
  return { id: r.id, name: r.name, venue: r.venue, date: r.date?.toISOString().slice(0, 10) ?? null, songs: items.length, minutes: Math.round(items.reduce((s, x) => s + (x.minutes ?? 0), 0)), updatedAt: r.updatedAt.toISOString() };
}

export async function listSetlists(userId: string): Promise<SetlistSummary[]> {
  const rows = await prisma.setlist.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: MAX_SETLISTS, select: SELECT });
  return rows.map(summary);
}

/** The owner's setlist with linked tones resolved (a tone that's since gone private or deleted shows as missing). */
export async function getSetlist(userId: string, id: string): Promise<SetlistView | null> {
  const r = await prisma.setlist.findFirst({ where: { id, userId }, select: SELECT });
  if (!r) return null;
  const items = storedItems(r.items);
  const ids = [...new Set(items.flatMap((s) => (s.toneId ? [s.toneId] : [])))];
  const tones = ids.length ? await prisma.tone.findMany({ where: { AND: [{ id: { in: ids } }, viewableToneWhere(userId)] }, select: { id: true, name: true } }) : [];
  const byId = new Map(tones.map((t) => [t.id, t]));
  // Linked songs show their chord chart on stage, if the owner can still open them.
  const canvasIds = [...new Set(items.flatMap((s) => (s.canvasId ? [s.canvasId] : [])))];
  const canvases = canvasIds.length ? await prisma.songCanvas.findMany({ where: { AND: [{ id: { in: canvasIds } }, editableCanvasWhere(userId)] }, select: { id: true, sections: true, arrangement: true, title: true, key: true, bpm: true } }) : [];
  const charts = new Map(canvases.flatMap((c) => {
    try { return [[c.id, parseContent(c as unknown as Record<string, unknown>)] as const]; } catch { return []; }
  }));
  return { ...summary(r), notes: r.notes, items: items.map((s) => ({ ...s, tone: s.toneId ? (byId.get(s.toneId) ?? null) : null, chart: s.canvasId ? (charts.get(s.canvasId) ?? null) : null })) };
}

const toData = (i: Partial<SetlistInput>) => ({
  ...(i.name !== undefined && { name: i.name }),
  ...(i.venue !== undefined && { venue: i.venue }),
  ...(i.notes !== undefined && { notes: i.notes }),
  ...(i.date !== undefined && { date: i.date ? new Date(`${i.date}T00:00:00Z`) : null }),
  ...(i.items !== undefined && { items: i.items as Prisma.InputJsonValue }),
});

export async function createSetlist(userId: string, input: SetlistInput): Promise<SetlistView> {
  if ((await prisma.setlist.count({ where: { userId } })) >= MAX_SETLISTS) throw new ApiError(409, `You can keep up to ${MAX_SETLISTS} setlists. Delete an old one first.`);
  const { id } = await prisma.setlist.create({ data: { userId, ...toData(input), name: input.name }, select: { id: true } });
  return (await getSetlist(userId, id))!;
}

export async function updateSetlist(userId: string, id: string, patch: Partial<SetlistInput>): Promise<SetlistView> {
  const { count } = await prisma.setlist.updateMany({ where: { id, userId }, data: toData(patch) });
  if (!count) throw new ApiError(404, "Setlist not found.");
  return (await getSetlist(userId, id))!;
}

export async function deleteSetlist(userId: string, id: string) {
  const { count } = await prisma.setlist.deleteMany({ where: { id, userId } });
  if (!count) throw new ApiError(404, "Setlist not found.");
}
