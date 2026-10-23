import { NextResponse } from "next/server";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePermission } from "@/lib/authz";
import { editDraft, editManagedCreator, generateDrafts, importInitialTones, publishBatch, publishDraft, reviewDraft, reviewDrafts, scheduleDraft, scheduleDrafts, setPublishingPaused, unpublishDraft } from "@/lib/tone-drafts";

export const maxDuration = 60;

export const POST = route("admin.tone-drafts", async req => {
  const actor = await requirePermission("platform.config");
  const body = await readJson(req, 64 * 1024);
  if (body.action === "generate") return NextResponse.json(await generateDrafts(actor));
  if (body.action === "pause") { await setPublishingPaused(actor, body.paused); return NextResponse.json({ ok: true }); }
  if (body.action === "import") return NextResponse.json(await importInitialTones(actor, body.confirmation));
  if (body.action === "bulk-approve") return NextResponse.json(await reviewDrafts(actor, body.ids, true));
  if (body.action === "bulk-reject") return NextResponse.json(await reviewDrafts(actor, body.ids, false));
  if (body.action === "bulk-schedule") return NextResponse.json(await scheduleDrafts(actor, body.ids, body.scheduledFor));
  if (body.action === "batch-publish") return NextResponse.json(await publishBatch(actor, body.ids, body.confirmation));
  if (typeof body.id !== "string" || !body.id || body.id.length > 40) throw new ApiError(400, "Choose a draft or creator.");
  switch (body.action) {
    case "edit": await editDraft(actor, body.id, body); break;
    case "approve": await reviewDraft(actor, body.id, true); break;
    case "reject": await reviewDraft(actor, body.id, false); break;
    case "publish": return NextResponse.json({ toneId: await publishDraft(actor, body.id) });
    case "schedule": await scheduleDraft(actor, body.id, body.scheduledFor); break;
    case "unpublish": await unpublishDraft(actor, body.id); break;
    case "remove": await unpublishDraft(actor, body.id, true); break;
    case "creator": await editManagedCreator(actor, body.id, body); break;
    default: throw new ApiError(400, "Unknown publishing operation.");
  }
  return NextResponse.json({ ok: true });
});
