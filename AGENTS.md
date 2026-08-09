# AGENTS.md — working rules for Fallow

The single contributor/agent brief for this repo. Read it before changing code.

Other documentation, and nothing else:

| File                                                             | What it is                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| [README.md](README.md)                                           | User-facing: what the app does and how to run it                    |
| [MATH.md](MATH.md)                                               | **Authoritative** record of the implemented math — every derivation |
| ↳ its `## Section index`                                         | 4.2k lines / ~64k tokens. Read the section you need, not the file   |
| [ROADMAP.md](ROADMAP.md)                                         | Planned work in priority order — update when an item ships          |
| [STYLE.md](src/lib/presentation/style/STYLE.md)                  | All styling rules — read before touching markup or classes          |
| [zenith.md](zenith.md)                                           | Frozen copy of the source article. Historical only — never a spec   |
| [.claude/skills/verify/SKILL.md](.claude/skills/verify/SKILL.md) | How to launch and drive the app in a real browser                   |

Do not add new top-level `.md` files. New durable knowledge belongs in one of
the six above — architecture and rules here, math in `MATH.md`, styling in
`STYLE.md`, planned work in `ROADMAP.md`.

---

## 0. Less code, fewer bugs

The rule that outranks every rule below: **build the simplest thing that does
what was asked, and nothing else.** Think like an architect about where code
goes; do not let that turn into building for a future nobody has asked for.

- **Ship the ask, not the ask plus your improvements.** A form that opens on
  check and closes on uncheck is a form that opens on check and closes on
  uncheck. Flags, live regions, extra guards and defensive branches that were
  not asked for are not free — every one is state to reason about, a comment to
  keep true, and a test to maintain.
- **No speculative generality.** No abstraction for a second caller that does
  not exist. Extract on the _second_ real duplication (R3), not in
  anticipation of one.
- **Complexity needs a reachable failure to justify it.** If you cannot name
  the inputs and the wrong outcome, the branch does not go in. "Defensive" is
  not a reason; unreachable code is a lie about what can happen.
- **Comments earn their length.** One or two lines saying _why_, where the code
  cannot. A paragraph justifying a decision usually means the decision is too
  clever — simplify the code instead of defending it.
- **When you notice something unrelated, say it; do not fix it.** A finding
  reported costs a sentence. A finding fixed costs a review, a test, and a
  larger diff for the thing you were actually asked to do.

Deleting code to satisfy this rule is progress, not lost work.

## 1. Hard rules

Each exists because it was broken before.

### R1 — Layers point one way: presentation → business → data

- `src/lib/presentation` (and `src/routes`): UI only. **Never** imports
  `$lib/data/*`. Persisted types come from `$lib/business/type` — the one
  place; never re-export an entity type from a model as a convenience (`Task`
  was reachable from `metric/calculation.ts` too, and a route used that path).
- `src/lib/business`: domain logic — pure models (`model/`), reactive stores
  (`store/`), app-wide reactive state (`state/`), pure helpers (`utils/`). Never imports
  `$lib/presentation/*`. The layer's **root** is the fifth category and the
  easy one to get wrong: composed, stateless facades over the data layer —
  `session-history.ts` (read-side sessions, the calibration snapshot, storage
  startup), `backup.ts`, `appearance.ts`. Not a store: no reactive state, and
  the stores are among its callers. Not `utils/`: `utils/` is pure — which is
  what lets a route value-import from it (see
  `presentation-not-to-business-model`) and what nothing touching IndexedDB
  may claim.
- `src/lib/data`: storage models (`type/`), the IndexedDB connection
  (`storage/`), repositories with `$`-prefixed CRUD controllers
  (`repository/`), migrations (`migration/`). Never imports upward; model
  defaults a migration needs are **passed in as parameters**. Every IndexedDB
  access goes through one primitive — `withStore` (single store) or
  `withTransaction` (several) — and both resolve when the transaction
  **commits**, not on request success, which fires earlier and hides a late
  abort (quota, a malformed record). Hand-rolling is how `$exportAllStores`
  read each store separately — not a snapshot: a save landing between two
  reads yields a backup whose stores disagree.
- `src/lib/logger.ts`: below all three layers, and the only module that is —
  every layer and the hooks report diagnostics, so a home inside any one layer
  would break the direction for the other two. It imports nothing from the
  app (`logger-imports-nothing`, an error) and is the only file allowed to
  touch `console`; `no-console` is an **error** everywhere else (`scripts/`
  exempt — console output is the point there). Call `logError` / `logWarning`
  with a message, the caught error, and a `context` object of ids, dates and
  counts — **never task titles or notes**, the payload a reporting service
  would ship off-device. Plugging in Sentry or similar is one `setLogSink`
  call in `hooks.client.ts`; no per-call-site reporting. Logging is **not** a
  user-facing surface — see the next bullet — and most failures do one of
  each.
- **Three user-facing failure surfaces; picking the wrong one is the bug.**
  Retryable and persistent → the banner, `StorageStatusStore`'s
  (`store/storage-status.svelte.ts`): a store takes a `StorageReporter` from
  `register(name, retryLoad?)` and reports `'load-failed'` or `'save-failed'`,
  passing `retryLoad` if it can fail a **read** — that is what the banner's
  Retry re-runs. Transient and informational → a toast
  (`presentation/utils/toast.ts`). Already visible in the failing component →
  nothing more, but verify it really is visible: the `analytics-store` load is
  two `try` blocks — one per read — because `#hasModelReportFailed` takes both
  cards that read feeds out of their loading string and each then says so
  itself, while a failed **history** read renders every chart as an empty year
  — looks like a user with no data, so it toasts. Silent is only acceptable
  where the screen is already visibly wrong. Four stay deliberately silent
  (re-proposing them is churn): yesterday's session (decoration, and the
  banner's Retry does not cover that read), the Energy Lab's `localStorage`
  view preference (loss costs nothing), its `readStopObservations` effect
  (any real outage also fails the `settings` read, which toasts for both; an
  isolated failure only empties a fit the card already labels "not fitted"),
  and `readTitleRatings` (the add-task form offers no title suggestions and every
  task is rated on the 5/5/5 defaults it shipped with for a year — a banner would
  claim the day failed to load).
  Silent still means **logged** — `readStopObservations` was an unhandled
  rejection until caught. `indexed-db.ts` has two that never settle at all:
  `onblocked` (a data-layer hang with no store to report through) and
  `reloadStaleBuild`, where settling is the bug — the page is already on its way
  out, and a connection handed back is a window for the very write the reload
  exists to prevent.
  A count is not a surface: `importFromDate` returning 0 makes the header say
  "No tasks on that date", a claim about the user's data a failed read cannot
  support, so it raises the retryable banner instead.
- **A store never imports the toast API; it takes an injected thunk.**
  Importing is doubly illegal (business → presentation, caught by both
  `eslint` and `depcruise`), and `svelte-sonner`'s `toast` is module-scope
  state, which no store may hold. Injection also keeps the store testable
  without module mocks — the same reason R5 exists. Two so far —
  `EnergyLabStore`'s `NotifyParamsLoadFailed`, `AnalyticsStore`'s
  `NotifyHistoryLoadFailed` — both wired by the `(app)` layout, which builds
  every store in the app even where only one route reads it: one purpose-named
  thunk per case, **not** a `NotificationKind` union. Severity vocabulary and
  copy belong to presentation; an enum in business mirrors the message
  catalogue for no gain. A second site gets its own thunk; a union earns its
  keep at three. The banner is the counter-example that shows the line: a
  business-owned _state_ with no copy in it (`'load-failed'` is a machine
  value the layout localizes), so it is a store the others take, not a thunk
  they are handed.
- Enforced twice, and the two catch different things. `no-restricted-imports`
  in `eslint.config.js` matches the `$lib/...` **specifier string** — a
  dynamic `import('$lib/data/...')` crossing is invisible to it, and a
  relative one only cannot hide because relative specifiers are banned
  outright (see Code), not because it reads them as layer violations.
  `.dependency-cruiser.cjs` resolves modules to disk; its four directional
  rules — `data-not-to-upper-layers`, `business-not-to-presentation`,
  `presentation-not-to-data`, `presentation-not-to-business-model`, all
  `severity: 'error'` — catch those. Run with
  `npm run depcheck`; it is in CI. `src/lib/paraglide` is generated and
  exempt.
- One gap worth knowing: the Svelte compiler strips `import type` before
  dependency-cruiser parses a `.svelte` file, so a type-only crossing from a
  component produces no edge to flag. Inside components that boundary is
  eslint's alone (it does flag `import type`) — hence the error severity, and
  hence persisted types coming from `$lib/business/type`.

### R2 — Routes and components hold no logic

The lint rules enforce dependency _direction_, not code _placement_: a route
importing business code is legal, so logic drifts into `+page.svelte` where
nothing can unit-test it. Happened twice (a 518-line main page, a 1349-line
Energy Lab); both had to be pulled back out.

Reads end at a store: `presentation-not-to-business-model` in
`.dependency-cruiser.cjs` is an **error** when a route or component
value-imports `$lib/business/model/*` (stores, state, `utils`, and
`import type` are fine). Not a judgement call: put the orchestration in a
store and give the page the result.

A `+page.svelte` may contain: markup, local UI-only state (draft editors,
open/closed toggles, view preferences), formatters, and thin `$derived`
aliases of a store. Anything else — model orchestration, fits, persistence,
threshold policy — goes in a module:

| Kind of code                        | Where it goes                                        |
| ----------------------------------- | ---------------------------------------------------- |
| Pure math                           | `business/model/*.ts`                                |
| Composed model results for a screen | `business/model/metric/daily-metrics.ts` (or a peer) |
| Reactive state + persistence        | `business/store/*.svelte.ts`                         |
| Labels, thresholds, colors, i18n    | `presentation/utils/*.ts`, `presentation/component/` |

Rule of thumb: if you cannot write a `.test.ts` for it, it is in the wrong
file.

### R3 — One definition per concept

A mapping used by two subsystems is exported once, never mirrored.
`Task → EnergyTaskInput` lived in two places with a comment admitting it
("mirrors the Energy Lab's task mapping") — the Lab and the calibration fits
could have silently disagreed about what a task _is_; now it is `toEnergyTask`
in `business/model/metric/calculation.ts`. `workedHoursByTask` in
`zenith-energy.ts` is the same story: the §8.10 stopping fit and the §12
adherence audit each had their own "hours per task, restricted to the day's
tasks" join — free to disagree about what the user actually worked, while
auditing each other.

The two task screens are the same rule in the UI. `/` and `/energy` render the
same day's list, and everything they were free to disagree about had drifted:
the card around the list, where the add-task form sat (top on one, bottom on
the other — plus a second form in the Lab's empty state, which replaced itself
with a collapsed one the moment it took the first task, leaving no field on
screen), the rule between rows, and the ✎ editor, which only `/` had, so the
Lab could not rename a task at all. Four components hold what the two screens
say the same way now:

- `task-list-card.svelte` — the card, the heading, the form above the list, the
  empty state, and the rule between rows (`divide-y`, so neither screen
  decides how its own list is separated).
- `task-row-shell.svelte` — the row's frame and hover surface, the completion
  checkbox, the title, the `P · M · E` line, the whole action strip (⚡, 🪫, ✎,
  ✕) and every editor it opens, including the completion prompt that opens
  both measurements at once. Each screen adds only its readings, through
  `lead` / `meta` / `trailing`. An action is present when its callback is, so a
  past day passes neither measurement and a read-only row no ✎ or ✕. The two
  measurements were one-per-screen until 2026-08-09 and are not any more: both
  models read both fits — ϕ (⚡) feeds the Lab's own curves, and the α, λ₀, §12
  audit and §11.9 carry-over readings all run off 🪫 hours — so each screen was
  withholding an instrument the other's model consumes (ROADMAP item 11).
  The ⚡ editor is the shell's own state; the 🪫 draft is the PAGE's, because
  the Lab's calibration card opens one from outside the row. `DrainDraft` and
  `newDrainDraft` in `measurement-prompt.ts` are what keep the two pages'
  copies one shape, and `EnergyObservationStore.drainMeasuredToday` is the one
  answer to "is this task rated today" that both screens light 🪫 from.
  What the row has already measured has to read at REST, since the strip is
  hover-revealed: ⚡ is badged beside the `P · M · E` line (one number per day),
  and 🪫 cannot be — a task worked twice has two ratings — so it pins the strip
  open instead and the lit button is what says so.
- `measurement-form-actions.svelte` — the ✓/✕ that closes ⚡, 🪫 and 😴. It
  exists because those three editors were written separately and drifted into
  two different button sizes, one with a hover surface and one without; the
  instrument's hue on ✓ is the only real difference and is a prop.
- `task-edit-form.svelte` — the editor, on both screens.
- `task-form-fields.svelte` — the fields both task forms set: the three model
  input sliders (one loop over one table, so their labels, minimums and accents
  are defined once) and the must-do flag, in the row the submit buttons sit in.
  `TaskEdit` — the five fields a form can set — is this component's type, since
  adding a task and re-tuning one emit the same thing. The forms are otherwise
  not each other: `task-form.svelte` is a title combobox over rated history
  with a collapse and a reset, `task-edit-form.svelte` is a plain title input,
  which is ~150 lines of script the editor has no counterpart for. Do not push
  the title or the frame in here to make them look like one component; the
  callers keep both, so each frame and each field is defined once, whole, and
  the caller's own `space-y-*` is what sets the form's density.

What is left in `task-item.svelte` and `energy-task-row.svelte` is one
screen's reading of the task and nothing else: priority, allocation, run order
and T* on `/`, the schedule's hue and hours in the Lab — three snippets and the
prop mapping around them. That is two readings of one task, not one thing
duplicated — and it is the only reason there are two components. If the
readings ever converge, merge the two callers; do not give the shell a mode
flag.

If you catch yourself writing "mirrors", "same as", or "keep in sync with" in
a comment, export the thing instead.

### R4 — Model inputs are persisted data, not preferences

Anything the model reads must survive a backup/restore round trip.

- **IndexedDB** (via a repository, listed in `indexed-db.ts` `STORE_NAMES`,
  which `backup-repository.ts` imports): sessions, routines, observations, the
  per-day fit snapshots (`fitSnapshots`, MATH.md §12.1), and any setting that
  feeds a calculation — e.g. the Energy Lab's params (`settings` store, key
  `energyParams`).
- **localStorage**: only values whose loss costs nothing and that have no
  business in a backup — view preferences (e.g. which tab of a card was open),
  and `fallow:futile-schema-reload` (`indexed-db.ts`, R8), the one entry in this
  tier the data layer owns: the on-disk schema version a stale-build reload has
  been proven not to fix. Browser-wide on purpose, because that verdict is about
  the deployment and not about the tab that discovered it, and losing it costs
  one extra reload. It records the version rather than a bare flag so a later
  release still earns a reload of its own.
- **sessionStorage**: two things, both of them about surviving exactly one
  `location.reload()`. The toast queue that must outlive a deliberate one
  (`showToastAfterReload` in `presentation/utils/toast.ts`; import and delete
  are the callers, export does not reload and toasts live) — an IndexedDB store
  was considered and is **wrong**: it would join `STORE_NAMES`, so backups would
  carry "Import failed" and restoring an old one would replay stale toasts, a
  permanent schema version (R8) for a string that lives four seconds. Nor is it
  a store's to write: that tier is presentation's, like the Lab's view
  preference. And `fallow:schema-reload-spent` (`indexed-db.ts`, R8), which is
  the data layer's own and is per **tab** for the reason the other marker is
  per browser: every stale tab has to reload, so one tab's success must not
  answer for the tabs still holding the old build in memory. A module variable
  cannot hold it — the reload it bounds is what resets the module. It records
  the same on-disk version, so a tab left behind by two releases running still
  reloads for the second.
- **Cookies** (via `data/repository/appearance-repository.ts`): only what SSR
  must know before hydration — `hooks.server.ts` stamps the theme and scenery
  classes so the first paint is already correct. Nothing else.

Persisted values are user-reachable — hand-edited, restored from an older
backup, or written by a build since deployed over. **Validate on read, in the
business layer that owns the shape.** The data layer parses and stores; it
does not know what a valid value means. Import does not judge either: it
merges whatever the file holds (`backup-repository.ts` checks only `app` and
`schemaVersion`) — the read side is the only line of defence.

- Sessions, tasks, routines and all three observation records go through
  `business/model/persisted.ts`, and **every** read does: each store funnels
  its repository calls through one private helper (`#readSession`,
  `#readRoutines`, `#readFlowObservations`, `#readDrain`, `#readRest`) so a
  new call site cannot quietly skip it, and `session-history.ts` sanitizes at
  each of its reads. Nothing downstream defends itself: `Math.max('abc', 3)`
  is NaN, one non-finite observation makes an entire least-squares fit NaN,
  and a NaN task in the daily session is written straight back by autosave.
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

No **store** talks to a storage API directly — not IndexedDB, not
`document.cookie`, not `localStorage`. Key names, cookie attributes and schema
live in exactly one repository: they are read from the server and written from
the browser, and would otherwise be spelled at four call sites. Store-scoped
on purpose — the two presentation-tier keys are why: `toast.ts` and
`/energy`'s `VIEW_KEY` reach `sessionStorage`/`localStorage` themselves. The
one-place rule still binds them (each key declared in exactly one module), but
a repository would put a view preference in the data layer to no purpose. "One
module" is about production code: a test may re-spell a key as an independent
oracle, the way R8 step 4 keeps the store-name lists literal.

### R5 — Business code does not import SvelteKit routing

Stores take what they need as arguments. `SessionStore` reads the viewed day
through an injected `ReadDateParam` thunk supplied by the `(app)` layout — not
by importing `$app/state`. Testable without module mocks; routing stays a
layout concern.

The **environment** is an argument too. `ThemeStore` takes both appearance
snapshots — the SSR payload (`data.appearance`) and `appearance.ts`'s
`readClientAppearance()`, both read by `+layout.svelte` — instead of reading
`document.cookie` itself behind a `browser` check. The layout is the module
that genuinely runs in both places; a store handed two snapshots reconciles
them by precedence alone, and its spec needs no module mock to do it.

`$app/environment`'s `browser` is still fine where a module really does run in
both (`state/today.svelte.ts`, whose getter SSR reaches). **Never inside an
`$effect`**: effects do not run during SSR, so a `browser` guard in one is dead
code — six were, across `SessionStore`, `EnergyLabStore` and
`debounced-write.svelte.ts`, until 2026-08-04.

### R6 — Test first: write it, watch it fail, then implement

No exceptions for "small". The test comes **before** the implementation, and
you must **see it fail for the reason you expect** — not error out on a typo, a
missing import, or a locator that never matched. A test written after the code
is a description of whatever the code happens to do; only a test you watched go
red proves it can catch the thing coming back.

This applies to features as much as to bugs. Write the assertion for the
behaviour you are about to add, run it, read the failure, then build. If the
"failure" is anything other than the behaviour being absent, the test is wrong —
fix the test before touching the implementation.

Pick the level:

| Change                            | Test                                                   |
| --------------------------------- | ------------------------------------------------------ |
| Math / model                      | `*.test.ts` beside it, asserting the identity or bound |
| Metric composition, scoping       | `daily-metrics.test.ts` — scope invariants             |
| Repository, migration, IDB schema | `*.test.ts` with `fake-indexeddb`                      |
| Store (needs a component context) | `*.svelte.spec.ts` + a test harness component          |
| Component                         | `play` function on its story (`storybook` project)     |
| Component, not story-expressible  | `*.svelte.spec.ts` — module mocks, rerender, head      |
| A user-visible flow               | `e2e/*.e2e.ts`                                         |

**Check for existing coverage first; when there is none, adding it is part of
the change, not a follow-up:**

- **Fixing a bug** — the failing test comes from the _reproduction_, so write
  the repro first and let it dictate the test.
- **Adding a feature** — it ships with tests for its own behaviour, including
  the empty, failed and boundary cases, not only the happy path. One test per
  behaviour, not per branch: a suite that grows faster than the feature is a
  cost, and every test is code that has to be maintained too.
- **Refactoring** — pin the behaviour _before_ moving it: add the test against
  the OLD code, confirm it passes, then refactor. That is what makes it a
  safety net rather than a description of whatever the new code happens to do.
- **Moving logic between layers** — coverage moves with it. When a component
  stops computing something, the assertion that used to prove it (a rendered
  label, say) no longer does; re-assert wherever the logic landed.

"There was no test for this before" is a reason to write one, never a reason
to skip it. If a change genuinely cannot be tested, say so explicitly and
why — usually a sign it is in the wrong file (R2).

Test the invariant, not the implementation: "completing a task must not move
plan-scoped metrics" — a rule that has actually been violated — not that a
function returns what it returns.

`vitest.config` sets `expect.requireAssertions: true`; a test with no
assertion fails.

### R7 — Math changes go in MATH.md, in the same change

`MATH.md` is the spec; the code is the implementation. If you change a
formula, a constant, a bound, or a fit's conditioning:

1. Update the relevant `MATH.md` section **in the same commit**.
2. Cite the section from the code comment (`// MATH.md §8.7`) so the two stay
   findable from each other.
3. If only the _explanation_ was wrong and the model did not change, log it in
   MATH.md §10 (doc-only revision log) — do not imply a model change.
4. Never "fix" the code to match `zenith.md`. The implementation deliberately
   deviates from the article; MATH.md §6 lists how and why.
5. If you added or moved a section, run `node scripts/math-index.mjs` — never
   retype a row of the section index. Its ranges are a fixed point (the index
   sits above what it indexes, so a new row shifts its own numbers) and its
   columns have truncation rules that are invisible in the output. `npm run
lint` fails on a stale index.

### R8 — Changing the IndexedDB schema is a five-step change

Missing any one ships a broken upgrade or a lossy backup:

1. Bump `DB_VERSION` in `src/lib/data/storage/indexed-db.ts`.
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
5. If data is moving from somewhere else, write a migration in
   `data/migration/` that never lets the stale source win over what IndexedDB
   already owns, and drops unparseable input instead of retrying forever.

A bump also **reloads other tabs** — every one of them. A tab still running the
previous build gets `VersionError` the next time it reaches the database, and
`reloadStaleBuild` reloads it into the build that ran the upgrade: reading a
migrated schema with the old build's code, and writing old-shaped records back
into it, is corruption nothing downstream can detect. Two markers bound that, and
which storage each one lives in **is** the logic (R4). `fallow:schema-reload-spent`
is per tab, because a tab that comes back to the same stale build must stop, while
the three tabs that never reloaded still must not be spoken for. Only when a tab
reloads and finds the same stale build does the reload stand proven futile, and
that verdict goes browser-wide as `fallow:futile-schema-reload` — the case being a
**rollback**, where the newer schema outlives the newer build. `openAndHeal`'s
missing-store repair records the same verdict directly, for the version it is
about to create: it leaves the disk permanently a version ahead of the build that
healed it, and that build is not stale — it wrote the schema itself, so no tab
should ever spend a reload on it. Every exit lands on the old degraded open at the
on-disk version, what every build did before this guard existed.

---

## 2. Conventions

Most are enforced by eslint/prettier — see the configs. The rest:

### Naming

- No abbreviations.
- Files and folders: singular, `kebab-case`. (Exception: config files whose
  name a tool dictates.)
- Slot names and emitted events: `kebab-case`.
- Functions: _imperative verb + object [+ from|to|by + target]_ —
  `getUser()`, `addItemToCart()`, `sortCompaniesByName()`.
- **Booleans start with `is`, `has` or `with`** — `isOpen`, `hasUser`,
  `withAutoLoad` — so the name reads as a claim and never as a command: a prop
  called `open` or `fitted` says nothing about whether it asks a question or
  performs an action, which is how a caller ends up passing the wrong thing.
  `can` / `must` / `should` are the same shape where the modal is the accurate
  verb (`canLog`, `mustDoToday`). A component's own mount-time copy of such
  a prop keeps the plain word (`isOpen` → `let open = $state(isOpen)`), so the
  two never shadow each other. Existing names are a baseline, not a to-do list:
  rename one when you touch it, in a change of its own.
- Data-layer controllers start with `$` + a CRUD verb: `$createX`, `$readX`,
  `$updateX`, `$deleteX`. Inside `.svelte`/`.svelte.ts` the `$` prefix is
  reserved for runes, so import the repository as a namespace:
  `import * as sessionRepository from '$lib/data/repository/session-repository'`.

### Code

- Named exports only; default exports are for Svelte components. Enforced by
  `no-restricted-syntax` on `ExportDefaultDeclaration`; root `*.config.*` and
  `.storybook/` are exempt because their tool dictates the default export.
- Import through `$lib`, never a relative path — including a sibling. Three
  exemptions, each because the alias genuinely does not resolve: `./$types`
  (generated per route by `svelte-kit sync`), `e2e/` (Playwright has no Vite
  aliases), `.storybook/` (outside `src`). `component/ui/` is exempt too, for
  a different reason: `shadcn add` rewrites those barrels relative.
- `const` over `let`. Early returns over nested `if`.
- One responsibility per function. A function that _does_ something is an
  **action**; one that _reacts_ is a **handler**, named `onClick`,
  `onInputChange`. Handlers only handle — they compose actions.
- Comments explain _why_, and pay for their line count. Match the density of
  the file you are in.

### Svelte / stores

- **Every store reaches a route through its `setXStore()`** — all seven
  (`ThemeStore`, `StorageStatusStore`, `SessionStore`,
  `EnergyObservationStore`, `DailyPlanStore`, `AnalyticsStore`,
  `EnergyLabStore`). Sole exception: a `*.test-harness.svelte`, which
  constructs directly because the store under test is the thing it hands back.
  A bare `new XStore(...)` in a route is not a shortcut, it is the hole:
  `setContext` **throws outside component initialisation**, which is what
  makes "a store only ever exists inside a component tree" mechanically
  enforced instead of merely conventional. Do not assume the runes catch it:
  `DailyPlanStore` touches neither `onMount` nor `$effect`, only
  `$state`/`$derived`, so `new DailyPlanStore(...)` in a `+page.ts` `load()`
  **succeeds** — state created on the server and shared across SSR requests.
  `business/state/*.svelte.ts` remains the one module-scope exception, only
  for values derived from the environment (e.g. the clock), never user data.
- **Context is the creation rule; what the constructor does picks the tree.**
  `setXStore()` runs in whichever component's tree needs the store — the root
  layout for `ThemeStore`, `(app)` for `StorageStatusStore`, `SessionStore`,
  `EnergyObservationStore` and `EnergyLabStore` (status store first, because
  the others report into it and register their re-reads), the route's own
  instance script for `setDailyPlanStore` in `/` and `setAnalyticsStore` in
  `/analytics`. **Every store loads at init** — in its constructor, so a caller
  holding one never has to know it is inert. Three questions place the call:
  - **Does the constructor do I/O?** If not, lifetime is irrelevant: put the
    store at the route, because recreating it costs an allocation.
    `DailyPlanStore` touches neither `onMount` nor `$effect` — it is a fold
    over two layout stores, so a fresh one per visit is free.
  - **Do several routes read it?** Then it belongs at their lowest shared node,
    and its data comes from _that_ node's load. `ThemeStore` is the clean case:
    `+layout.server.ts` reads the cookies, the root layout hands them to the
    constructor, and no route ever passes the store anything. Nothing else can
    follow it — every other store's data is in IndexedDB, which no server
    `load` can await, which is why the rest read for themselves.
  - **Does it hold state its source does not own?** Then hoist it above the
    consumers and take each fresh slice through a named setter. Do **not** add
    an `init(data)` for the route to call on arrival: if it resets everything
    it is recreation with a precondition bolted on, and if it does not, the
    store and its source are two authorities over one array.

  For a single-route store whose constructor reads, both trees are defensible
  and the trade runs the same way in each direction:
  - **On the route, recreation is the refresh.** `AnalyticsStore` reads a year
    of summaries plus a 30-day audit that runs both planners per day: at boot
    every other page would pay for it, and it reads day summaries the main page
    rewrites all day, so arriving with a fresh store is how the numbers stay
    true. The price is the empty window on the way in, which the page's
    placeholder frame covers. Do **not** reach for a lazy `load()` to get cheap
    boot without that price — an inert store whose correctness depends on the
    caller remembering a second call is worse than the re-read it saves.
  - **In the layout when nothing outside can make it stale.** `EnergyLabStore`
    moved there: its params and stop observations are written by the Lab alone,
    so a surviving instance cannot fall behind, and the optimizer behind `plan`
    is a `$derived` no `$effect` touches, so it stays unrun on the five routes
    that never show it. What it buys is the ~120ms of placeholder a page-scoped
    store spent re-reading on every visit. Hoisting one that _can_ go stale
    means a named refresh per staleness reason, called by whoever knows the
    reason — `SessionStore` has two, `retryLoad()` for the banner's button and
    a `visibilitychange` re-read for a returning tab. A refresh is not the
    `load()` above: it leaves the store valid, only less current.
  - **A layout-scoped debounced write flushes on app teardown, not route
    teardown**, and that is not a loss: the pending timer stays alive to fire
    on its own precisely _because_ the store did, and `visibilitychange` still
    covers a tab that leaves first.
  - `StorageStatusStore.register` has no unregistration, so anything
    layout-scoped may pass a `retryLoad` freely and anything page-scoped may
    not. `EnergyLabStore` registers without one anyway, on its own merits: a
    failed params read is a toast, not the banner.

  A single-consumer store's `getXStore()` may legitimately have no callers yet;
  it lets a child component read the store without the page threading it down,
  at one line.

- **Loaded-ness is a field, never emptiness.** Every store that reads carries
  its own `isLoading`/`isLoaded`, because an empty array is an answer and a read
  that has not returned is the absence of one. Collapsing them is how a page
  ends up telling a user with a full week "No tasks" — the failure the
  first-paint policy in `STYLE.md` exists to prevent. A getter that reports on
  the data rather than the read (`AnalyticsStore.hasData`) is only meaningful
  once the flag says the read is done, and says so in its doc comment.
- A class field that a `$derived` initializer reads must be declared with `!`
  and assigned first in the constructor — the deriveds are lazy, but
  TypeScript checks declaration order.
- Components take snippets/props from the layout; they do not reach into
  stores themselves.
- **Autosave goes through `createDebouncedWrite`**
  (`store/debounced-write.svelte.ts`), which owns the whole mechanism: the
  trailing timer, the `onDestroy` flush and the flush-when-hidden listener. A
  store snapshots inside its own tracked `$effect` and calls
  `schedule(payload)`; nothing else. The rule the module encodes: **a debounce
  flush belongs in `onDestroy`, never in an `$effect` teardown.** An effect's
  cleanup runs before _every_ re-run, not only on destroy — flushing there
  fires on each keystroke and defeats the debounce, while cancelling there
  (the old bug) silently drops the last edit when the user navigates away. The
  session store and the Lab each had their own copy spelling the 500 ms delay
  two ways — R3 applied to a mechanism. The delay is `AUTOSAVE_DEBOUNCE_MS`;
  wait on it in a spec, never on `500`; `e2e/helpers.ts` exports its own
  `AUTOSAVE_MS = 1000` for Playwright, which cannot import app code. Two
  things stay with the caller because they are not the mechanism. The Lab's
  `#saveArmed` guard: the effect's first run after a load only establishes
  tracking, and scheduling there writes the just-loaded params straight back —
  after a _failed_ load, that overwrites the stored calibration with the
  defaults, a bug that shipped and is pinned by
  `energy-lab-store.svelte.spec.ts`. And the session store's re-read when the
  tab becomes visible, which asks the writer for `pending` so an unlanded edit
  is not overwritten by the stored day — reachable because a hidden tab that
  rolls over midnight re-loads and re-arms the autosave.
- **An inline editor focuses with `{@attach (node) => node.focus()}`, never
  `autofocus`.** The attribute is inert on any node inserted after load (the
  document's autofocus-processed flag), so all three editors that used it — ⚡,
  🪫, ☕ — silently never focused. The attachment also makes the choice
  conditional, which matters where an editor opens itself: `task-row-shell.svelte`
  opens both measurement editors on task completion and deliberately does NOT
  focus either, so ticking tasks off with the keyboard cannot yank the caret
  into a number field.
- **A `DropdownMenu.Item` never contains a focusable child, and an input inside
  menu content stops the keys it needs.** Two separate bits-ui facts, both of
  which shipped as mouse-only UI in the header's routine rows. First: the menu's
  Tab handler `preventDefault`s and moves focus past the whole menu, so a
  `<button>` nested in an item is unreachable, and Enter on the item dispatches
  the click at the _item_ — an item with no `onclick` silently does nothing. A
  row of two actions is therefore two sibling items inside a
  `DropdownMenu.Group` (`role="group"` keeps the menu → menuitem ownership
  valid), not one item with buttons in it. Second: the content's keydown handler
  claims arrows/Home/End for roving focus and every single character for
  typeahead **regardless of the event's target**, so an `<input>` in a menu must
  `stopPropagation()` on the keys it owns — but never on Escape, whose listener
  sits on `document`, nor on the arrow that is the only way out of the field
  (menu content hands focus to its first tabbable on open, which is that input).
- Storybook stories live **beside their component** (`*.stories.svelte`), one
  file per component or primitive group, rendered as smoke tests by the
  `storybook` vitest project. `.storybook/preview.ts` builds the theme toolbar
  from the catalogue in `business/model/theme.ts` and stamps the theme classes
  onto `<html>` the way `hooks.server.ts` does, so a story is reviewable on
  any of the 37 themes. `presentation/theme.stories.svelte` is the
  componentless one: a tall page for judging a theme's background, scenery and
  token swatches, parked outside `style/` on purpose (STYLE.md's scanner
  note). `@storybook/addon-a11y` runs axe on every story with
  `test: 'error'` — an a11y violation **fails CI**. `theme.stories.svelte`
  opts out of `color-contrast` only: it renders every fill/ink pair on
  purpose, including the 18 of 333 that cannot reach 4.5:1 (see STYLE.md's ink
  note; the budget is measured by `scripts/ink-contrast.mjs`). Contrast stays
  enforced on every real component. Storybook is also what
  `scripts/hover-contrast.mjs` drives (on :6006, unlike the ink script): axe only
  ever sees a story's REST state, so every hover fill's step and label contrast
  is measured there instead, over all 37 themes.

### Style

All styling rules live in [STYLE.md](src/lib/presentation/style/STYLE.md):
tokens-only classes, the `dark:` ban, the three colour roles and the ink
contrast budget, the two hover families, backdrop-blur, sonner's four
registry deviations, the
Tailwind scanner gotchas, the CSS namespace split, the adding-a-theme
checklist. **Read it before touching markup, classes, or anything under
`presentation/style/`.**

**Imports**, in order: types → external libs → internal helpers → data layer →
business layer → presentation (big/abstract to small/specific).

---

## 3. Model invariants

Full derivations in `MATH.md`; `zenith.test.ts` is the executable spec
(closed forms vs. numeric integration, root equations, allocator vs. brute
force). Do not change these without reading the derivation first.

### Zenith model (`business/model/zenith.ts`, model v2)

- User inputs are 1–10; the model maps difficulty Eᵤ∈[1,10]→E∈[1,5] and
  enjoyment βᵤ∈[1,10]→β∈[1,2]. Metrics comparing E against β must account for
  the asymmetry (some deliberately use raw values instead).
- Productivity curve: `p(t) = (a·kt + p₀)·e^(−kt)`, `k = (1−p₀/a)/ϕ`, so
  `p(0) = p₀` genuinely holds; peak at `t = ϕ`, value `a·e^(p₀/a−1)`. The
  ratio `r = p₀/a` is capped at 0.9 (`AMPLITUDE_RATIO_CAP`).
- The single-task optimum is **per task**: `T* = ϕ·x*(r)/(1−r)` where `x*(r)`
  solves `eˣ = 1 + x + x²/(1+r)`; the multiplier ranges over [1.5194, 1.7933]
  — 1.5 is the r → 1 asymptote and `AMPLITUDE_RATIO_CAP = 0.9` forbids it.
  `OPTIMAL_PHI_MULTIPLIER` (1.7933) is only the r→0 limit / upper bound (and
  the energy model's seed) — use `findOptimalSingleTaskTime` for real values.
  `TaskAllocation.optimalHours` is the ϕ-uncertainty-hedged optimum and is
  free to fall **below** that band: every user carries a posterior from day
  one, so on the zero-log posterior 23 of the 100 slider pairs land under
  1.5194ϕ and 6 under ϕ itself, bottoming at 0.7219ϕ (§5.1). The other 77 do
  sit in the band — but nothing holds them there, so no copy may quote it. The allocator never assigns time meaningfully past a task's `T*`.
- The objective is `Σᵢ P̄ᵢ(tᵢ)` — a sum of average productivity _rates_, not
  total output. `P̄` jumps from 0 to ≈`p₀` at `t = 0⁺` ("activation bonus"),
  so the objective is **not concave** — Lagrange/KKT solvers are invalid
  here. The allocator works on discrete 15-minute blocks (`BLOCK_HOURS`):
  greedy marginal analysis (exact for the single budget), exhaustive
  funded-subset enumeration for switch costs (exact, n ≤ 12; past that,
  bounded to the subset sizes the budget can fund — still exact wherever it
  fits, §34), plus a resource-transfer pass when a capacity pool binds
  (near-exact heuristic).
- Allocated hours are exact multiples of 0.25h; budget below one block is left
  unplanned. There is no 0.01h rounding step.
- `ϕ = c₁E + c₂β + c₃`, floored at 0.1h. Constants are personalized by
  `fitUserConstants` — a Bayesian linear regression whose MAP equals the old
  ridge fit, plus posterior covariance/noise (`phiPredictionStd`). The
  allocator consumes the MAP; the posterior makes it hedge ϕ-uncertainty
  (§5.1). ⚡ logs are **recency-weighted** by a 365-day half-life on the log's
  own date (§5.2), so every caller passes `ageDays` and the card reports an
  effective count, not a log count. The three energy fits (r, α, λ₀) are
  deliberately **not** weighted — §5.2 says why, and says to revisit them
  together or not at all.
- **A plan for day D is fitted from logs dated strictly BEFORE D** (§33). The
  constants are global, so one ⚡ re-times every task on the page — 33% on a
  task the user never logged, 75% of it on the very first log — and landing
  that on the day already in flight reshuffles a plan mid-execution. Applies to
  every **identity** fit (c₁c₂c₃, α, r, λ₀) and to **none** of the **state**
  reads: `simulateReservoirs`, the §11.9 carry-over and the §8.11 advisor take
  today's logs immediately, because a gauge of the present that ignored them
  would lie. `ageDays` runs against the planned day, not the live one. Any UI
  that prints a log count must print the **counted** one and name the deferred
  ones separately, or the ⚡ button reads as broken. History obeys the same rule
  by **reading** §12.1's stored `fitSnapshots` per day rather than refitting:
  `readDaySummaries` scores each day under the fit recorded on it, and falls back
  to the live fit only for a day that has none.
- Three constraints: the time budget plus cognitive/physical capacity pools
  (task weight = dimension difficulty / 10). Context switches cost
  `switchCost` hours — attention residue, distinct from ramp-up, which ϕ
  already prices — and are charged only between tasks that receive time.
- **A plan may be solved from a PREFIX of hours already worked** (§35): each
  task's block menu continues from `hᵢ` instead of from zero, the pools enter
  depleted by `Σ wᵢhᵢ` clamped at 0, and the switch bill is charged over the
  **day's** funded set `{worked} ∪ {newly funded}` — a plan that abandons a
  started task does not get its switch back. `hᵢ = 0` everywhere is
  bit-identical to the cold solve, which is what keeps §4, §5.1 and §34
  undisturbed. It feeds ONE next-up reading (`calculateRemainingDay`) and must
  never reach `calculateDailyMetrics`: that would rescope every plan-family row
  (§11.8) and double a per-keystroke `$derived` (§14.2's cost rule).

### Energy model (`business/model/zenith-energy.ts`, `/energy` only)

Standalone by design: shares the curve/ϕ machinery with `zenith.ts` but none
of its allocation code, so the main page is unaffected by changes here.

- Objective is `Σ_tasks V(task's daily output)`, not `Σ P̄` — total output per
  task through the concave satiety wrapper `V(O) = κ·ln(1+O/κ)`,
  `κ = satietyScale·(that task's reference single-session output)`. Satiety
  breaks winner-take-all (re-running the best task always beat switching); it
  must key on cumulative **output**, never on session phase, which decays over
  gaps and could be gamed with breaks. `satietyScale ≤ 0` recovers pure total
  output. The objective is only well-posed with its stopping terms:
  `freeTimeValue` (per hour not worked) and `terminalEnergyValue`
  (end-of-window energy). Fatigue alone never leaves the end of the window
  idle — it only produces instrumental mid-day rest. §8.4 lists rejected
  satiety forms.
- Warm-up `p(s)` uses a per-task session phase with **decaying carryover**:
  leaving a task for a gap `g` and returning resumes at `s·e^(−g/τ)`
  (`resumptionTimeConstant`), not 0. `normalizeSchedule` merges adjacent
  same-task blocks. Fragmentation stays costly (probe-verified), just not the
  old hard-reset cliff.
- Reservoirs follow `dC/dτ = −α·w·C + r'·g·(1−C)` with recovery gate
  `g = 1−(1−b)·w` (`b = microRecoveryFraction`, default 0.05) and
  `r' = recoveryRate·restRecoveryMultiplier` — closed-form exponential per
  block, no ODE solver. The gate keeps a full-demand (w = 1) task above the
  floor `b·r'/(α+b·r')` instead of draining to zero; without it there is no
  basal floor at all (the 2026-07-14 "demand 10 vs 9.5 flips the plan" cliff
  does not reproduce under today's search — §8.5). A `(1−w^q)` gate does **not**
  fix this (still 0 at w = 1, probe-verified) — don't re-propose it. `b = 0`
  recovers the pure `(1−w)` gate. §8.5.
- Output gate is Cobb-Douglas: `C_cog^wc · C_phys^wp`, demands
  `w = dimensionDifficulty/10`. Block output uses composite Simpson with 16
  nodes per fastest timescale (min of ϕ, 1/ρ), **capped at 1024 nodes** — so at
  the 0.1h ϕ floor the density falls once a block exceeds 6.4h: relative error
  is ~3e-7 up to 6h, 6.9e-7 at 8h, 1.7e-6 at 10h, 3.5e-6 at 12h and 5.6e-5 in a
  24h block (`scripts/enb-simpson-error.probe.ts`). Under default constants
  (min ϕ = 0.58h) the cap never binds.
- The optimizer is a deterministic multi-seed steepest-ascent local search
  over (task|rest, duration) block schedules: not slot-greedy (myopic, never
  rests), not full DP. Pure single-step moves strand ~1% of the objective and
  can return the wrong plan **structure** — hence the compound moves (transfer
  between blocks, half-block reassign, T*-session insert) and drop-one classic
  seeds; keep those when touching the search. §8.6.
- **Calibration order is load-bearing** (§8.7/§8.9/§8.10). Recovery `r` is
  fitted first from ☕ pre/post-rest pairs — during pure rest the law loses α
  entirely, so rest data identifies `r·m` on its own. The α drain rates are
  then fitted **conditioned on that recovery**, which is what makes α
  identifiable at all; `recoveryRate` is _not_ identifiable from
  end-of-session ratings — don't try. λ₀ is fitted last, conditioned on
  everything else. Each fit is a 1-D ridge toward the **defaults**, not toward
  current inputs. Ratings with demand 0 carry no signal and are dropped.
- A fit never writes params silently: the "Apply my fits" button copies it into
  the manual inputs. **One** button for all four fits, beside the Model
  Parameters heading, because the order above is the math — three per-card
  buttons let the user apply α before r, which adopts an α fitted against the
  old recovery and leaves it stale with only a re-armed button as the tell.
  `EnergyLabStore.applyFits()` is the only public way in; the per-fit setters
  are private so that order cannot be reached.
- `EnergyLabStore` never writes to the daily session. Its params live in
  IndexedDB (`settings` store, key `energyParams`) — see R4 — orchestrated by
  that store, not by the route. The **day window is not a param**: it is
  `session.availableHours`, one value shared both ways with the main page
  (settled 2026-07-29 — neither mode is the better one, so neither owns the
  day's hours). The store reads it; `/energy` writes it, like every other
  session field that route edits. There is deliberately **no** `|| 8` fallback
  and no lab-local override: either would render a window the main page does
  not have, which is the fork this replaced. A dated URL is refused rather
  than served — `/energy?date=…` redirects to the canonical route, because the
  layout's date reader is route-blind while the Lab is a today-only instrument
  (🪫/☕ stamp the live clock, the λ₀ fit reads finished days). That redirect
  belongs in `energy/+page.ts`, not in a `$effect`: a load redirect runs before
  the layout hands the session store a date, so the wrong day is never read,
  and it holds with JS disabled.

---

## 4. Verification

Before claiming a change works:

```sh
npm run check      # svelte-check + tsc on the service worker — must be 0 errors
npx eslint .       # includes the layer-boundary rules — 0 errors, warnings are a baseline
npm run depcheck   # dependency-cruiser: layer direction, no cycles, no orphans
npm run test:unit -- --run
npm run test:e2e
```

Then, once those pass and **before reporting the work as done, dispatch a
read-only reviewer subagent over the working diff** — every completed feature
and every fixed bug, no exceptions for "small". The five commands prove a
change compiles, lints and passes the tests it shipped with; none of them can
tell you it is _right_. A reviewer reading the diff cold is the only step that
catches a wrong invariant, a rule in this file quietly broken, or a test that
asserts the implementation instead of the behaviour.

- `/code-review` covers the working diff; any review-focused subagent does
  too. What matters is that a second pass reads the diff, not which one runs
  it.
- **Give it this file along with the diff.** The findings worth having are
  mostly violations of the rules above — layer direction (R1), logic in a
  route (R2), a mirrored definition (R3), a behaviour change with no test
  (R6), a formula changed without `MATH.md` (R7) — and a reviewer that has not
  read them cannot report them.

**Scope the reviewer to two things: bugs and inconsistencies.**

1. **Bugs** — a reachable input or click order that produces a wrong result,
   loses the user's typing, or writes a measurement they never gave. A bug
   report must name the inputs and the wrong outcome. Anything that cannot be
   stated that way is not a bug.
2. **Inconsistencies** — the diff contradicting itself, this file, `MATH.md`,
   or `STYLE.md`. A comment that no longer describes its code. A test that
   passes whether or not the behaviour works.

**Ask it explicitly NOT to suggest improvements, hardening, extra abstraction,
or additional tests beyond a missing one for behaviour the diff changed.** Ask
it to say "no defects" when it finds none, and tell it that finding nothing is a
valid, expected outcome. Every reviewer will otherwise return _something_,
because that is what it was asked for.

Then, on the way back:

- **Verify each claim against the code before acting on it.** A finding is a
  claim about code, not a fact — reviewers do report things that are not true.
- **Fix bugs. Decline the rest, out loud, in one line each.** A finding that is
  real but is not a bug in what was asked for is a note, not a task; §0 outranks
  it. Accepting every finding is how a small change turns into a large one, and
  that is the reviewer's job done badly by the person reading it.
- **One review pass per change.** Fix what it found, re-run the five commands,
  ship. Re-reviewing your own fixes invites a fresh set of suggestions on code
  that was fine, and the loop does not converge — it accretes.

This is a step, not a suggestion: the checks above are all _mechanical_, and
every rule in §1 exists because something mechanical passed while the change
was still wrong.

All five commands run in CI (`.github/workflows/ci.yml`) on every push/PR to
`main`. Two notes on `check`: it also type-checks `src/service-worker.ts`
through `tsconfig.worker.json`, because SvelteKit's generated tsconfig
`exclude`s that file and it would otherwise never be checked. And
`svelte.config.js` exists only so svelte-check and eslint compile in the same
runes mode the build forces — `sveltekit()` takes its options inline in
`vite.config.ts`, so the build ignores the file and says so. Keep `runes` in
step across the two.

`prettier --check` is not in CI, but it does pass and `npm run lint` runs it —
keep it passing (`npx prettier --write` the files you touched, never the
tree).

Warnings are a known baseline, not a to-do list: 18 `max-depth` (the scheduler
loops in `business/model/zenith*.ts`, downgraded to `warn` in
`eslint.config.js` because unnesting them is a test-covered refactor, not a
lint fixup). Errors are always zero — do not add to the warning count.

`npm run depgraph` renders the module graph to `dependency-graph.svg` (needs
graphviz). It is **gitignored, not committed**: CI regenerates it every run
and publishes it as the `dependency-graph` artifact, so the current graph is a
download away instead of a 500 KB file that goes stale between commits.

Vitest has three projects: `server` (node, `*.test.ts`), `client` (real
chromium, `*.svelte.{test,spec}.ts`), `storybook`.

**Probes are committed, and they are not tests.** A test asks _does this still
hold_ — binary, fast, green or red. A probe asks _what is true of the model over
a large input space_ and answers with a number, which legitimately moves
whenever the allocator changes. In the suite that is a red build carrying no
regression, so probes live in `scripts/*.probe.ts` behind their own config
(`vitest.probe.config.ts`, `npm run probe`) and never run in `npm test`. They
are committed because the alternative is the failure `MATH.md` already shows:
the sweep behind §14.1-2's "the trim is free" was thrown away, so the claim
could not be re-checked and stayed in the document while being false.

- **Seed the randomness.** A quoted number must be reproducible, not
  re-rollable — and a curated fixture and a random sweep answer different
  questions, so keep both (600 random days show the trim free on all 404 levers;
  the pool-bound fixture beside them is non-free on 103 of 126).
- **Date the number where it is quoted.** `MATH.md` already does this
  ("Probe 2026-07-27", "measured 2026-08-04"). `scripts/` is linted but sits
  outside `tsconfig.json`, and nothing runs a probe on a schedule, so one rots
  quietly; the date is what tells a reader whether the figure has been re-run
  since the code under it moved.
- **Pin what the probe found with one fixture in the suite**, never the sweep
  itself — §14.2's multi-gainer tie-break is pinned exactly that way.

**Which probe backs what** (each file's header names its claim; each claim in
`MATH.md` carries a dated back-reference to its probe). A `MATH.md` number with
no probe citation beside it is unbacked — that is the list to work down.

| Probe (`scripts/`)                      | Backs                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan-advice.probe.ts`                  | §14, §14.1-2 — priced-lever signs, the pure budget trim                                                                                                                 |
| `pool-allocator.probe.ts`               | §13.3, §4 — pooled suboptimality: there is no envelope to quote                                                                                                         |
| `energy-search-gap.probe.ts`            | §8.6 — the search's residual gap against the enumerated optimum, and the rest-split audit on the worst day                                                              |
| `stop-advisor.probe.ts`                 | §8.11 — session lookahead vs. the one-step marginal                                                                                                                     |
| `burnout-risk.probe.ts`                 | §11.6 — the 87% ceiling, the plateau, the resolution ladder                                                                                                             |
| `phi-uncertainty-cap.probe.ts`          | §5.1 — the σ ≤ 0.5·ϕ̂ cap and monotone-prefix truncation                                                                                                                 |
| `phi-cap-reachability.probe.ts`         | §5.1 — whether a real fit can reach the region that cap misses                                                                                                          |
| `allocator-exactness.probe.ts`          | §4 — the n ≤ 12 exactness claim; §5.1 guard 2 at plan level                                                                                                             |
| `subset-search-bound.probe.ts`          | §34 — what the funded-subset search forfeits past n = 12, by budget band, the budget-monotonicity violations the fallback still allows, and the size bound's wall clock |
| `hedged-stop-band.probe.ts`             | §3, §10 — where the hedged stop time lands against the closed form's band, how far σ̂ falls, and `expectedOptimalTime` vs a grid argmax                                  |
| `satiety-gaming.probe.ts`               | §8.4 — the monotone accumulator, and what a laundering one costs                                                                                                        |
| `stop-inversion-margin.probe.ts`        | §8.10 — inversion rates and the `STOP_INVERSION_MARGIN` split                                                                                                           |
| `fit-snapshot-drift.probe.ts`           | §12.1 — as-of-day vs whole-history fit drift, and refit cost                                                                                                            |
| `phi-error-price.probe.ts`              | §17 — the per-task-ϕ error pricing table                                                                                                                                |
| `curve-marginal-facts.probe.ts`         | §2 — the r-cap boundary, the five curve properties, the three N facts                                                                                                   |
| `alloc-epsilon-methodology.probe.ts`    | §4 — block-rule vs hour-rule admissibility, the 49% artefact                                                                                                            |
| `post-recency-weighting.probe.ts`       | §5.2 — the recency weights, Σw vs n_eff, the ten-year logger                                                                                                            |
| `causal-fit-window.probe.ts`            | §33 — how far one ⚡ moves an unlogged task, and what a one-day deferral costs                                                                                          |
| `post-monotone-prefix-cost.probe.ts`    | §5.1 guard 2 — violation size, blocks dropped, which cut lost the value                                                                                                 |
| `post-quadrature-floor.probe.ts`        | §5.1 — GH moment exactness and the ϕ-floor mean shift                                                                                                                   |
| `enb-simpson-error.probe.ts`            | §8.1 / AGENTS §3 — Simpson error under the 1024-node cap                                                                                                                |
| `enb-break-economics.probe.ts`          | §8 intro, §8.3–8.4, §13.5 — break economics pre/post fix, fragmentation cost, chunk sweep                                                                               |
| `sat-gate-floor.probe.ts`               | §8.5 — the w = 1 floor identity and 8 h endpoint, the rejected (1−w^q) gate, the demand sweep                                                                           |
| `sat-drain-identifiability.probe.ts`    | §8.7 — what ratings identify (r vs α), λ tuning, saturation                                                                                                             |
| `stp-lattice.probe.ts`                  | §8.8 — the 45-min lattice's quantization loss and enumerated optimum                                                                                                    |
| `stp-recovery-fit.probe.ts`             | §8.9 — the recovery fit's λ profile, range and identifiability limits; §8.7's ν₀ ≠ λ effect on the reported ±                                                           |
| `stp-stopping-identifiability.probe.ts` | §8.10 — V_T identifiability and the reconstruction's bracket                                                                                                            |
| `budget-advisor.probe.ts`               | §8.12 — why maximizing `valueVsClassic` or `objective` over the budget is ill-posed                                                                                     |
| `budget-knee.probe.ts`                  | §8.12 — the three candidate scorings, the knee across λ₀, and the running max's dip rate                                                                                |
| `curve-shape.probe.ts`                  | §8.12 — the raw difference's spike train, and the majorant's non-increasing / last-positive / telescoping properties                                                    |
| `advisor-curve-agreement.probe.ts`      | §8.12 — the stop advisor (§8.11) and the curve priced on one day, and where they agree                                                                                  |
| `mtr2-carry-over.probe.ts`              | §11.6 demand arm, §11.9 carry-over levels, §12's Σ P̄ spread premise                                                                                                     |
| `rv13-prior-posterior.probe.ts`         | §13.1 — the σ_ϕ ladder and what the n = 0 posterior moves                                                                                                               |
| `rv13-naive-lattice.probe.ts`           | §13.2 — the naive baseline's lattice handicap, before and after                                                                                                         |
| `rv14-naive-switch-bill.probe.ts`       | §19 — the naive baseline's switch bill and order dependence, before and after; the ≥ 0 arms and the pool-starved regressions                                            |
| `rv15-gain-headroom.probe.ts`           | §21 — why an honest gain still reads ~3%: selection vs shape, the activation-bonus ceiling, what binds on a real day                                                    |
| `rv13-stop-insertion.probe.ts`          | §13.4 — insertion convention: size and sign of the error                                                                                                                |
| `rv13-terminal-timing.probe.ts`         | §13.6 — mean-vs-min re-scoring, and the timing difference                                                                                                               |
| `adv1-plan-advice-frontier.probe.ts`    | §14, §14.1 — the Σ P̄ identity, budget monotonicity, rounding, frontier widths, the budget-0 grind day                                                                   |
| `adv2-budget-marginal.probe.ts`         | §14.2 — the budget marginal, zero-marginal days, per-task spread                                                                                                        |
| `adv2-switch-cost-price.probe.ts`       | §14.3 — the fixture table, the inversion grid, m(s) and the bracket                                                                                                     |
| `mode-cross-scoring.probe.ts`           | §15 — both plans scored under both objectives                                                                                                                           |
| `mode-run-order.probe.ts`               | §16 — the order-only gain and the burnout noise it would buy                                                                                                            |
| `mtr-human-capacity.probe.ts`           | §20 — the reading-is-the-constraint identity, what the band's >100 and Infinity arms can reach, the pool the row names                                                  |
| `mtr-load-rounding.probe.ts`            | §25 — the Load clamp's slack, what rounding the two loads cost Energy Balance's classification and the advisor's ordering                                               |
| `mtr-grind-density.probe.ts`            | §11.10 — the 100/m quantization against the band ladder, what unfunded tasks voted, §11.4's boundary as a hard count; §11.11 question 6 — count vs hour-weighted share  |
| `mtr-day-profile.probe.ts`              | §29 — the saturated difficulty axis under the old cut, what hour-weighting moved, the flip gate, history vs the dashboard                                               |
| `mtr-metric-trend.probe.ts`             | §31 — which readings survive the switch-cost-free solve, the exact solve's cost by n, why the gain cannot be plotted                                                    |
| `rv16-output-vs-classic.probe.ts`       | §30 — the Lab comparison tile under raw output vs the objective, and the rival plan's exact fit to the window                                                           |
| `mtr-friction-index.probe.ts`           | §11.4 — the Friction Index's interior, which its two pinned endpoints say nothing about                                                                                 |
| `mtr-bottleneck-strain.probe.ts`        | §23 — why Primary Bottleneck stopped reading E/β, and what the binding-pool draw reads instead                                                                          |
| `mtr-deep-work.probe.ts`                | §26 — the hard `mentalDifficulty >= 7` cut, and the band that called a three-quarters-deep day optimal                                                                  |
| `mtr-sustainable-work.probe.ts`         | §27 — the budget denominator against Σh, the grind-free day, and whether the fixed row restates Grind Density                                                           |
| `prefix-replan.probe.ts`                | §35 — the mid-day re-plan vs a cold re-solve and the morning plan, the on-plan control, the switch convention, the second solve's wall clock                            |

Every test artefact lands under the gitignored `test-result/`: `unit/` (vitest
html report), `coverage/` (v8, always on, over `business`/`data`/`presentation`),
`e2e/` (playwright report and traces). Coverage is a number to read, not a gate
— nothing fails on it.

**Driving the real app:** see the `verify` skill. Two gotchas that will cost
you an hour otherwise:

- A long-running dev server is **not a valid test target** after a batch of
  edits — it serves a stale module graph and produces failures that do not
  reproduce. Verify against `npm run build && npx vite preview`, or a
  freshly-started dev server.
- All data is client-side IndexedDB, so a headless profile starts empty. Seed
  through the UI and wait out the debounced autosave: `AUTOSAVE_DEBOUNCE_MS`
  in-app, and `e2e/helpers.ts` exports `AUTOSAVE_MS = 1000` for Playwright —
  wait on those, never a literal, so the margin moves with the constant.

---

## 5. Settled decisions — do not re-litigate

Each was considered and decided. Re-deciding them is churn.

- **Task ids come from `nextTaskId` and nowhere else** (`session-store`):
  `Math.max(Date.now(), …ids + 1)`, monotonic and never recycled. Both simpler
  rules are wrong and were shipped: `Date.now()` alone collides for two tasks
  added in the same millisecond (and the import path patched around that with
  `Date.now() + Math.random()`, putting fractions in a field three observation
  stores use as their foreign key); plain `max + 1` over the day's tasks
  recycles a deleted task's id, and a drain log — which outlives the task it
  rated — re-attaches to whatever new task inherits it.

- **A deleted task is undone from its toast; only routines get a confirm step.**
  The ✕ deletes at once and `removeTaskWithUndo` (`presentation/utils`) offers the
  task back for eight seconds. A second press would sit on the common path forever
  to save the rare mistake — deleting a task is frequent, and the row is gone
  either way when the user meant it. The header's routine rows arm-then-delete
  instead, for the opposite reason: nothing there can be handed back. The undo
  restores the task at its original index (`/energy` renders the day in store
  order) with its original id — safe because `nextTaskId` never recycles one, and
  necessary because the drain logs that outlive a task key on it. It refuses once
  the viewed day has moved on: a toast outlives a click onto another day, and
  autosave would keep the stray task there.

- **The day's plan is solved once per `calculateDailyMetrics`.** The allocator
  dominates dashboard cost (2ⁿ funded-subset enumeration, ~51 ms at n = 12)
  and used to run **twice** on identical inputs: the plan, then Zenith Gain's
  optimized side. `calculateTaskPlan` returns the plan plus its
  `allocatedHours`, and `calculateZenithGain` takes them — halving the
  dashboard `$derived` (which re-runs on every keystroke in the budget field)
  and the plan advice with it (MATH.md §14). The hours are passed in **input
  order**, and that is not cosmetic: hours are paired to tasks **by index**
  all the way down (`calculateTotalProductivity`), so the priority-sorted
  array would charge each task the time of whichever task outranked it.
  `pooledProductivityGain` therefore checks the length and re-solves rather
  than trusting a mismatched array — index-pairing turns one missing entry
  into a NaN optimized sum, i.e. a rendered "NaN%". A test in
  `daily-metrics.test.ts` asserts the gain equals what a self-solving
  `calculateZenithGain` reports, on a **reversed** task list — the one fixture
  shape that can catch a mix-up, because priority is intrinsic and the other
  fixtures happen to plan in input order.

- **A composed read reads each store once** (`session-history.ts`). Every read
  is a full store scan that grows with the user's whole history, so
  `readModelReport` reads flow, rest, drain and the session range once each
  and derives both model cards from those records — it used to compose its own
  sub-reads and cost three drain scans and two of everything else on every
  visit to analytics. A test
  in `session-history.test.ts` counts transactions.

- **The per-day observation upsert reads through the `date` index**, not a
  whole-store scan (`flow-observation-repository`). The key is (`taskId`,
  `date`), only `date` is indexed, so the day's handful of records are read
  and `taskId` matched in memory. A compound index would cost a schema
  version (R8) for nothing; scanning the store reads years of history that
  can never match.

- **🪫 drain ratings do NOT upsert — one row per session**
  (`$addDrainObservation`). `hours` is one session's length for the §8.7 α
  fit, while §8.10/§8.11/§12 read a task's hours for a day as the sum of its
  rows; the (`taskId`, `date`) upsert this used to do meant a second session
  overwrote the first and vanished from that sum (MATH.md §18). The row's 🪫
  button therefore always opens an EMPTY editor — one more session — while
  correcting a rating goes through the ✎ beside it in the calibration card and
  `$editDrainObservation`, which keeps that row's `createdAt`. Re-logging a
  correction would count the session twice. For the same reason the completion
  prompt passes `measured: false`: finishing a task ends a session that an
  earlier rating says nothing about.

- **The energy model is a peer mode, not a candidate to replace the main
  plan** (settled 2026-07-29, MATH.md §15). A 300-day cross-scoring probe:
  each model beats the other by tens of percent **on the other's objective** —
  classic wins `Σ P̄` on 283/300 days (median +38.8%), energy wins its own
  objective on 298/300 (median +17.4%). The 17 exceptions are all plans the
  pooled allocator is forbidden to emit (4.35–7.20 h cognitive against the 4 h
  pool — the energy model has no pool constraint), so neither allocator is
  defective. No evidence can rank them; §12's audit is a descriptive signal,
  not a promotion gate. What the probe does establish is the user-facing
  difference: energy funds 1.97 tasks/day vs classic 3.96 and **never more**
  (0/300 days), overlapping on composition 0.58 and agreeing on the funded set
  10% of the time. Classic spreads, energy concentrates. Keep both routes.

- **The Lab's task list reads in schedule order, snapshotted per visit**
  (settled 2026-08-05). Sorting it live is the obvious implementation and it is
  wrong: every parameter edit re-optimizes, so the rows re-ranked mid-drag and
  moved the row being dragged out from under the cursor. The page calls
  `lab.resnapshotOrder()` from its `onMount` — first paint and every
  re-navigation — and `#displayOrder` holds until then. Only positions freeze:
  every number in a row stays live, so a stale order never shows a stale
  reading. The snapshot is the **whole** day's order — scheduled tasks first,
  then the ones the plan funded nothing, in the store's own order — so "has no
  position" means exactly one thing: added since the snapshot. Those go to the
  front, because `addTask` puts a new task first and the card's form is above
  the list, so the front is where the user looks for the row they just
  deployed. A day with no window has no blocks to sort by, so the snapshot
  stays unfilled and the list reads in the store's order until one is set.

- **The Lab's row reads the three model inputs, it does not slide them**
  (settled 2026-08-06). They were live sliders — a second line on every row — on
  the theory that the Lab is where you watch the schedule react. It is, but to
  the params panel beside the list: `P`/`M`/`E` are a definition the user sets
  once when deploying a task, and the form already suggests them from history
  (ROADMAP item 24). So they read as text, exactly as `/` spells them, and ✎
  re-tunes them. The must-do checkbox is hidden in both of the Lab's forms
  (`showMustDoToday={false}`) because `isPinned` is read by the plan advisor and
  by nothing in this mode — the seeded value still round-trips, so an edit here
  cannot clear a flag set there.

- **Run order stays `calculateInterleavedOrder`'s nature alternation** (settled
  2026-07-29, MATH.md §16). `Σ P̄` is order-invariant, so only the energy model
  scores order at all — and under it the heuristic is a median 0.47% below the
  best ordering of the same allocation (p90 1.50%), landing at the 5.83th
  percentile of all orderings while best-vs-worst spans a median 7.07%. Holding the
  allocation fixed bounds any order-only change, the solver's included. The
  swap is also actively harmful to one metric: the objective-maximizing order
  is uncorrelated with drain (§8 charges no cost for it), so it moves Burnout
  Risk by >5 points on 89 of 300 days (30%) in no consistent direction. Do not re-open
  without a reason that isn't "the optimizer should beat the heuristic".

- **ϕ stays one plane for all tasks — no per-task offsets** (settled
  2026-08-04, MATH.md §17). Hierarchical partial pooling `ϕ = c·x + δ_task`
  fits fine and cuts held-out ϕ error 23–37%, but it buys **+0.09%** of plan
  value at a plausible per-task spread (0.3 h) and 4 h budget — 0.4 minutes of
  the budget lever the user already has — because the oracle that knows every
  task's true ϕ is itself worth only +0.16%. `P̄` is flat at `T*`, so ϕ error
  costs `O(ΔT²)`: **half an hour of per-task ϕ error costs ~0.3% of the day**
  (§17 has the table — price any per-task-ϕ proposal against it first). It also
  costs: 64–79% of logged titles carry one log, so δ absorbs stopwatch noise and
  the displayed ϕ gets 68–98% worse for users with no per-task structure; a
  never-logged task's σ_ϕ rises 0.058 → 0.259 h, which §5.1 turns into a
  permanent demotion of every task the user hasn't logged; and the grouping key
  would have to be the free-text title, since `nextTaskId` gives each day's
  instance a fresh id. Re-open only with real logs showing `Σδ̂²` above the
  0.25 h noise floor **and** a habitually ≤2 h budget.

- **`zenith.ts`, `zenith-energy.ts` and `session-store.svelte.ts` are
  deliberately deep modules** — large implementations behind tiny interfaces.
  A 2026-07-23 interface analysis found every proposed split would force
  currently-private helpers (`amplitudeRatio`, `phiQuadratureNodes`,
  `reservoirLaw`, date-routing state) into cross-module exports: more surface,
  not less. Two seams were worth cutting and are cut: generic 3×3 linalg →
  `linalg.ts`, and the drain/rest measurements →
  `energy-observation-store.svelte.ts` (below). Don't split on line count —
  **the test is interface arithmetic**:
  a split pays only if it removes more public surface than it adds. Measure
  before proposing one, and **re-measure rather than quoting these numbers** —
  both files have grown since: on 2026-07-23 `session-store.svelte.ts` stood at
  675 lines behind **39 public members** (~1 per 17 lines, against ~1 per 50 in
  `zenith.ts`), 34 of them called from exactly one place — a wide facade, not a
  deep module, so size was never the argument either way.

- **Drain and rest observations live in `EnergyObservationStore`**, not the
  session store (extracted 2026-07-27) — the one cluster whose extraction cost
  **zero** new cross-module exports: a measurement is stamped with the live
  clock's today, never the viewed day, so it needs none of the date-routing,
  load or auto-save state — only a task lookup and somewhere to report a
  failed write, both already available (`tasks`, and `liveToday` needs no
  store at all). It also needs no `initializeStorage()` ordering: the
  localStorage migration writes only sessions and `energyParams`, never these
  two object stores. What deliberately did **not** move (re-proposing it is
  churn):

  | Stayed                        | Because                                                                     |
  | ----------------------------- | --------------------------------------------------------------------------- |
  | Day routing + load + autosave | One concern; task mutations work _because_ the autosave effect watches them |
  | Flow observations             | `logFlow` stamps `flowMinutes` onto the task, persisted with the session    |
  | Routines                      | 3 members, needs a `tasks` thunk — not worth a file                         |

- **The banner is `StorageStatusStore`'s, not the session store's** (extracted
  2026-07-28). It was the session store's because that store failed first, and
  every store added afterwards depended on it to reach the banner:
  `EnergyObservationStore` imported `StorageErrorKind` from it,
  `EnergyLabStore` held a session store partly to call `reportStorageError`,
  and the retry action was a list in the layout that each new `retryLoad()`
  had to be remembered into — an invariant maintained in prose. Now the
  session store loses three public members, the cross-store type import is
  gone, and "a store that can fail a read is covered by the retry" is true by
  registration, not memory.
  **The failure is tracked per reporting store, not as one flag** — keep that:
  one flag meant one store's success cleared another's unrecovered failure.
  Sharpest on retry: `retry()` fires the registrations in order, but
  `EnergyObservationStore`'s two reads settle before `SessionStore`'s
  migration-plus-three, so a re-failure there was wiped by the session's later
  `clearLoadFailure()` — the user pressed Retry, the banner vanished, and the
  drain/rest logs were still unreadable with Burnout Risk quietly on defaults.
  A store therefore gets a `StorageReporter` and nothing else: it can report
  and clear **its own** load failure, and cannot dismiss the banner, fire the
  retry, or speak for another store. Three consequences worth not undoing:
  - `clearLoadFailure` is not `clear`. A read that works again proves that
    store's data is reachable, so it drops that store's `'load-failed'` —
    never a `'save-failed'`, whose edit is already lost, and never anyone
    else's. That is what lets a transient read failure heal on the next
    successful read instead of leaving a banner over a recovered app.
  - `error` and `canRetry` are separate. A lost write outranks a failed read
    for the _message_ (a read failure is already visible as a wrong or empty
    screen; an unsurfaced lost edit reads as success), but Retry is offered
    for any outstanding failed read regardless — keying the button off
    `error`, as it was, hides the only recovery affordance whenever a write
    has also failed.
  - `retry()` drops the load failures and keeps the save failures. Re-reading
    does not un-lose a write.

- **Metric color-band thresholds live in the presentation layer**
  (`utils/band.ts` — the whole banding policy in one module: the four band
  names, the thresholds, the per-axis table, and the tokens and words each
  band renders as). Banding a reading as good/bad is display policy, not
  domain math. It exports `AXIS_BAND` + `isOutOfBand` because the plan-advice
  card decides which findings to surface from the same call the metric rows
  are colored by — two copies of the thresholds is exactly the R3 failure.
  **A view model carries a `Band`, never a class string.** `Metric.band` and
  `AdviceRow.beforeBand` name the band; the component looks up
  `BAND_TEXT_CLASS` / `BAND_BAR_CLASS` and `bandLabel`. Keying anything off
  `text-success` makes renaming a token a silent behaviour change: the
  dashboard's screen-reader band text was wired that way and a `-strong` swap
  would have dropped it with nothing failing. `bandLabel` returns `null` for
  `neutral` on purpose — the default value colour makes no claim, so silence
  is the honest equivalent.

- **Plan advice is computed on demand, never in a `$derived`** (MATH.md §14).
  `suggestPlanAdjustments` re-solves the whole day once per candidate, so cost
  scales with the 2ⁿ funded-subset enumeration: measured 12 ms for a 6-task
  day but **946 ms for a 12-task one** (2026-07-27, before solve-once halved
  it — conclusion unchanged). In a `$derived` that is a frozen main thread on
  every keystroke in the budget field. `DailyPlanStore` therefore exposes
  `computeAdvice()` plus `isAdviceStale`, and staleness compares a **fingerprint
  of the inputs** — a `$derived` read from outside a reactive context is not
  guaranteed to return the same object twice, so identity reports staleness on
  a day that never changed.

- **The advisor ranks, it does not judge.** It reports every axis
  unconditionally with a lower-is-better badness function; whether a reading
  is bad enough to act on is the band above. Options per axis are the Pareto
  frontier on (improvement ↑, plan value ↑) so there is no weight λ to
  defend — see MATH.md §14 for why "the single biggest improvement" is bad
  advice. **Unconditionally includes the axes nothing improves**: one finding
  per axis, empty menu and all (MATH.md §14.4). Filtering those out in the
  model is a presentation decision taken where the bands are not visible, and
  it made an unfixable warning — Energy Balance on a day of nothing but
  cognitive work — indistinguishable from a day with no warning on it, which
  the card then called fine. The card says the empty menu out loud instead.

- **A budget _increase_ never enters that frontier** (MATH.md §14.1). Σ P̄
  prices deferring and trimming in full, but it does not price the extra
  hour — and Σ P̄ is monotone in the budget at the true optimum (§34's fallback
  can invert it), so a `budget + 1` inside the
  frontier out-values every defer and dominates the entire menu down to "work
  more". `plan-advice.ts` splits the candidates with `isPriced` and returns
  the increase as `AdviceFinding.unpriced`, which the card renders last and
  labelled in hours. Do not merge the two lists back together.

- **`mustDoToday` promises the day, not the hours** (MATH.md §14). The flag only
  removes a task from the defer candidates; the allocator never sees it, so a
  flagged task can still be funded zero. `suggestPlanAdjustments` therefore
  **partitions** the unfunded read — `unfundedMustDoTaskIds` beside
  `unfundedTaskIds` — and the card gives it its own warning-coloured line,
  because the plain unfunded sentence reads as something the menu below can fix
  and for these tasks there is no lever left. The badge is worded "Stays today"
  and the checkbox "Don't move off today" for the same reason: "Must do" beside
  `0m` reads as a promise the model never made.

- **The budget levers carry unrounded hours** (MATH.md §14.1). Rounding
  `budget − planSlack` to quarter-hours trimmed past the hours the plan
  actually spends, so the trim stopped even being feasible. The card has no
  Apply for `set-budget`, so there is nothing to align the hours to — the
  descriptor rounds the **label**, never the lever. The trim is **feasible, not
  free**: `allocate` is path-dependent on `budgetBlocks`, so on a pool-bound day
  the re-solve can land up to a measured **−0.9%** below the plan it trimmed
  (MATH.md §14.1-2, `scripts/plan-advice.probe.ts`). Do not clamp that to 0 —
  it is a plan the allocator really produces, and §14.1-3 forbids showing a real
  difference as costless.

- **The budget's shadow price is a day-level reading, not a per-task column**
  (MATH.md §14.2). `PlanAdvice.budgetMarginal` re-solves at
  `budget + BLOCK_HOURS` and reports what that block adds plus which task takes
  it. **Both halves are open-scoped** (§11.8): the allocator is blind to
  `completed`, so the plan-scoped reading named an already-ticked-off task as
  the recipient of the next 15 minutes, worth up to +33.4%. `recipient: null`
  means a wider budget buys no remaining work, and says nothing about why —
  a bound pool, tasks near their stopping times and a block landing on finished
  work look identical from one solve. Do not re-propose the per-task column:
  the reason originally recorded for rejecting it (marginals equalize, so a
  column degenerates) is **false and measured false** — the two that hold are
  that no user lever corresponds to a per-task entry, and that the column is
  arithmetic on a curve that ignores the pools and the switch cost, overstating
  the budget's yield on 63% of probe days. It lives in `suggestPlanAdjustments`,
  not `calculateDailyMetrics`: the latter runs in a `$derived` on every
  keystroke and every slider drag, where a second solve doubles dashboard cost.

- **The switch cost is instrumented but never advised** (2026-08-04, MATH.md
  §14.3). MATH.md §14 rules `switchCost` and the pools "measurements of the
  user, not choices about the day" — that excludes them as levers and, by the
  same sentence, licenses them as instrument targets.
  `PlanAdvice.switchCostPrice` reports the `(m−1)·s` hours the plan reserves
  over **funded** tasks, that as a share of the budget, and Σ P̄ re-solved at
  `s = 0` and `s = 2s`. Declaring it 2× too high costs a measured **8.47%** of
  plan value on a 2–4-task day (18.77% at 5+ tasks), against 0.16% for the ϕ
  oracle — this was the last model input with no reading anywhere. Four things
  it must keep, three of which invert the bullet directly above:
  - **Plan-scoped, not open-scoped**, because it is compared against
    `planValueOf`, which is built from the whole task list (§11.8). Restricting
    one side to open work reports a difference that is mostly the scope change.
  - **Clamped per arm, never floored.** The exact optimum is monotone
    non-increasing in `s`, so a lower declaration reads only ≥ 0 and a higher one
    only ≤ 0; the opposite sign is §13.3 suboptimality, not the day. Inversions
    are reachable and large — 112 over 71,520 UI-grid configurations, worst free
    arm **−6.53%**, worst doubled arm **+1.36%**, and 40 of them without touching
    `s`. Their magnitude is **not** bounded by §13.3's "worst 0.09%", which is a
    single-draw maximum. So each arm is clamped to its provable direction and
    nothing else is touched. Do **not** replace this with §14.2's floor: that
    zeroes the doubled arm on 284 of 596 fixture alternatives, the arm that says
    over-declaring is the expensive direction. Tests pin both a symmetric floor
    and an inverted clamp.
  - **Read through `calculateZenithGain`**, not by summing `avgProductivity`
    over the returned plan. The plan comes back priority-sorted, so the same
    terms add in a different order and land a few ulps off `planValueOf`.
  - **The copy stays conditional** — "if your switch cost were X, this plan
    would read Y". It reports plan value _under a declaration_, never the cost
    of mis-declaring, which would require knowing which value is true. The two
    even differ in sign: planning as if switching were free raises reported
    value, while switching for free-that-isn't lowers realized value.

  It gets no `AdviceLever`, no axis, no frontier entry and no Apply button, and
  must not be wired to suppress anything. Do not re-propose **fitting** `s` from
  the observed funded-task count: `m(s)` is not monotone (195 violations on 115 of
  the 298 fixture days × 101 `s` values), a one-day bracket is a median 0.50 h
  wide against a [0,1] h range, and one mis-counted task moves the bracket edge
  0.34 h.

- **A day's fitted params are stored, not recomputed from the logs**
  (2026-08-03, MATH.md §12.1). The fit as of day D _is_ a pure function of the
  observations dated ≤ D, so the §12 audit could refit per audited day instead of
  reading a `fitSnapshots` record — and that would fix history retroactively,
  which storing cannot. It loses on cost, and only on cost: each per-day refit
  costs a WHOLE-history fit (19 ms/day measured, 570 ms for a 30-day audit vs
  17.6 ms for one), so recomputation is O(auditDays × totalLogVolume) and gets
  slower every time the user logs anything, on a screen that runs it on every
  visit. Do not re-propose refitting as a simplification; the trade was measured.
  Two consequences that follow and are intended: **only today's record is ever
  written** (a past day's fit is what the user had, so it is never rewritten —
  `$updateFitSnapshot` is an upsert on the date and every caller passes today),
  and a day with **no** snapshot falls back to the caller's live fit rather than
  dropping out of the audit, because the day was still worked.

- **`buildCurves` is built once per search or fit** (2026-08-01): the
  optimizer and the stopping fit thread one curve map through every
  evaluation (`evaluateWithCurves`); public `evaluateSchedule` still builds
  its own. Hoisting measured 2.6× (104 → 40 ms on a 4-task/8h solve).
- **Human Capacity is unclamped** — it is allowed to read over 100%, and the
  band above 100 stays even though the allocator's own plan cannot get there
  (0 of 3000 probed days; 44.1% touch ≥ 99%, MATH.md §20). The reading is the
  share of §4's capacity constraint the plan consumed, on the allocator's own
  weights — so which pool it BLAMES is decided on the exact saturations, never
  on the rounded ones (§20.1).
- **Burnout Risk is not monotone in the declared budget, and that stays**
  (settled 2026-08-06, MATH.md §11.6). Raising `availableHours` over a fixed
  task list makes the reading FALL on 3006 of 37800 probed steps, worst 29
  points (`scripts/burnout-risk.probe.ts`). It is not a bug in the metric: the
  larger budget funds more tasks, and their switch gaps are real rest, so the
  simulated day contains less work. Documented rather than smoothed — holding
  the funded set fixed while walking the budget would report a plan the user is
  not being shown. Do not "fix" the fall.
- **`PHI_UNCERTAINTY_RELATIVE_CAP` stays 0.5 — do not lower it to 0.35**
  (settled 2026-08-06, MATH.md §5.1). §5.1 records that the cap does not
  exclude everything it claims to: bimodality and truncation loss start at
  σ/ϕ̂ ≈ 0.35, not 0.5. Tightening it is the obvious repair and the wrong one.
  A real fit cannot reach the gap — the ridge's λ = 4 anchor shrinks ϕ̂ exactly
  when σ is large, so 0 of 576 000 fitted cells land at ϕ̂ > 3.06h with
  σ/ϕ̂ > 0.35, and the 5 of 28 800 that extrapolation reaches forfeit 0.0000%
  (`scripts/phi-cap-reachability.probe.ts`). Lowering it would clamp 1.23% of
  realistic cells and hedge them LESS, worth up to +6.809% of conjured value
  for the few-log users the posterior exists to protect.
- The productivity curve deviates from the source article on purpose
  (MATH.md §6).

- **No page is prerendered, including `imprint` and `privacy`.** Every page
  goes through a root layout that personalises the response per-cookie, so a
  build-time render bakes the defaults in. Measured on a real build via
  `vite preview` with `theme=abyss; scenerySeed=42` (2026-07-26): prerendered
  `/imprint` serves `class="fallow "` / `lang="en"` / an `Imprint` `<h1>`
  where today's `/de/imprint` serves `class="abyss dark"` / `lang="de"` /
  `Impressum`, and a
  cold load gets the seed baked at build time, not the visitor's cookie.
  Locale living in the URL makes the case stronger, not weaker: 30 indexable
  URLs, every one still cookie-personalised for theme and seed. Hydration
  repairs the class, the copy and (since 2026-08-01) the seed, so it costs a
  FOUC rather than a wrong page — but avoiding exactly that FOUC is why the
  theme is stamped server-side, and it would hit precisely the cold arrivals
  (search results, shared links) these pages exist for. Two trivial CDN
  renders do not pay for that.

- **The service worker caches page HTML that is per-cookie personalised, and
  every personalised input is repaired when a stale copy is served**
  (2026-08-01, closing the last §6 SW item). The cache is bounded (keyed on
  pathname), its failures are not silent, and pages are network-first — a
  cached page only ever wins offline. What a stale copy can then get wrong,
  and what fixes it: theme and scenery motion reconcile against their cookies
  in `ThemeStore`'s constructor (against the snapshot `+layout.svelte` reads
  for it — see R5); the scenery **seed** reconciles in its
  `onMount`, not the constructor, because hydration never re-patches the
  SSR'd style attribute (the `+layout.svelte` scenery-clock comment is the
  precedent) — only a post-mount state change reaches the DOM. **Locale** is
  URL-addressed (`/de/*`), so a cached page's language always matches its
  cache key; the one wrong-language path was the offline shell fallback, and
  the worker now caches one shell per locale (`SHELLS`, derived from the
  paraglide runtime's `locales`/`baseLocale`, never spelled by hand) and
  picks it by pathname prefix. Residual cost by design: a stale cached page
  repairs with a FOUC, and `x-vercel-ip-timezone` in the serialized payload
  is repaired by the layout's own clock re-derivation at mount. Pinned by the
  `German shell` e2e (raw response HTML asserts `lang="de"` pre-hydration)
  and the seed-reconciliation store specs.

- **`app.html`'s inline pre-paint script no longer hardcodes theme names**
  (2026-08-01): `hooks.server.ts` fills the `%theme.default%` /
  `%theme.default-dark%` placeholders with JS array literals from the
  catalogue in `business/model/theme.ts`, so a default-theme change is a
  one-place edit again. The script still only swaps the classes it owns
  (assigning `className` would wipe the server-stamped scenery-paused class).
  Pinned by the `dark-preferring first visit` e2e.

- **`sitemap.xml` and `robots.txt` prerender only when `PUBLIC_SITE_URL` is
  set** (`export const prerender = Boolean(env.PUBLIC_SITE_URL)`). Both must
  emit absolute URLs; an unconditional prerender bakes in SvelteKit's
  `http://sveltekit-prerender` placeholder. The sitemap lists every route in
  **every** locale with `xhtml:link` alternates, `/imprint` and `/privacy`
  included.

- **`PUBLIC_SITE_URL` is set on Vercel in the Production scope only** — the one
  environment variable the app reads (see `.env.example`). Production-scoped on
  purpose: preview deploys fall back to their own request origin instead of
  claiming to be canonical. Consequences of the scope choice, both intended —
  previews serve dynamic (not prerendered) crawler files, and their SEO tags
  point at themselves.

- **`/de/*`, `/es/*`, `/fr/*`, `/zh/*` are real, indexable URLs, not a cookie
  state.**
  The paraglide strategy is `['url', 'cookie', 'baseLocale']`; `en` stays
  unprefixed. Two consequences that are easy to get wrong:
  - Every internal `href` goes through `localizeHref`, and every comparison
    against a pathname goes through `deLocalizeHref`. A raw `===` on
    `page.url.pathname` is wrong on every prefixed locale.
  - Adding a locale is four edits and no new component: the catalogue
    (`messages/<locale>.json`, key-for-key with `en.json`), `locales` in
    `project.inlang/settings.json`, `LOCALE_DISPLAY` in
    `presentation/utils/locale.svelte.ts` (total record — it fails to compile
    until label, `Intl` tag and week start are filled in) and `OG_LOCALES` in
    `seo-head.svelte`. Everything else — nav picker, sitemap, hreflang, the
    offline shells — is derived from the runtime's `locales`.
  - The strategy is declared **twice** — in `vite.config.ts` for
    build/dev/vitest, and in the `paraglide` npm script for `check`/`prepare`.
    paraglide 2.x has no config file for it, so this is a deliberate,
    documented exception to R3; change one and you must change the other.

## 6. Known open items

- Every persisted shape now has a validator (R4). **Add one with each new
  persisted shape**, in `business/model/persisted.ts` for a record the model
  reads, and route the read through it — the repository's return type
  describes a well-formed record, never guarantees one.
- **A task moves between days only via `moveTaskToTomorrow`.** Tasks live
  inside their day's `DailySession` record, so a move is two writes: append to
  tomorrow's session (a read-modify-write through `$readSessionByDate` /
  `$updateSession` — the only store write that does not target the viewed
  day), then drop from today's `#tasks` (persisted by the normal autosave). In
  that order and without a transaction on purpose: the failure mode is a
  visible duplicate, never a vanished task. What travels is definition and
  provenance only — a fresh id in the destination day's id space (observation
  joins are per-date), no `mustDoToday`, no `flowMinutes`. The method refuses
  completed and `mustDoToday` tasks, no-ops mid-navigation
  (`#loadedDate !== #selectedDate`) and serializes with itself (two
  overlapping read-modify-writes on tomorrow would drop one task). Destination
  is hard-coded to `selectedDate + 1`: the advice card's "To tomorrow" button
  is the only caller, it never means anything else, and tomorrow is never the
  day on screen — an arbitrary-date move would have to answer that (YAGNI).
  The advice reading itself stays a counterfactual (MATH.md §14): the model
  prices "off today", only the button commits to a destination.
