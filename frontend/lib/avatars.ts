/**
 * Default profile pictures: original renders of Resoniq's own 3D equipment
 * (knobs, tubes, speakers, pedals), made in the avatar lab (app/avatar-lab)
 * and served from /public/avatars. Only these paths, someone's own processed
 * upload, or their Google photo can ever be set as an avatar.
 */
export const DEFAULT_AVATARS = [
  { id: "halcyon-knob", label: "Halcyon chicken-head knob" },
  { id: "basalt-knob", label: "Basalt knurled knob" },
  { id: "kintsugi-knob", label: "Kintsugi lacquer knob" },
  { id: "lumen-knob", label: "Lumen aluminium knob" },
  { id: "prism-knob", label: "Prism glass knob" },
  { id: "halcyon-tubes", label: "Tubes behind a laser-cut grille" },
  { id: "basalt-tubes", label: "Tubes behind hex steel" },
  { id: "lumen-tubes", label: "Tubes behind aluminium slats" },
  { id: "prism-glow", label: "Frosted glass, lit from within" },
  { id: "kintsugi-seam", label: "A gold kintsugi seam" },
  { id: "halcyon-power", label: "A red rocker switch" },
  { id: "basalt-panel", label: "Basalt's brushed panel" },
  { id: "speaker-cone", label: "A speaker cone" },
  { id: "speaker-mic", label: "A mic on the speaker" },
  { id: "pedal-ember", label: "Ember Drive pedal" },
  { id: "pedal-tidepool", label: "Tidepool chorus pedal" },
  { id: "pedal-orbit", label: "Orbit phaser pedal" },
  { id: "pedal-echo", label: "Echo Room delay pedal" },
  { id: "input-jack", label: "Input jack and cable" },
  { id: "lumen-panel", label: "Lumen's aluminium panel" },
] as const;

export type DefaultAvatarId = (typeof DEFAULT_AVATARS)[number]["id"];
export const avatarPath = (id: DefaultAvatarId) => `/avatars/${id}.webp`;
export const isDefaultAvatar = (id: string): id is DefaultAvatarId => DEFAULT_AVATARS.some((a) => a.id === id);
export const isDefaultAvatarPath = (url: string | null | undefined) => !!url && DEFAULT_AVATARS.some((a) => avatarPath(a.id) === url);

/** A Google account photo URL, as Google sign-in provides it. */
export const isGooglePhoto = (url: unknown): url is string => typeof url === "string" && url.length <= 2048 && /^https:\/\/lh3\.googleusercontent\.com\//.test(url);

/** What the avatar picker can switch to. Validated server-side against the account's own sources. */
export type AvatarChoice = "initials" | "google" | "upload" | `preset:${DefaultAvatarId}`;

export function parseAvatarChoice(v: unknown): AvatarChoice | null {
  if (v === "initials" || v === "google" || v === "upload") return v;
  if (typeof v === "string" && v.startsWith("preset:") && isDefaultAvatar(v.slice(7))) return v as AvatarChoice;
  return null;
}
