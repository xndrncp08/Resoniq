# Managed tone publishing — implementation and release report

Validated locally on 2026-10-23. Implementation: `54c4748` on
`feat/anonymous-tone-publishing`. Nothing in this run was merged into `main`,
pushed, deployed, or written to the production database.

## Existing work verified

The branch started clean, two commits ahead of `main` / `origin/main` at
`7ff64c3`: `d15b366` (Anonymous identity, provenance and discovery filters) and
`62e41bd` (preset library). Both commits were preserved. The branch had a
`ToneDraft` schema but no publishing service, admin control center or scheduler.

There are **28 actual preset objects and 28 unique keys**. This is not a regex
counting error. The final two are `acoustic-inspired-electric` and
`acoustic-inspired-fingerpicked`. All 28 become drafts; those two remain outside
the initial 26-tone import, available for later editing and review.

## Completed behavior

- Six fictional editorial identities, each explicitly named “Demo Creator”,
  with a distinct instrument avatar, disclosure biography and specialization.
  `ManagedCreator.owner = Resoniq` records ownership internally.
- Managed identities use the existing non-login `SYSTEM` user kind. Existing
  credential/staff constraints remain; new triggers also refuse OAuth links,
  database sessions and conversion back into a member identity. Auth.js and
  request authorization reject system identities. The `resoniq_` handle
  namespace is reserved. A colliding genuine member is never converted.
- Missing drafts are generated from the existing presets. Catalog references
  must resolve to approved gear and match its catalog names. Explicit custom
  gear remains identified as custom; no invented catalog records are inserted.
- Normalized rig fingerprints catch duplicates despite renamed presets or
  reordered JSON keys. Publication also checks legacy generated tones that
  have no draft link, and refuses to overwrite or duplicate them.
- Edits reset approval and scheduling. Approval, rejection, creator selection,
  manual publication, scheduling, pausing, withdrawal and removal are available
  at `/admin/tone-publishing`. Only active personal administrators can operate
  the service, including direct CLI callers. Successful mutations and actual
  failed publication attempts have durable history and audit records.
- Publication creates the tone, gear index, optional community discussion,
  community count and publication history in one transaction. A shared
  PostgreSQL transaction advisory lock serializes publication and controls.
  Concurrent/repeated calls do not duplicate tones or posts.
- Withdrawal makes a tone private and removes its discussion from public
  listings. Withdrawn drafts may be edited, reapproved and republished using
  the same tone/post IDs. Removal deletes the tone, retaining the withdrawn
  discussion and internal history; it cannot silently be regenerated.
- The existing authenticated `/api/cron/jobs` daily run at **04:17 UTC** handles
  due approved drafts. Automation defaults to paused. A durable event count
  limits automatic publication to two tones per UTC day across instances,
  retries, repeat cron calls and withdrawals. A failing draft does not consume
  a publication slot or block the second attempt on another due draft.
- The initial import is an explicit, atomic, one-time operation requiring 26
  reviewed drafts and the exact confirmation
  `Publish the 26 reviewed Resoniq demo tones`. Import/manual events are
  distinct from automatic events and do not change the daily automation limit.
- Generated provenance and managed attribution appear in listings, profiles,
  detail pages and community attachments. Save/remix flows work; remixes retain
  generated provenance and source credit. System identities receive no inbox
  notifications. No engagement is seeded.

The six original avatars are small local SVG instrument illustrations at
`frontend/public/creators/{clean,blues,metal,ambient,bass,pedals}.svg`; they are
editorial artwork, not portraits of supposed real musicians.

Preset corrections include Deluxe Reverb middle controls, OR15 presence/volume
controls, Markbass mid bands, effect-capable JC-120/Twin channels and bass Drop A
tuning. Knob settings are explicitly normalized positions, not native dB
readouts. References: [Fender](https://www.fender.com/products/65-deluxe-reverb),
[Orange](https://orangeamps.com/products/or15),
[Markbass](https://markbass.it/product/little-mark-iv-300/),
[Roland manual](https://static.roland.com/assets/media/pdf/JC-120E_OM.pdf).
The settings remain generated, untested suggestions; no recording, performance
or gear ownership is claimed.

## Actual validation

| Check | Result |
| --- | --- |
| Type checking | Passed |
| ESLint, zero warnings | Passed |
| Unit/route tests | 235 passed, 25 files |
| PostgreSQL integration tests | 80 passed, 14 files |
| New publishing integration scenarios | 14 passed |
| Production build | Exit 0; compiled in 1.526 s, TypeScript phase 3.0 s |
| Migration drift against a separate shadow database | No difference |
| Fresh database migrations | All 16 applied, including the final atomic migration |
| Upgrade from `main` with existing user/tone/community/post fixtures | Passed; content checksum identical before/after |
| CLI prepare → approve → initial import → repeated import | 26 imported, then 0 imported |
| HTTP verification | 26 public tone APIs, exports, source and six genre filters, seven bass tones, six creators |
| Browser verification | Public library, tone page, creator profile, admin draft edit/save, authenticated save and remix |
| Responsive checks | 390 × 844 and 1440 × 1000; no horizontal overflow or broken avatars |

Tests used separate local PostgreSQL databases ending in `_test`, never a
production or development reset. The development database was read only;
observed counts were 17 users, 1 tone, 20 communities and 137 gear items.

Local initial publication distribution (production has **not** been imported):

| Identity | Specialization | Initial tones |
| --- | --- | ---: |
| `resoniq_clara` | Clean guitar, funk, jazz | 5 |
| `resoniq_bram` | Blues and crunch | 4 |
| `resoniq_onyx` | Metal and high gain | 5 |
| `resoniq_aura` | Ambient and worship | 2 |
| `resoniq_lowen` | Bass | 7 |
| `resoniq_piper` | Indie and pedalboards | 3 |

Screenshots are local ignored artifacts in `output/playwright/publishing-*`.
Logs are in `/tmp/resoniq-publishing-*`. Browser testing used an isolated local
administrator; its save/remix operations were test actions in that database.

## Production status and release gates

**Production creators created: 0. Production tones published: 0.**

Vercel configuration confirms `resoniq-two.vercel.app` uses Supabase project
`ptdhmmhsdccbvvijnbqc`. The connected Supabase integration lists only project
`vyxqudcxlfsdjyugjwhb`, which has no Resoniq tables. A read against the actual
production project returned “You do not have permission to perform this
action.” No production schema, migration ledger, counts or records could be
verified, and no production backup or migration was attempted.

The user also requires explicit authorization before merging or pushing this
feature. Production records must wait until compatible code is deployed:
the previous production UI cannot provide the new managed attribution.

Once access and Git/deployment authorization are available:

1. Inspect the actual production `_prisma_migrations`, table structure,
   existing generated tones, reserved handles and administrator identities.
   Resolve any collision without changing genuine accounts/content.
2. Take a private, restorable `pg_dump` backup (client version at least as new
   as the server), or an equivalently verified backup through the connected
   integration. Record pre-change counts and relevant content checksums.
3. Review and apply only pending migrations. Expected feature migrations are
   `20261023055944_anonymous_tone_publishing` and
   `20261023063000_managed_tone_publishing`; verify the actual ledger first.
   Use Prisma's deployment workflow so its checksums/history remain correct.
   Never run a reset, development migration command or destructive seed.
4. The new migration is transactional, uses bounded lock/statement timeouts,
   enables RLS on the publishing tables with no Data API policies, and uses
   invoker functions with no public execute grant. Run Supabase security and
   performance advisors against the correct project after applying it.
5. Deploy the validated feature and confirm the admin endpoint/page and public
   discovery API are available. Keep automation paused for the initial review.
6. Use the admin workflow, or the CLI below with a real active administrator,
   to prepare drafts, review/approve the initial 26, and publish the batch.
7. Verify the public tone/profile/post URLs, source/genre search, save/remix,
   attribution and zero initial engagement against production. Check genuine
   records/counts against the backup. Only then enable daily automation if
   desired.

CLI (from `frontend`, with `DATABASE_URL` securely supplied):

```sh
npm run tones:initial-import                           # read-only status
npm run tones:initial-import -- --action prepare --admin-id <existing-admin-id> --confirm 'Publish the 26 reviewed Resoniq demo tones' --deployment https://resoniq-two.vercel.app --backup /private/path/production.dump
# Inspect every draft and rig before the next step.
npm run tones:initial-import -- --action approve --admin-id <existing-admin-id> --confirm 'Publish the 26 reviewed Resoniq demo tones' --deployment https://resoniq-two.vercel.app --backup /private/path/production.dump
npm run tones:initial-import -- --action publish --admin-id <existing-admin-id> --confirm 'Publish the 26 reviewed Resoniq demo tones' --deployment https://resoniq-two.vercel.app --backup /private/path/production.dump
```

Remote writes require a readable pg_dump archive and a compatible deployment
whose publishing endpoint returns the expected application authentication
response. A protected or incompatible deployment fails closed. Never pass
database credentials on the command line or commit backups/secrets.

For rollback, pause automation and withdraw the imported drafts through the
same admin service. Retain additive tables/history; do not drop them or restore
over unrelated new user data. Do not roll the public UI back past support for
generated attribution while these tones remain public.

## Unverified outside this environment

Live Supabase migration/backup/import, real administrator browser access,
deployed cron delivery and public production URLs remain unverified because
of the access/deployment gates above. Browser checks used Chromium, not real
mobile Safari or assistive technology. No Python engine or external email/
storage tests were rerun; this feature does not change those services.
