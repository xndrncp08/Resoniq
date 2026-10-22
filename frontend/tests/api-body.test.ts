import { describe, expect, it, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { readJson } from "@/lib/api";

describe("bounded JSON bodies", () => {
  it("accepts JSON with a charset and counts UTF-8 bytes", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: '{"text":"é"}' });
    expect(await readJson(request, 13)).toEqual({ text: "é" });
  });
  it("rejects lookalike media types", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/jsonp" }, body: "{}" });
    await expect(readJson(request)).rejects.toMatchObject({ status: 415 });
  });
  it("cancels an oversized stream before buffering the rest, even with a false content-length", async () => {
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(8)); }, cancel });
    const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body, duplex: "half" } as RequestInit);
    await expect(readJson(request, 12)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
    expect(reads).toBeLessThan(5);
  });
  it("rejects malformed or missing JSON", async () => {
    for (const body of ["[1]", "no", ""]) {
      await expect(readJson(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body }))).rejects.toMatchObject({ status: 400 });
    }
  });
});
