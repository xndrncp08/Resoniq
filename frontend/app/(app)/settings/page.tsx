import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { isSuspended } from "@/lib/authz";
import { mediaCapabilities } from "@/lib/hosting";
import { PageHeader } from "@/components/app/ui";
import { DangerZone, ProfileForm } from "@/components/social/SettingsForms";
import { ResendVerification } from "@/components/auth/TokenForms";
import { mailConfigured } from "@/lib/mailer";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requirePageActor("/settings");
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { handle: true, name: true, image: true, bannerUrl: true, bio: true, instruments: true, genres: true, links: true, email: true, emailVerified: true, passwordHash: true, createdAt: true, uploadedImage: true, providerImage: true },
  });
  const links = Array.isArray(u.links) ? (u.links as { label: string; url: string }[]) : [];
  return (
    <div className="mx-auto max-w-[760px] space-y-8">
      <PageHeader eyebrow="Settings" title="Your account" />
      {isSuspended(actor) && (
        <p className="panel border-amber/40 p-4 font-body text-sm text-amber">
          Your account is suspended{actor.suspendedUntil ? ` until ${actor.suspendedUntil.toISOString().slice(0, 10)}` : ""}. You can still browse. <a href="/appeals?type=ACCOUNT" className="underline">Appeal</a>
        </p>
      )}
      <section className="space-y-3"><h2 className="font-display text-xl font-semibold">Profile</h2><ProfileForm
        // Only profile fields reach the browser (never the email, hash or verification state).
        initial={{ handle: u.handle, name: u.name, image: u.image, bannerUrl: u.bannerUrl, bio: u.bio, instruments: u.instruments, genres: u.genres, links }}
        avatarSources={{ upload: u.uploadedImage, google: u.providerImage }}
        imagesEnabled={(await mediaCapabilities()).images}
      /></section>
      <section className="panel space-y-2 p-5">
        <h2 className="font-display text-lg font-semibold">Sign-in</h2>
        <p className="font-body text-sm text-muted">Email: <span className="text-ink">{u.email ?? "—"}</span> {u.email && (u.emailVerified ? <span className="text-signal">· verified</span> : <span className="text-amber">· not verified</span>)}</p>
        {u.email && !u.emailVerified && u.passwordHash && mailConfigured() && <ResendVerification />}
        {u.passwordHash && <p className="font-body text-sm text-muted">Forgot your password? <a href="/forgot" className="text-copper hover:underline">Reset it by email</a>. Resetting signs you out everywhere.</p>}
        <p className="font-body text-sm text-muted">Member since {u.createdAt.toLocaleDateString("en", { month: "long", year: "numeric" })}. Your email is never shown on your profile.</p>
      </section>
      <section className="panel space-y-2 p-5">
        <h2 className="font-display text-lg font-semibold">Privacy</h2>
        <ul className="list-disc space-y-1 pl-5 font-body text-sm text-muted">
          <li>Tones are unlisted by default: viewable by link, never listed until you make them public.</li>
          <li>Uploaded audio for analysis is private to you; only the recipe is shared when you share a tone.</li>
          <li>Photos are re-encoded on upload, which strips location and camera metadata.</li>
        </ul>
      </section>
      <DangerZone handle={u.handle} hasPassword={!!u.passwordHash} />
    </div>
  );
}
