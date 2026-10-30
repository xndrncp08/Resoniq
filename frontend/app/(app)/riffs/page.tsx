import type { Metadata } from "next";
import { PageHeader } from "@/components/app/ui";
import RiffList from "@/components/riffs/RiffList";
import { listRiffs } from "@/lib/riffs/service";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Riff Vault", robots: { index: false } };

export default async function RiffsPage() {
  const userId = await requirePageUserId("/riffs");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Riff Vault" title="Your ideas">Record a riff the moment it arrives, keep every take, and develop it into a song. Private unless you start a project with it.</PageHeader>
      <RiffList userId={userId} initial={await listRiffs(userId)} />
    </div>
  );
}
