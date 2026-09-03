# The draft that stops short of flow

**Kind:** feature · **Status:** landed 2026-09-04 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`.

## Goal

While typing a task, the user can see whether the hours today's plan would give
it are enough to actually get into flow on it, or whether it would stop before
the warm-up pays off — "flow at 45m" against "short of flow by 30m", on the same
panel that already prices the day.

## Scenarios

### Scenario — a draft the day funds past its warm-up

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** a priced draft whose plan funds 1 h 30 m against a ϕ of 45 m
- **When** the panel renders
- **Then** a `Warm-up` row reads `flow at 45m`

### Scenario — the reached row is green

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** the same draft
- **Then** the row's bar carries `BAND_BAR_CLASS.success`

### Scenario — a draft the day stops short of

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** a priced draft whose plan funds 30 m against a ϕ of 1 h
- **When** the panel renders
- **Then** the `Warm-up` row reads `short of flow by 30m`

### Scenario — the short row is amber

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** the same draft
- **Then** the row's bar carries `BAND_BAR_CLASS.warning`

### Scenario — the bar reads how far the hours get toward flow

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** the same draft — 30 m funded against a 1 h warm-up
- **Then** the bar's inline width is `50%`

Both fixtures are exact binary fractions on purpose: a width asserted off
`hours / flowStateTime` is a float, and 25/45 prints seventeen digits.

### Scenario — a draft the day funds nothing for still names its warm-up

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** a priced draft the plan funds 0 h for, with a ϕ of 1 h 30 m
- **When** the panel renders
- **Then** the `Warm-up` row reads `short of flow by 1h 30m`

### Scenario — the unfunded row's bar is empty

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** the same unfunded draft
- **Then** the bar's inline width is `0%`

### Scenario — colour is not the only carrier of the band

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** the draft that stops short
- **Then** the row carries the `sr-only` text `Caution` (WCAG 1.4.1, as the pool
  and Burnout Risk rows already do)

### Scenario — an unnamed draft has no warm-up row (pin)

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** `impact` is `null`
- **Then** the panel renders the prompt line, with no `Warm-up` row

### Claim — the reading is the draft's own ϕ from the solve it is already in

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** any day and draft
- **Then** `calculateDraftImpact(...).flowStateTime` equals the `flowStateTime`
  of the draft's row in the plan that same call solved

### Claim — the band is Flow Coverage's criterion, narrowed to one task

`src/lib/presentation/utils/band.test.ts`

- **Given** hours ≥ ϕ
- **Then** `getBandFlowReached` returns `success`
- **Given** hours < ϕ
- **Then** `getBandFlowReached` returns `warning`

### Claim — the timeline's two sentences are unchanged by the key rename (pin)

`src/lib/presentation/component/day-timeline.stories.svelte`

- **Given** the stories that today assert `short of flow by 45m` and
  `flow at 1h 15m`
- **Then** both still read exactly that

### Claim — the two callers that lose their inline comparison are unchanged (pin)

`src/lib/presentation/utils/day-timeline.test.ts`,
`src/lib/presentation/utils/metric-descriptor.test.ts`

- **Given** the existing band assertions on `buildDayTimeline`'s blocks and on
  the Longest Warm-Up descriptor
- **Then** both still hold after the expression moves into `band.ts`

## Out of scope

- **The ± on ϕ.** `flowStateTimeStd` is the task row's
  ([the-band-beside-the-flow-time.md](the-band-beside-the-flow-time.md)); no
  other row on this panel carries an uncertainty, and one that did would be the
  only reading here that hedges.
- **The optimal stopping time T\* (1.52–1.79×ϕ).** The row asks one question —
  does the warm-up get paid for — which is Flow Coverage's criterion, not the
  stopping rule. Two thresholds on one row is a row nobody reads.
- **A flow reading on the tasks the draft displaces.** The Cost row names them
  ([what-the-draft-takes-from-the-day.md](what-the-draft-takes-from-the-day.md));
  this row is about the draft, and a second per-task list would turn the panel
  into a table.
- **Any prompt to act** — "add 20m and it reaches flow". The panel offers no
  lever, and the sentence would cost a search over budgets the advisor already
  owns.
- **Time Scarcity and Deep Work Ratio rows.** Closed by the prior spec's Out of
  scope; nothing here re-opens them.
- **`/energy`'s copy of the form.** It passes no `impact` and stays one column.
- **Any change to a number.** ϕ is read off the solve the panel already pays
  for. Nothing here enters the model, and no allocation moves.
- **Moving the timeline's sentence rendering into a util.** The two surfaces
  share the message and the band function; the four lines choosing between the
  two sentences stay in each component, which is where markup belongs.

## Read before building

- `src/lib/business/model/metric/draft-impact.ts` — `DraftImpact` gains
  `flowStateTime`; `planned` (the draft's own row in the solve) already carries
  it, so nothing is recomputed.
- `src/lib/business/model/metric/draft-impact.test.ts` — the model Claim.
- `src/lib/business/model/metric/calculation.ts` — `SuggestedTask.flowStateTime`
  (~line 123) and `calculateFlowCoverage` (~line 337), whose `hours ≥ ϕ`
  criterion this row narrows to one task.
- `src/lib/presentation/utils/band.ts` — where `getBandFlowReached(hours,
flowStateTime)` goes, beside `getBandDeepWork`. It is a **new public export**:
  price it in `src/lib/presentation/AGENTS.md`, under the settled decision that
  band policy lives in this file.
- `src/lib/presentation/utils/band.test.ts` — the band Claim.
- `src/lib/presentation/utils/day-timeline.ts` — line 61's inline
  `suggestedHours >= flowStateTime` becomes the new call.
- `src/lib/presentation/utils/metric-descriptor.ts` — the same expression at
  ~line 286, whose comment ("so the two rows cannot disagree about it") is R3's
  "keep in sync with" written out.
- `src/lib/presentation/utils/day-timeline.test.ts`,
  `src/lib/presentation/utils/metric-descriptor.test.ts` — the two pins.
- `src/lib/presentation/component/day-timeline.svelte` — the two `m.` calls at
  ~lines 69–73 take the renamed keys.
- `src/lib/presentation/component/day-timeline.stories.svelte` — the sentence
  pins.
- `src/lib/presentation/component/task-form-preview.svelte` — the new row, after
  Priority score. `changeRow` is not it: that snippet renders a before → after
  pair, and this row is one sentence with a fill bar.
- `src/lib/presentation/component/task-form-preview.stories.svelte` — the shared
  `impact` fixture gains `flowStateTime`; the scenarios above land as `play`
  functions.
- `src/lib/presentation/component/task-form.stories.svelte` — its `DraftImpact`
  literal needs the new field or `svelte-check` fails.
- `messages/en.json`, `de`, `es`, `fr`, `zh` — rename
  `day_timeline_flow_reached` → `flow_reached` and `day_timeline_flow_short` →
  `flow_short` (five files, translations carried over verbatim); add
  `form_impact_flow` — English `Warm-up`, translated in the other four.
- `src/lib/presentation/AGENTS.md` — "The add-task form's second column is a
  reading and nothing else", and the band-policy decision.
- MATH.md §1 — ϕ. Read only: no formula, constant or bound moves.
- AGENTS.md §0 and R3 — why the expression is exported rather than copied a
  fourth time.

## Decisions

- **The row shows even when the day funds the draft nothing.** The shared
  sentence stays true at zero hours — 0 h is short of flow by exactly ϕ — and ϕ
  is the one figure an unfunded panel otherwise never prints. Rejected: gating
  it on `position === null` the way the Cost row is, because the Cost row is
  about hours the day moves and there are none, while ϕ is the draft's own
  property and is readable whatever the day does. The gate would also be a
  branch §0 does not ask for.
- **The timeline's sentence is reused, not re-worded.** Rejected:
  `form_impact_flow_reaches` / `_short` reading "1h 30m, reaches flow" and "45m,
  never gets there", because it mirrors a sentence that already exists in five
  locales (R3) and repeats the funded hours the tile at the top of the panel
  already prints. The keys lose their `day_timeline_` prefix because a shared
  string named after one of its two surfaces is a name that lies —
  `common_cancel` and `unit_hours` are the repo's shape for this.
- **`hours ≥ ϕ` becomes one exported function.** It is inline in three places
  today (`calculation.ts`, `day-timeline.ts`, `metric-descriptor.ts`); this
  change would be the fourth. Rejected: a fourth copy, because R3 fires at the
  first mirror and this one is already documented as a mirror in a comment.
  `calculateFlowCoverage` stays as it is — it is model-layer and counts a set,
  and presentation may not import it (R1).
- **The label is `Warm-up`.** Rejected: `Time to flow`, which restates the
  sentence's own noun, and `Flow`, which reads as "Flow: flow at 45m".
  `Warm-up` is already the app's word for ϕ in the Longest Warm-Up metric.
- **The row sits after Priority score.** Suggested hours and Priority score are
  the two readings about the draft itself; the pools, Burnout Risk, Unassigned
  hours and Cost are about the day. The new row belongs to the first group.
- **The model returns ϕ; presentation bands it.** Matches the settled decision
  that band thresholds live in `utils/band.ts` and a view model carries a
  `Band`, never a class string.
- **No guard on ϕ = 0.** The bar divides by it, as the timeline already does; no
  solve produces a zero ϕ, and §0 wants a reachable failure before a branch.

## Open questions

None.
