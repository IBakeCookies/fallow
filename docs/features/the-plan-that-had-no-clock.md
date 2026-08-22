# The plan that had no clock

**Status:** landed 2026-08-22 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`/` gains **The day** — the redesign's centrepiece
([docs/redesign/README.md](../redesign/README.md) item 2): a to-scale strip
above the ledger, one block per funded task in run order, each block as wide as
its allocation, the gaps between them the switch cost, and a bar under each
title showing how far that allocation gets toward flow arrival. Reaching flow
reads `success`, stopping short reads `warning`, so the diagnosis the ledger
prints as two numeric columns is visible without reading them.

The strip needs a clock the model does not have. Fallow allocates durations, so
the day gets a **start time** the user sets per day beside its budget, and the
strip labels itself `from 09:00`. It is a display anchor and nothing else: no
formula reads it, no fit reads it, and the plan is identical with or without
it.

## Scenarios

### Scenario — the strip prints no clock until the day is given a start

`e2e/time-budget.e2e.ts`

- **Given** today, a fresh profile, one task, an 8 h budget
- **When** the page loads
- **Then** the strip prints no clock time

### Scenario — the start time moves the label

`e2e/time-budget.e2e.ts`

- **Given** today, one task, an 8 h budget
- **When** the day's start time is set to `07:30`
- **Then** the strip's label reads `from 07:30`

### Scenario — a day whose only edit is its start time is still saved

`e2e/time-budget.e2e.ts`

The auto-save skips a pristine day so browsing ahead creates no empty records
(`session-store.svelte.ts`'s `dirty`). A start time is the fourth field that
makes a day non-pristine, and the only one added since that guard was written.

- **Given** today, a fresh profile, no tasks and no budget
- **When** the start time is set to `07:30` and the page is reloaded
- **Then** the start-time field reads `07:30`

### Scenario — a past day draws the strip it was planned under

`e2e/day-navigation.e2e.ts`

- **Given** a past day loaded by date, holding one task and a budget
- **When** the page loads
- **Then** The day's strip renders that task's block
- **Then** no start-time field exists

### Scenario — moving a task to tomorrow keeps tomorrow's start time

`src/lib/business/store/session-store.svelte.spec.ts`

`moveTaskToTomorrow` writes the destination day as a whole record, so every
field it does not carry is a field it erases.

- **Given** tomorrow already stored with a start time of `06:00`
- **When** a task is moved to tomorrow
- **Then** the stored destination day still reads `06:00`

### Scenario — a stored start time that is not a number reads as unset

`src/lib/business/model/persisted.test.ts`

- **Given** a stored session whose `startHour` is `'nine'`
- **When** it is sanitized
- **Then** the returned session has no `startHour`

### Scenario — a stored start time outside the day is clamped into it

`src/lib/business/model/persisted.test.ts`

- **Given** a stored session whose `startHour` is `99`
- **When** it is sanitized
- **Then** its `startHour` reads `24`

### Scenario — the blocks read in run order, offset by the ones before them

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** three funded tasks at 2 h / 1 h / 1 h, run order 2, 3, 1, a 0
  switch cost and a 4 h budget
- **When** the view model is built
- **Then** the blocks read in run-order sequence
- **Then** their start offsets read 0 h, 1 h and 2 h

### Scenario — consecutive blocks are separated by the switch cost

`src/lib/presentation/utils/day-timeline.test.ts`

The gap **is** the reading: the strip states the switch cost by leaving room
for it rather than printing a second copy of the number.

- **Given** two funded tasks at 2 h each, a 0.25 h switch cost and a 4.25 h
  budget
- **When** the view model is built
- **Then** the second block's start offset reads 2.25 h

### Scenario — a block that reaches flow and a block that does not

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** one task allocated 2.5 h with a flow arrival of 2.25 h, and one
  allocated 1 h with a flow arrival of 1.5 h
- **When** the view model is built
- **Then** the first block's band is `success`
- **Then** the second block's band is `warning`

### Scenario — an unfunded task gets no block

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** two tasks, one allocated 2 h and one allocated 0 h
- **When** the view model is built
- **Then** the view model holds one block

### Scenario — a day that funds nothing still states its start

`src/lib/presentation/utils/day-timeline.test.ts`

- **Given** no tasks, a start time of 09:00 and an 8 h budget
- **When** the view model is built
- **Then** the view model holds no blocks
- **Then** its start label reads `09:00`

### Scenario — a block short of flow says so in words

`src/lib/presentation/component/day-timeline.stories.svelte`

Colour is the only thing separating the two bands on screen, so the band has to
be readable without it (WCAG 1.4.1 — `band.ts`'s `bandLabel` is what the
metrics dashboard uses for the same reason).

- **Given** a strip holding one block allocated short of its flow arrival
- **When** the story renders
- **Then** the block carries the `warning` band's word

### Scenario — an empty strip says the day funds nothing

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** a strip with no blocks and an 8 h day
- **When** the story renders
- **Then** the card reads its nothing-funded line
- **Then** the card reads its start

### Claim — the funded plan always fits inside the day (pin)

`src/lib/business/model/metric/daily-metrics.test.ts`

The strip's geometry depends on this and carries no clamp for it, per AGENTS.md
§0: `bestPlanWithSwitchCost` buys blocks out of
`floor((totalBudget − overhead) / BLOCK_HOURS)`, so the allocation plus the
overhead cannot exceed the budget by construction. Pinning it here is what
lets the component divide by the budget and trust the result. It goes green on
its first run.

- **Given** any task set, budget and switch cost `calculateDailyMetrics` accepts
- **Then** `Σ suggestedHours + (fundedCount − 1) · switchCost ≤ availableHours`

## Out of scope

- **An hour axis.** The artboards draw `09 10 11 …` tick labels above the
  strip. Each block's own duration already carries the scale; ticks are a
  second layout to keep in step with the first, for a reading the header makes.
- **A footer sentence about flow coverage.** The artboards close the panel with
  "Four of five tasks stop before flow arrives. Flow coverage 1/5." That number
  is the metrics grid's `Flow Coverage` tile, and printing it twice is R3 in the
  UI. The bars are this panel's version of that reading.
- **"16m of it left"** on a block that overshoots flow. The `success` band and
  `flow at 2h 14m` already say it was reached; the remainder is a third number
  on a block that has two.
- **The Energy Lab's strip gaining clock labels.** `plan-timeline-bar.svelte`
  reads elapsed offsets (`formatOffset`) and `/energy` already holds
  `getSessionStore()`, so it is cheap — but it is a second screen's change with
  its own stories, and the Lab's blocks come from a different solver.
- **Prefilling the start time from the weekday.** `availableHours` does this
  (`prefillBudgetFor`, ROADMAP item 16) because a budget varies by day of week.
  An unset day opens on the presentation default instead; a weekday memory for
  the start time is a second history to summarise for a field most users set
  once.
- **The start time entering any formula.** MATH.md §8.3's circadian boundary is
  settled — rejected until there is an instrument, and the only time-of-day
  instrument the data carries is the `createdAt` stamp on 🪫 logs (§36). This
  change adds no instrument and re-opens nothing: `sanitizeSession` grows a
  field the model never reads.
- **Redrawing the strip from the mid-day re-plan.** `remainingDay` (MATH.md
  §35) re-solves what is left once hours are logged; the strip stays the day as
  planned from its start time, which is what the ledger's `Hours` column and
  the metrics grid also read. A strip that slid under the user through the day
  is a different feature.
- **Putting the start time in the collapsed budget summary.** The strip's own
  label states it on screen already.

## Read before building

- `src/lib/data/type/index.ts:37-47` — `DailySession` gains
  `startHour?: number`. **Optional, on the `cognitivePool` / `physicalPool`
  precedent** and for the same reason: every day stored before this change has
  none, and absent must stay distinguishable from a value. No new object store,
  so R8 does not fire — no `DB_VERSION` bump, no `STORE_NAMES` edit.
- `src/lib/business/model/persisted.ts:104-137` — `sanitizeSession`. The two
  optional pools at the end of that function are the shape to copy: read
  `finite()`, and set the key only when it is present. Clamp to `[0, 24]` (the
  pools have no upper bound; a start time needs one, or a hand-edited `99`
  pushes every block off the panel). That 24 is a **local constant here, not
  `BUDGET_BOUNDS.max`** — R1 forbids the import, and the two answer different
  questions (a calendar day versus a form field's range).
- `src/lib/business/store/session-store.svelte.ts` — four edits, each mirroring
  what `switchCost` and the pools already do:
  - `:108` — a `#startHour = $state<number | null>(null)` field. **Null, not a
    default**, on `#availableHours`' precedent: the raw field is what the
    pristine-day check reads.
  - `:276-282` — the `dirty` test gains `this.#startHour !== null`. Without it
    a day whose only edit is its start time is never written, which is the
    third scenario above.
  - `:293` + `:721` — both session writes carry `startHour`. The second is
    `moveTaskToTomorrow`, which writes a whole record: it must carry the
    destination's own value, which means `#readDestination` (`:365-381`)
    returns it too — with **no fallback**, since a `?? 9` there would stamp a
    start time onto a day that never chose one.
  - `:455-472` — `#loadSession` sets the field from the record and back to
    `null` for a day with none.
  - `:557-562` — a `startHour` getter/setter pair beside `switchCost`'s, on the
    raw value. The default is presentation's (see below), so the store hands
    out `number | null`.
- `src/lib/presentation/utils/budget-bounds.ts` — gains `DEFAULT_START_HOUR`
  and the start field's bounds beside `BUDGET_BOUNDS`. **The default lives here,
  in presentation**, on the argument `band.ts` makes for its thresholds: no
  formula reads a start time, so choosing 09:00 is a display decision and does
  not belong beside `DEFAULT_SWITCH_COST` in `zenith.ts`, where R7 would then
  want a MATH.md section for a constant with no math in it.
- `src/lib/presentation/utils/duration-format.ts` — gains `formatClock(hours)`
  → `"09:00"` and its inverse for the `<input type="time">` value. **24-hour and
  locale-free**, matching `formatOffset` in the same file. Also **fix
  `formatOffset`'s comment**: it says "the model has no notion of when the day
  begins", which stays true of the model and stops being true of the session —
  say which, or the next reader reads it as a ban on this feature.
- `src/lib/presentation/utils/day-timeline.ts` (new) — the view model:
  `{ range: { start, end }, blocks: [{ id, title, hours, startOffset, share,
flowShare, band, ... }] }` from `suggestedTasks`, `runOrder`, `switchCost`,
  `availableHours` and the start hour. `completion-chart-points.ts` is the
  precedent for the shape and for why the geometry is a tested util rather than
  a pile of `$derived` in the component (R2). Blocks carry a `Band`, never a
  class string — [presentation/AGENTS.md](../../src/lib/presentation/AGENTS.md)
  §"Metric color-band thresholds".
- `src/lib/presentation/utils/band.ts` — `Band`, `BAND_BAR_CLASS` for the flow
  bar's fill, and `bandLabel` for the word the twelfth scenario asserts.
- `src/lib/presentation/component/plan-timeline-bar.svelte` — **read it, then
  do not reuse it.** It is the Lab's strip: contiguous `EvaluatedBlock`s with
  model-given `start` offsets, rest blocks, `SeriesColors` fills and no flow
  reading. The two share a metaphor and no payload; what they must share is
  `formatClock`, so the day never has two spellings of a time.
- `src/lib/presentation/component/day-timeline.svelte` (new) and its stories.
  `card-shell` is the card surface (STYLE.md); the blocks are absolutely
  positioned by percentage share off the range, like the Lab's bar sizes by
  `width:` off `windowHours`.
- `src/lib/presentation/component/day-constraints-bar.svelte:9-42` — one more
  bound prop and one more field. It holds `availableHours`, `switchCost` and
  both pools already; a native `<input type="time">` matches the native
  `type="date"` in `day-actions.svelte:192`. Its `isOpen` heuristic
  (`availableHours <= 0`) is untouched.
- `src/routes/(app)/+page.svelte:259-261` — `<DayTimeline>` renders between
  `<MetricsDashboard>` and `<TaskList>`, which is the artboards' order, and
  binds the new field into `<DayConstraintsBar>` beside the other four. Note
  the bar is inside `{:else}` — a past day has no constraints panel at all,
  which is the fourth scenario's second Then.
- `src/lib/presentation/AGENTS.md` — the public-export half: a new component, a
  new presentation util, and the day's start time as a session field the model
  does not read. One line each.
- `docs/redesign/README.md` — **"One thing still to settle" is settled by this
  change.** Its text says the clock times are invented and that shipping the
  timeline means adding the setting "and deciding how it interacts with the
  circadian drain instrument (MATH.md §8.8)". §8.8 is 45-minute plan
  granularity; the instrument is §36's `createdAt` stamps under §8.3's
  boundary. Correct the citation and record the decision, the way items 1 and 6
  in the same file record theirs.
- `messages/{en,de,es,fr,zh}.json` — the panel's title, its start line, its
  legend, the two per-block flow lines, the nothing-funded line, and the
  start-time field's label. `budget_*` for the field, on the bar's existing
  keys.
- `docs/testing.md` — the level table, for the four util scenarios, the two
  story scenarios and the store one; and the reviewer table for the dispatch.
- `AGENTS.md` §0 — the out-of-scope list above is enforcement of it. The axis
  and the footer sentence are the two things most likely to get helpfully built.

## Decisions

- **The start time is a display anchor, not a model input** — no formula, fit or
  metric reads it, so the plan is byte-identical with and without it and no
  MATH.md section changes. Rejected: feeding it into the drain/recovery
  simulation so a 06:00 day prices differently from a 14:00 one — that is
  MATH.md §8.3's circadian boundary, settled as "rejected until there is an
  instrument", and this change brings none.
- **Per day, on the session record** — a weekend that starts at noon is a real
  day, and `availableHours` and the pools already establish that the day's
  shape is per-day and persisted. Rejected: one profile-wide setting, which
  cannot say that; rejected: `localStorage`, which R4 permits for a value no
  formula reads but which would then be the only part of a day's shape that a
  backup does not carry.
- **The default lives in presentation** — 09:00 is a display choice about an
  anchor no formula reads, which is exactly the argument `band.ts` makes for
  keeping banding thresholds out of the model. Rejected: `DEFAULT_START_HOUR`
  beside `DEFAULT_SWITCH_COST` in `zenith.ts`, which puts a constant with no
  math in it in the file R7 governs; rejected: a default inside
  `sanitizeSession`, which would make "unset" unrepresentable and so make the
  pristine-day check impossible.
- **The strip is a new component, not `plan-timeline-bar.svelte`** — the Lab's
  bar renders the energy optimizer's `EvaluatedBlock[]`, which already carry
  `start` offsets and rest blocks and are coloured per task series. `/`'s blocks
  are derived from run order, durations and the switch cost, and their whole
  point is the flow bar the Lab's has no input for. Rejected: one component
  taking both shapes — that is a mode flag on a component whose two modes share
  only a metaphor (AGENTS.md §4, "the shell takes a `columnCount`, never a mode
  flag"). What they do share, `formatClock`, is exported once.
- **The gaps state the switch cost; no number restates it** — the artboards'
  footer prints `15-minute switch cost — 1.00 h of the day`, which is
  `daily-metrics.ts:123`'s `overhead` computed a second time in a second layer.
  The legend names what a gap is and the geometry does the arithmetic.
  Rejected: exporting `overhead` from the metric to print it here, which adds a
  public export for a sentence.
- **The clock is 24-hour and locale-free** — `formatOffset` in the same file
  sets that precedent, `<input type="time">` needs `HH:MM` on the wire anyway,
  and one function then serves the field and the strip's own label.
  Rejected: `Intl.DateTimeFormat` per locale, which would render `9:00 AM` in
  `en` and split the format the input uses from the one the panel prints.
- **The strip draws the morning plan all day** — it matches the ledger's
  `Hours` column, the metrics grid and `planSlackHours`, all of which are
  plan-scoped (MATH.md §11.8). Rejected: re-anchoring on `remainingDay` once
  hours are logged, which makes the panel move under the user and puts a second
  scope on a page whose scope families are settled.
- **An empty day keeps the panel** — it still has a start, an end and a real
  statement to make ("nothing is funded today"), and a card that appears and
  disappears as the budget crosses zero is a layout that jumps on the app's
  most common first action. Rejected: hiding it, on `plan-advice-card`'s
  precedent — that card hides because its reading costs a solve, and this one
  costs nothing.
- **The funded-plan bound is pinned rather than clamped** — `Math.max(0, …)` in
  `planSlackHours` makes an overflow look representable; the allocator's block
  budget makes it impossible. A test says which, and the component then divides
  by the budget with no guard (AGENTS.md §0: complexity needs a reachable
  failure).

## Open questions

None.
