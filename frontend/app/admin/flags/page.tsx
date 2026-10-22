import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/page";
import { FLAGS, type FlagKey } from "@/lib/flags";
import AdminHeader from "@/components/admin/AdminHeader";
import { FlagSwitch } from "@/components/admin/Forms";

export const metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  await requireStaffPage("platform.config");
  const rows = new Map((await prisma.featureFlag.findMany()).map((r) => [r.key, r]));
  return (
    <>
      <AdminHeader title="Feature flags">Switches take effect on this server immediately and on others within 30 seconds.</AdminHeader>
      <ul className="panel divide-y divide-line">
        {(Object.keys(FLAGS) as FlagKey[]).map((k) => {
          const row = rows.get(k);
          const enabled = row?.enabled ?? FLAGS[k].default;
          return (
            <li key={k} className="flex items-center justify-between gap-4 px-4 py-4">
              <div><p className="font-mono text-sm">{k}</p><p className="font-body text-sm text-muted">{FLAGS[k].description}{!row && " (default)"}</p></div>
              <FlagSwitch flag={k} enabled={enabled} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
