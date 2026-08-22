# Data layer — rules

Owns storage models (`type/`), the IndexedDB connection (`storage/`),
repositories with `$`-prefixed CRUD controllers (`repository/`) and migrations
(`migration/`). Read with the root [AGENTS.md](../../../AGENTS.md).

## R1 — this layer never imports upward

Model defaults a migration needs are **passed in as parameters**.

Every IndexedDB access goes through one primitive — `withStore` (single store)
or `withTransaction` (several) — and both resolve when the transaction
**commits**, not on request success, which fires earlier and hides a late abort
(quota, a malformed record). Hand-rolling is how `$exportAllStores` read each
store separately — not a snapshot: a save landing between two reads yields a
backup whose stores disagree.

`indexed-db.ts` has two rejections that never settle at all: `onblocked` (a
data-layer hang with no store to report through) and `reloadStaleBuild`, where
settling is the bug — the page is already on its way out, and a connection
handed back is a window for the very write the reload exists to prevent.

## Naming — `$` + a verb

Enforced by eslint on `repository/**`: an exported repository function is `$`
plus one of `create`, `read`, `update`, `delete`, `export`, `import`, `restore`.
The last three are not CRUD — `$exportAllStores`/`$importAllStores` are the
backup pair, and `$restoreX` is the undo path that puts a deleted record back.

An upsert is `$updateX` — most
writers here are one (`$updateSession`, `$updateFitSnapshot`, `$updateRoutine`
all `put()` and create if absent), and the doc comment says so.
`$createOrUpdateX` is for the one case where a store has **two** writers at
different addresses and the plain `$updateX` is the strict by-id one:
`$createOrUpdateFlowObservation` upserts on (`taskId`, `date`) while
`$updateFlowObservation` corrects a record and no-ops if it is gone. Do not
reach for it otherwise — handing an upsert a deleted record re-creates it
(MATH.md §36), so which of the two a caller has is worth spelling.

Inside `.svelte`/`.svelte.ts` the `$` prefix is reserved for runes, so import
the repository as a namespace:
`import * as sessionRepository from '$lib/data/repository/session-repository'`.

## R4 — Model inputs are persisted data, not preferences

Anything the model reads must survive a backup/restore round trip.

- **IndexedDB** (via a repository, listed in `indexed-db.ts` `STORE_NAMES`,
  which `backup-repository.ts` imports): sessions, routines, observations, the
  per-day fit snapshots (`fitSnapshots`, MATH.md §12.1), and any setting that
  feeds a calculation — e.g. the Energy Lab's params (`settings` store, key
  `energyParams`).
- **localStorage**: values that have no business in a backup, and whose loss
  costs at most a gesture. The second clause is the operative one — view
  preferences (e.g. which tab of a card was open); `/`'s running session timer
  (`presentation/utils/session-timer.ts`), whose loss costs a typed number but
  which a restored three-week-old backup must never resurrect; and
  `fallow:futile-schema-reload` (`indexed-db.ts`), the one entry in this tier
  the data layer owns — browser-wide because the verdict it records is
  about the deployment, not about the tab that discovered it, and losing it
  costs one extra reload. R8 owns what it means.
- **sessionStorage**: two things, both about surviving exactly one
  `location.reload()`. The toast queue that must outlive a deliberate one
  (`showToastAfterReload` in `presentation/utils/toast.ts`; import and delete
  are the callers, export does not reload and toasts live) — an IndexedDB store
  was considered and is **wrong**: it would join `STORE_NAMES`, so backups
  would carry "Import failed" and restoring an old one would replay stale
  toasts, a permanent schema version (R8) for a string that lives four seconds.
  Nor is it a store's to write: that tier is presentation's, like the Lab's
  view preference. And `fallow:schema-reload-spent` (`indexed-db.ts`), the data
  layer's own and per **tab** where the other marker is per browser — R8 says
  why. A module variable cannot hold it: the reload it bounds is what resets
  the module.
- **Cookies** (via `repository/appearance-repository.ts`): only what SSR must
  know before hydration — `hooks.server.ts` stamps the theme and scenery
  classes so the first paint is already correct. Nothing else.

### Validate on read, in the business layer that owns the shape

Persisted values are user-reachable — hand-edited, restored from an older
backup, or written by a build since deployed over. The data layer parses and
stores; it does not know what a valid value means. Import does not judge
either: it merges whatever the file holds (`backup-repository.ts` checks only
`app` and `schemaVersion`) — the read side is the only line of defence.

- Sessions, tasks, routines and all three observation records go through
  `business/model/persisted.ts`, and **every** read does: each store funnels
  its repository calls through one private helper (`#readSession`,
  `#readRoutines`, `#readFlowObservations`, `#readDrain`, `#readRest`) so a new
  call site cannot quietly skip it, and `session-history.ts` sanitizes at each
  of its reads. Nothing downstream defends itself: `Math.max('abc', 3)` is NaN,
  one non-finite observation makes an entire least-squares fit NaN, and a NaN
  task in the daily session is written straight back by autosave.
- Two repairs, because the records mean different things. Sessions and tasks
  are the user's own content: keep them, clamp the numbers, default a
  non-number to the least-effort end of its scale so corruption can never
  inflate a plan. Observations are measurements: a corrupt number cannot be
  repaired without inventing data, so the record is dropped. A record with no
  usable key (a session with no ISO `date`, a task or observation with no
  finite `id`) is always dropped — nothing can address it.
- Settings and appearance own their validators, next to the shape they know:
  `sanitizeEnergyParams` (energy-lab-store), `resolveThemeName`
  (`business/model/theme.ts`).
- **Add a validator with each new persisted shape**, in
  `business/model/persisted.ts` for a record the model reads, and route the
  read through it — the repository's return type describes a well-formed
  record, never guarantees one.

### No store talks to a storage API directly

Not IndexedDB, not `document.cookie`, not `localStorage`. Key names, cookie
attributes and schema live in exactly one repository: they are read from the
server and written from the browser, and would otherwise be spelled at four
call sites. Store-scoped on purpose — the three presentation-tier keys are why:
`toast.ts`, `/energy`'s `VIEW_KEY` and `session-timer.ts` reach
`sessionStorage`/`localStorage` themselves. The one-place rule still binds them (each key declared in exactly
one module), but a repository would put a view preference in the data layer to
no purpose. "One module" is about production code: a test may re-spell a key as
an independent oracle, the way R8 step 4 keeps the store-name lists literal.

## R8 — Changing the IndexedDB schema is a five-step change

Missing any one ships a broken upgrade or a lossy backup:

1. Bump `DB_VERSION` in `storage/indexed-db.ts`.
2. Add the store inside `onupgradeneeded`, guarded by
   `if (!database.objectStoreNames.contains(...))` — upgrades are additive and
   idempotent, never destructive.
3. Add the store name to `STORE_NAMES` in `indexed-db.ts` (the list lives
   there; `backup-repository.ts` imports it), or it is silently excluded from
   export/import/wipe.
4. Update the two hardcoded store-name lists in `indexed-db.test.ts` and
   `backup-repository.test.ts`. Keep them literal — an independent oracle,
   which a list derived from `STORE_NAMES` would not be. A separate test in
   `indexed-db.test.ts` asserts the created stores equal `STORE_NAMES`, so
   schema/`STORE_NAMES` drift fails on its own even if you update the literals
   wrongly.
5. If data is moving from somewhere else, write a migration in `migration/`
   that never lets the stale source win over what IndexedDB already owns, and
   drops unparseable input instead of retrying forever.

### A bump reloads every other tab

A tab still running the previous build gets `VersionError` the next time it
reaches the database, and `reloadStaleBuild` reloads it into the build that ran
the upgrade: reading a migrated schema with the old build's code, and writing
old-shaped records back into it, is corruption nothing downstream can detect.

Two markers bound that, and which storage each lives in **is** the logic (R4).
`fallow:schema-reload-spent` is per tab, because a tab that comes back to the
same stale build must stop, while the three tabs that never reloaded still must
not be spoken for. Only when a tab reloads and finds the same stale build does
the reload stand proven futile, and that verdict goes browser-wide as
`fallow:futile-schema-reload` — the case being a **rollback**, where the newer
schema outlives the newer build. Both record the on-disk **version** rather
than a bare flag, so a later release still earns a reload of its own and a tab
left behind by two releases reloads for the second.

`openAndHeal`'s missing-store repair records the same verdict directly, for the
version it is about to create: it leaves the disk permanently a version ahead
of the build that healed it, and that build is not stale — it wrote the schema
itself, so no tab should ever spend a reload on it. Every exit lands on the old
degraded open at the on-disk version, what every build did before this guard
existed.

## Settled decisions — do not re-litigate

Task ids are the business layer's — `nextTaskId` in `session-store`, never
recycled — but all three observation stores use one as a foreign key. The rule
is in [`business/AGENTS.md`](../business/AGENTS.md).

### The per-day observation upsert reads through the `date` index

Not a whole-store scan (`flow-observation-repository`). The key is (`taskId`,
`date`), only `date` is indexed, so the day's handful of records are read and
`taskId` matched in memory. A compound index would cost a schema version (R8)
for nothing; scanning the store reads years of history that can never match.

### 🪫 drain ratings do NOT upsert — one row per session

`$createDrainObservation`. `hours` is one session's length for the §8.7 α fit,
while §8.10/§8.11/§12 read a task's hours for a day as the sum of its rows; the
(`taskId`, `date`) upsert this used to do meant a second session overwrote the
first and vanished from that sum (MATH.md §18). The row's 🪫 button therefore
always opens an EMPTY editor — one more session — while correcting a rating
goes through that rating's own chip and `$updateDrainObservation`, which keeps
that row's `createdAt`. Re-logging a correction would count the session twice.
For the same reason the completion prompt passes `measured: false`: finishing a
task ends a session an earlier rating says nothing about.

`$updateDrainObservation` takes no `date`, and that is a **type** error rather
than a convention because the row corrects ratings on days it is only viewing.
A correction re-describes a session that already happened, so restamping it
with the live clock would take those hours off the day they were worked and
credit them to a day nobody worked them — in every per-day sum above, and in
§33's causal window. `createdAt` is excluded for the same reason.

### A day's fitted params are stored, not recomputed from the logs

MATH.md §12.1. The fit as of day D _is_ a pure function of the observations
dated ≤ D, so the §12 audit could refit per audited day instead of reading a
`fitSnapshots` record — and that would fix history retroactively, which storing
cannot. It loses on cost, and only on cost: each per-day refit costs a
WHOLE-history fit (19 ms/day measured, 570 ms for a 30-day audit vs 17.6 ms for
one), so recomputation is O(auditDays × totalLogVolume) and gets slower every
time the user logs anything, on a screen that runs it on every visit. Do not
re-propose refitting as a simplification; the trade was measured.

Two consequences that follow and are intended: **only today's record is ever
written** (a past day's fit is what the user had, so it is never rewritten —
`$updateFitSnapshot` is an upsert on the date and every caller passes today),
and a day with **no** snapshot falls back to the caller's live fit rather than
dropping out of the audit, because the day was still worked.
