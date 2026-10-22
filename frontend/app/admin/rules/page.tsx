import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import AdminHeader from "@/components/admin/AdminHeader";
import { JsonForm, RuleEditor } from "@/components/admin/Forms";

export const metadata = { title: "Automod rules" };

const HELP: Record<string, string> = {
  BLOCKED_TERM: "Holds posts and comments containing any of these whole words or phrases. Also refuses community names that contain them.",
  LINK_HOLD_NEW_ACCOUNTS: "Holds anything with a link from accounts younger than this many hours.",
  MAX_MENTIONS: "Holds posts and comments that @mention more people than this.",
  REPORT_HOLD: "Puts published content on hold once this many different people report it.",
};

export default async function RulesPage() {
  await requireStaffPage("platform.config");
  const rules = await prisma.moderationRule.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <>
      <AdminHeader title="Automod rules">Rules never delete anything. Matching content is held for a person to review in Held content.</AdminHeader>
      <ul className="mb-8 space-y-3">
        {rules.map((r) => (
          <li key={r.id} className="panel p-4">
            <div className="mb-1 flex items-center gap-2"><span className="font-display text-lg font-semibold">{r.label}</span><span className="font-mono text-xs text-muted">{r.kind}</span></div>
            <p className="mb-3 font-body text-sm text-muted">{HELP[r.kind]}</p>
            <RuleEditor id={r.id} kind={r.kind} config={r.config as Record<string, unknown>} enabled={r.enabled} />
          </li>
        ))}
      </ul>
      <h2 className="mb-3 font-display text-xl font-semibold">Add a rule</h2>
      <JsonForm
        url="/api/admin/rules"
        submit="Add rule"
        fields={[
          { name: "kind", label: "Type", type: "select", options: Object.keys(HELP).map((k) => [k, k.toLowerCase().replace(/_/g, " ")]) },
          { name: "label", label: "Label (shown to the author as the hold reason)", required: true },
          { name: "value", label: "Value (terms, one per line, or a number)", type: "textarea" },
        ]}
        transform={(v) => ({ kind: v.kind, label: v.label, config: v.kind === "BLOCKED_TERM" ? { terms: v.value } : { [v.kind === "LINK_HOLD_NEW_ACCOUNTS" ? "hours" : v.kind === "MAX_MENTIONS" ? "max" : "reports"]: Number(v.value) } })}
      />
    </>
  );
}
