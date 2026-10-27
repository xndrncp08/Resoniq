"use client";

import { api } from "@/lib/client-api";

export type UploadKind = "VIDEO" | "AUDIO" | "IMAGE";
export type UploadPurpose = "POST" | "AVATAR" | "BANNER" | "MESSAGE";

// Mirrors lib/media/limits.ts for instant feedback; the server enforces the real limits.
const MAX: Record<UploadKind, number> = { VIDEO: 500 * 1024 ** 2, AUDIO: 50 * 1024 ** 2, IMAGE: 15 * 1024 ** 2 };
const LABEL: Record<UploadKind, string> = { VIDEO: "Videos can be up to 500 MB.", AUDIO: "Audio can be up to 50 MB.", IMAGE: "Images can be up to 15 MB." };

export function kindOf(file: File): UploadKind | null {
  const t = file.type;
  if (t.startsWith("video/")) return "VIDEO";
  if (t.startsWith("audio/")) return "AUDIO";
  if (t === "image/jpeg" || t === "image/png" || t === "image/webp") return "IMAGE";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "m4v", "webm", "mkv"].includes(ext)) return "VIDEO";
  if (["mp3", "wav", "flac", "m4a", "aac"].includes(ext)) return "AUDIO";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "IMAGE";
  return null;
}

export function precheck(file: File): string | null {
  const kind = kindOf(file);
  if (!kind) return "That file type isn't supported. Use MP4/MOV/WebM video, MP3/WAV/FLAC/M4A audio, or JPEG/PNG/WebP images.";
  if (file.size > MAX[kind]) return LABEL[kind];
  return null;
}

type Created = { id: string; upload: { method: string; url: string; headers: Record<string, string> } };

/**
 * Uploads one file: reserve → PUT the bytes (progress via XHR, which fetch can't report) → complete.
 * Resolves with the media id once the server has queued processing.
 */
export async function uploadFile(file: File, opts: { purpose?: UploadPurpose; alt?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<string> {
  const kind = kindOf(file);
  if (!kind) throw new Error(precheck(file) ?? "Unsupported file.");
  const created = await api<Created>("/api/media", { body: { kind, size: file.size, mime: file.type, purpose: opts.purpose ?? "POST", alt: opts.alt } });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(created.upload.method, created.upload.url);
    for (const [k, v] of Object.entries(created.upload.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "Upload failed.";
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        // not JSON (e.g. storage provider error page)
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("The connection dropped during upload. Try again."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
  await api(`/api/media/${created.id}/complete`, { method: "POST" });
  return created.id;
}
