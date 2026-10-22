import Link from "next/link";
import { Avatar, compact } from "@/components/app/ui";

export default function MusicianRow({ u }: { u: { handle: string; name: string | null; image: string | null; bio?: string | null; followerCount?: number } }) {
  return (
    <Link href={`/u/${u.handle}`} className="focus-ring flex items-center gap-3 rounded-2xl p-3 hover:bg-white/[0.03]">
      <Avatar user={u} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body font-medium">{u.name ?? u.handle}</span>
        <span className="block truncate font-mono text-xs text-muted">@{u.handle}{u.followerCount !== undefined && ` · ${compact(u.followerCount)} followers`}</span>
        {u.bio && <span className="mt-0.5 line-clamp-1 block font-body text-sm text-ink-dim">{u.bio}</span>}
      </span>
    </Link>
  );
}
