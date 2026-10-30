import { NextResponse } from "next/server";
import { enforceRateLimit, readJson, route } from "@/lib/api";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { parseStudioPatch } from "@/lib/studio/patch";
import { dnaFromPatch } from "@/lib/tone-dna";
import { similarTones } from "@/lib/similar-tones";

/** DNA and nearest public tones for an unsaved studio patch (the Amp Studio's "Find similar"). */
export const POST = route("tones.similar.patch", async (req) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const body = await readJson(req, 16 * 1024);
  const dna = dnaFromPatch(parseStudioPatch(body.studio));
  return NextResponse.json({ dna, similar: await similarTones(dna) });
});
