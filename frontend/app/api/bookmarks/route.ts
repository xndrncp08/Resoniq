import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { decodeCursor, parseLimit } from "@/lib/pagination";
import { bookmarksFeed } from "@/lib/posts";

export const GET = route("bookmarks.list", async (req) => {
  const actor = await requireActor();
  const url = new URL(req.url);
  return NextResponse.json(await bookmarksFeed(actor.id, decodeCursor(url.searchParams.get("cursor")), parseLimit(url.searchParams.get("limit"))));
});
