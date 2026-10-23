/** Uses the same validated services as the admin panel; read-only unless --action is supplied. */
import { parseArgs } from "node:util";
import { statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { generateDrafts, importInitialTones, INITIAL_IMPORT_CONFIRMATION, INITIAL_PRESET_KEYS, reviewDraft } from "@/lib/tone-drafts";

export function parseImportArgs(args: string[]) {
  const { values } = parseArgs({ args, options: {
    action: { type: "string", default: "status" }, "admin-id": { type: "string" },
    confirm: { type: "string" }, deployment: { type: "string" }, backup: { type: "string" },
  } });
  if (!["status", "prepare", "approve", "publish"].includes(values.action!)) throw new Error("Use --action status|prepare|approve|publish.");
  if (values.action !== "status" && (!values["admin-id"] || values.confirm !== INITIAL_IMPORT_CONFIRMATION)) throw new Error(`Writes require --admin-id and --confirm '${INITIAL_IMPORT_CONFIRMATION}'.`);
  return values;
}

async function main() {
  const args = parseImportArgs(process.argv.slice(2));
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Set DATABASE_URL explicitly. No default development or production database is selected.");
  const url = new URL(raw);
  if (args.action !== "status" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    if (!args.backup || statSync(args.backup).size === 0) throw new Error("Provide --backup with a verified pre-change pg_dump archive.");
    execFileSync("pg_restore", ["--list", args.backup], { stdio: "ignore" });
    if (!args.deployment || new URL(args.deployment).protocol !== "https:") throw new Error("Provide the compatible HTTPS --deployment origin before publishing live records.");
    const response = await fetch(new URL("/api/admin/tone-drafts", args.deployment), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }), redirect: "manual" });
    const body = await response.json().catch(() => null);
    if (response.status !== 401 || body?.error !== "Sign in required.") throw new Error("The compatible publishing API is not accessible at this deployment. Deploy and verify it first.");
  }
  if (args.action !== "status") {
    const actor = await prisma.user.findUniqueOrThrow({ where: { id: args["admin-id"]! }, select: { id: true, handle: true, role: true, status: true, suspendedUntil: true } });
    if (args.action === "prepare") console.log(await generateDrafts(actor));
    if (args.action === "approve") {
      const drafts = await prisma.toneDraft.findMany({ where: { key: { in: INITIAL_PRESET_KEYS } } });
      if (drafts.length !== 26) throw new Error("Generate all initial drafts before approving the batch.");
      for (const draft of drafts) if (draft.status !== "PUBLISHED") await reviewDraft(actor, draft.id, true);
      console.log("Recorded approval of the 26 initial presets; no tones published.");
    }
    if (args.action === "publish") console.log(await importInitialTones(actor, args.confirm));
  }
  const drafts = await prisma.toneDraft.findMany({ include: { creator: { select: { user: { select: { handle: true } } } } }, orderBy: { key: "asc" } });
  console.log(JSON.stringify({
    creators: await prisma.managedCreator.count(),
    control: await prisma.tonePublishingControl.findUnique({ where: { id: "default" } }),
    drafts: drafts.map(d => ({ key: d.key, status: d.status, creator: d.creator?.user.handle, fingerprint: d.fingerprint, url: d.toneId ? `${args.deployment ?? ""}/t/${d.toneId}` : null, error: d.error })),
  }, null, 2));
}

if (process.argv[1]?.endsWith("publish-initial-tones.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "Initial import failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
