import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { sniffMedia } from "@/lib/media/sniff";
import { isValidKey, localStorageDriver, UploadTooLarge } from "@/lib/storage";
import { ApiError } from "@/lib/api-error";
import { ValidationError } from "@/lib/validation";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const { parseUploadRequest } = await import("@/lib/media/service");

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniffMedia", () => {
  it.each([
    [bytes([0, 0, 0, 0x20], "ftypisom", [0, 0]), { kind: "VIDEO", ext: "mp4" }],
    [bytes([0, 0, 0, 0x14], "ftypqt  "), { kind: "VIDEO", ext: "mov" }],
    [bytes([0, 0, 0, 0x20], "ftypM4A "), { kind: "AUDIO", ext: "m4a" }],
    [bytes([0x1a, 0x45, 0xdf, 0xa3], "....webm"), { kind: "VIDEO", ext: "webm" }],
    [bytes([0x1a, 0x45, 0xdf, 0xa3], "matroska"), { kind: "VIDEO", ext: "mkv" }],
    [bytes([0xff, 0xd8, 0xff, 0xe0]), { kind: "IMAGE", ext: "jpg" }],
    [bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]), { kind: "IMAGE", ext: "png" }],
    [bytes("RIFF", [0, 0, 0, 0], "WEBP"), { kind: "IMAGE", ext: "webp" }],
    [bytes("ID3", [3, 0]), { kind: "AUDIO", ext: "mp3" }],
    [bytes("fLaC"), { kind: "AUDIO", ext: "flac" }],
  ])("recognizes %#", (b, expected) => {
    expect(sniffMedia(b)).toMatchObject(expected);
  });

  it.each([
    ["GIF", bytes("GIF89a")],
    ["Windows executable", bytes("MZ", [0x90, 0])],
    ["HEIC", bytes([0, 0, 0, 0x18], "ftypheic")],
    ["shell script renamed .mp4", bytes("#!/bin/sh\nrm -rf /")],
    ["empty", new Uint8Array()],
  ])("refuses %s", (_n, b) => {
    expect(sniffMedia(b)).toBeNull();
  });
});

describe("parseUploadRequest", () => {
  it("accepts a normal video", () => {
    expect(parseUploadRequest({ kind: "VIDEO", size: 10_000_000, mime: "video/mp4" })).toMatchObject({ kind: "VIDEO", purpose: "POST" });
  });
  it("refuses a 2 GB video before any bytes are sent", () => {
    expect(() => parseUploadRequest({ kind: "VIDEO", size: 2 * 1024 ** 3 })).toThrow(ApiError);
  });
  it.each([
    { kind: "VIDEO", size: 10, mime: "application/x-msdownload" },
    { kind: "PDF", size: 10 },
    { kind: "VIDEO", size: 10, purpose: "AVATAR" },
    { kind: "IMAGE", size: 0 },
    { kind: "IMAGE", size: 1.5 },
  ])("rejects %j", (body) => {
    expect(() => parseUploadRequest(body)).toThrow(ValidationError);
  });
});

describe("storage keys", () => {
  it("accepts generated media keys and refuses traversal", () => {
    expect(isValidKey("media/user1/media1/playback.mp4")).toBe(true);
    expect(isValidKey("user1/0b1c-uuid.flac")).toBe(true);
    expect(isValidKey("media/user1/../../etc/passwd.mp4")).toBe(false);
    expect(isValidKey("media/user1/m1/playback.exe")).toBe(false);
    expect(isValidKey("/abs/path.mp3")).toBe(false);
  });
});

describe("local putStream", () => {
  const roots: string[] = [];
  afterAll(() => Promise.all(roots.map((r) => rm(r, { recursive: true, force: true }))));
  const streamOf = (chunks: number[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const n of chunks) c.enqueue(new Uint8Array(n));
        c.close();
      },
    });

  it("stores up to the cap and leaves nothing behind past it", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "resoniq-put-"));
    roots.push(root);
    const store = localStorageDriver(root);
    expect(await store.putStream("media/u/m1/original.mp4", streamOf([500, 500]), 1000)).toBe(1000);
    expect((await store.stat("media/u/m1/original.mp4"))?.size).toBe(1000);
    await expect(store.putStream("media/u/m2/original.mp4", streamOf([600, 600]), 1000)).rejects.toBeInstanceOf(UploadTooLarge);
    expect(await store.stat("media/u/m2/original.mp4")).toBeNull();
    expect(await readdir(path.join(root, "media/u/m2"))).toEqual([]);
  });
});
