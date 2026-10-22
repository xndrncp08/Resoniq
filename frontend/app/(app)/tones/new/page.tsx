import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { PageHeader } from "@/components/app/ui";
import ToneEditor from "@/components/tone/ToneEditor";

export const metadata: Metadata = { title: "Share a rig" };

export default async function NewTonePage() {
  await requirePageActor("/tones/new");
  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader eyebrow="New tone" title="Share your rig">Describe the setup you actually play. No analysis needed, and nothing here is required.</PageHeader>
      <ToneEditor tone={{ id: null, name: "", description: null, visibility: "PUBLIC", rig: null, hasInferred: false }} />
    </div>
  );
}
