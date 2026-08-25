# The fit reads on the row it fits

**Status:** landed 2026-08-25 · **Roadmap:** none

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

On `/energy`, the user can see a task row and the parameter that moves it in one
viewport, and can read what their own logs fit for a parameter **beside that
parameter's own stepper** rather than 600px below it. Today the left column runs
empty for the page's bottom 45%, and `Cognitive drain 0.35 /h` and `Cognitive drain ≈ 1.21 ±
0.18 /h · n=18` are two readings of one quantity on two different cards with
nothing saying they disagree.

The page also gets back the ~56px its visible `<h1>` spends on a second copy of
the name the nav's active link already draws — the same trade `/` made — and the
sentence that `<h1>`'s tooltip carries becomes readable without hovering.

## Scenarios

The acceptance criteria, and the R6 tests — written here _before_ the
implementation, so the implementer transcribes them rather than inventing them
after the fact ([docs/testing.md](../testing.md)).

Measured on a seeded day (4 tasks, 8h window, 18 🪫 / 4 ☕ / 5 ⚡ logs) at
1440×900: `<table>` top 868px, Tasks card 803→1181, side column 803→2143,
Model Parameters card 682px tall, document 2241px.

### Scenario — the plan reads above the ledger

`e2e/energy-lab.e2e.ts`

- **Given** a day with four deployed tasks and an 8h day window
- **When** the Lab opens
- **Then** the energy chart's top edge is above the first task row's top edge

### Scenario — the ledger and the parameters read beside the calibration boxes

`e2e/energy-lab.e2e.ts`

- **Given** a day with one deployed task and an 8h day window
- **When** the Lab opens
- **Then** the Tasks card and the Model Parameters card share a left edge and a
  width, and the parameters read below the list
- **Then** the Drain Calibration card starts to the right of both

### Scenario — a fitted parameter reads its fit on its own row

`e2e/energy-lab.e2e.ts`

- **Given** one 🪫 drain rating logged yesterday, carried past midnight (the
  `page.clock.fastForward('25:00:00')` pattern the existing "a drain rating fits
  α but only applies on demand" test already uses)
- **When** the Lab opens
- **Then** the Cognitive drain parameter row reads `≈ <alpha> ± <std> · n=1`

### Scenario — the stopping fit reads on Free-time value

`e2e/energy-lab.e2e.ts`

- **Given** a past day whose 🪫 ratings make one informative stop observation
- **When** the Lab opens
- **Then** the Free-time value parameter row reads `≈ <value> ± <std> · n=1`

### Scenario — a parameter whose logs carry no signal says so on its row

`e2e/energy-lab.e2e.ts`

- **Given** one 🪫 drain rating logged today, which no fit has counted yet
- **When** the Lab opens
- **Then** the Cognitive drain parameter row reads `no informative ratings`

### Scenario — a parameter with no logs at all carries no fit line

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile with one task and no 🪫, ☕ or ⚡ logs
- **When** the Lab opens
- **Then** the Cognitive drain parameter row shows no fit reading

### Scenario — the calibration card keeps the count, the reset and the pending line

`e2e/energy-lab.e2e.ts`

- **Given** one 🪫 drain rating logged today
- **When** the Lab opens
- **Then** the Drain Calibration card reads `Drain ratings · 1`
- **Then** the Drain Calibration card reads
  `1 rating logged today, counted from tomorrow`
- **Then** the Drain Calibration card offers `Delete all ratings`

### Scenario — applying the fits moves the value its own row was showing

`e2e/energy-lab.e2e.ts`

- **Given** one 🪫 drain rating carried past midnight, and the Cognitive drain
  row showing both its parameter value and its fit
- **When** `Apply my fits` is clicked
- **Then** the Cognitive drain stepper holds the value its fit reading named

### Scenario — the Lab draws no page title

`e2e/energy-lab.e2e.ts`

- **Given** a day with tasks
- **When** the Lab opens
- **Then** no visible heading reads `Energy Lab` above the first card

### Scenario — the Lab's explanation is server-rendered

`e2e/energy-lab.e2e.ts` — the `request` fixture, as `e2e/nav.e2e.ts`'s
"the server-rendered nav marks the section" already does

- **Given** a plain GET of `/energy`
- **When** the response body is read
- **Then** it contains the Lab's explanation of what the energy scheduler
  maximizes (`energy_intro_1`'s text)

### Scenario — the explanation reads without a hover

`e2e/energy-lab.e2e.ts`

- **Given** the Lab open on any day
- **When** the page is scrolled to its foot
- **Then** the explanation is visible with no tooltip opened

### Scenario — the budget-curve button reads in the Model Parameters header

`e2e/energy-lab.e2e.ts`

- **Given** a day with tasks and an 8h day window, the curve not yet run
- **When** the Lab opens
- **Then** `How long should today be?` renders inside the Model Parameters card,
  above the Day window stepper
- **Then** once run, the curve's card renders below the calibration boxes

### Scenario — a rest is logged from the ledger, not from the calibration card

`e2e/energy-lab.e2e.ts`

- **Given** a day with one deployed task
- **When** the Lab opens
- **Then** the Tasks card offers `☕ Log a rest` and the Recovery Calibration
  card offers no such button
- **Then** saving a pair leaves `Rest pairs · 1` on the Recovery Calibration card

### Scenario — a rest can be logged on a day with no tasks

`e2e/energy-lab.e2e.ts`

- **Given** a fresh profile with no tasks deployed
- **When** a rest pair is logged from the Lab, and a task is then deployed
- **Then** the Recovery Calibration card reads `Rest pairs · 1`

No **Claim**: no formula, constant, bound or fit changes. This is presentation
only — `EnergyLabStore` already exposes every reading the new layout needs
(`cognitiveDrainFit`, `physicalDrainFit`, `recoveryFit`, `stoppingFit`,
`pendingDrainLogCount`, `pendingRestLogCount`, `hasFit`, `fitsApplied`,
`applyFits`), and none of them moves.

## Out of scope

- **The energy chart itself.** Both trajectories are compressed into the top
  quarter of the plot and the "Output rate (relative)" area is the loudest
  series while being the least actionable. Real, reported, and deliberately not
  built here.
- **The timeline bar's repeated task names.** Nine blocks naming three tasks is
  the interleaving the optimizer actually chose, and the Schedule view exists
  for the detail.
- **`/`'s layout.** It reads the ledger first because that is where its day gets
  typed; the Lab reads the plan first because the plan is its answer. The two
  screens are one definition of the LIST, not of the page order.
- **`flow-calibration-card.svelte` on `/`.** Its reading is a status sentence,
  not a fitted number against a parameter, so nothing moves onto a row there.
- **Merging the three calibration cards into one component.** AGENTS.md §4
  settles that they share a shell and not a body; this change takes content
  _out_ of the bodies and adds no mode flag.
- **`EnergyLabStore`, `ledger-column.ts`, the schedule-order snapshot, and
  `withMustDoToday`.** Untouched.
- **`calibration-card.svelte` the shell.** It gains nothing; `/` renders it too.
- **An FAQ or `FAQPage` structured data for `/energy`.** The explainer carries
  the existing intro prose and nothing more; `FallowExplainer`'s schema half
  stays `/`'s.
- **The `sr-only` `<h2>` `energy_sections_heading`.** The outline level between
  the page title and the `<h3>` cards is still needed and still hidden.

## Read before building

- `src/routes/(app)/energy/+page.svelte` — the whole layout. Today: plan card →
  budget curve → `lg:grid-cols-3` of (ledger `col-span-2` | stop advisor +
  params + three calibration cards). This is the file the redesign is in.
- `src/lib/presentation/component/param-row.svelte` — gains the fit reading. It
  takes `id`/`label`/`hint`/`value`/`onchange`/`min`/`max`/`step`/`unit`/`accent`
  today.
- `src/lib/presentation/component/fit-row.svelte` — the four-copies-of-one-row
  component whose whole job this absorbs; its own header comment already says it
  is "one fitted constant against the parameter it would replace". Deleted here,
  with `fit-row.stories.svelte`.
- `src/lib/presentation/component/calibration-card.stories.svelte` — renders
  `FitRow`; follows it.
- `src/lib/presentation/component/budget-curve-card.svelte` and
  `stop-advisor-card.svelte` — the side column's other two readings.
- `src/lib/presentation/component/fit-log-summary.svelte` — the count-and-reset
  row that stays on each calibration card. Also rendered by `/analytics` and by
  `flow-calibration-card`; do not change its shape.
- `src/lib/presentation/component/fallow-explainer.svelte` — the pattern the
  Lab's explainer copies: a below-the-fold `<section class="card-shell">`
  carrying the page's crawlable prose, always server-rendered. Its own header
  comment states the reason. The Lab's is prose only — no FAQ, no
  `FAQPage` structured data, no second `jsonLdScript`.
- `src/routes/(app)/energy/+page.svelte`'s `<h1>` and its comment "Outside the
  load gate: the title reads nothing, and it is what keeps the route from
  painting blank for the frame before IndexedDB answers." The load gate's own
  branch renders skeletons, not nothing, so re-check that claim against the code
  and correct or drop it — AGENTS.md §0 makes that part of this diff, not a note.
- `e2e/nav.e2e.ts`, "the server-rendered nav marks the section and the viewed day
  in both locales" — the `request`-fixture pattern the SSR scenario copies.
- `docs/deployment.md` — SSR, locales and SEO, before changing what `/energy`
  server-renders.
- `src/lib/presentation/component/metrics-dashboard.svelte` — the precedent for
  a dense multi-column reference block, and the reason this one is a `grid`
  instead (see Decisions).
- `messages/en.json`, `de.json`, `es.json`, `fr.json`, `zh.json` —
  `energy_fit_value`, `energy_recovery_fit_value`, `energy_stop_fit_value`,
  `energy_fit_no_signal`. Five locales.
- `e2e/energy-lab.e2e.ts` — `calibrationCard` and `cognitiveDrainRow` helpers
  and the tests that read fits off the cards: "a drain rating logged today is
  named beside the fit", "that same rating fits once the clock has passed
  midnight", "a break logged today is named beside the recovery fit", "a drain
  rating fits α but only applies on demand", "a past day that ran out of clock
  is named on the stopping card", "deleting the drain rating clears the
  calibration". Each re-points at the parameter row for the fit half and stays
  on the card for the count/pending half.
- `AGENTS.md` §4, the UI bullet "The calibration cards share a shell, not a
  body" — amended here, not re-opened. AGENTS.md §0 also governs: cite documents
  by section, never by line.
- `src/lib/presentation/AGENTS.md`, four sections: "The calibration cards share
  a shell, not a body" (the bodies lose their fit values), "The row's layout"
  (its "the ledger also takes `/`'s full width and the metrics read beneath it"
  becomes true of both screens), "Components" (the bullet on a card that is its
  run button and nothing else — the reason is position, and the position
  changes), and "R3 in the UI — the two task screens are one definition" (which
  claimed the two screens agree on page order; they agree on the list, and the
  section now says why the order differs).
- `src/lib/presentation/style/STYLE.md` — tokens-only classes, before touching
  any markup.
- `docs/testing.md` — the test-level table; every scenario above is a
  user-visible flow, so `e2e/*.e2e.ts`.
- MATH.md — nothing. No section changes.

## Decisions

- **The plan reads first and full width; the ledger and the parameters stack in
  one wide column under it.** The defect being fixed was never the plan's
  position — it was that the edit-a-param / watch-the-Planned-column loop spanned
  two scrolls and the left column ran empty for the page's bottom 45%. Stacking
  the list and the params in the same 2/3 column closes that gap harder than
  reordering the page did, and it leaves the plan where it reads as the screen's
  answer. Rejected: the ledger first and full width (built first, reverted the
  same day), because it bought the same adjacency at the cost of burying the one
  card the page exists to produce.

- **One grid under the plan, not two.** The four read-outs — stop advisor, then
  the three calibration cards — stack in the 1/3 column at their own heights
  rather than being pulled to the wide column's row boundaries. Two stacked
  grids would align each read-out to the card beside it and reintroduce the
  empty-column bug in miniature. 2/3–1/3 at `lg` and not 3/4–1/4: measured, a
  quarter of 1024px is ~225px, which the ☕ editor could not have been used in.

- **A fit reads on the parameter row it fits; the calibration card keeps the log
  count, the reset, the pending count and λ₀'s censored state.** Four fits map
  one-to-one onto four parameter rows — `recoveryRate`, `alphaCog`, `alphaPhys`,
  `freeTimeValue` — which is the order `energy_apply_fits_title` already names.
  `Apply my fits` then resolves a disagreement the user can see instead of
  applying a claim they have to scroll to find. This narrows the calibration
  bodies rather than folding them together, so §4's rule survives and its wording
  is amended. Rejected: a compact `fit 1.21` marker on the row with the full
  reading left on the card, because one quantity would then read in two places,
  which is the R3 failure §4 exists to prevent.

- **`ParamRow` renders the fit; `fit-row.svelte` is deleted.** After the move it
  has one caller and its own comment describes it as four copies of one row
  against the parameter it would replace — which is the row it now lives on.
  Rejected: keeping it and passing it into `ParamRow` as a snippet, because that
  is a second component for one caller.

- **One message key for all four fits.** `energy_fit_value`,
  `energy_recovery_fit_value` and `energy_stop_fit_value` are three keys for the
  same `≈ {x} ± {std} · n={count}` shape differing only in unit, and the unit is
  already the stepper's (`/H`, `OUT/H`). Rejected: keeping three, because the
  unit stops being part of the string the moment the reading sits on the row
  that carries it.

- **No logs at all means no fit line.** `no informative ratings` against every
  parameter on a fresh profile is noise, and it makes a claim about logs the user
  has not made. The row carries a fit reading when a fit exists, and the
  no-signal line only when logs exist but carry none. Rejected: always rendering
  the line for layout stability, because a reserved empty row is the thing the
  ✎/✕ strip was already reworked to stop doing.

- **The params band is a `grid`, not CSS `columns`.** `metrics-dashboard` uses
  `columns-*` because column flow keeps a reading's neighbours in the descriptor
  its neighbours on screen — correct for text. A stepper is an interactive
  control and CSS column flow can break one across a column boundary. Rejected:
  matching the dashboard's `columns-*` for consistency, because consistency in
  the class is not consistency in what renders.

- **The budget-curve button reads in the Model Parameters header; its chart
  reads full width at the foot.** The curve answers what the Day window row's
  number should be, which is the same rule that puts each fit on the row it
  fits — so the button belongs on the card holding that row. The chart it
  returns does not: it is wider than a third of that card and it prices the whole
  day, so it lands last and full width. This splits `budget-curve-button.svelte`
  off `budget-curve-card.svelte`; the button keeps its bare un-run state, which
  `presentation/AGENTS.md` requires. Rejected: a full-width row of its own for
  the un-run button, which is a lone right-aligned control on an empty row.

- **☕ is typed on the ledger's heading row, beside Load and Save.** A break is a
  log of the day like ⏱ and 🪫, and the card that reads its fit is a read-out
  once the fit moves to the row — so leaving the editor there put the only
  writable control among three read-outs. It also fixes a real gap: the recovery
  card is inside the page's `hasTasks` gate, so a break could not be logged on a
  day with no tasks, which is the day most likely to have contained one.
  `task-list-card.svelte`'s existing `strip` slot takes the form, so no new prop.
  Rejected: beside `Deploy Task` at the foot of the list, which pairs recording
  what happened with creating what has not.

- **The `<h1>` becomes `sr-only`, exactly as `/`'s did.** The nav's active link
  already draws `Energy Lab`, so the visible heading is a second copy of the page
  name costing ~56px above a page whose first card should be the ledger. The
  element stays in the markup so the route keeps a crawlable heading and the
  `sr-only` `<h2>` beneath it does not head an outline with no `<h1>`. Rejected:
  shrinking the title instead, which keeps a second copy and buys back less.

- **The intro moves to a below-the-fold explainer section, not to another
  card's heading tooltip.** Two facts decide it. It is not server-rendered
  today — `curl /energy | grep` finds `energy_intro_1` **zero** times, because
  bits-ui mounts `Tooltip.Content` on open, so the only prose on a route whose
  meta description promises a "day-value scheduler" reaches no crawler and no
  reader who does not hover. And every card heading that could host it — the
  `Optimized Day` `<h3>` most naturally — sits inside `hasTasks` or the load
  gate, so the Lab's only explanation would vanish on an empty day, which is
  precisely when a new user needs it. A foot section fixes both and is what `/`
  already does with `FallowExplainer`. Rejected: the `Optimized Day` heading
  (unreachable on an empty day, still not server-rendered); rejected: the nav's
  `Energy Lab` link, because the nav is shared chrome and carries readings and
  the brand, not per-page prose.

- **The explainer reuses the four existing `energy_intro_*` keys.** The copy is
  already written and translated in five locales; this moves where it renders,
  not what it says. Rejected: rewriting it for the wider measure, which would
  put five locales of new translation into a layout change.

- **The pending-log lines stay on the calibration cards.** M37 put them there and
  ROADMAP item 33 records the gap they closed; a redesign that dropped them would
  reopen it. They are about the log store, not about the parameter, so they stay
  with the count they qualify.

## Open questions

None.
