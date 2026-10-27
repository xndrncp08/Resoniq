"use client";

import { useRef, useState } from "react";
import Icon from "@/components/icons/Icon";
import { Button, IconButton } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";
import type { UploadPurpose } from "@/lib/upload-client";
import { kindOf, precheck, uploadFile } from "@/lib/upload-client";

export type UploadItem = { key: string; file: File; progress: number; state: "uploading" | "done" | "error"; mediaId?: string; error?: string; preview?: string };

/**
 * Attachments for the composer: drop or pick files, watch progress, retry or
 * remove. Reports the finished media ids (in order) through onChange.
 */
export type UploadKinds = { images: boolean; video: boolean; audio: boolean; note: string | null };

export default function Uploader({ max = 10, onChange, kinds = { images: true, video: true, audio: true, note: null }, purpose = "POST", compact = false }: { max?: number; onChange: (ids: string[], busy: boolean) => void; kinds?: UploadKinds; purpose?: UploadPurpose; compact?: boolean }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());

  const publish = (next: UploadItem[]) => onChange(next.flatMap((i) => (i.state === "done" && i.mediaId ? [i.mediaId] : [])), next.some((i) => i.state === "uploading"));
  const update = (key: string, patch: Partial<UploadItem>) =>
    setItems((prev) => {
      const next = prev.map((i) => (i.key === key ? { ...i, ...patch } : i));
      publish(next);
      return next;
    });

  function start(item: UploadItem) {
    const ctrl = new AbortController();
    aborts.current.set(item.key, ctrl);
    uploadFile(item.file, { purpose, onProgress: (p) => update(item.key, { progress: p }), signal: ctrl.signal })
      .then((mediaId) => update(item.key, { state: "done", mediaId, progress: 1 }))
      .catch((err) => (err as Error).name !== "AbortError" && update(item.key, { state: "error", error: errorMessage(err) }));
  }

  function add(files: FileList | File[]) {
    const room = max - items.length;
    const fresh = [...files].slice(0, Math.max(0, room)).map<UploadItem>((file) => {
      const kind = kindOf(file);
      const allowed = kind === "IMAGE" ? kinds.images : kind === "VIDEO" ? kinds.video : kind === "AUDIO" ? kinds.audio : true;
      const problem = allowed ? precheck(file) : (kinds.note ?? "That kind of file can't be posted right now.");
      return {
        key: crypto.randomUUID(),
        file,
        progress: 0,
        state: problem ? "error" : "uploading",
        error: problem ?? undefined,
        preview: kindOf(file) === "IMAGE" ? URL.createObjectURL(file) : undefined,
      };
    });
    setItems((prev) => {
      const next = [...prev, ...fresh];
      publish(next);
      return next;
    });
    fresh.filter((i) => i.state === "uploading").forEach(start);
  }

  function remove(key: string) {
    aborts.current.get(key)?.abort();
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      publish(next);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {compact ? (
        <>
          <Button size="sm" variant="ghost" icon="upload" onClick={() => input.current?.click()} disabled={items.length >= max} aria-label="Attach a recording or photo">Attach</Button>
          <input ref={input} type="file" multiple hidden accept={[kinds.video && "video/mp4,video/quicktime,video/webm,.mkv", kinds.audio && "audio/*", "image/jpeg,image/png,image/webp"].filter(Boolean).join(",")} onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
        </>
      ) : (
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`panel-inset grille flex flex-col items-center gap-3 rounded-2xl border-dashed px-4 py-8 text-center transition-colors ${drag ? "border-copper bg-copper/5" : ""}`}
      >
        <span className="flex gap-2 text-copper">{kinds.video && <Icon name="video" size={26} />}{kinds.audio && <Icon name="audio" size={26} />}<Icon name="image" size={26} /></span>
        <p className="font-body text-sm text-ink-dim">{kinds.video ? "Drop a performance video, an audio clip or photos of your board" : "Drop photos of your rig or board"}</p>
        <p className="font-mono text-[11px] text-muted">{[kinds.video && "Video ≤ 500 MB / 10 min", kinds.audio && "Audio ≤ 50 MB", "Images ≤ 15 MB"].filter(Boolean).join(" · ")} · up to {max} files</p>
        {kinds.note && <p className="max-w-md font-body text-xs text-amber">{kinds.note}</p>}
        <Button size="sm" icon="upload" onClick={() => input.current?.click()} disabled={items.length >= max}>Choose files</Button>
        <input ref={input} type="file" multiple hidden accept={[kinds.video && "video/mp4,video/quicktime,video/webm,.mkv", kinds.audio && "audio/*", "image/jpeg,image/png,image/webp"].filter(Boolean).join(",")} onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>
      )}
      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="panel flex items-center gap-3 rounded-2xl p-2.5">
              {i.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.preview} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <span className="panel-inset flex h-12 w-12 items-center justify-center rounded-xl text-copper"><Icon name={kindOf(i.file) === "AUDIO" ? "audio" : "video"} /></span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm">{i.file.name}</p>
                {i.state === "error" ? (
                  <p className="font-body text-xs text-danger">{i.error}</p>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(i.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${i.file.name}`}>
                      <div className={`h-full rounded-full transition-[width] ${i.state === "done" ? "bg-signal" : "bg-copper"}`} style={{ width: `${Math.round(i.progress * 100)}%` }} />
                    </div>
                    <span className="w-24 text-right font-mono text-[11px] text-muted">{i.state === "done" ? "processing next" : `${Math.round(i.progress * 100)}%`}</span>
                  </div>
                )}
              </div>
              {i.state === "error" && kindOf(i.file) && !precheck(i.file) && (
                <IconButton icon="arrow-up" label="Retry upload" size={34} onClick={() => { update(i.key, { state: "uploading", progress: 0, error: undefined }); start(i); }} />
              )}
              <IconButton icon="close" label={`Remove ${i.file.name}`} size={34} onClick={() => remove(i.key)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
