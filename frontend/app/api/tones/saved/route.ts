import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { savedTones } from "@/lib/tones";

export const GET = route("tones.saved", async (req) => {
  const actor = await requireActor();
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await savedTones(actor.id, decodeCursor(p.get("cursor")), parseLimit(p.get("limit"))));
});
