import Link from "next/link";
import Icon from "@/components/icons/Icon";
import { compact } from "@/components/app/ui";
import { featured } from "@/lib/admin/curation";
import MusicianRow from "@/components/social/MusicianRow";
import PostCard from "@/components/social/PostCard";
import ToneCard from "@/components/tone/ToneCard";

/** Staff-curated picks for a placement. Renders nothing until something is featured and still public. */
export default async function FeaturedStrip({ placement, viewerId }: { placement: "LANDING" | "HOME" | "EXPLORE"; viewerId: string | null }) {
  const f = await featured(placement, viewerId);
  if (!f.posts.length && !f.tones.length && !f.users.length && !f.communities.length) return null;
  return (
    <section aria-labelledby={`featured-${placement}`} className="space-y-4">
      <h2 id={`featured-${placement}`} className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight"><Icon name="spotlight" size={22} className="text-copper" /> Featured</h2>
      {f.posts.length > 0 && <div className="grid gap-4 lg:grid-cols-2">{f.posts.map((p) => <PostCard key={p.id} post={p} signedIn={!!viewerId} />)}</div>}
      {f.tones.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{f.tones.map((t) => <ToneCard key={t.id} tone={t} />)}</div>}
      {f.users.length > 0 && <div className="panel grid p-2 sm:grid-cols-2 lg:grid-cols-3">{f.users.map((u) => <MusicianRow key={u.id} u={u} />)}</div>}
      {f.communities.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {f.communities.map((c) => <Link key={c.id} href={`/c/${c.slug}`} className="focus-ring panel p-4 hover:border-copper/40"><span className="font-display text-lg font-semibold">{c.name}</span><span className="block font-mono text-xs text-muted">{compact(c.memberCount)} members</span></Link>)}
        </div>
      )}
    </section>
  );
}
