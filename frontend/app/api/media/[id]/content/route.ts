import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { MEDIA_LIMITS } from "@/lib/media/limits";
import { ownUpload } from "@/lib/media/service";
import { sniffMedia } from "@/lib/media/sniff";
import { getStorage, UploadTooLarge } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Local-storage uploads: the raw body is streamed to disk with a hard byte cap. */
export const PUT = route<Ctx>("media.content", async (req, { params }) => {
  const actor = await requireActor({ write: true });
  const storage = getStorage();
  if (storage.driver !== "local") throw new ApiError(404, "Upload directly to storage.");
  const media = await ownUpload(actor, (await params).id);
  if (media.status !== "UPLOADING") throw new ApiError(409, "This upload is already complete.");
  if (await storage.stat(media.originalKey)) throw new ApiError(409, "This upload is already complete.");
  const declared = Number(req.headers.get("content-length"));
  const cap = Math.min(media.sizeBytes, MEDIA_LIMITS[media.kind].bytes);
  if (Number.isFinite(declared) && declared > cap) throw new ApiError(413, `${MEDIA_LIMITS[media.kind].label}.`);
  if (!req.body) throw new ApiError(400, "Empty upload.");

  // Check the first bytes before accepting the rest, so a mislabelled file fails fast.
  const reader = req.body.getReader();
  const first = await reader.read();
  if (first.done || !first.value) throw new ApiError(400, "Empty upload.");
  const sniffed = sniffMedia(first.value);
  if (!sniffed || sniffed.kind !== media.kind) {
    await reader.cancel();
    throw new ApiError(415, `That file isn't a supported ${media.kind.toLowerCase()} format.`);
  }
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(first.value);
    },
    async pull(c) {
      const { done, value } = await reader.read();
      if (done) c.close();
      else c.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  try {
    const bytes = await storage.putStream(media.originalKey, body, cap);
    return NextResponse.json({ ok: true, bytes });
  } catch (err) {
    if (err instanceof UploadTooLarge) throw new ApiError(413, `${MEDIA_LIMITS[media.kind].label}.`);
    throw err;
  }
});
