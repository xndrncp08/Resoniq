import type { Metadata } from "next";
import { PageHeader } from "@/components/app/ui";
import GigList from "@/components/gigs/GigList";
import { listSetlists } from "@/lib/setlists";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Gig Mode", robots: { index: false } };

export default async function GigsPage() {
  const userId = await requirePageUserId("/gigs");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Gig Mode" title="Setlists">Songs in order with tempo, key, the tone to load and stage notes. Open Gig Mode on stage to step through them with big buttons, a page-turner or a MIDI footswitch.</PageHeader>
      <GigList userId={userId} initial={await listSetlists(userId)} />
    </div>
  );
}
