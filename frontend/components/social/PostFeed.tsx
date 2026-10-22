"use client";

import InfiniteList from "@/components/social/InfiniteList";
import PostCard from "@/components/social/PostCard";
import type { PostView } from "@/lib/posts";
import type { ReactNode } from "react";

export default function PostFeed({ endpoint, initial, cursor, signedIn, voteMode = "amp", empty }: { endpoint: string; initial: PostView[]; cursor: string | null; signedIn: boolean; voteMode?: "amp" | "updown"; empty?: ReactNode }) {
  return <InfiniteList endpoint={endpoint} initial={initial} initialCursor={cursor} empty={empty} render={(p) => <PostCard post={p} signedIn={signedIn} voteMode={voteMode} />} />;
}
