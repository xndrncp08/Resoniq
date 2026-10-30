import type { Metadata } from "next";
import { PageHeader } from "@/components/app/ui";
import CanvasList from "@/components/canvas/CanvasList";
import { listCanvases } from "@/lib/canvas/service";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Songwriting", robots: { index: false } };

export default async function WritePage() {
  const userId = await requirePageUserId("/write");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Songwriting Canvas" title="Your songs">Lyrics and chords, sections and arrangement, with the riffs they grew from. Private, or shared with a project to write together.</PageHeader>
      <CanvasList userId={userId} initial={await listCanvases(userId)} />
    </div>
  );
}
