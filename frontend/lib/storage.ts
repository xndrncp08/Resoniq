import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getSupabaseAdmin, SONGS_BUCKET } from "@/lib/supabase";

/**
 * Where uploaded songs live. Audio is only ever read back on the server —
 * by GET /api/songs/[id]/audio (owner-checked) and by /api/analyze — so the
 * Supabase bucket can and should be private.
 *
 * RESONIQ_STORAGE picks the driver: "supabase", or "local" (files under
 * RESONIQ_LOCAL_STORAGE_DIR, default ./.storage). Unset, Supabase is used
 * when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, local otherwise.
 * Local storage is per-machine and not backed up: fine for development or
 * a single host with a persistent volume, wrong for anything scaled out.
 */

export type StoredObject = { bytes: Buffer; contentType: string };

export interface SongStorage {
  readonly driver: "supabase" | "local";
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
  /** Size in bytes, or null when the object doesn't exist. */
  stat(key: string): Promise<{ size: number } | null>;
  /** Copies an object to a local file (the worker processes media from disk). */
  downloadTo(key: string, file: string): Promise<void>;
  uploadFrom(key: string, file: string, contentType: string): Promise<void>;
}

/** Local disk: uploads stream through the app, reads support byte ranges. */
export interface LocalStorage extends SongStorage {
  readonly driver: "local";
  /** Streams a body to storage, failing (and leaving nothing behind) past maxBytes. Returns the byte count. */
  putStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<number>;
  readStream(key: string, range?: { start: number; end: number }): ReadableStream<Uint8Array>;
}

/** Supabase: the browser uploads to a signed URL and media is served through short-lived signed URLs. */
export interface RemoteStorage extends SongStorage {
  readonly driver: "supabase";
  createUploadUrl(key: string): Promise<string>;
  signedUrl(key: string, ttlS: number): Promise<string>;
}

// Keys are generated server-side; anything else is refused so a bad key can
// never address a path outside the root.
//   songs: `${userId}/${uuid}.${ext}`
//   media: `media/${userId}/${mediaId}/${variant}.${ext}`
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.(mp3|wav|flac)$/;
const MEDIA_KEY_PATTERN = /^media\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/[a-z0-9_-]{1,32}\.(mp4|mov|webm|mkv|jpg|png|webp|m4a|mp3|wav|flac|json)$/;

export const CONTENT_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
} as const;
export type AudioExt = keyof typeof CONTENT_TYPES;

const MEDIA_TYPES: Record<string, string> = {
  ...CONTENT_TYPES,
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  m4a: "audio/mp4",
  json: "application/json",
};

export const isValidKey = (key: string) => KEY_PATTERN.test(key) || MEDIA_KEY_PATTERN.test(key);

function assertKey(key: string) {
  if (!isValidKey(key)) throw new Error(`Invalid storage key: ${key}`);
}

export function contentTypeFor(key: string): string {
  return MEDIA_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";
}

export class UploadTooLarge extends Error {}

export function localStorageDriver(root: string): LocalStorage {
  const fileFor = (key: string) => {
    assertKey(key);
    const file = path.resolve(root, key);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return file;
  };
  return {
    driver: "local",
    async put(key, bytes) {
      const file = fileFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: "wx" });
    },
    async get(key) {
      try {
        return { bytes: await readFile(fileFor(key)), contentType: contentTypeFor(key) };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async remove(key) {
      await rm(fileFor(key), { force: true });
    },
    async stat(key) {
      try {
        return { size: (await stat(fileFor(key))).size };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async downloadTo(key, file) {
      await copyFile(fileFor(key), file);
    },
    async uploadFrom(key, file) {
      const dest = fileFor(key);
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(file, dest);
    },
    async putStream(key, body, maxBytes) {
      const dest = fileFor(key);
      await mkdir(path.dirname(dest), { recursive: true });
      // Write to a temp name and rename on success, so a cut-off upload never looks complete.
      const tmp = `${dest}.part`;
      let bytes = 0;
      const cap = new Transform({
        transform(chunk: Buffer, _enc, done) {
          bytes += chunk.length;
          done(bytes > maxBytes ? new UploadTooLarge("Upload exceeds its size limit.") : null, chunk);
        },
      });
      try {
        await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>), cap, createWriteStream(tmp, { flags: "wx" }));
        await rename(tmp, dest);
        return bytes;
      } catch (err) {
        await rm(tmp, { force: true });
        throw err;
      }
    },
    readStream(key, range) {
      return Readable.toWeb(createReadStream(fileFor(key), range)) as ReadableStream<Uint8Array>;
    },
  };
}

function supabaseDriver(): RemoteStorage {
  const bucket = () => getSupabaseAdmin().storage.from(SONGS_BUCKET);
  return {
    driver: "supabase",
    async put(key, bytes, contentType) {
      assertKey(key);
      const { error } = await bucket().upload(key, bytes, { contentType });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    },
    async get(key) {
      assertKey(key);
      const { data, error } = await bucket().download(key);
      if (error) {
        const { code, status } = error as { code?: string; status?: number };
        if (code === "NoSuchKey" || status === 404) return null;
        throw new Error(`Supabase download failed: ${error.message}`);
      }
      return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type || contentTypeFor(key) };
    },
    async remove(key) {
      assertKey(key);
      const { error } = await bucket().remove([key]);
      if (error) throw new Error(`Supabase delete failed: ${error.message}`);
    },
    async stat(key) {
      assertKey(key);
      const dir = key.slice(0, key.lastIndexOf("/"));
      const name = key.slice(key.lastIndexOf("/") + 1);
      const { data, error } = await bucket().list(dir, { search: name, limit: 1 });
      if (error) throw new Error(`Supabase stat failed: ${error.message}`);
      const hit = data?.find((o) => o.name === name);
      return hit ? { size: Number((hit.metadata as { size?: number } | null)?.size ?? 0) } : null;
    },
    // shortcut: Supabase downloads are buffered in memory (fine to ~500 MB per worker); stream via signed URL if that's too much.
    async downloadTo(key, file) {
      const obj = await this.get(key);
      if (!obj) throw new Error(`Missing object: ${key}`);
      await writeFile(file, obj.bytes);
    },
    async uploadFrom(key, file, contentType) {
      assertKey(key);
      const { error } = await bucket().upload(key, await readFile(file), { contentType, upsert: true });
      if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    },
    async createUploadUrl(key) {
      assertKey(key);
      const { data, error } = await bucket().createSignedUploadUrl(key);
      if (error || !data) throw new Error(`Supabase signed upload failed: ${error?.message}`);
      return data.signedUrl;
    },
    async signedUrl(key, ttlS) {
      assertKey(key);
      const { data, error } = await bucket().createSignedUrl(key, ttlS);
      if (error || !data) throw new Error(`Supabase signed URL failed: ${error?.message}`);
      return data.signedUrl;
    },
  };
}

let storage: LocalStorage | RemoteStorage | null = null;

export function getStorage(): LocalStorage | RemoteStorage {
  if (!storage) {
    const configured = process.env.RESONIQ_STORAGE;
    const useSupabase =
      configured === "supabase" ||
      (!configured && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    // turbopackIgnore: this is a runtime data directory; without the hint the
    // build traces the whole project into the standalone output.
    const localRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.RESONIQ_LOCAL_STORAGE_DIR ?? ".storage");
    storage = useSupabase ? supabaseDriver() : localStorageDriver(localRoot);
  }
  return storage;
}

/**
 * Identifies MP3/WAV/FLAC from the first bytes, so a renamed file of any
 * other kind is refused before it reaches storage or the engine.
 */
export function sniffAudio(bytes: Uint8Array): AudioExt | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (bytes.length >= 4 && ascii(0, 4) === "fLaC") return "flac";
  if (bytes.length >= 3 && ascii(0, 3) === "ID3") return "mp3";
  // Bare MPEG audio frame: 11 sync bits, then a valid version and layer III.
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x18) !== 0x08 && (bytes[1] & 0x06) === 0x02) {
    return "mp3";
  }
  return null;
}
