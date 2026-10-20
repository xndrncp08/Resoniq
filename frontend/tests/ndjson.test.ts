import { describe, expect, it } from "vitest";
import { readNdjson } from "@/lib/ndjson";

function streamOf(chunks: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((s) => c.enqueue(enc.encode(s)));
      c.close();
    },
  });
}

describe("readNdjson", () => {
  it("emits each line as it completes, across chunk boundaries and without a trailing newline", async () => {
    const seen: unknown[] = [];
    await readNdjson(streamOf(['{"a":1}\n{"b"', ':2}\n\n{"c":', "3}"]), (e) => seen.push(e));
    expect(seen).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it("handles multi-byte characters split between chunks", async () => {
    const bytes = new TextEncoder().encode('{"t":"Pick attack — é"}\n');
    const cut = bytes.length - 4;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, cut));
        c.enqueue(bytes.slice(cut));
        c.close();
      },
    });
    const seen: unknown[] = [];
    await readNdjson(body, (e) => seen.push(e));
    expect(seen).toEqual([{ t: "Pick attack — é" }]);
  });
});
