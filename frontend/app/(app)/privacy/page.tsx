import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Privacy", description: "What Resoniq stores, why, who processes it, and how to delete it." };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[720px] space-y-6 font-body text-[15px] leading-relaxed text-ink-dim">
      <PageHeader eyebrow="Policy" title="Privacy" />
      <p className="font-mono text-xs text-muted">Last updated 26 October 2026</p>
      <p>Resoniq is a community for musicians. This page describes what this Resoniq instance actually stores and why. There are no ads, no third-party analytics or tracking scripts, and no data is sold.</p>

      <H>What we store</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><span className="text-ink">Account:</span> when you sign in with Google, your Google account ID, email address, name and profile picture. If you sign up with email instead, your email and a salted password hash.</li>
        <li><span className="text-ink">Profile and content:</span> your handle, bio, instruments and genres; the posts, comments, tones, rigs, uploads and songs you share; and your saves, follows, votes, bookmarks and community memberships.</li>
        <li><span className="text-ink">Safety records:</span> reports, appeals, moderation decisions and an administrative audit log, so actions on the platform can be reviewed.</li>
        <li><span className="text-ink">Rate limiting:</span> your IP address, used as a counter key to stop abuse. Counters expire within their window and are deleted daily.</li>
        <li><span className="text-ink">Cookies:</span> only essential, first-party cookies that keep you signed in, protect forms and remember your privacy choice. No advertising, analytics or cross-site cookies. Every one is listed in the <Link href="/cookies" className="text-copper underline underline-offset-2">cookie policy</Link>.</li>
      </ul>

      <H>On your device</H>
      <p>If you allow on-device preferences, Resoniq remembers your display settings, metronome, gear profile, unsent post drafts, practice notes and TANK-G bank plans in this browser&apos;s local storage, separate from your account and never sent to us. They can be read by other people using the same browser profile. If you don&apos;t allow it, they last only for your visit. Change this any time in <Link href="/cookies" className="text-copper underline underline-offset-2">Cookie settings</Link>; turning it off deletes what&apos;s stored. Deleting your account doesn&apos;t clear another browser&apos;s storage, so clear site data on shared devices.</p>
      <p>The <Link href="/practice" className="text-copper underline underline-offset-2">practice room</Link> and the Amp Studio play audio files and microphone input locally in your browser without uploading them.</p>

      <H>Who processes it</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><span className="text-ink">Vercel</span> hosts the app (United States).</li>
        <li><span className="text-ink">Supabase</span> hosts the database and private file storage (United States).</li>
        <li><span className="text-ink">Render</span> runs the audio analysis engine; songs you analyze are sent there for processing (United States).</li>
        <li><span className="text-ink">Google</span> handles Google sign-in.</li>
        <li><span className="text-ink">Resend</span> delivers account emails, when email delivery is enabled.</li>
      </ul>

      <H>Who can see what</H>
      <p>Your profile, public posts and public tones are visible to anyone. Unlisted tones are visible to anyone with the link; private tones and your uploaded songs are visible only to you. Moderators and administrators can see reported content and account status to keep the community safe.</p>

      <H>Deleting your data</H>
      <p>You can delete your account in <Link href="/settings" className="text-copper underline underline-offset-2 hover:text-copper-soft">Settings</Link>. That removes your account, profile, posts, comments, tones, songs, uploads, saves, follows, votes, reports and appeals in one step, and queues your stored files for deletion. Media removed after a copyright report is kept for 30 days so a mistaken takedown can be reversed, then deleted. The administrative audit log keeps its records with your account detached.</p>

      <H>Your rights</H>
      <p>Depending on where you live (for example, in Canada under PIPEDA and Quebec&apos;s Law 25, or in the EU and UK under the GDPR), you may have the right to access, correct, delete or move your information, and to withdraw consent. You can do most of this yourself: edit your profile and content, change cookie choices, and delete your account in Settings. For anything else, contact the operator of this Resoniq instance.</p>

      <H>Questions</H>
      <p className="text-sm text-muted">Privacy requests can be sent to the operator of this Resoniq instance. See also <Link href="/terms" className="text-copper underline underline-offset-2 hover:text-copper-soft">Terms</Link> and <Link href="/copyright" className="text-copper underline underline-offset-2 hover:text-copper-soft">Copyright &amp; takedowns</Link>.</p>
    </article>
  );
}
