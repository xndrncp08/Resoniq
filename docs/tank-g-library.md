# M-VAVE TANK-G preset library — implementation and release report

Branch `feat/tank-g-library` (on top of `feat/anonymous-tone-publishing` @
`7d33604`). Validated locally on 2026-10-23. Nothing here was merged, pushed,
deployed or written to the production database.

## Hardware capabilities

Source: [M-VAVE TANK-G user manual](https://images.equipboard.com/uploads/item/manual/117745/m-vave-tank-g-manual.pdf)
(Manuals+ edition, Feb 2024). Encoded in `frontend/lib/devices/tank-g.ts` and
shown on the device page.

**Verified in the manual text:** noise gate (threshold; fully left = off) →
amp/preamp (9 types; Gain, Treble, Middle, Bass, Volume, i.e. the "3-band EQ" is the
amp tone stack) → modulation (MOD FX zones: Chorus mix / Phaser depth /
Tremolo mix; MOD SPEED) → delay (DLY MIX zones: Analog / Tape / Dual; DLY TIME)
→ reverb (RVB DECAY zones: Room / Spring / Cloud; RVB MIX) → IR CAB (9
positions, first = off, 8 importable slots) → global MASTER. Between two zones
a module is off. 36 presets (banks 1–9 × A–D), saved in LIVE mode by holding
a footswitch. Editing, preset import/export and IR import use M-EFCS
(Windows/macOS) or the mobile app.

**Reported, not in the manual text:** amp slot voicings (the manual prints
them as an image): AC30HW Normal, '65 Twin Reverb, Bogner Shiva, JTM45, Plexi
100, JCM800, 5150 Lead, ENGL Powerball, Dual Rectifier, consistent across two
retail listings. M-VAVE says voicings change with firmware.

**Unverified, so not relied on:** factory IR names per slot (sources
conflict), so presets name a cabinet style instead of a slot. Some listings
call the delays Analog/Digital/Reverse. The M-EFCS preset file format is
undocumented, so **no native export is written**. There is no
compressor, drive pedal, pitch or shimmer block, so shimmer-style pads use
Cloud reverb plus modulation. Research was cut short when the session's
permission classifier began blocking further web fetches.

## What was built

- `RigSpec.device` (slug, amp slot, collection), parsed and bounded in
  `parseRig`; included in fingerprints only when present, so existing drafts
  keep their hashes.
- Server-side device validation on every draft approval/publish: TANK-G-only
  blocks in signal order, supported types and controls, a 5-knob tone stack and
  no separate EQ.
- **121 presets** (`lib/tank-g-presets.ts`): clean & ambient 34, rock &
  alternative 32, metal & progressive 30, lead & expressive 25. Knob values are
  normalized 0–10 positions. Setup steps, level matching and
  single-coil/humbucker adjustments are derived from each preset's settings.
  Unit tests reject exact duplicates and near-duplicates (same slot and effect
  types within 3 total knob steps); three near-duplicates were found and
  re-voiced. Artist references are "inspired by" style notes only.
- Drafts flow through the existing managed creators and workflow, **tone-only**
  (no community posts, no feed flooding). `TANK_G_INITIAL_KEYS` = nine per
  collection, one full 36-slot set.
- Admin (`/admin/tone-publishing`): core/TANK-G and status filters, per-draft
  device check + panel preview, bulk approve (≤40, re-validated), queue
  approved drafts for the paused two-per-day automation, and a confirmed,
  atomic, idempotent batch publish outside that budget. History + audit for
  everything.
- Discovery (`/gear/m-vave-tank-g`, linked from `/tones`): collections, amp
  slot, effect type, genre and text filters over the catalog link and
  `rig.device`/chain JSON; paginated 18 at a time. Capability and caveat notes,
  loading steps.
- Tone pages show a TANK-G faceplate and a knob-by-knob setup sheet with
  approximate clock positions. Export as a `.tank-g-setup.txt` sheet or Resoniq
  JSON (with the panel), both labelled as not native M-EFCS files. Save, remix
  and compare are unchanged and keep device metadata/provenance.
- Migration `20261023090000_tank_g_catalog`: idempotent insert of the
  `m-vave-tank-g` gear row (`ON CONFLICT DO NOTHING`).

## Validation (actual runs)

| Check | Result |
| --- | --- |
| Typecheck, ESLint (0 warnings) | Passed |
| Unit tests | 243 passed, 26 files (8 new TANK-G tests) |
| Integration (Postgres `resoniq_tankg_test`) | 87 passed, 15 files (7 new) |
| Fresh migrate deploy | 17/17 applied |
| Drift vs `resoniq_tankg_shadow_test` | No difference |
| Production build | Exit 0 |
| Served build on `resoniq_tankg_ui_test` | 149 drafts generated, 36 approved and batch-published; device page, filters, pagination, tone page, sheet and JSON exports verified over HTTP; desktop and 500 px layouts with no horizontal overflow |

## Production state (read-only checks, 2026-10-23)

The Supabase connector now exposes `ptdhmmhsdccbvvijnbqc` (org "Resoniq"),
resolving the earlier project mismatch. Ledger: 14 migrations applied; pending
are `20261023055944_anonymous_tone_publishing`,
`20261023063000_managed_tone_publishing`, `20261023090000_tank_g_catalog`
(all additive, defaults on new columns, compatible with the code currently on
`main`). Counts: 1 user (Google, role USER), 1 account, 0 tones/posts/
comments, 20 communities, 137 gear, 4 moderation rules. No `resoniq_*` handle
collisions. **There is no administrator.** Production Vercel serves `main` @
`7ff64c3`.

## Release runbook (needs owner authorization)

1. Grant ADMIN to the owner account (`cmvkjybwm0000jk08na3vicw8`), e.g.
   `npm run admin:grant -- --email <owner email> --role ADMIN` with the
   production `DATABASE_URL`. It records `user.role.grant` in the audit log.
2. Take a private `pg_dump -Fc` backup (or a Supabase dashboard backup) and
   record counts.
3. `npx prisma migrate deploy` against production (direct connection), then
   run the Supabase security/performance advisors.
4. Merge `feat/tank-g-library` into `main` and push; Vercel deploys.
5. In `/admin/tone-publishing`: generate drafts, review and approve the core 26,
   then run the 26-tone import. On the TANK-G tab, review previews and bulk-approve,
   then publish the first collection (36). Keep automation paused. Optionally
   queue the remaining approved drafts, which publish two per day once automation is
   enabled.
6. Verify `/gear/m-vave-tank-g`, a tone page, exports, save/remix, and that
   genuine counts match the backup.
