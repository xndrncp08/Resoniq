import { INSTRUMENTS } from "@/lib/instruments";
import { OPEN_TO } from "@/lib/portfolio-options";

export type DirectoryParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => typeof value === "string" ? value.trim() : "";

export function parseMusicianFilters(params: DirectoryParams) {
  const instrument = INSTRUMENTS.find((i) => i === params.instrument);
  const genre = text(params.genre).toLowerCase().slice(0, 24);
  const after = text(params.after);
  const open = OPEN_TO.find((o) => o.id === params.open)?.id;
  return {
    open,
    q: text(params.q).replace(/^@/, "").slice(0, 100),
    instrument,
    genre,
    after: /^[a-z0-9_]{3,30}$/.test(after) ? after : "",
  };
}

export type MusicianFilters = ReturnType<typeof parseMusicianFilters>;

export function musicianDirectoryHref(filters: Partial<MusicianFilters> = {}) {
  const params = new URLSearchParams();
  for (const key of ["q", "instrument", "genre", "open", "after"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return `/musicians${params.size ? `?${params}` : ""}`;
}
