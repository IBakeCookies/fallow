# Worked-hours instrument on `/`

**Status:** landed 2026-08-09 · **Roadmap:** item 11

Backfilled 2026-08-14 from ROADMAP item 11, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

🪫 is logged from `/` and not only `/energy`, and ⚡ from `/energy` and not only
`/`: both measurements are on both task rows. Nothing about the data needed
building — the 🪫 button was simply only ever rendered on `/energy`.

## Scenarios

### Scenario — both instruments sit on both rows

- **Given** today's task list on `/`
- **When** the row's hover-revealed action strip is open
- **Then** the 🪫 button is on the row
- **Given** today's task list on `/energy`
- **When** the row's hover-revealed action strip is open
- **Then** the ⚡ button is on the row

### Scenario — completing a task asks both questions

- **Given** a task on either screen
- **When** the task is completed
- **Then** both measurement prompts open, stacked

### Scenario — each measurement keeps its own prompt policy

- **Given** a day that already has a ⚡ (one number per day)
- **When** a task is completed
- **Then** the ⚡ question goes quiet
- **Given** a task already rated 🪫 today (one per session, MATH.md §18)
- **When** the task is completed
- **Then** the 🪫 question is asked again

### Scenario — a row says at rest what it measured

- **Given** a task with a ⚡ measured, on either screen
- **When** the action strip is at rest
- **Then** the ⚡ badge reads the measurement
- **Given** a task with a 🪫 rating
- **When** the action strip is at rest
- **Then** the strip stays pinned open (superseded 2026-08-10, see Decisions)

## Out of scope

- **`DailyMetricsInput` was deliberately left alone.** This item planned to add
  today's logs to it (`metric/daily-metrics.ts:48-58` still has no worked-hours
  field), but nothing reads such a field until item 12 — it is 12's input, and
  adding it now would ship a prop with no consumer.
- **Options (b) and (c) for hours provenance are moot** — worked hours as a
  `Task` field (b) and a new store (c) — since (a) settled.
- **The α-drift probe** that would have chosen between (b) and (c) is not
  needed.
- **No amendment path attaches an old rating to new hours.** Every session
  re-asks mind/body, and correcting one edits that row in place.
- **No schema change, no R8.**
- **Known limit: the sessions-per-day bias** in item 18's table, which this
  makes commoner and does not cause.
- **🪫 cannot badge** — a task worked twice has two ratings.
- **No data work.** `EnergyObservationStore` is created once in the `(app)`
  layout and both pages already read it from context, so a 🪫 log has always
  been shared across the two screens.

## Where it landed

- `task-row-shell.svelte` — the two rows already shared it; with the same two
  actions on both, the `actions` and `forms` snippets were identical in each
  caller, so the whole action strip, both measurement editors and the ✎ editor
  moved in, as did the ⚡ badge.
- `task-item.svelte` — now its three reading snippets and the prop mapping
  around them; gave up the ⚡ badge.
- `energy-task-row.svelte` — same three reading snippets and prop mapping.
- `measurement-prompt.ts` — holds `DrainDraft`/`newDrainDraft`, which is what
  stops the two pages' draft records drifting apart again.
- `measurement-form-actions.svelte` — the one owner of the ✓/✕ pair.
- `fit-log-summary.svelte` — keeps the fit's two verbs after the three
  calibration cards stopped listing their own kind.
- `zenith-energy.ts` — takes `UserConstants` in its curve builders, so the Lab's
  own plans are computed with ϕ constants only the main page could calibrate.
- `metric/daily-metrics.ts:48-58` — `DailyMetricsInput`, left without a
  worked-hours field.
- MATH.md §18 — hours provenance, settled as option (a).
- MATH.md §8.7 — the one session `H` that `DrainObservationRecord.hours`
  instruments for α.
- MATH.md §8.10, §11.9, §12 — the readings that take a task's day as the sum of
  its session rows.
- MATH.md §36 — what a correction may touch; what let the ✎ leave the row.
- AGENTS.md R3 — the two screens are one definition.

## Decisions

- **It was a smaller thing than the item claimed** — what shipped is the button,
  on both rows. Nothing about the data needed building: the store is created
  once in the `(app)` layout and both pages already read it from context.
- **The symmetric half was the real finding.** If 🪫 belongs on `/` because the
  α, λ₀, §12 and §11.9 readings all run off worked hours, then ⚡ belongs on
  `/energy` for the same reason: `zenith-energy.ts` takes `UserConstants` in its
  curve builders, so the Lab's own plans are computed with ϕ constants only the
  main page could calibrate. Each screen was withholding an instrument the
  other's model consumes. Both measurements are now on both rows.
- **So it consolidated rather than added.** The identical `actions` and `forms`
  snippets in the two callers collapsed into `task-row-shell.svelte`, leaving
  `task-item.svelte` and `energy-task-row.svelte` as their three reading
  snippets and the prop mapping around them.
- **`canLogFlow` became `canLog`** — the gate is `selectedDate === today` and
  both stores stamp an observation with the live clock's today, so the hazard it
  guards is the same for either measurement.
- **`DrainDraft`/`newDrainDraft` moved to `measurement-prompt.ts`** — which is
  what stops the two pages' draft records drifting apart again.
- **Completing a task now asks both questions**, stacked, each keeping its own
  policy — ⚡ goes quiet once measured (one number per day), 🪫 never does (one
  per session, MATH.md §18).
- **The ⚡ badge moved into the shell from `task-item.svelte`** — with both
  instruments on both rows and the strip hover-revealed, neither caller was
  saying at rest what it had already measured.
- **🪫 pinned the strip open instead of badging** — a task worked twice has two
  ratings, so it cannot badge; that is what the Lab's row did before and `/`
  then did too. **Superseded 2026-08-10:** a rating reads as one chip per
  session, which says it at rest without holding the strip open — and, being
  per-rating, is what let correcting and deleting one move onto the row it
  belongs to on both screens (AGENTS.md R3).
- **The cross-date reading the chips cannot give moved to `/analytics`**
  (2026-08-10), which now prints every ⚡, 🪫 and ☕ as one dated list — the range
  it is viewed under by default, or all of them — and both of a measurement's
  verbs sit on its row there: ✕ drops it, ✎ corrects it. The card resets the
  fit, the list holds the measurements, and this answers "what did I log". The
  three calibration cards stopped listing their own kind the same day — three
  partial answers to one question — and kept the fit's two verbs
  (`fit-log-summary.svelte`).
- **⚡ joined 🪫 in being correctable on a PAST day the same week** — the badge
  reads the day's own observation instead of a `flowMinutes` field on its
  session, so an amendment lands somewhere the auto-save is not asked to
  rewrite, and the field is gone. What let the ✎ leave the row at all is MATH.md
  §36: a correction rewrites the quantities the user rated and re-derives no
  covariate from the live task, so it needs no day in view — which is also the
  first correction ☕ has ever had, having no task and so no row to carry one.
- **The ✓/✕ pair likewise has one owner** (`measurement-form-actions.svelte`) —
  the three editors had each grown their own, two with a hover surface and one
  without.
- **Hours provenance — SETTLED 2026-08-05 as option (a)** (MATH.md §18).
  `DrainObservationRecord.hours` stayed the α instrument (§8.7's one session
  `H`) and the store became **one row per session**: §8.10/§11.9/§12 read a
  task's day as the sum of its rows, which is what `workedHoursByTask` and
  `readFinishedDays` already computed. The `(taskId, date)` upsert that forced
  the two readings onto one number is gone — it turned out to be deleting the
  earlier session outright, not just blurring it. Rejected: (b) worked hours as
  a `Task` field and (c) a new store, both moot once (a) settled.
- **New user input: yes, but only the `/`-side form.**

## Open questions

None — landed.
