import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import StageView from "@/components/gigs/StageView";
import { getSetlist } from "@/lib/setlists";
import { requirePageUserId } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Gig Mode", robots: { index: false } };

export default async function StagePage({ params }: Props) {
  const { id } = await params;
  const userId = await requirePageUserId(`/gigs/${id}/stage`);
  const setlist = await getSetlist(userId, id);
  if (!setlist) notFound();
  if (setlist.items.length === 0) redirect(`/gigs/${id}`);
  return <StageView setlist={setlist} />;
}
