import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deviceTones, GENERATED_DISCLOSURE } from "@/lib/tones";
import { bankLayout, slotLabel, TANK_G_SLUG, tankGSheetText } from "@/lib/devices/tank-g";

/** Every planned slot's setup sheet in one text file, in bank order. */
export const GET = route("tones.tank-g-banks", async (req) => {
  const actor = await requireActor();
  await enforceRateLimit("social-read", actor.id, RATE_LIMITS.socialRead);
  const gear = await prisma.gearItem.findUnique({ where: { slug: TANK_G_SLUG }, select: { id: true } });
  if (!gear) throw new ApiError(404, "Not found.");
  const { slots } = bankLayout(await deviceTones(actor.id, gear.id));
  const origin = new URL(req.url).origin;
  const sheets = slots.map((t, i) => `===== Bank ${slotLabel(i)} =====\n${tankGSheetText(t.name, t.declared!, origin, t.id, t.origin === "generated" ? GENERATED_DISCLOSURE : t.anonymous ? "Shared anonymously." : `Shared by @${t.author.handle}.`)}`);
  const body = sheets.length ? sheets.join("\n\n") : "No saved TANK-G presets yet. Save some from the TANK-G preset library first.";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="tank-g-banks.txt"', "cache-control": "private, no-store" } });
});
