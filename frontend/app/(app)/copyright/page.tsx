import type { Metadata } from "next";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Copyright & takedowns" };

export default function CopyrightPage() {
  return (
    <article className="mx-auto max-w-[720px] space-y-6 font-body text-[15px] leading-relaxed text-ink-dim">
      <PageHeader eyebrow="Policy" title="Copyright & takedowns" />
      <p>Resoniq is for musicians sharing their own playing and their own setups. Covers and lessons are welcome; uploading someone else&apos;s recording as your own is not.</p>
      <h2 className="font-display text-xl font-semibold text-ink">If your work was posted without permission</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Open the post (or the profile) and choose <span className="text-ink">Report → Copyright: it&apos;s my work</span>.</li>
        <li>Describe the work you own and where the original is published. A moderator reviews every copyright report.</li>
        <li>If the claim holds up, the media is removed straight away and the uploader is notified. Removed files are kept for 30 days so a mistaken takedown can be reversed, then deleted permanently.</li>
      </ol>
      <h2 className="font-display text-xl font-semibold text-ink">If your upload was removed</h2>
      <p>You&apos;ll get a notification with the reason. If you believe it was a mistake (it&apos;s your recording, or you have a license), file an <a href="/appeals" className="text-copper hover:underline">appeal</a> within 30 days. A different moderator reviews it.</p>
      <h2 className="font-display text-xl font-semibold text-ink">Repeat infringement</h2>
      <p>Accounts with repeated, upheld copyright removals are suspended or banned.</p>
      <p className="text-sm text-muted">Formal legal notices can be sent to the operator of this Resoniq instance. Reports filed in the app are the fastest route.</p>
    </article>
  );
}
