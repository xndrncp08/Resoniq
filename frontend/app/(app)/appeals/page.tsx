import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePageActor } from "@/lib/session";
import { Chip, PageHeader, TimeAgo } from "@/components/app/ui";
import AppealForm from "@/components/social/AppealForm";

export const metadata: Metadata = { title: "Appeals" };

const TYPES = ["POST", "COMMENT", "ACCOUNT", "MEDIA"] as const;

export default async function AppealsPage({ searchParams }: { searchParams: Promise<{ type?: string; id?: string }> }) {
  const sp = await searchParams;
  const actor = await requirePageActor("/appeals");
  const type = TYPES.find((t) => t === sp.type);
  const targetId = type === "ACCOUNT" ? actor.id : sp.id;
  const appeals = await prisma.appeal.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <PageHeader eyebrow="Appeals" title="Ask for a second look">If a moderator removed something of yours or suspended your account, explain why it should be reversed. A different moderator reviews each appeal.</PageHeader>
      {type && targetId && targetId !== "undefined" ? <AppealForm targetType={type} targetId={targetId} /> : <p className="font-body text-sm text-muted">Start an appeal from the moderation notification you received, or from the suspension notice in settings.</p>}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Your appeals</h2>
        {appeals.length ? (
          <ul className="panel divide-y divide-line">
            {appeals.map((a) => (
              <li key={a.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2"><Chip>{a.targetType.toLowerCase()}</Chip><Chip active={a.status === "REVERSED"}>{a.status === "OPEN" ? "in review" : a.status === "REVERSED" ? "reversed" : "upheld"}</Chip><TimeAgo iso={a.createdAt.toISOString()} className="font-mono text-xs text-muted" /></div>
                <p className="font-body text-sm text-ink-dim">{a.body}</p>
                {a.decisionNote && <p className="font-body text-sm"><span className="text-muted">Moderator:</span> {a.decisionNote}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-muted">None.</p>
        )}
      </section>
    </div>
  );
}
