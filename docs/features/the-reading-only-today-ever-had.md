# The reading only today ever had

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

Yield Index — "of the work I finished, was it the highest-priority work
available?" — exists only as today's tile on the dashboard. The user can see
how much of the plan they got through over a week, month or year, but never
whether the part they got through was the part worth doing. After this, the
Analytics page plots Yield Index per day over the viewed range, with Completion
Rate beside it as the reference line.

## Scenarios

### Scenario — the range carries a Yield reading

`e2e/analytics.e2e.ts`

- **Given** a profile with stored sessions on several of the last seven days,
  each with at least one completed task
- **When** the user opens `/analytics` on the Week range
- **Then** a card headed by the Yield card's title is visible
- **Then** its chart is reachable by its own accessible name, distinct from the
  Completion rate bar chart's
- **Then** the legend names Yield Index
- **Then** the legend names Completion Rate

### Scenario — a day that finished nothing has no Yield reading

`src/lib/presentation/utils/metric-trend-series.test.ts`

- **Given** three consecutive day summaries in the range, the middle one with
  tasks planned and `completedTasks: 0`
- **When** the output series is built
- **Then** the Yield line's value at the middle slot is `null`
- **Then** the Completion Rate line's value at the middle slot is `0`

### Scenario — a day the user never opened has neither reading

`src/lib/presentation/utils/metric-trend-series.test.ts`

- **Given** a range of seven days with a stored summary for only the first and
  last
- **When** the output series is built
- **Then** both lines carry seven values
- **Then** both lines are `null` on the five slots with no stored summary

### Scenario — every day summary carries its own Yield Index

`src/lib/business/model/metric/history.test.ts`

- **Given** a stored session whose completed tasks are not the top-priority
  ones
- **When** it is summarized
- **Then** the summary's `yieldIndex` equals `calculateYieldIndex` over the
  same plan the summary was read off
- **Then** a session with nothing completed summarizes to `yieldIndex: 0`

## Out of scope

- **Fallow Gain over the range.** The obvious "productivity" number, and
  already measured and refused for the trend card: `mtr-metric-trend.probe.ts`
  is why that card plots three lines and not four. Nothing here re-opens it.
- **Any plan-scope reading** — Deep Work Ratio, Human Capacity, Time Scarcity,
  flow coverage. They describe the plan the user wrote, not the work they did,
  and they are allocation-dependent on top of it, so they would inherit
  `solveWithoutSwitchCost`'s error, which is the thing this card is free of.
- **Monthly aggregation at the Year range.** The card draws one slot per day at
  every range, the way the Load card already does. The bar chart's monthly path
  (`monthlyCompletionRates`) is not extended.
- **A new store getter.** `analytics.summaries` is already public and already
  read by the page.
- **A band, colour or verdict on the reading.** No card on this page judges its
  own numbers except through `utils/band.ts`, and nothing asked for banding here.
- **Touching the chart component.** `metric-trend-chart.svelte` already draws
  gaps, single-day dots and a legend from `TrendSeries`; it takes no change.

## Read before building

- `src/routes/(app)/analytics/+page.svelte` — the card goes directly under the
  "Load and burnout" card, inside the existing `{:else}` gate. **It needs no `pending()` or `reportFailed()`
  branch**: its data is `analytics.summaries`, which is what `hasData` already
  gated on — unlike the Load card, which waits on the calibrated energy params.
  The loading branch's skeleton array is commented as "the five full-width
  GATED cards"; it becomes six, and the new body is `aspect-[800/180]`, the
  same ratio the Load card's skeleton uses.
- [`src/lib/presentation/utils/metric-trend-series.ts`](../../src/lib/presentation/utils/metric-trend-series.ts)
  — the slot-filling, the `TICK_TARGET` label step and the `line()` helper. The
  new builder is the second real caller of the slot/label half (R3), so that
  half is shared inside this module. The comment on `line()` is the rule that
  every colour class stays spelled out literally — Tailwind's scanner cannot
  see `'stroke-' + hue`.
- [`src/lib/presentation/component/metric-trend-chart.svelte`](../../src/lib/presentation/component/metric-trend-chart.svelte)
  — what a `TrendSeries` has to satisfy, and why a `null` is a break and a
  lone recorded day is a dot.
- [`src/lib/presentation/component/completion-bar-chart.svelte`](../../src/lib/presentation/component/completion-bar-chart.svelte)
  — the bars are `fill-brand`; the Completion Rate line is the same fact, so it
  carries the same hue.
- [`src/lib/business/model/metric/history.ts`](../../src/lib/business/model/metric/history.ts)
  — `DaySummary` and `summarizeSession` gain `yieldIndex`, read off the same
  `solveWithoutSwitchCost` plan every other field is. `calculateMetricTrend`'s
  doc comment is where the exactness argument for `completionRate` is already
  written, and it covers `yieldIndex` for the same reason.
- [`src/lib/business/model/metric/calculation.ts`](../../src/lib/business/model/metric/calculation.ts)
  — `calculateYieldIndex`, and `calculateCompletionRate` above it.
- MATH.md §3 — `priorityScore = P̄(T*)·10` is intrinsic, independent of the
  allocation "at **every** budget, zero included", and the section states
  outright that the 1 dp rounding does not reach the Yield Index. **This is the
  whole licence for the card, and no formula, constant or bound moves: MATH.md
  is not edited by this change.**
- Three test fixtures build `DaySummary` literals and each needs the new field:
  [`calendar-store.svelte.spec.ts`](../../src/lib/business/store/calendar-store.svelte.spec.ts),
  [`completion-chart-points.test.ts`](../../src/lib/presentation/utils/completion-chart-points.test.ts),
  [`analytics-store.svelte.spec.ts`](../../src/lib/business/store/analytics-store.svelte.spec.ts).
- [`messages/en.json`](../../messages/en.json) and the four other locales —
  `ana_load_trend`, `_hint` and `_aria` are the keys to copy the shape of. The
  two line labels reuse `metric_yield_index` and `metric_completion_rate`; only
  the card's own three keys are new.
- [`e2e/analytics.e2e.ts`](../../e2e/analytics.e2e.ts) — the existing chart is
  found by the name `Completion rate`, so the new one's accessible name must
  not collide.
- [STYLE.md](../../src/lib/presentation/style/STYLE.md) — semantic tokens only;
  `stroke-info` and `stroke-brand` both already ship.

## Decisions

- **Yield Index, not "productivity"** — the card is titled for the two lines it
  draws ("Yield and completion"), matching "Load and burnout" one card below.
  Rejected: "Productivity", because the word already names `P(t)`, the model's
  own curve (MATH.md §2, and an AGENTS.md §4 entry is phrased around it) — one
  word for two things in a repo where every reading is cited by name. The
  metric is also already called Yield Index on the dashboard, so the chart and
  the tile say the same word for the same number.
- **Completion Rate rides along as a second line** — it is drawn once already,
  as bars, directly above. It is here anyway because Yield Index alone
  misreads: a flat 100% line means "everything I finished was the top of the
  list", which a user with one task done out of eight would read as a perfect
  day. The second line is the named failure that §0 asks for before extra code
  goes in, and it costs one `line()` call. Rejected: Yield alone.
- **The Yield line breaks on a day that completed nothing; the Completion line
  plots 0 there** — they look inconsistent and are not. Completing none of the
  plan is a true reading of 0%; "of what you finished" has no value when
  nothing was finished, which is why the dashboard gates the Yield tile on
  `completedTasks > 0` and shows the Completion tile always. The chart's gap
  convention already exists for exactly this. Rejected: plotting the `0` that
  `calculateYieldIndex` returns, because it prints a reading the tile refuses
  to print.
- **One slot per day at every range, including Year** — 365 slots, the way the
  Load card already draws its year, so the two line charts on the page share
  one x-axis convention. Rejected: monthly averages like the bar chart's Year
  view, which needs a second aggregation path for a smoother line nobody asked
  for.
- **`yieldIndex` is stored on `DaySummary` rather than recomputed in the
  builder** — every other reading the analytics page folds is a `DaySummary`
  field, and the summary is where the plan it must be read off lives.
  Recomputing it in the presentation layer would need `suggestedTasks` handed
  across the layer boundary for one sum. Rejected: a `calculateOutputTrend`
  beside `calculateMetricTrend`, which is a second fold over the same summaries
  for two numbers already in them.
- **No new module for the series builder** — it goes in
  `metric-trend-series.ts` beside `metricTrendSeries`, sharing the slot and
  label half. Rejected: a second file, which would export the shared half
  across modules to save nothing.
- **No probe** — the card's honesty claim is that its two readings are
  _identical_ to the dashboard's, not close to it, because `priorityScore` is
  allocation-independent (MATH.md §3). That is a bound, so it is a test, not a
  number that moves (`scripts/PROBES.md`).

## Open questions

None.
