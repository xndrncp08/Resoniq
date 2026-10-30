import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { getTone } from "@/lib/tones";
import { patchFromTone } from "@/lib/studio/from-tone";
import { dnaFromPatch } from "@/lib/tone-dna";
import { similarTones } from "@/lib/similar-tones";

type Ctx = { params: Promise<{ id: string }> };

/** A tone's DNA and the public tones closest to it. Same visibility rules as the tone itself. */
export const GET = route<Ctx>("tones.similar", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const tone = await getTone((await params).id, viewer?.id ?? null);
  if (!tone) throw new ApiError(404, "Tone not found.");
  const dna = dnaFromPatch(patchFromTone(tone).patch);
  return NextResponse.json({ dna, similar: await similarTones(dna, { exclude: tone.id }) });
});
