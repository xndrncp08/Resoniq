import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { listConversations } from "@/lib/messaging";
import { EmptyState, LinkButton, PageHeader, Tabs } from "@/components/app/ui";
import ConversationList from "@/components/messages/ConversationList";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

type Props = { searchParams: Promise<{ view?: string }> };

export default async function MessagesPage({ searchParams }: Props) {
  const actor = await requirePageActor("/messages");
  const kind = (await searchParams).view === "projects" ? "PROJECT" : null;
  const items = await listConversations(actor.id, kind ? { kind } : {});
  return (
    <div className="mx-auto max-w-[760px] space-y-5">
      <PageHeader eyebrow="Messages" title="Talk shop">Private conversations, collaboration invites and the projects that come out of them. Only the people in a conversation can see it.</PageHeader>
      <Tabs label="Messages" items={[{ href: "/messages", label: "All", active: !kind }, { href: "/messages?view=projects", label: "Projects", active: kind === "PROJECT" }]} />
      <ConversationList userId={actor.id} kind={kind} initial={items} />
      {!items.length && (
        <EmptyState icon={kind ? "users" : "comment"} title={kind ? "No projects yet" : "No conversations yet"} action={<LinkButton href="/musicians" variant="primary">Find musicians</LinkButton>}>
          {kind ? "Invite someone to collaborate from their profile. When they accept, your shared project starts here." : "Message a musician or invite them to collaborate from their profile."}
        </EmptyState>
      )}
    </div>
  );
}
