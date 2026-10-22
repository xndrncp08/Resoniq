import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listFollows } from "@/lib/follows";
import { LinkButton, PageHeader } from "@/components/app/ui";
import UserList from "@/components/social/UserList";

type Props = { params: Promise<{ handle: string; list: string }> };

export const metadata: Metadata = { robots: { index: false } };

export default async function FollowListPage({ params }: Props) {
  const { handle, list } = await params;
  if (list !== "followers" && list !== "following") notFound();
  const page = await listFollows(handle.toLowerCase(), list, null, 30);
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-[620px]">
      <LinkButton href={`/u/${handle}`} variant="ghost" size="sm" icon="chevron-left">@{handle}</LinkButton>
      <PageHeader title={list === "followers" ? "Followers" : "Following"} />
      <UserList endpoint={`/api/users/${handle}/${list}?limit=30`} initial={page.items} cursor={page.nextCursor} />
    </div>
  );
}
