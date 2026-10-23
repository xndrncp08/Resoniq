import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/lib/session";
import { getTone } from "@/lib/tones";
import { PageHeader } from "@/components/app/ui";
import ToneEditor from "@/components/tone/ToneEditor";

export const metadata: Metadata = { title: "Edit tone", robots: { index: false } };

export default async function EditTonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageActor(`/t/${id}/edit`);
  const tone = await getTone(id, actor.id);
  if (!tone || !tone.viewer.isOwner) notFound();
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader eyebrow="Edit tone" title={tone.name} />
      <ToneEditor tone={{ id: tone.id, name: tone.name, description: tone.description, visibility: tone.visibility, rig: tone.declared, hasInferred: !!tone.inferred, generated: tone.origin === "generated" }} />
    </div>
  );
}
