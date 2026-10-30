import { describe, expect, it } from "vitest";
import { conversationKeys, conversationsQuery } from "@/lib/queries/conversations";
import { toneKeys, versionKeys } from "@/lib/queries/tones";
import { canvasKeys } from "@/lib/queries/canvases";
import { riffKeys } from "@/lib/queries/riffs";
import { setlistKeys } from "@/lib/queries/setlists";
import { studioKeys } from "@/lib/queries/studio";

// Invalidation works by key prefix: every per-member cache must sit under ["user", userId, ...] so signing out clears it,
// and each collection's lists under its own prefix so one invalidation reaches every filter.
describe("query keys", () => {
  it("scope personal data to the member", () => {
    for (const key of [conversationKeys.list("u", "PROJECT"), versionKeys.tone("u", "t"), canvasKeys.one("u", "c"), riffKeys.one("u", "r"), setlistKeys.one("u", "s"), studioKeys.presets("u")]) expect(key.slice(0, 2)).toEqual(["user", "u"]);
    expect(toneKeys.similar("t")[0]).toBe("tones");
  });

  it("share one cache for the same list wherever it's used", () => {
    expect(conversationsQuery("u", "PROJECT").queryKey).toEqual(["user", "u", "conversations", "PROJECT"]);
    expect(conversationKeys.list("u", "PROJECT").slice(0, 3)).toEqual(conversationKeys.all("u"));
    expect(riffKeys.list("u", { tag: "x" }).slice(0, 4)).toEqual([...riffKeys.all("u"), "list"]);
    expect(canvasKeys.list("u", "p").slice(0, 4)).toEqual([...canvasKeys.all("u"), "list"]);
  });
});
