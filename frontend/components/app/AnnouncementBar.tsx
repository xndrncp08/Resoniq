import Icon from "@/components/icons/Icon";
import { currentAnnouncement } from "@/lib/admin/announcements";

/** The current platform announcement, set in the admin console. */
export default async function AnnouncementBar() {
  const a = await currentAnnouncement().catch(() => null);
  if (!a) return null;
  return (
    <div role="status" className={`flex items-start gap-3 border-b px-4 py-2.5 font-body text-sm sm:px-6 lg:px-8 ${a.level === "WARN" ? "border-amber/30 bg-amber/10 text-amber" : "border-signal/20 bg-signal/[0.07] text-ink"}`}>
      <Icon name={a.level === "WARN" ? "alert" : "megaphone"} size={18} className={`mt-px shrink-0 ${a.level === "WARN" ? "" : "text-signal"}`} />
      <p><span className="font-semibold">{a.title}</span>{a.body && <span className="text-ink-dim"> · {a.body}</span>}</p>
    </div>
  );
}
