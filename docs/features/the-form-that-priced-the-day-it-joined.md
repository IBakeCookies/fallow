# The form that priced the day it joined

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

`/`'s add-task form takes three ratings, an importance and some tags, and says
nothing about what any of it would do. The day's answer only arrives after the
task is deployed and the dashboard re-reads.

After this, the dialog is two columns: the fields as they were, and beside them
what the task being typed would do to today — the hours the plan would give it,
its priority score and run slot, both capacity pools before and after, and the
hours the day would have left unassigned. The must-do flag and the submit move
to the foot of that reading, which is where a Cancel would sit in a form that
had one.

Nothing is written until the task is deployed. The reading is a second solve
over the day the dashboard already solved, so it describes exactly the plan the
user is about to get.

## Scenarios

### Scenario — the draft is priced as an extra task

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a 12 h day holding `Write spec` and `Gym`, and a physical draft
- **When** the impact is calculated
- **Then** its hours, priority score, run position and funded count equal what
  `calculateDailyMetrics` reports for the same day with the draft deployed as a
  real task

### Scenario — the draft is priced where a deploy would put it

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a 4 h day whose two tasks and the draft score 20.8 / 20.8 / 20.7 —
  one rounding bucket, so input position orders them
- **When** the impact is calculated
- **Then** its hours and run position equal those of the same day with the draft
  **prepended** as a real task, which is where `SessionStore.addTask` puts it

### Scenario — the day's readings are before-and-after

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** the same day and draft
- **When** the impact is calculated
- **Then** `slackHours.before` is the baseline's `planSlackHours`, `after` is
  the plan with the draft in it, and the physical pool reads higher after than
  before

### Scenario — a draft the day has no hours for

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a 2 h day holding four high-importance tasks, and a weak draft
- **When** the impact is calculated
- **Then** it reads 0 hours, a `null` position, and every day-level reading
  unchanged

### Scenario — a pool of zero hours

`src/lib/business/model/metric/draft-impact.test.ts`

- **Given** a day whose physical pool is 0 h and whose tasks all draw on it
- **When** the impact is calculated
- **Then** both pool readings are 0 %, never `Infinity`

### Scenario — the store prices the form's draft against the viewed day

`src/lib/business/store/daily-plan-store.svelte.spec.ts`

- **Given** a day with one cognitive task
- **When** `previewDraft` is set to a physical draft
- **Then** `draftImpact` reads hours, its `slackHours.before` is `daily`'s own
  `planSlackHours`, and adding a task to the session moves its funded count
- **And** setting `previewDraft` back to `null` drops the reading

### Scenario — the panel reads the impact

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact of 1.25 h at position 4 of 6, pools 41→62 % and 86→89 %,
  slack 3.9 h → 2.65 h
- **When** the panel renders
- **Then** it reads `1h 15m`, `runs 4 of 6`, `63.4`, `41% → 62%`, `86% → 89%`
  and `3h 54m → 2h 39m`, with the band's fill on the bar and an `sr-only`
  `Optimal` beside the 62 % row

### Scenario — nothing typed yet

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** `impact: null`
- **When** the panel renders
- **Then** it reads the prompt line and no reading

### Scenario — an unfunded draft reads quietly

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact of 0 hours and a `null` position
- **When** the panel renders
- **Then** the value is `text-ty-silent` and the note says today funds no hours
  for it

### Scenario — a pool with no hours drops its row

`src/lib/presentation/component/task-form-preview.stories.svelte`

- **Given** an impact whose physical pool reads `Infinity`
- **When** the panel renders
- **Then** the physical row is absent and the cognitive row is there

### Scenario — the form publishes what a solve reads

`src/lib/presentation/component/task-form.stories.svelte`

- **Given** the form with an `impact` and an `ondraftchange`
- **When** a title is typed and a slider dragged
- **Then** `ondraftchange` is called with the three ratings and the importance,
  and with `null` while the title is blank
- **And** the submit follows the reading in the DOM, with the must-do flag
  beside it

## Out of scope

- **A clock window for the slot** ("17:45 → 19:00"). The plan carries no time of
  day at all, deliberately — `presentation/AGENTS.md`, "The day's strip reads
  inside the Tasks card, and carries no clock", and
  [the-anchor-that-held-only-itself.md](the-anchor-that-held-only-itself.md).
  The slot is `runs 4 of 6`, which is the reading the model has.
- **"from 6 past runs ± 0.3 h" under the hours.** Nothing counts a title's past
  runs: `title-memory` remembers the ratings a title was last given, not its
  hours, and `flowStateTimeStd` is a ± on ϕ (time to flow), not on an
  allocation. A count and a spread per title is its own instrument over the 🪫
  logs, and it is not in this change.
- **A sentence explaining the slot** ("high physical load lands next to Move lab
  boxes"). Nothing generates it. The advisor's own sentences cost one solve per
  candidate — 109–124 ms on a 12-task day — which is why it has a button
  (`business/AGENTS.md`), and that is not something a keystroke may trigger.
- **Naming why an unfunded draft got nothing.** `UnfundedReason` is the
  advisor's, attributed off the candidate frontier it already solved. A second,
  cheaper attribution here would be a mirrored definition of the same question
  (R3), so the panel says the day funds no hours and lets the pool rows beside
  it show whether one is full.
- **`/energy`'s copy of the form.** It passes neither `impact` nor
  `ondraftchange` and stays one column: its plan is the energy optimizer's, and
  a classic-allocator reading beside those fields would describe a plan that
  screen does not show.
- **Any change to a number.** The allocator, the pools, the slack and the
  priority score are read as they are. Nothing here enters the model.

## Read before building

- `src/lib/business/model/metric/calculation.ts` — `calculateTaskPlan`,
  `calculateInterleavedOrder`, `calculatePoolSaturation` (extended with both
  pools' own saturations) and the two extractions the reading shares with
  `daily-metrics`: `calculatePoolDraw` and `calculatePlanSlackHours`.
- `src/lib/business/model/metric/daily-metrics.ts` — `DailyMetricsInput` is the
  reading's input, and `DailyMetrics` its baseline.
- `src/lib/business/model/metric/plan-advice.ts` — the precedent for a reading
  that reuses the caller's baseline instead of re-solving it.
- `src/lib/business/store/daily-plan-store.svelte.ts` — where `previewDraft` and
  `draftImpact` live, beside the advice that is deliberately not a `$derived`.
- `src/lib/presentation/component/task-form.svelte` — the draft, `emptyDraft()`
  and `fromPick`; the footer that becomes the `actions` snippet.
- `src/lib/presentation/component/task-list-card.svelte` — the dialog the card
  owns, and its `max-w-lg`.
- `src/lib/presentation/utils/band.ts` — `AXIS_BAND.humanCapacity`,
  `BAND_BAR_CLASS`, `bandLabel`; a reading carries a `Band`, never a class
  string.
- `src/lib/presentation/style/STYLE.md` — the nested-panel rule: an inset is cut
  into a card, and a dialog is not one.
- `messages/en.json` around `form_*` — eleven new keys, and the same keys in
  `de.json`, `es.json`, `fr.json`, `zh.json`.

No MATH.md section changes: every formula here already exists.

## Decisions

- **The reading is a `$derived`, not a button.** It is ONE solve — the day with
  the draft in it — where the advisor is one per candidate, so the cost is what
  `#daily` already pays on every keystroke in the budget field. A `$derived`
  nobody reads never runs, so it costs nothing on any screen without an open
  add-task dialog. Rejected: a Recheck button, which would make the panel a
  reading of a draft the user has since edited.
- **The form publishes its draft; it does not read the store.** Components take
  props (`presentation/AGENTS.md`), and the solve is model wiring (R2). The form
  sends only what an allocation reads — the three ratings and the importance —
  so a tag or the must-do flag cannot re-solve a day.
- **An unnamed draft is not priced.** The panel renders the prompt line instead,
  which is the convention for a reading that costs a solve. Pricing the blank
  default would put a plan on screen for a task nobody is typing.
- **The must-do flag takes the Cancel slot.** The design has a Cancel; this form
  has nothing to cancel — the dialog's ✕ closes it and a draft is never written
  until it is deployed — so the footer keeps the flag and the submit and moves
  to the foot of the reading. Rejected: adding a Cancel that only closes the
  dialog, a second control for what the ✕ already does.
- **Both pools read, not just the one that binds.** Human Capacity names the
  binding pool because that is the day's limit; a draft is a question about
  where its own load lands, and one row would hide a physical task loading a
  pool the day's plan barely touches. `calculatePoolSaturation` gained both
  saturations rather than a second copy of the division (R3).
- **The draft is solved at the HEAD of the task list.** `addTask` prepends, and
  the allocator's sort is stable over the 1-dp priority score, so input position
  orders every rounding tie — which decides the run slot and, on a tight budget,
  which tie-mate is funded. An appended draft read `runs 2 of 3` where the deploy
  gave slot 1, and on a 1.5 h day read "no hours" where the deploy funded it and
  dropped an existing task instead. Pinned by a scenario built on a tie
  (20.8 / 20.8 / 20.7), which fails if the draft is solved anywhere else.
- **The draft is solved under an id one past the day's highest.** An id the day
  already holds would price the draft as the task it collided with. This is not
  a `nextTaskId` case (`business/AGENTS.md`): that rule is about ids a day keeps,
  and this one does not outlive the call.
- **The dialog is widened for both screens.** `sm:max-w-3xl` on the card's
  `Dialog.Content`, not a prop the card takes: a width flag on a shell that
  cannot see what its caller's form contains is a mode flag, and `/energy`'s
  one-column form is unharmed by the room.
- **The three sliders read `label · track · value` on one line, and go
  three-across only where the fields have the room.** A container query
  (`--container-task-fields`) rather than a viewport breakpoint: the same
  component is in the dialog's field column and in the ledger's inline editor,
  and neither width is the viewport's. The dialog stacks them, which is the
  design's layout and gives a full-width track to drag; the inline editor keeps
  its one line of three.
- **A rule separates the ratings from the placement fields.** The three sliders
  describe the work; importance and tags describe where it sits in the day. Both
  forms get it, since both hold the same two groups.
- **The 1–5–10 slider ticks and the restyled inputs in the design are not
  built.** The layout was the ask; the fields keep the app's own styling.

## Open questions

None.
