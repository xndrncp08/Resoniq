import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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
}

// Keys are generated server-side as `${userId}/${uuid}.${ext}`; anything
// else is refused so a bad key can never address a path outside the root.
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.(mp3|wav|flac)$/;

export const CONTENT_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
} as const;
export type AudioExt = keyof typeof CONTENT_TYPES;

function assertKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
}

function contentTypeFor(key: string): string {
  return CONTENT_TYPES[key.split(".").pop() as AudioExt] ?? "application/octet-stream";
}

export function localStorageDriver(root: string): SongStorage {
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
  };
}

function supabaseDriver(): SongStorage {
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
  };
}

let storage: SongStorage | null = null;

export function getStorage(): SongStorage {
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
