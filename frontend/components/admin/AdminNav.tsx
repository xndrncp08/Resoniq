"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/icons/Icon";

export type AdminNavItem = { href: string; label: string; icon: IconName; badge?: number };

export default function AdminNav({ sections }: { sections: [string, AdminNavItem[]][] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Control center" className="flex flex-col gap-5">
      {sections.map(([title, items]) => (
        <div key={title}>
          <p className="label-engraved mb-1.5 px-3 text-[10px]">{title}</p>
          <ul className="space-y-0.5">
            {items.map((i) => {
              const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active ? "page" : undefined} className={`focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 font-body text-sm ${active ? "bg-amber/10 text-amber" : "text-muted hover:bg-white/[0.04] hover:text-ink"}`}>
                    <Icon name={i.icon} size={18} />
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && <span className="rounded-full bg-amber px-1.5 font-mono text-[10px] font-semibold leading-[18px] text-bg">{i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
