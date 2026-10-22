"use client";

import InfiniteList from "@/components/social/InfiniteList";
import ToneCard from "@/components/tone/ToneCard";
import type { ToneView } from "@/lib/tones";
import type { ReactNode } from "react";

export default function ToneGrid({ endpoint, initial, cursor, empty }: { endpoint: string; initial: ToneView[]; cursor: string | null; empty?: ReactNode }) {
  return <InfiniteList endpoint={endpoint} initial={initial} initialCursor={cursor} empty={empty} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" render={(t) => <ToneCard tone={t} />} />;
}
