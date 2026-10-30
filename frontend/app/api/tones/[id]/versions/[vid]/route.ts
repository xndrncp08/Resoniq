import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseNote, setVersionNote } from "@/lib/tone-versions";

type Ctx = { params: Promise<{ id: string; vid: string }> };

/** Body: { note }: edit a version's revision note. */
export const PATCH = route<Ctx>("tones.versions.note", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("tones-write", actor.id, RATE_LIMITS.toneWrite);
  const { id, vid } = await params;
  await setVersionNote(actor.id, id, vid, parseNote((await readJson(req)).note));
  return NextResponse.json({ ok: true });
});
