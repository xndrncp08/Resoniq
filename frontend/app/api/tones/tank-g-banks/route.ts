import { prisma } from "@/lib/prisma";
import { ApiError, enforceRateLimit, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deviceTones, GENERATED_DISCLOSURE } from "@/lib/tones";
import { bankLayout, slotLabel, TANK_G_SLOTS, TANK_G_SLUG, tankGSheetText } from "@/lib/devices/tank-g";

/** Every planned slot's setup sheet in one text file, in bank order. */
export const GET = route("tones.tank-g-banks", async (req) => {
  const actor = await requireActor();
  await enforceRateLimit("social-read", actor.id, RATE_LIMITS.socialRead);
  const gear = await prisma.gearItem.findUnique({ where: { slug: TANK_G_SLUG }, select: { id: true } });
  if (!gear) throw new ApiError(404, "Not found.");
  const tones = await deviceTones(actor.id, gear.id);
  const url = new URL(req.url);
  // ?order= is the planner's slot list (ids, blank for empty). Only the viewer's own and saved presets are honoured.
  const order = url.searchParams.get("order");
  const byId = new Map(tones.map((t) => [t.id, t]));
  const slots = order === null ? bankLayout(tones).slots : order.split(",").slice(0, TANK_G_SLOTS).map((id) => byId.get(id) ?? null);
  const origin = url.origin;
  const sheets = slots.flatMap((t, i) => !t?.declared ? [] : [`===== Bank ${slotLabel(i)} =====\n${tankGSheetText(t.name, t.declared, origin, t.id, t.origin === "generated" ? GENERATED_DISCLOSURE : t.anonymous ? "Shared anonymously." : `Shared by @${t.author.handle}.`)}`]);
  const body = sheets.length ? sheets.join("\n\n") : "No saved TANK-G presets yet. Save some from the TANK-G preset library first.";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="tank-g-banks.txt"', "cache-control": "private, no-store" } });
});
