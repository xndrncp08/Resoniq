import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { exportTone, getTone } from "@/lib/tones";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads the tone as Resoniq JSON. */
export const GET = route<Ctx>("tones.export", async (req, { params }) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const tone = await getTone((await params).id, viewer?.id ?? null);
  if (!tone) throw new ApiError(404, "Tone not found.");
  const file = `${tone.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "tone"}.resoniq.json`;
  return new Response(JSON.stringify(exportTone(tone, new URL(req.url).origin), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "private, no-store",
    },
  });
});
