import Link from "next/link";
import { Avatar } from "@/components/app/ui";

/** The "what are you playing?" bar at the top of the feed. */
export default function ComposerPrompt({ user }: { user: { handle: string; name: string | null; image: string | null } }) {
  return (
    <Link href="/new" className="focus-ring panel flex items-center gap-3 p-3 hover:border-line-strong">
      <Avatar user={user} size={36} />
      <span className="font-body text-[15px] text-muted">What are you playing today?</span>
    </Link>
  );
}
