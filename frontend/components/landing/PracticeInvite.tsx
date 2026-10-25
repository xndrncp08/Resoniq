import Link from "next/link";
import Icon from "@/components/icons/Icon";

export default function PracticeInvite() {
  return (
    <section aria-labelledby="practice-invite" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
      <div className="panel grille grid overflow-hidden lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col justify-center border-b border-line p-6 sm:p-10 lg:border-b-0 lg:border-r">
          <p className="label-engraved text-signal">Make music today</p>
          <h2 id="practice-invite" className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Your next 15 minutes<br /><span className="text-muted">could sound different.</span></h2>
          <p className="mt-5 max-w-md text-ink-dim">You do not need another piece of gear to move forward. Just a little focus and a reason to pick up your instrument.</p>
          <Link href="/practice" className="focus-ring mt-6 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-signal px-5 text-sm font-semibold text-bg">Enter the practice room <Icon name="chevron-right" size={18} /></Link>
          <p className="mt-3 font-mono text-xs text-muted">Free. No account needed. Your audio stays local.</p>
        </div>
        <ol className="divide-y divide-line" aria-label="A 15-minute session idea">
          {[{ n: "01", time: "5 min", title: "Find the pocket", text: "Set a comfortable pulse. Play one phrase with intention.", href: "/practice" }, { n: "02", time: "5 min", title: "Change one thing", text: "Try a different sound. Listen to how it changes your touch.", href: "/tones" }, { n: "03", time: "5 min", title: "Let someone in", text: "Ask for fresh ears. A good question can unlock the next step.", href: "/new?prompt=feedback" }].map((step) => <li key={step.n}><Link href={step.href} className="focus-ring flex gap-5 p-6 transition-colors hover:bg-white/[0.03] sm:p-8"><span className="pt-1 font-mono text-sm text-copper">{step.n}</span><div className="flex-1"><div className="flex items-baseline justify-between gap-3"><h3 className="font-display text-2xl font-semibold">{step.title}</h3><span className="shrink-0 font-mono text-xs text-muted">{step.time}</span></div><p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p></div></Link></li>)}
        </ol>
      </div>
    </section>
  );
}
