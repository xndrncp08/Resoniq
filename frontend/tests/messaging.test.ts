import { describe, expect, it } from "vitest";
import { parseInvite, parseMessage } from "@/lib/messaging";
import { parseProfilePatch } from "@/lib/profile-validation";

describe("message input", () => {
  it("needs text or a recording, and caps attachments", () => {
    expect(parseMessage({ body: "  hi  " })).toEqual({ body: "hi", mediaIds: [], replyToId: null });
    expect(parseMessage({ body: "", mediaIds: ["m1", "m1"] }).mediaIds).toEqual(["m1"]);
    expect(() => parseMessage({ body: "   " })).toThrow();
    expect(() => parseMessage({ body: "x", mediaIds: ["a", "b", "c", "d", "e"] })).toThrow();
    expect(() => parseMessage({ body: "x".repeat(4001) })).toThrow();
    expect(() => parseMessage({ body: "x", replyToId: 5 })).toThrow();
  });

  it("invites need a project name and keep fields short", () => {
    expect(parseInvite({ title: " EP ", role: "", when: "May" })).toEqual({ title: "EP", role: null, when: "May", where: null, note: null });
    expect(() => parseInvite({ title: "" })).toThrow();
    expect(() => parseInvite({ title: "x".repeat(81) })).toThrow();
    expect(() => parseInvite({ title: "EP", role: 7 })).toThrow();
  });
});

describe("portfolio and messaging settings", () => {
  it("availability runs to the end of the chosen day, for up to a year", () => {
    const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    expect(parseProfilePatch({ availableUntil: day }).availableUntil?.toISOString()).toBe(`${day}T23:59:59.999Z`);
    expect(parseProfilePatch({ availableUntil: null }).availableUntil).toBeNull();
    expect(() => parseProfilePatch({ availableUntil: "2020-01-01" })).toThrow();
    expect(() => parseProfilePatch({ availableUntil: new Date(Date.now() + 400 * 86_400_000).toISOString() })).toThrow();
    expect(() => parseProfilePatch({ availableUntil: "soon" })).toThrow();
  });

  it("checks years, highlights and the messaging setting", () => {
    expect(parseProfilePatch({ playingSince: "2012", highlights: [" Toured  Japan ", ""], dmPolicy: "FOLLOWING" })).toEqual({ playingSince: 2012, highlights: ["Toured Japan"], dmPolicy: "FOLLOWING" });
    expect(() => parseProfilePatch({ playingSince: 1800 })).toThrow();
    expect(() => parseProfilePatch({ playingSince: new Date().getFullYear() + 1 })).toThrow();
    expect(() => parseProfilePatch({ highlights: Array.from({ length: 7 }, (_, i) => `h${i}`) })).toThrow();
    expect(() => parseProfilePatch({ highlights: ["<b>x</b>"] })).toThrow();
    expect(() => parseProfilePatch({ dmPolicy: "ANYONE" })).toThrow();
  });
});
