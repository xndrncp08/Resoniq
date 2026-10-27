import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/ui";
import { CookieSettingsButton } from "@/components/consent/Consent";

export const metadata: Metadata = { title: "Cookies", description: "Every cookie and browser storage key Resoniq uses, why, and for how long." };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>;

type Row = { name: string; purpose: string; lasts: string };

// Audited against what the app sets (lib/consent.ts, auth.ts and the localStorage users). Keep in step with them.
const ESSENTIAL: Row[] = [
  { name: "__Secure-authjs.session-token", purpose: "Keeps you signed in. A signed, encrypted, HTTP-only token; large sessions may be split into .0, .1 parts.", lasts: "30 days, renewed while you use Resoniq; removed when you sign out" },
  { name: "__Host-authjs.csrf-token", purpose: "Protects sign-in and sign-out forms against cross-site request forgery.", lasts: "Until you close the browser" },
  { name: "__Secure-authjs.callback-url", purpose: "Returns you to the page you were on after signing in.", lasts: "Until you close the browser" },
  { name: "__Secure-authjs.pkce.code_verifier, __Secure-authjs.state", purpose: "Only during Google sign-in: ties Google's reply to the sign-in you started.", lasts: "Up to 15 minutes" },
  { name: "resoniq_consent", purpose: "Remembers the choices on this page, so we don't ask on every visit.", lasts: "6 months, then we ask again" },
];

const PREFERENCES: Row[] = [
  { name: "resoniq:preferences", purpose: "Display and 3D setting, metronome tempo and volume, and the gear profile used for tone suggestions.", lasts: "Until you change your choice or clear site data" },
  { name: "resoniq:drafts", purpose: "Your unsent post, per account, so it can be restored. Uploads aren't kept.", lasts: "Until you post it, discard it, or clear site data" },
  { name: "resoniq.practice.v1", purpose: "The practice note you save in the practice room.", lasts: "Until you clear it or clear site data" },
  { name: "resoniq:tank-g-banks:v2:…", purpose: "Your TANK-G bank layout, per account.", lasts: "Until you reset it or clear site data" },
];

function Table({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-white/[0.03] font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          <tr><th scope="col" className="px-4 py-2.5 font-medium">Name</th><th scope="col" className="px-4 py-2.5 font-medium">Why</th><th scope="col" className="px-4 py-2.5 font-medium">How long</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.name} className="align-top">
              <th scope="row" className="break-all px-4 py-3 font-mono text-xs font-normal text-ink">{r.name}</th>
              <td className="px-4 py-3">{r.purpose}</td>
              <td className="px-4 py-3 text-muted">{r.lasts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-[760px] space-y-6 font-body text-[15px] leading-relaxed text-ink-dim">
      <PageHeader eyebrow="Policy" title="Cookies and storage" />
      <p className="font-mono text-xs text-muted">Last updated 26 October 2026</p>
      <p>
        Resoniq has no advertising, no analytics and no tracking scripts, and it never sells data. It uses a few essential cookies to keep you signed in and secure. With your permission, it also remembers some settings and unsent work in your browser&apos;s local storage. Everything is listed below, including how long each item lasts.
      </p>
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="font-body text-sm">You can change your choice at any time.</p>
        <CookieSettingsButton className="focus-ring rounded-full bg-copper px-4 py-2 font-body text-sm font-medium text-bg hover:bg-copper-soft" />
      </div>

      <H>Essential (always on)</H>
      <p>Resoniq can&apos;t work without these: they keep you signed in, protect forms and remember your privacy choice. All of them are first-party and HTTP-only where the browser allows it. None of them is used for advertising or to follow you across other sites.</p>
      <Table rows={ESSENTIAL} caption="Essential cookies" />

      <H>On-device preferences (optional)</H>
      <p>This category uses your browser&apos;s local storage, not cookies, and nothing here is sent to our servers. If you turn it off, these features still work during your visit but are forgotten when you leave, and anything already stored is deleted. Other people using the same browser profile can read what&apos;s stored.</p>
      <Table rows={PREFERENCES} caption="On-device preference storage" />

      <H>Analytics (optional, not used)</H>
      <p>Resoniq doesn&apos;t use any analytics or measurement tools today. The setting exists so that if that ever changes, measurement stays off for everyone who hasn&apos;t allowed it. This page would be updated first.</p>

      <H>Other services your browser contacts</H>
      <ul className="list-disc space-y-2 pl-5">
        <li><span className="text-ink">Google</span>: Google sign-in happens on Google&apos;s own pages, under Google&apos;s cookies and privacy policy. Profile photos from Google accounts load from Google&apos;s image servers, without telling Google which Resoniq page you&apos;re on. Like any server, Google can see your IP address.</li>
        <li><span className="text-ink">Supabase storage</span>: uploaded images, audio and video can load directly from our storage provider. No cookies are set for this.</li>
        <li><span className="text-ink">Vercel</span> hosts Resoniq and keeps standard server logs, such as IP addresses and requested pages, to operate and secure the service. Anonymous crash reports from your browser (error, code location and page path only) go to the same logs. They use no cookies or storage.</li>
      </ul>
      <p>Your browser&apos;s own permissions, such as microphone access in the Amp Studio, are separate: you grant them in the browser, and audio from your microphone is processed on your device.</p>

      <H>Your choices and rights</H>
      <p>
        Use Cookie settings on this page, in the footer or in <Link href="/settings" className="text-copper underline underline-offset-2">Settings</Link>. You can also clear this site&apos;s data in your browser, which removes everything listed above and signs you out. Optional categories are off until you turn them on, and turning one off again is as easy as turning it on. Depending on where you live (for example, in Canada under PIPEDA and Quebec&apos;s Law 25, or in the EU and UK under the GDPR and ePrivacy rules), you may also have rights to access, correct or delete your information. The <Link href="/privacy" className="text-copper underline underline-offset-2">Privacy</Link> page explains what we store and how to make a request.
      </p>
    </article>
  );
}
