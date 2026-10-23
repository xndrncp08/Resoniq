import { ApiError, enforceRateLimit, optionalActor, route } from "@/lib/api";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { exportTone, GENERATED_DISCLOSURE, getTone } from "@/lib/tones";
import { tankGSheet, tankGSheetText } from "@/lib/devices/tank-g";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads the tone as Resoniq JSON, or ?format=sheet as a plain-text TANK-G setup sheet. */
export const GET = route<Ctx>("tones.export", async (req, { params }) => {
  await enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const viewer = await optionalActor();
  const tone = await getTone((await params).id, viewer?.id ?? null);
  if (!tone) throw new ApiError(404, "Tone not found.");
  const base = tone.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "tone";
  const origin = new URL(req.url).origin;
  const sheet = new URL(req.url).searchParams.get("format") === "sheet";
  if (sheet && !(tone.declared && tankGSheet(tone.declared).length)) throw new ApiError(404, "This tone has no device setup sheet.");
  const file = sheet ? `${base}.tank-g-setup.txt` : `${base}.resoniq.json`;
  const content = sheet
    ? tankGSheetText(tone.name, tone.declared!, origin, tone.id, tone.origin === "generated" ? GENERATED_DISCLOSURE : tone.anonymous ? "Shared anonymously." : `Shared by @${tone.author.handle}.`)
    : JSON.stringify(exportTone(tone, origin), null, 2);
  return new Response(content, {
    headers: {
      "content-type": sheet ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "private, no-store",
    },
  });
});
