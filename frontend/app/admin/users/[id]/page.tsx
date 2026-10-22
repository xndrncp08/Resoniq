import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/admin/page";
import { userDetail, ROLES } from "@/lib/admin/users";
import { can } from "@/lib/permissions";
import AdminAction from "@/components/admin/AdminAction";
import AdminHeader from "@/components/admin/AdminHeader";
import Stat from "@/components/admin/Stat";
import Table, { StatusPill } from "@/components/admin/Table";
import { Avatar } from "@/components/app/ui";

export const metadata = { title: "Member" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaffPage("users.suspend");
  const d = await userDetail((await params).id);
  if (!d) notFound();
  const { user: u } = d;
  const self = u.id === actor.id;
  return (
    <>
      <AdminHeader title={u.name ?? `@${u.handle}`} actions={<Link href={`/u/${u.handle}`} target="_blank" className="font-body text-sm text-copper hover:underline">Public profile ↗</Link>}>
        @{u.handle} · {u.email ?? "no email"} {u.email && (u.emailVerified ? "(verified)" : "(unverified)")} · joined {u.createdAt.toISOString().slice(0, 10)}
      </AdminHeader>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar user={u} size={64} />
        <StatusPill status={u.role} /> <StatusPill status={u.status} />
        {u.suspendedUntil && <span className="font-mono text-xs text-muted">until {u.suspendedUntil.toISOString().slice(0, 10)}</span>}
        {u.statusReason && <span className="font-body text-sm text-muted">Reason: {u.statusReason}</span>}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Posts" value={u._count.posts} icon="feed" />
        <Stat label="Comments" value={u._count.comments} icon="comment" />
        <Stat label="Tones" value={u._count.tones} icon="tone" />
        <Stat label="Uploads" value={u._count.media} icon="video" />
        <Stat label="Followers" value={u.followerCount} icon="users" />
        <Stat label="Reputation" value={u.reputation} icon="amp-up" />
      </div>
      {!self && (
        <section className="panel mb-8 space-y-3 p-4">
          <h2 className="font-display text-lg font-semibold">Account actions</h2>
          <div className="flex flex-wrap gap-3">
            {u.status !== "ACTIVE" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "status", status: "ACTIVE" }} label="Reinstate" variant="primary" reason={{ field: "reason", placeholder: "Note for the log" }} />}
            {u.status !== "SUSPENDED" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "status", status: "SUSPENDED" }} label="Suspend" reason={{ field: "reason", placeholder: "Reason shown to the member" }} extra={{ field: "days", label: "Days", type: "number", placeholder: "days (blank = open)" }} />}
            {can(actor.role, "users.ban") && u.status !== "BANNED" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "status", status: "BANNED" }} label="Ban" variant="danger" reason={{ field: "reason", placeholder: "Reason for the log" }} confirm={`Ban @${u.handle}? Their content disappears for everyone until the ban is lifted.`} />}
          </div>
          {can(actor.role, "users.roles") && (
            <div className="flex flex-wrap items-center gap-2 border-t hairline pt-3">
              <span className="font-body text-sm text-muted">Role:</span>
              {ROLES.filter((r) => r !== u.role).map((r) => <AdminAction key={r} url={`/api/admin/users/${u.id}`} body={{ action: "role", role: r }} label={`Make ${r.toLowerCase()}`} confirm={`Change @${u.handle}'s role to ${r}?`} />)}
            </div>
          )}
        </section>
      )}
      <div className="grid gap-8 xl:grid-cols-2">
        <section><h2 className="mb-3 font-display text-lg font-semibold">Recent posts</h2>
          <Table head={["Post", "Status", "Score"]} empty={d.recentPosts.length ? undefined : "No posts."}>{d.recentPosts.map((p) => <tr key={p.id}><td><Link href={`/p/${p.id}`} target="_blank" className="line-clamp-1 hover:underline">{p.title ?? p.body.slice(0, 80)}</Link></td><td><StatusPill status={p.status} /></td><td className="font-mono">{p.score}</td></tr>)}</Table>
        </section>
        <section><h2 className="mb-3 font-display text-lg font-semibold">Reports against this account</h2>
          <Table head={["Reason", "By", "Status", "When"]} empty={d.reportsAgainst.length ? undefined : "None."}>{d.reportsAgainst.map((r) => <tr key={r.id}><td>{r.reason.toLowerCase()}{r.details && <span className="block text-xs text-muted">{r.details}</span>}</td><td className="font-mono text-xs">@{r.reporter.handle}</td><td><StatusPill status={r.status} /></td><td className="font-mono text-xs">{r.createdAt.toISOString().slice(0, 10)}</td></tr>)}</Table>
        </section>
      </div>
      <section className="mt-8"><h2 className="mb-3 font-display text-lg font-semibold">History</h2>
        <Table head={["Action", "By", "Reason", "When"]} empty={d.audit.length ? undefined : "No staff actions yet."}>{d.audit.map((a) => <tr key={a.id}><td className="font-mono text-xs">{a.action}</td><td className="font-mono text-xs">@{a.actor?.handle ?? "system"}</td><td>{a.reason}</td><td className="font-mono text-xs">{a.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td></tr>)}</Table>
      </section>
    </>
  );
}
