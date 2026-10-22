import { NextResponse } from "next/server";
import { enforceRateLimit, optionalActor, route } from "@/lib/api";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { searchAll, searchCommunities, searchGearItems, searchMusicians, searchPosts, searchTones, SEARCH_PAGE, SEARCH_TYPES, type SearchType } from "@/lib/search";

/** ?q= &type=posts|tones|musicians|communities|gear (omit for a mix) &page= */
export const GET = route("search", async (req) => {
  enforceRateLimit("social-read", clientIp(req), RATE_LIMITS.socialRead);
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });
  const viewer = await optionalActor();
  const type = p.get("type") as SearchType | null;
  const offset = Math.max(0, Math.min(500, (Number(p.get("page")) || 0) * SEARCH_PAGE));
  if (!type || !SEARCH_TYPES.includes(type)) return NextResponse.json(await searchAll(q, viewer?.id ?? null));
  const items = await {
    posts: () => searchPosts(q, viewer?.id ?? null, offset),
    tones: () => searchTones(q, viewer?.id ?? null, offset),
    musicians: () => searchMusicians(q, offset),
    communities: () => searchCommunities(q, offset),
    gear: () => searchGearItems(q, offset),
  }[type]();
  return NextResponse.json({ items });
});
