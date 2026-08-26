# Flow Coverage becomes the ninth advice axis

**Kind:** feature · **Status:** landed 2026-08-24 · **Roadmap:** item `none`

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

Planned 2026-08-24.

## Goal

Today the advisor can say "No task move and no budget change improves this" on a
day where moving one task off today takes Flow Coverage from 3/5 to 4/4 — because
Flow Coverage is not one of the eight `ADVICE_AXES` and nothing ever asks the
question. The lever already exists: `buildLevers` builds a `defer-task`
candidate for every unpinned active task and re-solves the whole day for each.

After this, "Check my day" can offer **"Move “Daily” off today · Flow Coverage
60% → 100% · −2.1% plan value"** — the same priced counterfactual every other
axis gets, on the one headline reading whose stated remedy (§28: "2/5 means drop
tasks or add hours") the advisor has never searched.

## Scenarios

### Scenario — the advisor offers the defer that completes flow coverage

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** a day of five cognitive tasks and a budget under which three reach ϕ,
  one of them a small task whose removal frees enough hours for a fourth to reach ϕ
- **When** `suggestPlanAdjustments` runs
- **Then** the `flowCoverage` finding's options include a `defer-task` lever for
  that small task

### Scenario — that option carries the re-solved reading, not an extrapolation

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** the same day
- **When** the option's lever is applied to the input and `calculateDailyMetrics`
  is called on the result
- **Then** the option's `after` equals that plan's own flow-coverage share

### Scenario — a defer that frees nothing is never offered on this axis

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** a day carrying an unfunded task, so deferring it leaves the
  allocation untouched and raises the _share_ (3/5 → 3/4) without any task
  reaching flow
- **When** `suggestPlanAdjustments` runs
- **Then** the `flowCoverage` finding lists no option deferring that task

This is §11.11's failure written as a test. It is the whole reason the axis ranks
on the count and not on the share; if it goes green with `badness = −share`, the
implementation took the shortcut.

### Scenario — emptying the plan never wins this axis

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** a day with a single funded task that reaches flow
- **When** `suggestPlanAdjustments` runs
- **Then** the `flowCoverage` finding lists no option

Energy Balance and Schedule Integrity each needed a `NaN` sentinel to stop
"defer the last task" winning their frontier (MATH.md §14.1-5). This axis needs
none — an empty plan has `reached = 0`, which is the worst reading there is —
and the test says so rather than a guard asserting it.

### Scenario — one row per axis, and the new one is filed in axis order

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** any day
- **When** `suggestPlanAdjustments` runs
- **Then** `findings` carries nine entries in `ADVICE_AXES` order

The existing `files a finding for every axis, in axis order` test asserts eight.
Update it; do not add a second one.

### Scenario — the card renders the row with both readings

`src/lib/presentation/component/plan-advice-card.stories.svelte` (play)

- **Given** a `PlanAdvice` fixture whose `flowCoverage` finding is out of band and
  carries one defer option
- **When** the card renders
- **Then** a row labelled "Flow Coverage" shows the before reading, the after
  reading and the signed plan-value cost

### Scenario — the row's button moves the task to tomorrow

`src/lib/presentation/component/plan-advice-card.stories.svelte` (play)

- **Given** that same fixture
- **When** the row's "To tomorrow" button is pressed
- **Then** the card emits the defer for that task's id

No new action: this is the `defer-task` path every other axis's row already uses.

### Scenario — the tile and the card band the same reading identically

`src/lib/presentation/utils/metric-descriptor.test.ts`

- **Given** a plan whose flow coverage is short of full
- **When** the dashboard row is built
- **Then** its band is the one `AXIS_BAND.flowCoverage` returns for the same share

`metric-descriptor.ts` currently spells Flow Coverage's thresholds inline, and
`band.ts` will now own them. Two copies of one threshold is the R3 failure the
banding module exists to prevent — this test is what stops them drifting back
apart.

### Claim (pin) — the tile still prints the fraction

`src/lib/presentation/utils/metric-descriptor.test.ts`

- **Given** a plan where three of five tasks reach flow
- **Then** the Flow Coverage row's value is `3/5`

Green on first run, which is the pass condition. The card prints a percentage
(see Decisions); the tile must not follow it.

### Claim — where Flow Coverage's warning band belongs

`scripts/plan-advice.probe.ts` → MATH.md §14.5

- **Given** the probe's existing 600 seeded days
- **Then** report the share of days Flow Coverage bands `warning` under each
  threshold: `< 50` (today's rule), `< 75`, `< 80`, `< 100`

**Measured 2026-08-24, and it refuted the rule this spec first wrote.** The rule
was "adopt the largest threshold whose warning share is ≤ 50% of days". No
threshold qualifies — the sweep reads `<50: 89.0%`, `<75: 95.2%`, `<80: 96.2%`,
`<100: 96.3%`. The rule existed to stop a mostly-green tile turning mostly-amber,
and the premise is simply false: this tile is amber on 89% of days already,
because `total` counts every task in the plan including the ones funded zero
hours. Applying the rule literally would keep `< 50`, under which the motivating
3/5 = 60% day is in band and the axis cannot fire on the case it was built for.

**Adopted: `value >= 100 ? 'success' : 'warning'`.** It costs 7.3pp more amber
days than today's rule, paints nothing red — `< 50` already bands warning, so no
day gets louder than it is now — and makes the band mean exactly the condition
the axis searches on: some task in this plan never reaches ϕ.

The same sweep prices the axis and settles the ranking independently: a lever
raises the flow **count** on **30.8%** of days, and **259 of 664** defers that
raise the **share** raise no count at all. Those 259 are precisely the free
improvements a ratio-ranked axis would have offered — §11.11's defect, at 39% of
this axis's defer candidates.

The threshold is not a judgement call to make at the keyboard: §26, §27 and §29
each set a band against a measured distribution, and ROADMAP already refused one
reading ("a week-feasibility reading … pinned infeasible on 84% of slack weeks")
for being permanently bad. Whatever the sweep says, §14.5 carries the number.

### Claim — an improvement is never lost to the card's rounding

`src/lib/business/model/metric/plan-advice.test.ts`

- **Given** any option on this axis
- **Then** its share exceeds the baseline's by at least `100 / total` points

A budget lever holds `total` fixed and raises `reached`; a defer lowers `total`
by one and cannot raise `reached` without freeing hours. So the smallest real
improvement is one whole task's share, which `Math.round(value)` cannot swallow
for any plausible task count. Stated as a test rather than a probe — it is a
bound, not a number that moves — and it is the reason this axis needs no
counterpart to the Energy Balance resolution defect (§25, `adv3`).

## Out of scope

- **Ranking on the share, or on hours short of ϕ.** Both are gamed by the defer
  itself — see Decisions.
- **Changing `calculateFlowCoverage`.** Its `total` counts every task in the
  plan, funded or not, so a long backlog reads low permanently and no lever the
  user owns fixes it. That interacts with the band question above and is worth
  saying out loud in §14.5 — it is **not** worth fixing here: §11.8 set the plan
  scope deliberately, and rescoping a headline tile is its own change with its
  own spec (AGENTS.md §0 — report it, do not fix it).
- **A delete button.** The model prices "not on today's list" and nothing else;
  two buttons would carry the same number. The row uses the existing
  `moveTaskToTomorrow` path.
- **Joint levers.** §14 is single-step by design: apply one suggestion and ask
  again.
- **Returning Grind Density to the axes.** §11.11 retired it on evidence, and
  nothing here re-opens it.
- **Reordering the card's rows.** Flow Coverage is appended to `ADVICE_AXES`;
  row order is not a ranking and this change does not make it one.

## Read before building

- `src/lib/business/model/metric/plan-advice.ts` — `ADVICE_AXES`, the `AXIS`
  record (lines 200–260), `paretoOptions`. Both change: the axis list gains a
  member, and `badness` must be able to read the count while `read` returns the
  share.
- `src/lib/business/model/metric/calculation.ts:330-359` — `calculateFlowCoverage`,
  the `{ reached, total }` shape and the `t.suggestedHours >= t.flowStateTime` test.
- `src/lib/business/model/metric/daily-metrics.ts:160` — where the reading is
  computed, and the `DailyMetrics.flowCoverage` field the axis reads.
- `src/lib/presentation/utils/band.ts:163-184` — `AXIS_BAND` (its `satisfies`
  will demand the new key) and `isOutOfBand`.
- `src/lib/presentation/utils/metric-descriptor.ts:168-182` — the inline
  `reached === total ? 'success' : …` band that moves into `AXIS_BAND`, and the
  `${reached}/${total}` render that stays.
- `src/lib/presentation/utils/plan-advice-descriptor.ts:83-124` — `AXIS_LABEL`
  (add `flowCoverage: m.metric_flow_coverage`, an existing key — **no new
  messages, and no translation work in the five locales**) and `readingOf`,
  which prints `${Math.round(value)}%`.
- `src/lib/presentation/component/plan-advice-card.svelte:103-118` — the row
  loop and the `advice_no_lever` line, so the new row needs no markup.
- MATH.md §14 — the levers, the badness table (which gains a row) and the
  Pareto rule. **Write §14.5** for this change: the axis, why it ranks on the
  count, the band sweep's number, and the `total` interaction above.
- MATH.md §11.11 — the argument this change has to answer: a count-denominated
  axis under hour-priced levers, measured at −15pp for 0.25 h.
- MATH.md §11.8 — Flow Coverage is plan-scoped, completed tasks included, and
  the display gate belongs to the same family.
- MATH.md §28 — the headline claim this closes ("the remedy is in the reading").
- `src/lib/business/model/AGENTS.md` — "The advisor ranks, it does not judge".
  It states one badness function per axis over the reading; after this, one axis
  ranks on a number it does not display, which is a durable statement and belongs
  there.
- `src/lib/presentation/AGENTS.md` — "Metric color-band thresholds live in the
  presentation layer". `AXIS_BAND` is a **public export** gaining a key, and
  `AdviceAxis` is a public type gaining a member; this is where the repo prices
  that.
- `scripts/PROBES.md` — the `plan-advice.probe.ts` row's "Backs" text, which must
  name the band sweep. `node scripts/probe-registry.mjs --check` fails the lint
  otherwise.
- Run `node scripts/math-index.mjs` after adding §14.5 (R7).

## Decisions

- **The axis ranks on `reached`, displays the share.** `badness = −reached`;
  `read = 100 · reached / total`. Deferring a task can only lower or hold the
  count, so it never improves the axis for free — dropping "Daily" wins only
  because "Review 1 PR APP" genuinely crossed ϕ. Rejected: **ranking on the
  share**, because a defer shrinks numerator and denominator together and any
  starved task then buys a free improvement — MATH.md §11.11 measured exactly
  that on Grind Density (−15pp for 0.25 h, 2.9% of booked time) and retired the
  axis for it. Also rejected: **`Σ max(0, ϕᵢ − hᵢ)`, hours short of flow**, which
  looks like §11.11's prescribed hour-denominated repair but is not — deferring a
  starved task deletes its shortfall just as mechanically.
- **`badness` reads the metrics, `read` reads the display.** The `AXIS` record
  becomes `{ read: (metrics) => number, badness: (metrics) => number }` and
  `paretoOptions` calls `badness(candidate.metrics)` instead of
  `badness(read(…))`. §14 already says badness only **orders** candidates and
  never decides anything, so decoupling it from the printed reading is faithful
  to what it is. Rejected: **packing both numbers into one value**, and rejected:
  **banding on the count**, which cannot be done — a band needs the total.
- **The card prints a percentage where the tile prints a fraction.** `60% → 100%`
  beside a tile reading `3/5`. Rejected: **printing the fraction in the card**,
  which is not recoverable — `AdviceOption.after` is one number and 60% is 3/5 or
  6/10 alike, and a second field on the view model to carry the total buys one
  row's punctuation. The two agree exactly and the last Claim shows no
  improvement can hide in the rounding, so this is not the §25 resolution defect.
- **The band moves out of `metric-descriptor.ts` and into `AXIS_BAND`.** Forced,
  not chosen: the card filters on `isOutOfBand`, so the axis needs an entry, and
  leaving the tile's copy in place would be two spellings of one threshold (R3).
- **The threshold itself is measured, not asserted** — see the sweep Claim. The
  feature lands either way; only which days show the row is at stake.
- **Appended to `ADVICE_AXES`, not inserted.** Row order is not a ranking and
  making it one is a separate argument.
- **No new message keys.** The label is the existing `metric_flow_coverage`, the
  action, cost and button copy are the ones every defer row already uses. A
  change that adds an axis to the advisor and touches no locale file is the
  measure of how much of this was already built.
- **`/build` runs the sweep before it picks the threshold.** The probe is a
  question added to `scripts/plan-advice.probe.ts` rather than a new file — that
  probe already builds the 600 seeded days and already backs §14.

## Open questions

None.
