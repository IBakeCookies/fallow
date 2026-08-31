# The example day a shared link opens on

**Kind:** feature · **Status:** landed 2026-08-31 · **Roadmap:** Phase 6 item 11
(product and reach), whose premise "only if Fallow grows users beyond its
author" is the thing this change exists to trigger

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Someone who opens a shared Fallow link sees a worked day — six tasks with real
allocations, both energy pools binding, one task the plan refuses to fund, and
the gain over an equal split — instead of "No tasks deployed yet". A banner says
the numbers are not theirs, and one click clears it and starts their own day.
Nothing the demo shows is read from or written to IndexedDB.

## Scenarios

### Scenario — the shared link opens on a solved plan

`e2e/demo-day.e2e.ts`

- **Given** a fresh profile, no IndexedDB records, no logs
- **When** they open `/?demo`
- **Then** the task list shows the six seeded tasks
- **Then** each funded task shows a non-zero time allocation
- **Then** exactly one task shows no allocation
- **Then** the gain-over-equal-split figure reads above zero

### Scenario — an edit in the demo does not survive a reload

`e2e/demo-day.e2e.ts`

- **Given** `/?demo` open, one task's effort changed, the auto-save debounce elapsed
- **When** they reload the page
- **Then** the task list shows the six seeded tasks unchanged

### Scenario — the demo never writes a session

`src/lib/business/store/session-store.svelte.spec.ts`

- **Given** a `SessionStore` constructed in demo mode, with a task edited and the debounce flushed
- **Then** `sessionRepository.$updateSession` was not called

### Scenario — the demo never reads storage

`src/lib/business/store/session-store.svelte.spec.ts`

- **Given** a `SessionStore` constructed in demo mode
- **Then** `initializeStorage` was not called

### Scenario — an existing user's saved day is shadowed, not touched

`e2e/demo-day.e2e.ts`

- **Given** a saved session for today carrying the user's own tasks
- **When** they open `/?demo`
- **Then** the task list shows the six seeded tasks

### Scenario — dropping the param returns them to their own day

`e2e/demo-day.e2e.ts`

- **Given** `/?demo` open over a saved session for today
- **When** they open `/`
- **Then** the task list shows their own tasks

### Scenario — the banner starts their own day

`e2e/demo-day.e2e.ts`

- **Given** `/?demo` open on a fresh profile
- **When** they activate the banner's start-your-own-day action
- **Then** the URL carries no demo param
- **Then** the task list shows the empty state

### Scenario — the empty state offers the example day

`play` function on `task-list-card.stories.svelte`

- **Given** the card rendered with no tasks
- **When** they activate the see-an-example-day action
- **Then** the demo href is the one navigated to

### Claim — the seeded day is the day the Goal promises

`src/lib/business/demo-day.test.ts`

- **Given** the seeded fixture's six tasks, its declared hours, switch cost and pools
- **Then** both energy pools bind
- **Then** exactly one task receives zero blocks
- **Then** the plan's summed average productivity exceeds the equal-split baseline

Not a pin: the fixture does not exist yet. It is a bound, not a number that
moves, so it is a test and not a probe — but if the fixture is tuned until it
passes, the tuning belongs in the fixture, never in the assertion.

## Out of scope

- `?demo` on any route but the planner. `/energy`, `/calendar` and `/analytics`
  ignore it; their stores are untouched.
- Seeded drain/rest logs, `fitSnapshots`, or anything the calibration cards
  read. Considered as the demo's content and rejected — it is the larger build,
  and MATH.md §33's causal fit window would constrain the seeded log dates.
- Copying the demo tasks into the real day on exit. That is a persistence path,
  which is the thing the Goal rules out.
- Browsers with IndexedDB blocked. The demo happens not to need it, which is
  not the same as supporting them; no test claims it.
- Any change to `canonical`, `robots.txt`, `sitemap.xml` or the locale URLs.
- A tour, a walkthrough, or a first-run dialog.

## Read before building

- `src/routes/(app)/+layout.svelte` — the `setSessionStore` call site that reads
  the `date` param is where the demo reader joins it; the storage-error block in
  the same file is the banner precedent, in markup and in placement
- `src/lib/business/store/session-store.svelte.ts` — four paths the demo has to
  neutralise, not one: `#boot`'s `initializeStorage`, the date-change effect
  that calls `#loadSession`, the auto-save effect and its dirty guard, and the
  `visibilitychange` re-read
- `src/lib/business/AGENTS.md` — the store rules, and where a new public export
  is priced
- `src/lib/presentation/component/task-list-card.svelte` — the empty state the
  example-day action joins
- `src/lib/presentation/AGENTS.md` — no store access in components
- `src/lib/presentation/style/STYLE.md` — the banner's class cluster is the
  storage banner's second use; R3 decides whether that is the duplication that
  earns a composite `@utility`
- `messages/en.json`, and `de`/`es`/`fr`/`zh` beside it — the banner copy, the
  empty-state action, and the six task titles; all five locales
- `src/lib/presentation/component/seo-head.svelte` — canonical is built from
  `page.url.pathname`, so `/?demo` already self-canonicalises to `/`; this is
  why the Out of scope list needs no robots or sitemap work
- `docs/deployment.md` — the serving decisions that conclusion rests on
- `docs/testing.md` — the level table each scenario above names
- `README.md` — the "Try it" link becomes `/?demo`
- `ROADMAP.md` Phase 6 — append this as a new item; renumber nothing

No MATH.md section changes: the demo runs the existing solver on new inputs.

## Decisions

- **Demo mode is a second reader passed to `setSessionStore`, beside the date
  reader.** The planner page, its layout and every view model stay one code
  path. Rejected: a `/demo` route, because it duplicates the page to change its
  data source.
- **The demo skips `initializeStorage` and every repository read.** Rejected:
  seeding IndexedDB and deleting on exit, because an exit that never runs — a
  closed tab, a crash — leaves fabricated tasks in a real profile.
- **Editing works in the demo, it just never persists.** Poking at a slider is
  how a visitor learns what the model does. Rejected: a read-only demo, because
  it answers fewer of the questions the link exists to answer.
- **The six task titles are paraglide messages like all other copy**, so the
  demo is not English-only on `/de/?demo`. Rejected: literals in the fixture,
  because `messages/` is the only place user-visible copy lives.
- **The fixture carries the model inputs (effort, enjoyment, ϕ, nature), the
  declared hours, the switch cost and both pools** — everything the Claim needs
  to be checkable without a store.
- **The banner is inline in the layout, not a component.** It mirrors the
  storage-error block; a one-off wrapper component is what the presentation
  rules ban.
- **This spec does not renumber ROADMAP.md.** The Phase 6 item is appended in
  the landing commit.

## Open questions

None.
