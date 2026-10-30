import { NextResponse } from "next/server";
import { enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseRig } from "@/lib/rig-validation";
import { parseStoredToneData } from "@/lib/tone-validation";
import { updateTone } from "@/lib/tones";
import { versionSettings } from "@/lib/tone-versions";

type Ctx = { params: Promise<{ id: string; vid: string }> };

/** Puts an old version's settings back as a new version (nothing is lost). Re-validated, as the rules may have changed since. */
export const POST = route<Ctx>("tones.versions.restore", async (_req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("tones-write", actor.id, RATE_LIMITS.toneWrite);
  const { id, vid } = await params;
  const v = await versionSettings(actor.id, id, vid);
  const when = v.createdAt.toISOString().slice(0, 16).replace("T", " ");
  const tone = await updateTone(actor, id, { data: v.data === null ? null : parseStoredToneData(v.data), rig: v.rig === null ? null : parseRig(v.rig), revisionNote: `Restored the version from ${when} UTC` }, "RESTORED");
  return NextResponse.json({ tone });
});
