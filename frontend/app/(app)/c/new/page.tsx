import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { canCreateCommunity, MAX_CREATED_PER_30_DAYS, MIN_ACCOUNT_AGE_DAYS } from "@/lib/communities";
import { EmptyState, LinkButton, PageHeader } from "@/components/app/ui";
import CommunityForm from "@/components/social/CommunityForm";

export const metadata: Metadata = { title: "Start a community" };

export default async function NewCommunityPage() {
  const actor = await requirePageActor("/c/new");
  const eligible = await canCreateCommunity(actor);
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader eyebrow="New community" title="Start a community">
        You&apos;ll be its first moderator. Accounts can create communities after {MIN_ACCOUNT_AGE_DAYS} days, up to {MAX_CREATED_PER_30_DAYS} every 30 days, and Resoniq staff review every new one.
      </PageHeader>
      {eligible.ok ? <CommunityForm /> : <EmptyState icon="community" title="Not yet" action={<LinkButton href="/c">Browse communities</LinkButton>}>{eligible.reason}</EmptyState>}
    </div>
  );
}
