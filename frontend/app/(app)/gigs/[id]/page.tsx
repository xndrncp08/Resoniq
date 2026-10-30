import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SetlistEditor from "@/components/gigs/SetlistEditor";
import { getSetlist } from "@/lib/setlists";
import { requirePageUserId } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Setlist", robots: { index: false } };

export default async function SetlistPage({ params }: Props) {
  const { id } = await params;
  const userId = await requirePageUserId(`/gigs/${id}`);
  const setlist = await getSetlist(userId, id);
  if (!setlist) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/gigs" className="focus-ring font-body text-sm text-muted hover:text-ink">← All setlists</Link>
      <SetlistEditor key={setlist.id} userId={userId} initial={setlist} />
    </div>
  );
}
