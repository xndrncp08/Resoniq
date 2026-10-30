import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CanvasEditor from "@/components/canvas/CanvasEditor";
import { getCanvas } from "@/lib/canvas/service";
import { requirePageUserId } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Song", robots: { index: false } };

export default async function CanvasPage({ params }: Props) {
  const { id } = await params;
  const userId = await requirePageUserId(`/write/${id}`);
  const canvas = await getCanvas(userId, id);
  if (!canvas) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/write" className="focus-ring font-body text-sm text-muted hover:text-ink">← Songs</Link>
      <CanvasEditor key={canvas.id} userId={userId} initial={canvas} />
    </div>
  );
}
