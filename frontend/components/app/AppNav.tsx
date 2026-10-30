"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/icons/Icon";
import { Avatar } from "@/components/app/ui";
import { usePulse, type Pulse } from "@/lib/queries/notifications";

export type NavUser = { id: string; handle: string; name: string | null; image: string | null; isStaff: boolean } | null;
type Item = { href: string; label: string; icon: IconName; badge?: number; match?: string[] };

const isActive = (pathname: string, item: Item) =>
  [item.href, ...(item.match ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));

function primary(): Item[] {
  return [
    { href: "/feed", label: "Feed", icon: "feed", match: ["/p"] },
    { href: "/explore", label: "Explore", icon: "explore", match: ["/search", "/tag"] },
    { href: "/practice", label: "Practice", icon: "audio" },
    { href: "/gigs", label: "Gig Mode", icon: "signal-chain" },
    { href: "/studio", label: "Amp Studio", icon: "amp" },
    { href: "/musicians", label: "Musicians", icon: "user" },
    { href: "/c", label: "Communities", icon: "community" },
    { href: "/tones", label: "Tones", icon: "tone", match: ["/t", "/compare"] },
    { href: "/gear", label: "Gear", icon: "gear-catalog" },
    { href: "/analyze", label: "Analyze", icon: "analyze" },
  ];
}

function personal(user: NonNullable<NavUser>, pulse: Pulse): Item[] {
  return [
    { href: "/messages", label: "Messages", icon: "comment", badge: pulse.messages },
    { href: "/notifications", label: "Notifications", icon: "bell", badge: pulse.notifications },
    { href: "/library", label: "Tone vault", icon: "vault" },
    { href: "/bookmarks", label: "Bookmarks", icon: "bookmark" },
    { href: `/u/${user.handle}`, label: "Profile", icon: "user" },
    { href: "/settings", label: "Settings", icon: "settings" },
    ...(user.isStaff ? [{ href: "/admin", label: "Control center", icon: "shield" as const }] : []),
  ];
}

function NavLink({ item, pathname, compact }: { item: Item; pathname: string; compact: boolean }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={`focus-ring group relative flex items-center gap-3 rounded-xl py-2.5 font-body text-[15px] transition-colors ${compact ? "justify-center px-0" : "px-3"} ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      {/* A static highlight: the shell is on every page, so it shouldn't pull in the animation runtime. */}
      {active && <span aria-hidden className="absolute inset-0 -z-10 rounded-xl border border-line bg-surface-2" />}
      <span className={`relative ${active ? "text-copper" : ""}`}>
        <Icon name={item.icon} size={22} />
        {!!item.badge && (
          <span className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-copper px-1 text-center font-mono text-[10px] font-semibold leading-[18px] text-bg">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </span>
      <span className={compact ? "sr-only" : ""}>{item.label}</span>
    </Link>
  );
}

/** Desktop sidebar (≥1280: full, 768–1279: icon rail). */
export function SideNav({ user, pulse: initialPulse }: { user: NavUser; pulse: Pulse }) {
  const pathname = usePathname();
  const pulse = usePulse(user?.id ?? null, initialPulse);
  const sections: [string, Item[]][] = [["Play", primary()], ...(user ? ([["You", personal(user, pulse)]] as [string, Item[]][]) : [])];
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r hairline bg-bg-0/60 px-3 py-5 md:flex md:w-[76px] xl:w-[248px]">
      <Link href="/feed" className="focus-ring mb-6 flex items-center gap-2.5 rounded-xl px-2.5 py-1" aria-label="Resoniq feed">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.svg" alt="" width={32} height={32} className="h-8 w-8" />
        <span className="hidden font-display text-xl font-semibold tracking-tight xl:inline">Resoniq</span>
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto scrollbar-none">
        {sections.map(([title, items]) => (
          <div key={title} className="flex flex-col gap-0.5">
            <p className="label-engraved mb-1 hidden px-3 xl:block">{title}</p>
            {items.map((item) => (
              <div key={item.href} className="xl:hidden">
                <NavLink item={item} pathname={pathname} compact />
              </div>
            ))}
            {items.map((item) => (
              <div key={`${item.href}-full`} className="hidden xl:block">
                <NavLink item={item} pathname={pathname} compact={false} />
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-4 flex flex-col gap-3">
        <Link href={user ? "/new" : "/login?callbackUrl=/new"} className="focus-ring flex h-12 items-center justify-center gap-2 rounded-full bg-copper font-body font-semibold text-bg shadow-glow transition hover:bg-copper-soft">
          <Icon name="plus" size={20} />
          <span className="hidden xl:inline">Share</span>
        </Link>
        {user ? (
          <Link href={`/u/${user.handle}`} className="focus-ring flex items-center gap-3 rounded-xl p-1.5 hover:bg-white/[0.04]">
            <Avatar user={user} size={36} />
            <span className="hidden min-w-0 xl:block">
              <span className="block truncate font-body text-sm font-medium">{user.name ?? user.handle}</span>
              <span className="block truncate font-mono text-xs text-muted">@{user.handle}</span>
            </span>
          </Link>
        ) : (
          <Link href="/login" className="focus-ring hidden rounded-full border border-line-strong py-2.5 text-center font-body text-sm text-ink hover:border-copper/50 xl:block">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Phones: a top bar with search and alerts, and a bottom tab bar with a center create button. */
export function MobileNav({ user, pulse: initialPulse }: { user: NavUser; pulse: Pulse }) {
  const pathname = usePathname();
  const { notifications: unread, messages } = usePulse(user?.id ?? null, initialPulse);
  const tabs: Item[] = [
    { href: "/feed", label: "Feed", icon: "feed", match: ["/p"] },
    { href: "/explore", label: "Explore", icon: "explore", match: ["/search", "/tag", "/c", "/gear", "/musicians"] },
    { href: "/tones", label: "Tones", icon: "tone", match: ["/t", "/library", "/analyze"] },
    user ? { href: `/u/${user.handle}`, label: "You", icon: "user", match: ["/settings", "/bookmarks"] } : { href: "/login", label: "Sign in", icon: "user" },
  ];
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b hairline bg-bg/85 px-4 backdrop-blur-xl md:hidden">
        <Link href="/feed" className="focus-ring flex items-center gap-2 rounded-lg" aria-label="Resoniq feed">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" width={28} height={28} />
          <span className="font-display text-lg font-semibold">Resoniq</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/practice" aria-label="Practice room" className={`focus-ring flex h-10 w-10 items-center justify-center rounded-full ${pathname === "/practice" ? "text-signal" : "text-muted hover:text-ink"}`}><Icon name="audio" size={22} /></Link>
          <Link href="/search" aria-label="Search" className="focus-ring flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-ink">
            <Icon name="search" size={22} />
          </Link>
          {user && (
            <Link href="/messages" aria-label={messages ? `Messages, ${messages} unread` : "Messages"} className={`focus-ring relative flex h-10 w-10 items-center justify-center rounded-full ${pathname.startsWith("/messages") ? "text-copper" : "text-muted hover:text-ink"}`}>
              <Icon name="comment" size={22} />
              {!!messages && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-signal" />}
            </Link>
          )}
          {user && (
            <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-ink">
              <Icon name="bell" size={22} />
              {!!unread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-copper" />}
            </Link>
          )}
        </div>
      </header>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center">
          {tabs.slice(0, 2).map((t) => <Tab key={t.href} item={t} pathname={pathname} />)}
          <Link href={user ? "/new" : "/login?callbackUrl=/new"} aria-label="Share something" className="focus-ring tap-clean mx-auto -mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-copper text-bg shadow-glow">
            <Icon name="plus" size={26} strokeWidth={2.2} />
          </Link>
          {tabs.slice(2).map((t) => <Tab key={t.href} item={t} pathname={pathname} />)}
        </div>
      </nav>
    </>
  );
}

function Tab({ item, pathname }: { item: Item; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`focus-ring tap-clean flex h-16 flex-col items-center justify-center gap-1 font-body text-[11px] ${active ? "text-copper" : "text-muted"}`}>
      <Icon name={item.icon} size={24} />
      {item.label}
    </Link>
  );
}
