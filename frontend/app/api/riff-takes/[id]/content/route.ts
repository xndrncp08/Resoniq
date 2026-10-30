import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { MAX_TAKE_BYTES, ownTake } from "@/lib/riffs/service";
import { sniffRiffAudio } from "@/lib/riffs/sniff";
import { getStorage, UploadTooLarge } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Local-storage uploads: streamed to disk with a hard byte cap, format checked from the first bytes. */
export const PUT = route<Ctx>("riff-takes.content", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  const storage = getStorage();
  if (storage.driver !== "local") throw new ApiError(404, "Upload directly to storage.");
  const take = await ownTake(actor.id, (await params).id);
  if (take.status !== "UPLOADING" || (await storage.stat(take.storageKey))) throw new ApiError(409, "This take is already uploaded.");
  const cap = Math.min(take.sizeBytes, MAX_TAKE_BYTES);
  if (Number(req.headers.get("content-length")) > cap) throw new ApiError(413, "The recording is larger than declared.");
  if (!req.body) throw new ApiError(400, "Empty upload.");
  const reader = req.body.getReader();
  const first = await reader.read();
  if (first.done || !first.value) throw new ApiError(400, "Empty upload.");
  const sniffed = sniffRiffAudio(first.value);
  if (!sniffed || !take.storageKey.endsWith(`.${sniffed.ext}`)) {
    await reader.cancel();
    throw new ApiError(415, "That file isn't a supported audio recording.");
  }
  const body = new ReadableStream<Uint8Array>({
    start: (c) => c.enqueue(first.value),
    async pull(c) {
      const { done, value } = await reader.read();
      if (done) c.close();
      else c.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  try {
    return NextResponse.json({ ok: true, bytes: await storage.putStream(take.storageKey, body, cap) });
  } catch (err) {
    if (err instanceof UploadTooLarge) throw new ApiError(413, "The recording is larger than declared.");
    throw err;
  }
});
