import { isEnabled } from "@/lib/flags";
import { mailConfigured } from "@/lib/mailer";

/**
 * What this deployment can actually do. A serverless host (Vercel) has no
 * persistent disk and no long-running worker, so features that need either
 * are switched off honestly instead of leaving uploads stuck.
 *
 *   RESONIQ_MEDIA_WORKER=on|off   whether a worker processes video/audio (default: on, off on Vercel)
 *   Storage is available with Supabase configured, or with local disk off serverless.
 */
export const isServerless = () => !!process.env.VERCEL;

export function storageAvailable(): boolean {
  const supabase = process.env.RESONIQ_STORAGE === "supabase" || (!process.env.RESONIQ_STORAGE && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  return supabase || !isServerless();
}

export function mediaWorkerAvailable(): boolean {
  const v = process.env.RESONIQ_MEDIA_WORKER;
  return v ? v === "on" : !isServerless();
}

/**
 * Public deployments (serverless by default; RESONIQ_REQUIRE_EMAIL_FOR_SIGNUP
 * overrides) keep registration closed until verification email can actually
 * be delivered, and then require verification to publish.
 */
export function emailRequiredForSignup(): boolean {
  const v = process.env.RESONIQ_REQUIRE_EMAIL_FOR_SIGNUP;
  return v ? v === "true" : isServerless();
}

export async function signupsOpen(): Promise<{ open: boolean; reason: string | null }> {
  if (!(await isEnabled("signups"))) return { open: false, reason: "New accounts are paused right now. Try again later." };
  if (emailRequiredForSignup() && !mailConfigured()) return { open: false, reason: "Registration opens soon: we're finishing email verification first. Existing members can sign in." };
  return { open: true, reason: null };
}

export type MediaCapabilities = { images: boolean; video: boolean; audio: boolean; analysis: boolean; note: string | null };

/** For the UI and the upload routes alike. */
export async function mediaCapabilities(): Promise<MediaCapabilities> {
  const storage = storageAvailable();
  const uploads = storage && (await isEnabled("uploads.enabled"));
  const worker = mediaWorkerAvailable();
  const video = uploads && worker && (await isEnabled("uploads.video"));
  const note = !storage
    ? "Uploads aren't available on this deployment yet. Text posts, tones and rigs work as usual."
    : !uploads
      ? "Uploads are paused right now."
      : !worker
        ? "Video and audio posts are paused on this deployment. Photos, text posts and tones work as usual."
        : null;
  return { images: uploads, video, audio: uploads && worker, analysis: storage && !!process.env.PYTHON_ENGINE_URL, note };
}
