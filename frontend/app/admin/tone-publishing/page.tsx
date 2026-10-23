import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import { GENERATED_DISCLOSURE } from "@/lib/tones";
import { INITIAL_IMPORT_CONFIRMATION, INITIAL_PRESET_KEYS } from "@/lib/tone-drafts";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminAction from "@/components/admin/AdminAction";
import ToneDraftReview from "@/components/admin/ToneDraftReview";
import { JsonForm } from "@/components/admin/Forms";
import { Avatar, Chip } from "@/components/app/ui";

export const metadata = { title: "Tone publishing" };
const url = "/api/admin/tone-drafts";

export default async function TonePublishingPage() {
  await requireStaffPage("platform.config");
  const [drafts, creators, communities, control, events] = await Promise.all([
    prisma.toneDraft.findMany({ orderBy: [{ createdAt: "asc" }, { key: "asc" }] }),
    prisma.managedCreator.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.community.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.tonePublishingControl.findUnique({ where: { id: "default" } }),
    prisma.tonePublishingEvent.findMany({ include: { draft: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const initial = drafts.filter(d => INITIAL_PRESET_KEYS.includes(d.key));
  const ready = initial.length === 26 && initial.every(d => d.reviewedAt && ["APPROVED", "PUBLISHED"].includes(d.status));
  const creatorOptions = creators.map(c => ({ id: c.id, name: `${c.user.name ?? c.user.handle}${c.enabled ? "" : " (paused)"}` }));
  return <div className="space-y-8">
    <AdminHeader title="Tone publishing">Review generated starting points, assign Resoniq-managed demo creators and publish useful settings. These identities never sign in and never represent independent musicians.</AdminHeader>
    <section className="panel space-y-4 p-5" aria-label="Publishing controls">
      <p className="text-sm text-muted">{GENERATED_DISCLOSURE}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Chip>Automation {control?.paused !== false ? "paused" : "enabled"}</Chip>
        <AdminAction url={url} body={{ action: "generate" }} label="Generate missing drafts & creators" />
        <AdminAction url={url} body={{ action: "pause", paused: control?.paused === false }} label={control?.paused === false ? "Pause automation" : "Enable automation"} />
      </div>
      <p className="text-sm text-muted">28 presets total. The two acoustic-simulation variations stay outside the 26-tone initial batch. Manual publication is available independently of the daily two-tone automation budget.</p>
      {control?.initialImportAt ? <p className="text-sm text-signal">Initial batch completed {control.initialImportAt.toISOString()}.</p> : <>
        <p className="text-sm">{initial.filter(d => d.reviewedAt).length}/26 initial presets reviewed. Approve each after inspecting its rig and attribution.</p>
        {ready && <AdminAction url={url} body={{ action: "import", confirmation: INITIAL_IMPORT_CONFIRMATION }} label="Publish reviewed initial batch (26)" variant="primary" confirm="Approve the one-time import of these 26 reviewed tones and community posts? The normal two-per-day scheduler limit remains in place." />}
      </>}
    </section>
    <section aria-labelledby="creator-h" className="space-y-3">
      <h2 id="creator-h" className="font-display text-2xl">Managed creators</h2>
      <div className="grid gap-4 md:grid-cols-2">{creators.map(c => <article key={c.id} className="panel space-y-3 p-4">
        <div className="flex gap-3"><Avatar user={c.user} /><div><Link href={`/u/${c.user.handle}`} className="font-semibold hover:underline">{c.user.name}</Link><p className="text-xs text-muted">Owned by {c.owner} · {c.enabled ? "approved" : "paused"} · no login</p></div></div>
        <p className="text-sm text-muted">{c.user.bio}</p>
        <JsonForm key={c.updatedAt.toISOString()} url={url} submit="Save creator" fields={[
          { name: "action", label: "Operation", defaultValue: "creator", type: "hidden" },
          { name: "id", label: "Creator ID", defaultValue: c.id, type: "hidden" },
          { name: "specialization", label: "Specialization", defaultValue: c.specialization, required: true },
          { name: "enabled", label: "Approved for publication", type: "checkbox", checked: c.enabled },
        ]} />
      </article>)}</div>
    </section>
    <section aria-labelledby="draft-h" className="space-y-3">
      <h2 id="draft-h" className="font-display text-2xl">Drafts & published tones</h2>
      {drafts.map(d => <details key={`${d.id}:${d.updatedAt.toISOString()}`} className="panel p-4">
        <summary className="focus-ring cursor-pointer rounded p-1"><span className="font-semibold">{d.name}</span> <span className="font-mono text-xs text-muted">{d.status}{d.removedAt ? " · removed" : ""}</span></summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted">{d.key}{d.scheduledFor && ` · Scheduled after ${d.scheduledFor.toISOString()}`}</p>
          {d.error && <p role="alert" className="text-sm text-danger">{d.error}</p>}
          {d.toneId && <Link href={`/t/${d.toneId}`} className="text-copper hover:underline">View tone</Link>}
          <ToneDraftReview draft={{ id: d.id, name: d.name, description: d.description, rig: d.rig, creatorId: d.creatorId, communityId: d.communityId, status: d.status, removed: !!d.removedAt }} creators={creatorOptions} communities={communities} />
        </div>
      </details>)}
    </section>
    <section aria-labelledby="history-h" className="space-y-3">
      <h2 id="history-h" className="font-display text-2xl">Publishing history</h2>
      <p className="text-sm text-muted">Latest 100 events. Administrator identities and actions are also recorded in the audit log.</p>
      <ol className="divide-y divide-line">{events.map(e => <li key={e.id} className="py-3 text-sm"><time className="font-mono text-xs text-muted">{e.createdAt.toISOString()}</time><p>{e.draft.name} · {e.action} · {e.source.toLowerCase()}</p>{e.error && <p className="text-danger">{e.error}</p>}</li>)}</ol>
    </section>
  </div>;
}
