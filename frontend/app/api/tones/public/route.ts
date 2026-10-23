import { NextResponse } from "next/server";
import { enforceRateLimit, optionalActor, route } from "@/lib/api";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { listTones, parseToneGenre, parseToneSource } from "@/lib/tones";
import { parseTankGFilters } from "@/lib/devices/tank-g";

/** Public tone discovery: ?sort=new|popular &instrument=GUITAR|BASS &gear=<id> &genre &source=members|generated &q &cursor, plus TANK-G &amp &effect &collection */
export const GET = route("tones.public", async (req) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const p = new URL(req.url).searchParams;
  const instrument = p.get("instrument");
  return NextResponse.json(
    await listTones(viewer?.id ?? null, {
      sort: p.get("sort") === "popular" ? "popular" : "new",
      instrument: instrument === "GUITAR" || instrument === "BASS" ? instrument : undefined,
      gearId: p.get("gear") ?? undefined,
      q: p.get("q")?.trim().slice(0, 80) || undefined,
      source: parseToneSource(p.get("source")),
      genre: parseToneGenre(p.get("genre")),
      ...parseTankGFilters(k => p.get(k)),
      cursor: decodeCursor(p.get("cursor")),
      limit: parseLimit(p.get("limit")),
    }),
  );
});
