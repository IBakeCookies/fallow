# The task that drains more than its sliders

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

The user can see which of their recurring tasks drains a reservoir fastest per
hour worked, and which drains it slowest — measured against how hard they
themselves rated the task, so a task that costs more than its sliders say is
the one that surfaces. Today the analytics screen reports drain only as a
whole-day total (logged hours, the fitted α on "Your model"): nothing on the
page attributes drain to a task.

## Scenarios

### Scenario — the ranking appears once a reservoir has enough separated logs

`e2e/analytics.e2e.ts`

- **Given** a month range where two task titles each carry ≥ 3 first-session 🪫
  rows dated before today, with cognitive demand > 0
- **And** their fitted α values are separated by more than the sum of their
  posterior stds
- **When** the user opens `/analytics`
- **Then** a "Most draining per hour" card is present
- **And** the card names the higher-α title as most draining for mind
- **And** the card names the lower-α title as least draining for mind

### Scenario — a reservoir whose ends are not separated is not ranked

`src/lib/business/model/energy-calibration.test.ts`

- **Given** two titles with ≥ 3 first-session rows each whose fitted α values
  differ by less than the sum of their posterior stds
- **When** the ranking is read
- **Then** that reservoir carries no ranking

### Scenario — the card is absent when no reservoir qualifies

`e2e/analytics.e2e.ts`

- **Given** a profile with a planned day and no 🪫 logs
- **When** the user opens `/analytics`
- **Then** no "Most draining per hour" card is present

### Scenario — a desk user gets the mind ranking and no body ranking

`src/lib/business/model/energy-calibration.test.ts`

- **Given** ≥ 3 first-session rows per title on two titles, all with
  `physicalDemand = 0` and `cognitiveDemand > 0`
- **When** the ranking is read
- **Then** the cognitive reservoir carries a ranking
- **And** the physical reservoir carries no ranking

### Scenario — today's rows are deferred and the card says so

`e2e/analytics.e2e.ts`

- **Given** a qualifying month range, plus two 🪫 rows logged today
- **When** the user opens `/analytics`
- **Then** the card states that 2 logs from today are not yet counted

### Scenario — the ranking reslices with the range toggle

`src/lib/business/store/analytics-store.svelte.spec.ts`

- **Given** six 🪫 rows dated before the week the page opens on, inside the month
- **When** the user switches the range from week to month
- **Then** the ranking names both ends, having named neither on the week

### Claim — a thin title cannot reach the ends of the ranking

`src/lib/business/model/energy-calibration.test.ts`

- **Given** two titles with the same mean rated drain at the same demand and
  hours, one with 1 informative row and one with 5
- **Then** the 1-row title's fitted α is strictly closer to the global fitted α
  than the 5-row title's

### Claim — a title's rows are the day's first session only

`src/lib/business/model/energy-calibration.test.ts`

- **Given** a title whose rows are all second-or-later sessions of their day,
  ordered by `createdAt`
- **Then** the title is absent from the ranking

### Claim — the range bounds the fit

`src/lib/business/model/energy-calibration.test.ts`

- **Given** a title whose only qualifying rows are dated before `rangeStart`
- **Then** the title is absent from the ranking

### Claim (pin) — the global calibration is untouched

`src/lib/business/model/energy-calibration.test.ts`

- **Given** any set of drain and rest records
- **Then** `calibrateEnergyParams` returns the same `params`, `cognitiveDrain`
  and `physicalDrain` as before this change

## Out of scope

- **A flow (⚡) counterpart.** `business/model/AGENTS.md`'s "ϕ stays one plane
  for all tasks" settled per-task ϕ structure on measured grounds that bind a
  display harder than a fit: 64–79% of logged titles carry one log, and the
  re-open bar is `Σδ̂²` above a 0.25 h noise floor. A ϕ-residual ranking would
  present near-noise as a finding, and a card is acted on in a way the
  allocator is not. Do not add one here; that decision is closed.
- **Feeding the ranking back into the model.** The per-title α is a reading
  only. `calibrateEnergyParams` keeps fitting one α per reservoir, the
  allocator keeps consuming it, and no plan changes because a title ranks high.
  A per-title α in the planner is the drain analogue of the per-task ϕ offsets
  already rejected, and it is not proposed.
- **A time-of-day column.** The fresh-start confound is removed by the
  first-session filter, not disclosed to the user to correct for.
- **Ranking by total drain (hours × rating).** See Decisions.
- **A "worst task" verdict.** The card ranks drain per hour; it does not judge
  a task, and the most draining task is frequently the day's most valuable one.
- **Any new persisted shape.** The reading folds `drainObservations` rows that
  already exist; no migration, no DB version bump.

## Read before building

- `MATH.md` §8.7 (Drain-rate calibration from end-of-session ratings) — the law
  `D(w,H;α)`, the ridge prior λ = 0.25, the posterior std, the `w = 0` / `H = 0`
  drop rule, and the **fresh-start assumption** this feature's first-session
  filter exists to neutralize. **A new §8.14 defines the per-title reading and
  its separation gate**; after inserting it run `node scripts/math-index.mjs`,
  because §8's line ranges shift and `npm run lint` checks the index.
- `src/lib/business/model/zenith-energy.ts` — `fitDrainRate` (the function to
  reuse per title) and `DrainRateFit` (`alpha`, `fitted`, `alphaStd?`,
  `usedCount`). Nothing in this file changes.
- `src/lib/business/model/energy-calibration.ts` — the new fold's home:
  `toCognitiveDrainObservations` / `toPhysicalDrainObservations` are already
  exported here and `calibrateEnergyParams` shows the fit's call shape. Chosen
  over `metric/history.ts`, which holds record folds with no fitting in them.
  A new public export lands here, so record it in
  `src/lib/business/model/AGENTS.md`.
- `src/lib/business/model/metric/history.ts` — `restSummary` and `loggedHours`
  are the convention for a range-filtered observation fold: `rangeStart` as a
  parameter, one nullable field when several numbers are one fact.
- `src/lib/business/store/analytics-store.svelte.ts` — the store already holds
  every input: `#drain` (all rows, unfiltered), `#energyParams` (the global
  fitted params), `#rangeStart`, `#today`, and the
  `#isModelReportLoaded` / `#hasModelReportFailed` pair a card must respect. Add
  a `$derived` reading; `ModelReport` does not need a new field.
- `src/lib/business/AGENTS.md`, "Being a today-only instrument does not exempt
  its fits from the causal window" — the rule that the α fit reads days
  **strictly before** today, and that a reading names what it defers beside the
  count. `session-history.ts`'s `countedDrain` is the existing filter to match.
- `src/lib/data/type/index.ts` — `DrainObservationRecord`: `taskTitle` is the
  grouping key, `createdAt` is the edit-stable log moment the first-session
  filter orders by, and `hours` is one session, so a day's rows are several.
- `src/routes/(app)/analytics/+page.svelte` — where the card goes (the
  `card-shell rounded-xl p-box-lg` pattern with an `<h2>` and an `mt-text-3xs`
  hint) and how a not-yet-loaded reading renders (`pending()` / `reportFailed()`
  snippets). R2 keeps the fold out of this file.
- `messages/en.json` — `ana_*` key naming; `de/es/fr/zh.json` need the same keys.
- `docs/testing.md` — the level table the scenarios above were picked from, and
  the reviewer row: this diff touches `business/model` and has a MATH.md
  section, so it gets a full reviewer pass with the § named.
- `src/lib/business/model/AGENTS.md`, "ϕ stays one plane for all tasks" — read
  it before touching the flow half. It is why there isn't one.

## Decisions

- **Rank by a per-title fitted α, not by hours × rating.** The 🪫 rating is
  already time-integrated — §8.7 reads `d/10` as `1 − C(H)` — so multiplying by
  hours double-counts length, and because the rating saturates at 10 a long
  task could never rank below a short brutal one. Rejected: `hours × drain`,
  which would rank the biggest task every week and tell the user nothing their
  own task list does not.
- **Reuse `fitDrainRate` per title rather than inverting the law by hand.**
  Rejected: a closed-form `α = −ln(1 − d/10)/(w·h)`, because it drops the
  micro-recovery term in `ρ = α·w + r′·g` and the `C_eq` floor, so it is not
  the quantity §8.7 fits. Reusing the fit also buys the ridge, the posterior std
  the gate needs, and the `w = 0` / `H = 0` drop for free.
- **The fallback α is the user's global fitted α, not the model default.** That
  is what makes "more draining than your other tasks" the sentence the card can
  say, and it makes the ridge do the protective work: a one-log title is pulled
  to the user's own α and cannot reach an end of the ranking.
- **Group by `taskTitle`, not `taskId`.** `nextTaskId` is `Date.now()`-based, so
  each day's instance of a routine task has a fresh id and a `taskId` fold
  aggregates nothing across a range. `business/model/AGENTS.md` already records
  the same constraint as one cost of per-task ϕ. Rejected: reading live titles
  by id, which cannot span days.
- **Only each day's earliest 🪫 row, ordered by `createdAt` — one per day across
  all titles, not one per title.**
  §8.7's fit assumes the session began at `C = 1`; a mid-day session that starts
  drained rates higher than the model predicts and biases α upward, so a task
  habitually done last would rank as most draining purely from its slot — and
  the user would drop the task when the answer is to move it earlier. Rejected:
  all rows with the confound disclosed in the hint, because it ships a biased
  ranking and asks the user to correct for it.
- **The ends must be separated by more than the sum of their posterior stds.**
  This is the gate that keeps the card from ranking noise, and it is the
  discipline the ϕ decision's 0.25 h noise floor applies to its own statistic.
  Fixture evidence that it will bite: ROADMAP item 18 records fitted α̂_phys
  landing in 0.261–0.267 across a whole probe arm — a narrow spread, on
  synthetic days, so it is a reason to gate and not a claim about real users.
- **A reservoir is ranked independently, and the card hides when neither
  qualifies.** §8.7 drops `w = 0` rows, so a desk user has no physical rows at
  all; ranking per reservoir is what lets the mind half ship anyway. Rejected: a
  permanent empty card explaining the 🪫 instrument, because a user who never
  logs would keep an empty box forever.
- **Minimum 3 informative day-first rows per title**
  (`DRAIN_RANKING_MIN_LOGS`), and the two ends must be different titles.
  Rejected: no gate, which the ϕ decision's single-log finding argues hardest
  against.
- **The reading respects the range selector.** The user asked for "over the
  period". Consequence to expect rather than fix: a 7-day range combined with
  the first-session filter and the 3-row gate will usually hide the card, and
  the month and year ranges are where it appears. Rejected: reading the whole
  loaded year like `currentStreak` does, which would print a figure the range
  the user is looking at does not support.
- **Today's rows are excluded and the deferred count is shown.** This is an α
  fit, so `business/AGENTS.md`'s causal-window rule applies unchanged, and the
  Lab's α card plus every "Your model" row already name what they defer beside
  the count.
- **Two lines of card, one per reservoir.** Each names its most- and
  least-draining title. Rejected: a full per-title table, which is surface §0
  does not pay for and duplicates the log history directly below it.

## Open questions

None.
