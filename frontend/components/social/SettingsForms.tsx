"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button, IconButton } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import { uploadFile } from "@/lib/upload-client";
import { INSTRUMENTS, INSTRUMENT_LABEL } from "@/lib/instruments";
import AvatarPicker from "@/components/social/AvatarPicker";

export type ProfileValues = { handle: string; name: string | null; image: string | null; bannerUrl: string | null; bio: string | null; instruments: string[]; genres: string[]; links: { label: string; url: string }[] };

const field = "panel-inset mt-2 w-full rounded-xl px-3 font-body text-[15px] outline-none focus:border-copper/60";

/** Uploads an image, waits for the worker to finish it, and returns the media id. */
async function uploadImage(file: File, purpose: "AVATAR" | "BANNER", onProgress: (p: number) => void): Promise<string> {
  const id = await uploadFile(file, { purpose, onProgress });
  for (let i = 0; i < 60; i++) {
    const { media } = await api<{ media: { status: string; error: string | null } }>(`/api/media/${id}`);
    if (media.status === "READY") return id;
    if (media.status === "FAILED") throw new Error(media.error ?? "That image couldn't be processed.");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Processing is taking longer than usual. Try again in a minute.");
}

export function ProfileForm({ initial, avatarSources, imagesEnabled = true }: { initial: ProfileValues; avatarSources: { upload: string | null; google: string | null }; imagesEnabled?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [genres, setGenres] = useState(initial.genres.join(", "));
  const [state, setState] = useState<{ busy: boolean; msg: string | null; error: string | null }>({ busy: false, msg: null, error: null });
  const [imgProgress, setImgProgress] = useState<string | null>(null);
  const [sources, setSources] = useState(avatarSources);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true, msg: null, error: null });
    try {
      const { profile } = await api<{ profile: ProfileValues }>("/api/me", {
        method: "PATCH",
        body: { name: v.name, handle: v.handle, bio: v.bio, instruments: v.instruments, genres: genres.split(",").map((g) => g.trim()).filter(Boolean), links: v.links.filter((l) => l.url.trim()) },
      });
      setV(profile);
      setState({ busy: false, msg: "Saved.", error: null });
      router.refresh();
    } catch (err) {
      setState({ busy: false, msg: null, error: errorMessage(err) });
    }
  }

  async function pickImage(purpose: "AVATAR" | "BANNER", file?: File) {
    if (!file) return;
    setImgProgress(purpose === "AVATAR" ? "Uploading photo…" : "Uploading banner…");
    try {
      const id = await uploadImage(file, purpose, (p) => setImgProgress(`${purpose === "AVATAR" ? "Photo" : "Banner"} ${Math.round(p * 100)}%`));
      const { profile } = await api<{ profile: ProfileValues }>("/api/me", { method: "PATCH", body: purpose === "AVATAR" ? { avatarMediaId: id } : { bannerMediaId: id } });
      setV((cur) => ({ ...cur, image: profile.image, bannerUrl: profile.bannerUrl }));
      if (purpose === "AVATAR") setSources((cur) => ({ ...cur, upload: profile.image }));
      setImgProgress(null);
      router.refresh();
    } catch (err) {
      setImgProgress(errorMessage(err));
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="panel overflow-hidden">
        <div className="relative h-32 bg-gradient-to-br from-copper-deep/60 via-surface to-signal-dim/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v.bannerUrl && <img src={v.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {imagesEnabled && <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-black/60 px-3 py-1.5 font-body text-xs text-ink backdrop-blur hover:bg-black/80">
            Change banner<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickImage("BANNER", e.target.files?.[0])} />
          </label>}
        </div>
        <div className="p-4 sm:p-5">
          <AvatarPicker
            // Remount when an upload lands, so the picker starts from the new photo.
            key={sources.upload ?? "none"}
            user={v}
            sources={sources}
            onChange={(image) => setV((cur) => ({ ...cur, image }))}
            upload={
              <div className="flex flex-wrap items-center gap-2">
                {imagesEnabled ? (
                  <label className="focus-within:ring-2 focus-within:ring-signal cursor-pointer rounded-full border border-line-strong px-4 py-2 font-body text-sm hover:border-copper/50">
                    Upload a photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickImage("AVATAR", e.target.files?.[0])} />
                  </label>
                ) : (
                  <span className="font-body text-xs text-muted">Photo uploads aren&apos;t available on this deployment yet.</span>
                )}
                {sources.upload && (
                  <button type="button" className="focus-ring rounded-full px-2 py-1 font-body text-sm text-muted hover:text-danger" onClick={async () => { await api("/api/me", { method: "PATCH", body: { avatarMediaId: null } }); setSources((cur) => ({ ...cur, upload: null })); setV((cur) => ({ ...cur, image: cur.image === sources.upload ? null : cur.image })); router.refresh(); }}>
                    Remove uploaded photo
                  </button>
                )}
                {imgProgress && <span role="status" className="font-body text-sm text-muted">{imgProgress}</span>}
              </div>
            }
          />
        </div>
      </div>

      <div className="panel grid gap-4 p-5 sm:grid-cols-2">
        <label className="block"><span className="label-engraved">Display name</span><input value={v.name ?? ""} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={100} className={`${field} h-11`} /></label>
        <label className="block"><span className="label-engraved">Handle</span><div className="relative"><span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 font-mono text-muted">@</span><input value={v.handle} onChange={(e) => setV({ ...v, handle: e.target.value.toLowerCase() })} pattern="[a-z0-9_]{3,30}" required className={`${field} h-11 pl-7 font-mono`} /></div></label>
        <label className="block sm:col-span-2"><span className="label-engraved">Bio</span><textarea value={v.bio ?? ""} onChange={(e) => setV({ ...v, bio: e.target.value })} rows={3} maxLength={500} className={`${field} py-2`} /></label>
        <fieldset className="sm:col-span-2">
          <legend className="label-engraved mb-2">Instruments (up to 4)</legend>
          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((k) => {
              const on = v.instruments.includes(k);
              return <button key={k} type="button" aria-pressed={on} disabled={!on && v.instruments.length >= 4} onClick={() => setV({ ...v, instruments: on ? v.instruments.filter((i) => i !== k) : [...v.instruments, k] })} className={`focus-ring rounded-full border px-3 py-2 font-body text-sm disabled:opacity-40 ${on ? "border-copper bg-copper/10" : "border-line text-muted"}`}>{INSTRUMENT_LABEL[k]}</button>;
            })}
          </div>
          <p className="mt-2 font-body text-xs text-muted">Your instruments and genres are public and help other musicians find you. Use your bio for a specific instrument or tradition.</p>
        </fieldset>
        <label className="block sm:col-span-2"><span className="label-engraved">Genres, comma separated</span><input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="blues, shoegaze, prog" className={`${field} h-11`} /></label>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="label-engraved mb-2">Links</legend>
          {v.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input value={l.label} onChange={(e) => setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" aria-label="Link label" maxLength={40} className="panel-inset h-10 w-32 rounded-xl px-3 font-body text-sm" />
              <input value={l.url} onChange={(e) => setV({ ...v, links: v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://" aria-label="Link URL" type="url" className="panel-inset h-10 flex-1 rounded-xl px-3 font-body text-sm" />
              <IconButton icon="close" label="Remove link" onClick={() => setV({ ...v, links: v.links.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {v.links.length < 5 && <Button size="sm" icon="plus" onClick={() => setV({ ...v, links: [...v.links, { label: "", url: "" }] })}>Add link</Button>}
        </fieldset>
      </div>
      {state.error && <p role="alert" className="font-body text-sm text-danger">{state.error}</p>}
      {state.msg && <p role="status" className="font-body text-sm text-signal">{state.msg}</p>}
      <Button type="submit" variant="primary" disabled={state.busy}>{state.busy ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}

export function DangerZone({ handle, hasPassword }: { handle: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/me", { method: "DELETE", body: { confirmHandle: confirm, password: hasPassword ? password : undefined } });
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <section className="panel border-danger/30 p-5">
      <h2 className="font-display text-lg font-semibold text-danger">Delete account</h2>
      <p className="mt-1 font-body text-sm text-muted">Deletes your profile, posts, comments, tones, uploads and analyses. Files are removed from storage shortly after. This can&apos;t be undone.</p>
      {!open ? (
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>Delete my account…</Button>
      ) : (
        <form onSubmit={remove} className="mt-4 space-y-3">
          <label className="block"><span className="font-body text-sm">Type <span className="font-mono">@{handle}</span> to confirm</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${field} h-11 font-mono`} autoComplete="off" /></label>
          {hasPassword && <label className="block"><span className="font-body text-sm">Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} h-11`} autoComplete="current-password" /></label>}
          {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
          <div className="flex gap-2"><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="danger" disabled={busy || confirm.replace(/^@/, "").toLowerCase() !== handle}>{busy ? "Deleting…" : "Delete forever"}</Button></div>
        </form>
      )}
    </section>
  );
}
