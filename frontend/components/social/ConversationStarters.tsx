import Link from "next/link";
import { POST_PROMPTS } from "@/lib/post-prompts";

export default function ConversationStarters() {
  return (
    <section aria-label="Start a musical conversation" className="grid gap-2 sm:grid-cols-3">
      {POST_PROMPTS.map((p) => <Link key={p.id} href={`/new?prompt=${p.id}`} className="focus-ring rounded-2xl border border-line bg-surface/40 p-4 transition-colors hover:border-copper/50"><span className="block font-display text-base font-semibold text-ink">{p.label} <span className="text-copper" aria-hidden>↗</span></span><span className="mt-1 block text-xs leading-relaxed text-muted">{p.description}</span></Link>)}
    </section>
  );
}
