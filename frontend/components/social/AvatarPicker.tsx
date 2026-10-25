"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Avatar } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import { avatarPath, DEFAULT_AVATARS, type AvatarChoice } from "@/lib/avatars";

type Sources = { upload: string | null; google: string | null };
type User = { handle: string; name: string | null; image: string | null };

function choiceFor(image: string | null, sources: Sources): AvatarChoice | null {
  if (!image) return "initials";
  if (image === sources.upload) return "upload";
  if (image === sources.google) return "google";
  const preset = DEFAULT_AVATARS.find((a) => avatarPath(a.id) === image);
  return preset ? `preset:${preset.id}` : null;
}

function Option({ selected, label, onSelect, disabled, children }: { selected: boolean; label: string; onSelect: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onSelect}
      className={`focus-ring tap-clean relative rounded-full p-0.5 transition-transform duration-150 hover:scale-105 disabled:opacity-50 motion-reduce:transition-none ${selected ? "ring-2 ring-copper ring-offset-2 ring-offset-surface" : "ring-1 ring-line"}`}
    >
      {children}
    </button>
  );
}

/**
 * Choose what the profile shows: an uploaded photo, the Google account photo,
 * initials, or one of Resoniq's own avatars. Switching is instant (and undone
 * if the server refuses); uploads and the Google photo stay available.
 */
export default function AvatarPicker({ user, sources, upload, onChange }: { user: User; sources: Sources; upload?: React.ReactNode; onChange: (image: string | null) => void }) {
  const router = useRouter();
  const [image, setImage] = useState(user.image);
  const current = choiceFor(image, sources);
  const resolve = (c: AvatarChoice) => (c === "initials" ? null : c === "upload" ? sources.upload : c === "google" ? sources.google : avatarPath(c.slice(7) as never));
  const mutation = useMutation({
    scope: { id: "avatar" },
    mutationFn: (choice: AvatarChoice) => api<{ profile: { image: string | null } }>("/api/me", { method: "PATCH", body: { avatar: choice } }),
    onMutate: (choice) => {
      const previous = image;
      const next = resolve(choice);
      setImage(next);
      onChange(next);
      return previous;
    },
    onError: (_e, _c, previous) => {
      if (previous === undefined) return;
      setImage(previous);
      onChange(previous);
    },
    onSuccess: ({ profile }) => {
      setImage(profile.image);
      onChange(profile.image);
      router.refresh();
    },
  });
  const pick = (c: AvatarChoice) => c !== current && mutation.mutate(c);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar user={{ ...user, image }} size={88} />
        <div className="min-w-0 space-y-2">
          <p className="font-body text-sm text-ink">Profile picture</p>
          <p className="font-body text-xs text-muted">Shown on your posts, comments, profile and in communities.</p>
          {upload}
        </div>
      </div>

      <div role="radiogroup" aria-label="Your photos" className="flex flex-wrap items-center gap-3">
        {sources.upload && (
          <Option selected={current === "upload"} label="Your uploaded photo" onSelect={() => pick("upload")}>
            <Avatar user={{ ...user, image: sources.upload }} size={52} />
          </Option>
        )}
        {sources.google && (
          <Option selected={current === "google"} label="Your Google photo" onSelect={() => pick("google")}>
            <Avatar user={{ ...user, image: sources.google }} size={52} />
          </Option>
        )}
        <Option selected={current === "initials"} label="Your initials" onSelect={() => pick("initials")}>
          <Avatar user={{ ...user, image: null }} size={52} />
        </Option>
      </div>

      <div>
        <p className="label-engraved mb-3">Resoniq avatars</p>
        <div role="radiogroup" aria-label="Resoniq avatars" className="grid grid-cols-5 gap-2.5 sm:grid-cols-10">
          {DEFAULT_AVATARS.map((a) => (
            <Option key={a.id} selected={current === `preset:${a.id}`} label={a.label} onSelect={() => pick(`preset:${a.id}`)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- small static files from /public */}
              <img src={avatarPath(a.id)} alt="" width={48} height={48} loading="lazy" decoding="async" className="aspect-square w-full rounded-full object-cover" />
            </Option>
          ))}
        </div>
        <p className="mt-2 font-body text-xs text-muted">Rendered from the amps, cabinets and pedals in the Amp Studio.</p>
      </div>
      <p role="status" aria-live="polite" className="font-body text-sm">
        {mutation.isPending ? <span className="text-muted">Saving…</span> : mutation.error ? <span className="text-danger">{errorMessage(mutation.error)} Your previous picture is back.</span> : mutation.isSuccess ? <span className="text-signal">Profile picture updated.</span> : null}
      </p>
    </div>
  );
}
