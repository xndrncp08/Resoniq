import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseReleaseUpdate, releaseCandidates, updateRelease } from "@/lib/publishing";

type Ctx = { params: Promise<{ id: string }> };

/** Author: the release, takes that can be added, and earlier versions. */
export const GET = route<Ctx>("posts.release.get", async (_req, { params }) => {
  const actor = await requireActor();
  return NextResponse.json(await releaseCandidates(actor.id, (await params).id));
});

/** Author: { takes: [{ takeId, mix }], refreshChart?, note? }. The previous version is kept as a revision. */
export const PATCH = route<Ctx>("posts.release.update", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  await enforceRateLimit("post-write", actor.id, RATE_LIMITS.postWrite);
  await updateRelease(actor.id, (await params).id, parseReleaseUpdate(await readJson(req)));
  return NextResponse.json({ ok: true });
});
