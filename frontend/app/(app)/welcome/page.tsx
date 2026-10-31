import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/icons/Icon";
import { LinkButton } from "@/components/app/ui";
import InterestsStep from "@/components/onboarding/InterestsStep";
import MusicianRow from "@/components/social/MusicianRow";
import ToggleButton from "@/components/social/ToggleButton";
import { onboardingSteps, welcomeMusicians } from "@/lib/onboarding";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

const FIRST_THINGS: { href: string; icon: IconName; title: string; body: string }[] = [
  { href: "/riffs", icon: "mic", title: "Record a riff", body: "Catch an idea on your phone or laptop mic. It stays private until you share it." },
  { href: "/studio", icon: "amp", title: "Dial in a tone", body: "Build a rig in Amp Studio and play through it, then save it to your vault." },
  { href: "/new?prompt=progress", icon: "edit", title: "Say hello", body: "Post what you're working on or ask for a second pair of ears." },
];

export default async function WelcomePage() {
  const userId = await requirePageUserId("/welcome");
  const [steps, people] = await Promise.all([onboardingSteps(userId), welcomeMusicians(userId)]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="label-engraved mb-2">Getting started · {steps.done} of {steps.total} done</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome to Resoniq</h1>
        <p className="mt-2 max-w-xl font-body text-ink-dim">Three quick steps so the feed, the music and the people you see fit how you play. Skip any of them; this page stays here for later.</p>
      </header>
      <ol className="space-y-4">
        <Step n={1} title="What do you play?" done={steps.interests}>
          <InterestsStep instruments={steps.instruments} genres={steps.genres} />
        </Step>
        <Step n={2} title="Follow a few musicians" done={steps.follows}>
          {people.length ? (
            <ul className="divide-y divide-line">
              {people.map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><MusicianRow u={u} /></div>
                  {u.shared.length > 0 && <span className="hidden font-mono text-xs text-muted sm:inline">also into {u.shared.slice(0, 2).join(", ")}</span>}
                  <ToggleButton url={`/api/users/${u.handle}/follow`} initial={u.viewerFollows} on="Following" off="Follow" signedIn size="sm" />
                </li>
              ))}
            </ul>
          ) : <p className="font-body text-sm text-muted">No one else is here yet. Invite a bandmate, or check <Link className="text-copper" href="/musicians">Musicians</Link> later.</p>}
          <p className="mt-3 font-body text-xs text-muted">Their posts and releases show up in your Following feed. <Link className="text-copper" href="/musicians">Find more musicians</Link></p>
        </Step>
        <Step n={3} title="Make your first thing" done={steps.created}>
          <div className="grid gap-2 sm:grid-cols-3">
            {FIRST_THINGS.map((t) => (
              <Link key={t.href} href={t.href} className="focus-ring rounded-2xl border border-line bg-surface/40 p-4 transition-colors hover:border-copper/50">
                <Icon name={t.icon} size={20} className="text-copper" />
                <span className="mt-2 block font-display text-base font-semibold text-ink">{t.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{t.body}</span>
              </Link>
            ))}
          </div>
        </Step>
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href="/feed" variant={steps.done === steps.total ? "primary" : "secondary"}>{steps.done === steps.total ? "You're set. Go to your feed" : "Go to the feed"}</LinkButton>
        <Link href="/music" className="focus-ring rounded font-body text-sm text-copper">Or listen to new music first</Link>
      </div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <li className="panel p-5" aria-label={`Step ${n}: ${title}${done ? " (done)" : ""}`}>
      <h2 className="mb-4 flex items-center gap-3 font-display text-xl font-semibold">
        <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full border font-mono text-sm ${done ? "border-copper bg-copper/15 text-copper" : "border-line text-muted"}`}>{done ? <Icon name="check" size={16} /> : n}</span>
        {title}
        {done && <span className="font-body text-xs font-normal text-copper">Done</span>}
      </h2>
      {children}
    </li>
  );
}
