import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RiffEditor from "@/components/riffs/RiffEditor";
import { getRiff } from "@/lib/riffs/service";
import { requirePageUserId } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Riff", robots: { index: false } };

export default async function RiffPage({ params }: Props) {
  const { id } = await params;
  const userId = await requirePageUserId(`/riffs/${id}`);
  const riff = await getRiff(userId, id);
  if (!riff) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/riffs" className="focus-ring font-body text-sm text-muted hover:text-ink">← Riff Vault</Link>
      <RiffEditor key={riff.id} userId={userId} initial={riff} />
    </div>
  );
}
