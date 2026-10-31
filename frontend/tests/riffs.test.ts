import { describe, expect, it } from "vitest";
import { extForMime, sniffRiffAudio } from "@/lib/riffs/sniff";
import { computePeaks, recorderMime } from "@/lib/riffs/peaks";
import { parseRiffPatch, parseTakeStart } from "@/lib/riffs/service";

const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("riff audio sniffing", () => {
  it("recognises browser recordings and audio files from their bytes", () => {
    expect(sniffRiffAudio(bytes([0x1a, 0x45, 0xdf, 0xa3], "....webm"))?.ext).toBe("webm");
    expect(sniffRiffAudio(bytes([0x1a, 0x45, 0xdf, 0xa3], "....matroska"))).toBeNull();
    expect(sniffRiffAudio(bytes("OggS", [0, 2]))?.ext).toBe("ogg");
    expect(sniffRiffAudio(bytes([0, 0, 0, 0x18], "ftypiso5", [0, 0]))?.ext).toBe("m4a");
    expect(sniffRiffAudio(bytes([0, 0, 0, 0x18], "ftypqt  "))).toBeNull();
    expect(sniffRiffAudio(bytes("RIFF", [0, 0, 0, 0], "WAVE"))?.ext).toBe("wav");
    expect(sniffRiffAudio(bytes("ID3", [3, 0]))?.ext).toBe("mp3");
    expect(sniffRiffAudio(bytes("<html><script>"))).toBeNull();
    expect(sniffRiffAudio(bytes([0x89], "PNG"))).toBeNull();
  });

  it("maps declared types to storage extensions, ignoring codec parameters", () => {
    expect(extForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extForMime("audio/mp4")).toBe("m4a");
    expect(extForMime("audio/x-wav")).toBe("wav");
    expect(extForMime("text/html")).toBeNull();
  });
});

describe("waveform peaks and recorder format", () => {
  it("scales the loudest slice to 1 and handles silence and short input", () => {
    const s = new Float32Array(1200).map((_, i) => (i < 600 ? 0.25 : -0.5));
    const p = computePeaks(s, 4);
    expect(p).toEqual([0.5, 0.5, 1, 1]);
    expect(computePeaks(new Float32Array(10), 120).every((v) => v === 0)).toBe(true);
    expect(computePeaks(new Float32Array(0))).toEqual([]);
  });

  it("prefers MP4/AAC (plays on every device), falls back to WebM Opus (Firefox), and admits when it can't record", () => {
    expect(recorderMime(() => true)).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(recorderMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(recorderMime((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(recorderMime(() => false)).toBeNull();
  });
});

describe("riff validation", () => {
  it("normalises tags and refuses bad values with readable messages", () => {
    expect(parseRiffPatch({ title: " Drop  D idea ", tags: ["Verse", "verse", "drop d"] }, { create: true })).toEqual({ title: "Drop D idea", tags: ["verse", "drop-d"] });
    expect(() => parseRiffPatch({ title: "" }, { create: true })).toThrow(/name/);
    expect(() => parseRiffPatch({ tags: ["<b>"] })).toThrow(/Tags/);
    expect(() => parseRiffPatch({ key: "H" })).toThrow(/key/);
    expect(() => parseRiffPatch({ stage: "VIRAL" })).toThrow(/stage/);
    expect(() => parseRiffPatch({})).toThrow(/Nothing/);
  });

  it("checks take uploads before any bytes are sent", () => {
    expect(parseTakeStart({ size: 1000, mime: "audio/webm;codecs=opus", durationSec: 12.34, peaks: [0, 0.5, 1] })).toMatchObject({ ext: "webm", durationSec: 12.3, peaks: [0, 0.5, 1] });
    expect(() => parseTakeStart({ size: 26 * 1024 * 1024, mime: "audio/webm" })).toThrow(/25 MB/);
    expect(() => parseTakeStart({ size: 10, mime: "application/pdf" })).toThrow(/format/);
    expect(() => parseTakeStart({ size: 10, mime: "audio/wav", durationSec: 9999 })).toThrow(/10 minutes/);
    expect(() => parseTakeStart({ size: 10, mime: "audio/wav", peaks: [2] })).toThrow(/peaks/);
  });
});

describe("waveform downsampling", () => {
  it("keeps the loudest of each group and leaves short waveforms alone", async () => {
    const { downsample } = await import("@/components/riffs/TakePlayer");
    expect(downsample([0.1, 0.9, 0.2, 0.3], 2)).toEqual([0.9, 0.3]);
    expect(downsample([0.5, 1], 64)).toEqual([0.5, 1]);
    expect(downsample(Array.from({ length: 120 }, (_, i) => i / 119), 64)).toHaveLength(64);
  });
});
