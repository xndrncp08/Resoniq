import Link from "next/link";
import Icon, { type IconName } from "@/components/icons/Icon";
import { Avatar } from "@/components/app/ui";

const QUICK: { href: string; label: string; icon: IconName }[] = [
  { href: "/new?category=PERFORMANCE", label: "Performance", icon: "video" },
  { href: "/new?category=TONE_COMPARISON", label: "Tone A/B", icon: "compare" },
  { href: "/new?prompt=feedback", label: "Ask for feedback", icon: "comment" },
  { href: "/new?prompt=collaboration", label: "Collaborate", icon: "community" },
];

/** The "what are you playing?" bar at the top of the feed. */
export default function ComposerPrompt({ user }: { user: { handle: string; name: string | null; image: string | null } }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={42} />
        <Link href="/new" className="focus-ring panel-inset flex h-11 flex-1 items-center rounded-full px-4 font-body text-[15px] text-muted hover:border-copper/40">
          What are you playing today?
        </Link>
      </div>
      <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1.5 font-body text-sm text-ink-dim hover:border-copper/50 hover:text-ink">
            <Icon name={q.icon} size={16} className="text-copper" /> {q.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
