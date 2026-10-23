import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import { GENERATED_DISCLOSURE } from "@/lib/tones";
import { batchConfirmation, INITIAL_IMPORT_CONFIRMATION, INITIAL_PRESET_KEYS, MAX_BATCH, TANK_G_INITIAL_KEYS } from "@/lib/tone-drafts";
import { TANK_G_SLUG, tankGSheet, validateTankGRig } from "@/lib/devices/tank-g";
import { parseRig } from "@/lib/rig-validation";
import { Tabs } from "@/components/app/ui";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminAction from "@/components/admin/AdminAction";
import ToneDraftReview from "@/components/admin/ToneDraftReview";
import { JsonForm } from "@/components/admin/Forms";
import { Avatar, Chip } from "@/components/app/ui";

export const metadata = { title: "Tone publishing" };
const url = "/api/admin/tone-drafts";

const STATUSES = ["DRAFT", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED", "REJECTED", "UNPUBLISHED"];

/** Server-side device check, shown per draft so problems surface before approval. */
function deviceCheck(rig: unknown, gearId: string | undefined) {
  try {
    const parsed = parseRig(rig);
    if (!parsed?.device) return null;
    if (!gearId) return "TANK-G catalog entry missing";
    validateTankGRig(parsed, gearId);
    return "ok";
  } catch (e) { return e instanceof Error ? e.message : "Invalid rig"; }
}

export default async function TonePublishingPage({ searchParams }: { searchParams: Promise<{ set?: string; status?: string }> }) {
  await requireStaffPage("platform.config");
  const sp = await searchParams;
  const set = sp.set === "tank-g" ? "tank-g" : "core";
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const [all, creators, communities, control, events, tankG] = await Promise.all([
    prisma.toneDraft.findMany({ orderBy: [{ createdAt: "asc" }, { key: "asc" }] }),
    prisma.managedCreator.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.community.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.tonePublishingControl.findUnique({ where: { id: "default" } }),
    prisma.tonePublishingEvent.findMany({ include: { draft: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.gearItem.findUnique({ where: { slug: TANK_G_SLUG }, select: { id: true } }),
  ]);
  const inSet = all.filter(d => d.key.startsWith("tank-g-") === (set === "tank-g"));
  const shown = inSet.filter(d => !status || d.status === status);
  const tg = all.filter(d => d.key.startsWith("tank-g-"));
  const toApprove = tg.filter(d => d.status === "DRAFT" && deviceCheck(d.rig, tankG?.id) === "ok").slice(0, MAX_BATCH).map(d => d.id);
  const firstSet = tg.filter(d => TANK_G_INITIAL_KEYS.includes(d.key));
  const firstPending = firstSet.filter(d => d.status !== "PUBLISHED");
  const firstReady = firstSet.length === TANK_G_INITIAL_KEYS.length && firstPending.length > 0 && firstPending.every(d => d.reviewedAt && ["APPROVED", "SCHEDULED", "FAILED"].includes(d.status));
  const toSchedule = tg.filter(d => d.status === "APPROVED" && !TANK_G_INITIAL_KEYS.includes(d.key)).slice(0, MAX_BATCH).map(d => d.id);
  const nextRun = new Date(); nextRun.setUTCHours(24, 0, 0, 0);
  const qs = (o: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ set, status, ...o }).filter((e): e is [string, string] => !!e[1]))}`;
  const initial = all.filter(d => INITIAL_PRESET_KEYS.includes(d.key));
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
      <p className="text-sm text-muted">28 core presets plus {tg.length} M-VAVE TANK-G presets. The two acoustic-simulation variations stay outside the 26-tone initial batch. Manual publication is available independently of the daily two-tone automation budget.</p>
      {control?.initialImportAt ? <p className="text-sm text-signal">Initial batch completed {control.initialImportAt.toISOString()}.</p> : <>
        <p className="text-sm">{initial.filter(d => d.reviewedAt).length}/26 initial presets reviewed. Approve each after inspecting its rig and attribution.</p>
        {ready && <AdminAction url={url} body={{ action: "import", confirmation: INITIAL_IMPORT_CONFIRMATION }} label="Publish reviewed initial batch (26)" variant="primary" confirm="Approve the one-time import of these 26 reviewed tones and community posts? The normal two-per-day scheduler limit remains in place." />}
      </>}
    </section>
    <section className="panel space-y-3 p-5" aria-labelledby="tank-h">
      <h2 id="tank-h" className="font-display text-2xl">M-VAVE TANK-G library</h2>
      <p className="text-sm text-muted">{tg.length} drafts · {tg.filter(d => d.status === "PUBLISHED").length} published · {tg.filter(d => d.status === "APPROVED").length} approved · {tg.filter(d => d.status === "SCHEDULED").length} scheduled. TANK-G presets publish as tone-only (no community posts) and appear on the <Link href={`/gear/${TANK_G_SLUG}`} className="text-copper hover:underline">TANK-G page</Link>. Every approval re-runs device validation on the server.</p>
      <div className="flex flex-wrap gap-2">
        {toApprove.length > 0 && <AdminAction url={url} body={{ action: "bulk-approve", ids: toApprove }} label={`Approve ${toApprove.length} validated drafts`} confirm={`Record your approval of ${toApprove.length} TANK-G drafts that passed device validation? Review the previews below first.`} />}
        {firstReady && <AdminAction url={url} body={{ action: "batch-publish", ids: firstPending.map(d => d.id), confirmation: batchConfirmation(firstPending.length) }} label={`Publish first collection (${firstPending.length})`} variant="primary" confirm={`Publish ${firstPending.length} reviewed TANK-G presets now as one batch? They are tone-only and outside the daily automation budget.`} />}
        {toSchedule.length > 0 && <AdminAction url={url} body={{ action: "bulk-schedule", ids: toSchedule, scheduledFor: nextRun.toISOString() }} label={`Queue ${toSchedule.length} approved for automation`} confirm={`Queue ${toSchedule.length} approved TANK-G drafts from ${nextRun.toISOString()}? Automation publishes at most two per UTC day, and only while enabled.`} />}
      </div>
      <p className="text-xs text-muted">First collection: {firstSet.filter(d => d.status === "PUBLISHED").length}/{TANK_G_INITIAL_KEYS.length} published (nine per collection, one full set of 36 device slots).</p>
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
      <Tabs label="Preset set" items={[{ href: qs({ set: "core", status: undefined }), label: "Core presets", active: set === "core", count: all.length - tg.length }, { href: qs({ set: "tank-g", status: undefined }), label: "TANK-G", active: set === "tank-g", count: tg.length }]} />
      <Tabs label="Status" items={[{ href: qs({ status: undefined }), label: "All", active: !status }, ...STATUSES.map(st => ({ href: qs({ status: st }), label: st.toLowerCase(), active: status === st, count: inSet.filter(d => d.status === st).length }))]} />
      {shown.map(d => <details key={`${d.id}:${d.updatedAt.toISOString()}`} className="panel p-4">
        <summary className="focus-ring cursor-pointer rounded p-1"><span className="font-semibold">{d.name}</span> <span className="font-mono text-xs text-muted">{d.status}{d.removedAt ? " · removed" : ""}</span></summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted">{d.key}{d.scheduledFor && ` · Scheduled after ${d.scheduledFor.toISOString()}`}</p>
          {d.error && <p role="alert" className="text-sm text-danger">{d.error}</p>}
          {d.toneId && <Link href={`/t/${d.toneId}`} className="text-copper hover:underline">View tone</Link>}
          {(() => {
            const check = deviceCheck(d.rig, tankG?.id);
            if (!check) return null;
            const rig = parseRig(d.rig);
            return <div className="space-y-2">
              <p className={`text-sm ${check === "ok" ? "text-signal" : "text-danger"}`} role={check === "ok" ? undefined : "alert"}>Device check: {check === "ok" ? "passed" : check}</p>
              {rig && <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-4">{tankGSheet(rig).map(r => <div key={r.control}><dt className="text-muted">{r.control}</dt><dd>{r.setting}</dd></div>)}</dl>}
            </div>;
          })()}
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
