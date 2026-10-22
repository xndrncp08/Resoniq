"use client";

import Link from "next/link";
import InfiniteList from "@/components/social/InfiniteList";
import { Avatar } from "@/components/app/ui";

type U = { id: string; handle: string; name: string | null; image: string | null };

export default function UserList({ endpoint, initial, cursor }: { endpoint: string; initial: U[]; cursor: string | null }) {
  return (
    <InfiniteList
      endpoint={endpoint}
      initial={initial}
      initialCursor={cursor}
      className="panel divide-y divide-line"
      empty={<p className="font-body text-muted">Nobody here yet.</p>}
      render={(u) => (
        <Link href={`/u/${u.handle}`} className="focus-ring flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
          <Avatar user={u} size={40} />
          <span className="min-w-0"><span className="block truncate font-body font-medium">{u.name ?? u.handle}</span><span className="font-mono text-xs text-muted">@{u.handle}</span></span>
        </Link>
      )}
    />
  );
}
