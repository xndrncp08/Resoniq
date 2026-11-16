"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { MouseEvent } from "react";
import Icon, { type IconName } from "@/components/icons/Icon";
import { Avatar } from "@/components/app/ui";
import { usePulse, type Pulse } from "@/lib/queries/notifications";

export type NavUser = { id: string; handle: string; name: string | null; image: string | null; isStaff: boolean } | null;
type Item = { href: string; label: string; icon: IconName; badge?: number; match?: string[] };

const isActive = (pathname: string, item: Item) =>
  [item.href, ...(item.match ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));

// Musicians, communities and gear are reached from Explore; analysis from Tones.
const DISCOVER: Item[] = [
  { href: "/feed", label: "Feed", icon: "feed", match: ["/p"] },
  { href: "/explore", label: "Explore", icon: "explore", match: ["/search", "/tag", "/musicians", "/c", "/gear"] },
  { href: "/music", label: "Music", icon: "waveform" },
  { href: "/tones", label: "Tones", icon: "tone", match: ["/t", "/compare", "/analyze"] },
];

const MAKE: Item[] = [
  { href: "/practice", label: "Practice", icon: "audio" },
  { href: "/riffs", label: "Riff Vault", icon: "mic" },
  { href: "/write", label: "Songwriting", icon: "edit" },
  { href: "/projects", label: "Projects", icon: "users", match: ["/rooms"] },
  { href: "/gigs", label: "Gig Mode", icon: "signal-chain" },
  { href: "/studio", label: "Amp Studio", icon: "amp" },
];

const inbox = (pulse: Pulse): Item[] => [
  { href: "/messages", label: "Messages", icon: "comment", badge: pulse.messages },
  { href: "/notifications", label: "Notifications", icon: "bell", badge: pulse.notifications },
];

const account = (user: NonNullable<NavUser>): Item[] => [
  { href: `/u/${user.handle}`, label: "Profile", icon: "user" },
  { href: "/library", label: "Tone vault", icon: "vault" },
  { href: "/bookmarks", label: "Bookmarks", icon: "bookmark" },
  { href: "/settings", label: "Settings", icon: "settings" },
  ...(user.isStaff ? [{ href: "/admin", label: "Control center", icon: "shield" as const }] : []),
];

// Popovers don't close on client-side navigation, so any link click inside one closes it.
const closeOnLink = (e: MouseEvent<HTMLElement>) => {
  if ((e.target as HTMLElement).closest("a")) e.currentTarget.hidePopover();
};

function NavLink({ item, pathname, compact = false }: { item: Item; pathname: string; compact?: boolean }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={`focus-ring relative flex h-10 shrink-0 items-center gap-3 rounded-lg font-body text-[15px] transition-colors ${compact ? "justify-center" : "px-3"} ${active ? "bg-surface-2 text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink"}`}
    >
      <span className={`relative ${active ? "text-copper" : ""}`}>
        <Icon name={item.icon} size={20} />
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

function Section({ title, items, pathname, compact }: { title?: string; items: Item[]; pathname: string; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && <p className={`mb-1 px-3 font-body text-xs font-medium text-muted/70 ${compact ? "sr-only" : ""}`}>{title}</p>}
      {items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} compact={compact} />)}
    </div>
  );
}

function AccountLinks({ user, pathname }: { user: NonNullable<NavUser>; pathname: string }) {
  return (
    <>
      <Section items={account(user)} pathname={pathname} />
      <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="focus-ring flex h-10 w-full items-center gap-3 rounded-lg px-3 font-body text-[15px] text-muted hover:bg-white/[0.04] hover:text-ink">
        <Icon name="logout" size={20} /> Sign out
      </button>
    </>
  );
}

function Rail({ user, pulse, pathname, compact }: { user: NavUser; pulse: Pulse; pathname: string; compact: boolean }) {
  return (
    <nav aria-label="Main" className={`min-h-0 flex-1 flex-col gap-6 overflow-y-auto scrollbar-none ${compact ? "flex xl:hidden" : "hidden xl:flex"}`}>
      <Section items={DISCOVER} pathname={pathname} compact={compact} />
      <Section title="Make" items={MAKE} pathname={pathname} compact={compact} />
      {user && <Section title="Inbox" items={inbox(pulse)} pathname={pathname} compact={compact} />}
    </nav>
  );
}

/** Desktop sidebar (≥1280: full, 768–1279: icon rail). */
export function SideNav({ user, pulse: initialPulse }: { user: NavUser; pulse: Pulse }) {
  const pathname = usePathname();
  const pulse = usePulse(user?.id ?? null, initialPulse);
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r hairline px-3 py-5 md:flex md:w-[72px] xl:w-[232px]">
      <Link href="/feed" className="focus-ring mb-6 flex items-center gap-2.5 rounded-lg px-2 py-1" aria-label="Resoniq feed">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.svg" alt="" width={28} height={28} className="h-7 w-7" />
        <span className="hidden font-display text-lg font-semibold tracking-tight xl:inline">Resoniq</span>
      </Link>
      <Rail user={user} pulse={pulse} pathname={pathname} compact />
      <Rail user={user} pulse={pulse} pathname={pathname} compact={false} />
      <div className="mt-4 flex flex-col gap-2">
        <Link href={user ? "/new" : "/login?callbackUrl=/new"} aria-label="Share something" className="focus-ring flex h-10 items-center justify-center gap-2 rounded-full bg-copper font-body text-sm font-semibold text-bg transition-colors hover:bg-copper-soft">
          <Icon name="plus" size={18} />
          <span className="hidden xl:inline">Share</span>
        </Link>
        {user ? (
          <>
            <button type="button" popoverTarget="account-menu" aria-label="Account menu" className="focus-ring flex items-center gap-3 rounded-lg p-1.5 text-left hover:bg-white/[0.04]">
              <Avatar user={user} size={32} />
              <span className="hidden min-w-0 flex-1 xl:block">
                <span className="block truncate font-body text-sm font-medium">{user.name ?? user.handle}</span>
                <span className="block truncate font-mono text-xs text-muted">@{user.handle}</span>
              </span>
              <Icon name="more" size={18} className="hidden text-muted xl:block" />
            </button>
            <div id="account-menu" popover="auto" onClick={closeOnLink} className="panel fixed inset-auto bottom-[76px] left-3 m-0 w-56 p-2 text-ink shadow-panel">
              <AccountLinks user={user} pathname={pathname} />
            </div>
          </>
        ) : (
          <Link href="/login" className="focus-ring flex h-10 items-center justify-center gap-2 rounded-full border border-line-strong font-body text-sm text-ink hover:border-copper/50" aria-label="Sign in">
            <Icon name="user" size={18} className="xl:hidden" />
            <span className="hidden xl:inline">Sign in</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Phones: a top bar (search, inbox, menu) and a bottom tab bar with a center create button. */
export function MobileNav({ user, pulse: initialPulse }: { user: NavUser; pulse: Pulse }) {
  const pathname = usePathname();
  const { notifications: unread, messages } = usePulse(user?.id ?? null, initialPulse);
  const tabs: Item[] = [
    DISCOVER[0],
    DISCOVER[1],
    DISCOVER[3],
    user ? { href: `/u/${user.handle}`, label: "You", icon: "user", match: ["/settings", "/bookmarks", "/library"] } : { href: "/login", label: "Sign in", icon: "user" },
  ];
  const iconLink = "focus-ring relative flex h-11 w-11 items-center justify-center rounded-full";
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b hairline bg-bg/90 pl-4 pr-2 backdrop-blur-xl md:hidden">
        <Link href="/feed" className="focus-ring flex items-center gap-2 rounded-lg" aria-label="Resoniq feed">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" width={26} height={26} />
          <span className="font-display text-lg font-semibold">Resoniq</span>
        </Link>
        <div className="flex items-center">
          <Link href="/search" aria-label="Search" className={`${iconLink} text-muted hover:text-ink`}>
            <Icon name="search" size={22} />
          </Link>
          {user && (
            <Link href="/messages" aria-label={messages ? `Messages, ${messages} unread` : "Messages"} className={`${iconLink} ${pathname.startsWith("/messages") ? "text-copper" : "text-muted hover:text-ink"}`}>
              <Icon name="comment" size={22} />
              {!!messages && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-copper" />}
            </Link>
          )}
          {user && (
            <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className={`${iconLink} ${pathname.startsWith("/notifications") ? "text-copper" : "text-muted hover:text-ink"}`}>
              <Icon name="bell" size={22} />
              {!!unread && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-copper" />}
            </Link>
          )}
          <button type="button" popoverTarget="mobile-menu" aria-label="Menu" className={`${iconLink} text-muted hover:text-ink`}>
            <Icon name="menu" size={22} />
          </button>
        </div>
      </header>
      <div id="mobile-menu" popover="auto" onClick={closeOnLink} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Menu</span>
          <button type="button" popoverTarget="mobile-menu" popoverTargetAction="hide" aria-label="Close menu" className={`${iconLink} text-muted hover:text-ink`}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <nav aria-label="Menu" className="flex flex-col gap-6">
          <Section items={[...DISCOVER, { href: "/musicians", label: "Musicians", icon: "user" }, { href: "/c", label: "Communities", icon: "community" }, { href: "/gear", label: "Gear", icon: "gear-catalog" }]} pathname={pathname} />
          <Section title="Make" items={MAKE} pathname={pathname} />
          {user ? (
            <div className="flex flex-col gap-0.5">
              <p className="mb-1 px-3 font-body text-xs font-medium text-muted/70">Account</p>
              <AccountLinks user={user} pathname={pathname} />
            </div>
          ) : (
            <Section items={[{ href: "/login", label: "Sign in", icon: "user" }]} pathname={pathname} />
          )}
        </nav>
      </div>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center">
          {tabs.slice(0, 2).map((t) => <Tab key={t.href} item={t} pathname={pathname} />)}
          <Link href={user ? "/new" : "/login?callbackUrl=/new"} aria-label="Share something" className="focus-ring tap-clean mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-copper text-bg">
            <Icon name="plus" size={24} strokeWidth={2.2} />
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
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`focus-ring tap-clean flex h-14 flex-col items-center justify-center gap-1 font-body text-[11px] ${active ? "text-copper" : "text-muted"}`}>
      <Icon name={item.icon} size={22} />
      {item.label}
    </Link>
  );
}
