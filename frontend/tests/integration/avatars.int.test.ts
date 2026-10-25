import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; sv: number } } }));
vi.mock("@/auth", () => ({ auth: async () => session.current }));
import { PATCH } from "@/app/api/me/route";
import { syncGooglePhoto } from "@/lib/avatar-sync";
import { avatarPath } from "@/lib/avatars";
import { makeUser, prisma, resetDb } from "./db";

beforeEach(async () => { session.current = null; await resetDb(); });

const GOOGLE = "https://lh3.googleusercontent.com/a/photo-one=s96-c";
const patch = (body: unknown) => PATCH(new Request("http://localhost/api/me", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), undefined);
const as = async (data: Record<string, unknown> = {}) => {
  const u = await makeUser();
  await prisma.user.update({ where: { id: u.id }, data });
  session.current = { user: { id: u.id, sv: 0 } };
  return u.id;
};
const image = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id }, select: { image: true } })).image;

describe("choosing an avatar", () => {
  it("switches between a default, the Google photo, the last upload and initials without losing any", async () => {
    const id = await as({ image: GOOGLE, providerImage: GOOGLE, uploadedImage: "/api/media/m1/playback" });
    expect((await patch({ avatar: "preset:basalt-tubes" })).status).toBe(200);
    expect(await image(id)).toBe(avatarPath("basalt-tubes"));
    expect((await patch({ avatar: "upload" })).status).toBe(200);
    expect(await image(id)).toBe("/api/media/m1/playback");
    expect((await patch({ avatar: "google" })).status).toBe(200);
    expect(await image(id)).toBe(GOOGLE);
    expect((await patch({ avatar: "initials" })).status).toBe(200);
    expect(await image(id)).toBeNull();
    const row = await prisma.user.findUniqueOrThrow({ where: { id }, select: { providerImage: true, uploadedImage: true } });
    expect(row).toEqual({ providerImage: GOOGLE, uploadedImage: "/api/media/m1/playback" });
  });

  it("refuses arbitrary images and sources the account doesn't have", async () => {
    const id = await as();
    for (const avatar of ["https://evil.example/x.png", "/avatars/../secrets", "preset:nope"]) expect((await patch({ avatar })).status).toBe(400);
    expect((await patch({ avatar: "google" })).status).toBe(400);
    expect((await patch({ avatar: "upload" })).status).toBe(400);
    expect(await image(id)).toBeNull();
  });

  it("forgets a removed upload, clearing the avatar only if that upload was showing", async () => {
    const shown = await as({ image: "/api/media/m2/playback", uploadedImage: "/api/media/m2/playback" });
    await patch({ avatarMediaId: null });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: shown }, select: { image: true, uploadedImage: true } })).toEqual({ image: null, uploadedImage: null });
    const preset = await as({ image: avatarPath("pedal-echo"), uploadedImage: "/api/media/m3/playback" });
    await patch({ avatarMediaId: null });
    expect(await image(preset)).toBe(avatarPath("pedal-echo"));
  });
});

describe("Google photo on sign-in", () => {
  it("remembers it, follows changes while it's showing, and never overrides another choice", async () => {
    const fresh = await makeUser();
    await prisma.user.update({ where: { id: fresh.id }, data: { image: GOOGLE } });
    await syncGooglePhoto(fresh.id, GOOGLE);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: fresh.id }, select: { providerImage: true } })).toEqual({ providerImage: GOOGLE });
    const next = "https://lh3.googleusercontent.com/a/photo-two=s96-c";
    await syncGooglePhoto(fresh.id, next);
    expect(await image(fresh.id)).toBe(next);

    const chose = await makeUser();
    await prisma.user.update({ where: { id: chose.id }, data: { image: avatarPath("speaker-cone"), providerImage: GOOGLE } });
    await syncGooglePhoto(chose.id, next);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: chose.id }, select: { image: true, providerImage: true } })).toEqual({ image: avatarPath("speaker-cone"), providerImage: next });
    await syncGooglePhoto(chose.id, "https://evil.example/x.png");
    expect(await image(chose.id)).toBe(avatarPath("speaker-cone"));
  });
});
