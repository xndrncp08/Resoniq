# Resoniq design system

Tokens live in `frontend/app/globals.css` (`@theme`). Tailwind v4 generates
utilities from them (`bg-surface-2`, `text-copper`, `text-display-lg`, …).

## Color

| Token | Value | Job |
| --- | --- | --- |
| `bg-0` / `bg` | `#06080B` / `#0A0D12` | Chassis, page |
| `surface`, `surface-2`, `surface-3` | `#151A22` → `#232A36` | Panels, raised controls |
| `line`, `line-strong` | `#262D39`, `#343D4C` | Hairlines, control borders |
| `ink`, `ink-dim`, `muted` | `#F3EFE8`, `#C9C3B8`, `#8B93A1` | Text, from primary to tertiary |
| `copper` (+ `soft`, `deep`) | `#FF8A3D` | Gear, primary actions, **creator-declared** |
| `signal` (+ `dim`) | `#37E6C9` | Audio, live data, **Resoniq-inferred** |
| `amber` / `danger` / `success` | `#FFC24D` / `#FF5D5D` / `#5BD68B` | Status only, always shown with an icon and a label |

The declared/inferred split is the system's core rule. `<Provenance kind>`
(`components/app/ui.tsx`) is the only way to label it.

## Type

Space Grotesk (display), Inter (body), IBM Plex Mono (readouts and numbers).
`text-display-xl` and `-lg` are for the public landing only. App pages open
with `PageHeader` (a 24–30px title and one line of help, no eyebrow);
entity pages (a tone, a gear item, a community) use `text-display-md`.
`.label-engraved` is a small sentence-case field or section label. Compact
uppercase mono labels remain only inside instrument panels (Amp Studio,
analysis readouts), where they read as faceplate printing.

## Surfaces and shape

`.panel` is a machined panel (gradient surface, hairline, 22px radius).
`.panel-inset` is a recessed well for inputs and readouts. `.grille` (a
speaker-cloth dot texture) and blurred glows are for the landing page and Amp
Studio, not app pages. Empty states are a dashed outline, an icon and one action. Controls are pill-shaped (`rounded-full`); content
cards are 22px; small wells are 12px.

## Components

- `Button`, `LinkButton`, `IconButton` (always labelled), `Chip`, `Tabs` (URL-driven), `Avatar` (hashed hue fallback), `EmptyState`, `PageHeader`, `TimeAgo`
- `Dialog`: a modal on desktop and a bottom sheet on phones, with focus trap and Escape (`lib/use-dialog-focus.ts`)
- Social: `PostCard`, `VoteControl` (amp or up/down), `CommentThread`, `ReportDialog`, `InfiniteList`
- Tone: `RigBoard` (signal chain drawn input → output), `RigEditor`, `GearPicker`, `ToneCard`
- Media: `VideoPlayer` (preview on hover, keyboard controls, rig overlay), `AudioPlayer` (real peaks), `Uploader` (progress, retry)
- Admin: `Stat`, `BarChart` (one measure per chart, hover readout plus an sr-only table), `Table`, `StatusPill`, `AdminAction`

## Icons

`components/icons/Icon.tsx`: about 80 original glyphs on a 24px grid with a
1.75 stroke, decorative by default. Instruments and gear are drawn from real
hardware (pedal enclosures, rack units, pick shapes, pole pieces).
`lucide-react` remains only inside a few older components for generic glyphs.

## Motion

Motion handles layout and presence; GSAP handles render loops (unchanged).
New surfaces use short springs for state changes. The public landing is
static; its former floating gear and marquee were removed. The detailed
analysis example and the 3D amp (see `docs/state-and-3d.md`) load on explicit request. Motion
configuration is scoped to the application, authentication form, dialogs and
deferred example. Reduced motion disables automatic video hover previews.
The global `prefers-reduced-motion` rule also neutralises CSS movement.

## Navigation

`components/app/AppNav.tsx` has three groups. Add new pages to one of them
rather than as new top-level links:

- **Discover:** Feed, Explore, Music and Tones. Musicians, Communities and Gear
  are reached from Explore; Analyze and Compare from Tones (their routes
  highlight the parent).
- **Make:** Practice, Riff Vault, Songwriting, Projects, Gig Mode and Amp Studio.
- **Inbox:** Messages and Notifications.

Personal pages (Profile, Tone vault, Bookmarks, Settings, Control
center for staff, Sign out) sit in the account menu. Menus are native
`popover` elements: light dismiss and Escape come from the browser, and a
click on any link inside closes them. Secondary actions on a page go in a
"More" popover (see `ToneActions`), not a longer button row.

## Responsive behavior

- ≥ 1280: full sidebar
- 768–1279: icon rail
- < 768: top bar (search, messages, notifications, menu) plus a bottom tab bar
  (Feed, Explore, Share, Tones, You). The menu sheet lists every destination.

Admin collapses its nav into a disclosure under 1024. Wide tables scroll
horizontally inside their panel, never the page.
