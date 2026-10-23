import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/ui";

export const metadata: Metadata = { title: "Terms", description: "The rules for using Resoniq." };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>;

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[720px] space-y-6 font-body text-[15px] leading-relaxed text-ink-dim">
      <PageHeader eyebrow="Policy" title="Terms" />
      <p>By using Resoniq you agree to these terms. They are short on purpose.</p>

      <H>Your account</H>
      <p>Keep your sign-in secure and give accurate information. One person per account. You are responsible for what is posted from your account.</p>

      <H>Your content</H>
      <p>You keep ownership of what you post. You give Resoniq permission to store, display and distribute it on the platform (including previews, search results and share images) for as long as it&apos;s posted. Only post recordings and media you made or have the right to share; see <Link href="/copyright" className="text-copper hover:underline">Copyright &amp; takedowns</Link>.</p>

      <H>Community rules</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>No harassment, hate, threats, spam, or impersonation of real people or brands.</li>
        <li>No content you don&apos;t have the rights to.</li>
        <li>Don&apos;t try to break, overload or scrape the service.</li>
      </ul>
      <p>Moderators can remove content and suspend or ban accounts that break these rules. Decisions can be <Link href="/appeals" className="text-copper hover:underline">appealed</Link>.</p>

      <H>Tones, analysis and generated presets</H>
      <p>Tone settings are starting points, not guarantees. Audio analysis gives heuristic estimates, not verified rigs. Presets labelled <span className="text-ink">Resoniq-generated</span> were written by Resoniq and published under clearly labelled demo creator profiles; they were not recorded or tested on the listed gear. Device knob positions are approximate. Start at low volume when trying any new setting.</p>
      <p>Brand and model names identify gear only. Resoniq isn&apos;t affiliated with, or endorsed by, any manufacturer or artist mentioned.</p>

      <H>No warranty</H>
      <p>Resoniq is provided as is, without warranties. To the extent the law allows, the operator isn&apos;t liable for indirect losses, lost data or damage from using the service or any setting found on it.</p>

      <H>Changes</H>
      <p>These terms may change; the current version is always on this page. Your data is handled as described in the <Link href="/privacy" className="text-copper hover:underline">Privacy</Link> page. You can stop using Resoniq and delete your account at any time.</p>
    </article>
  );
}
