# The unit the percentages never named

**Kind:** feature · **Status:** landed 2026-09-03 · **Roadmap:** none — M100, found by the
2026-09-03 review of the advice card's plan-value readings

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A user reading "Adjust the plan" can tell what "−5.1% plan value" means: a
change against today's plan, in the quantity the optimizer maximizes, which
counts each funded task's average and is not the amount of work the day does.
The card prints that percentage in three places — the cost of an option, the
budget's shadow price and the switch-cost bracket — and defines it in none of
them. One sentence of the bracket also states its own reading as a level rather
than a change, and attributes it to "this plan" when the arm is a different
allocation.

## Scenarios

### Scenario — the card names its unit before anything is priced

`e2e/plan-advice.e2e.ts`

- **Given** a fresh day with two tasks and a 10 h budget, before "Check my day"
  is pressed
- **When** the advice card paints
- **Then** the card's description says anything priced in plan value is a
  change against today's plan

### Scenario — an unpriced day still shows no reading

`e2e/plan-advice.e2e.ts`

- **Given** the same day, before "Check my day" is pressed
- **When** the advice card paints
- **Then** no `% plan value` reading is on screen

### Scenario — the switch-cost bracket reads as a re-solve, not as a level

`src/lib/presentation/utils/plan-advice-descriptor.test.ts`

- **Given** a day reserving 30m at 15m a switch, bracketed at +10.4% and −8.7%
- **When** `buildAdviceDisplay` renders `switchCost`
- **Then** the sentence says the two arms are re-solved days rather than this
  plan's own reading

### Claim — the two readings disagree often enough to warn about

`scripts/adv4-plan-value-vs-output.probe.ts`

- **Given** the fixture year (seed 42, 365 days), the 284 days with hours and
  more than one task, and every defer lever the card can offer on them
- **Then** the sign disagreement is the common case, not the corner

## Out of scope

- **Renaming "plan value".** It is the value of the objective — `vᵢ` is
  literally the task's declared importance — and the name is load-bearing in
  `advice_cost`, in the e2e regexes and in `PlanAdvice.planValue`. A vaguer word
  would cost the rename and still leave the unit undefined, which is the actual
  defect. The definition carries the meaning instead.
- **Printing the absolute Σ vᵢ·P̄ᵢ.** `PlanAdvice.planValue` exists and is not
  rendered. A bare Σ of average productivities is not a number a user can do
  anything with; the change it moves by is.
- **The three scopes behind the one label.** An option's delta is plan-scoped
  and unclamped, the budget marginal's is open-scoped and floored at 0, the
  bracket's is plan-scoped and clamped per arm to the sign its monotonicity
  allows. Each is argued where it is written and none of them is wrong; making
  them uniform would delete a reason, not add one.
- **`advice_cost_free` on a sub-0.05% lever.** `plan-advice.ts` rounds to one
  decimal before the descriptor sees the delta, so "costs no plan value" means
  free at the precision the card prints. Carrying the unrounded ratio into
  presentation to tell 0.00% from 0.04% is a distinction no reading acts on.
- **Any model change.** No formula, constant, bound or fit moves; MATH.md is
  untouched. The new copy paraphrases §0's existing sentence, it does not add a
  claim to it.
- **A tooltip, an info affordance or a second card.** The card already has a
  description line in its header, always visible, and it is the one place a
  legend covers all three readings at once.

## Read before building

- `messages/en.json` — `advice_desc` and `advice_switch_cost_bracket`, the only
  two strings that change. `advice_cost`, `advice_cost_free` and
  `advice_marginal` are deliberately untouched.
- `messages/{de,es,fr,zh}.json` — key-for-key with `en.json`
  ([docs/deployment.md](../deployment.md), "Adding a locale").
- `src/lib/presentation/utils/plan-advice-descriptor.ts` —
  `formatSwitchCostPrice` builds the bracket; `signedPlanValue` is the one
  signing shared by all three readings.
- `src/lib/presentation/utils/plan-advice-descriptor.test.ts` — the two
  assertions in "the price of the switch cost" that spell the old sentence, and
  that block's own header comment, which mirrors the descriptor's docblock.
- `src/lib/presentation/component/plan-advice-card.svelte` — where `advice_desc`
  renders, above every reading and before the first solve.
- `src/lib/presentation/component/plan-advice-card.stories.svelte` — four
  fixtures carry the bracket sentence verbatim and one `play` asserts it.
- `e2e/plan-advice.e2e.ts` — three `/plan value/` assertions, one of which is a
  `toBeHidden` that the new description would satisfy for the wrong reason.
- MATH.md §0 — the objective, "the quality of hours worked, not the amount of
  work done", which the new description is a paraphrase of.
- `src/lib/business/model/AGENTS.md`, "The switch cost is instrumented but never
  advised" — its fourth bullet quotes the bracket's copy as an example.
- `docs/redesign/Shipped.dc.html` — the artboard `docs/redesign/README.md` calls
  "the root page as it ships today", which prints both strings verbatim.
- [scripts/PROBES.md](../../scripts/PROBES.md) — the new probe's row.

## Decisions

- **The definition goes in `advice_desc`, not beside each reading.** One legend
  in the card header covers the option column, the budget marginal and the
  bracket at once. Rejected: repeating the unit in each of the three strings,
  which triples the words and still leaves the option column — three or four
  rows deep — restating it on every line.
- **The description keeps its existing claim.** "Re-solved by the same optimizer
  that built your plan" is what separates this card from a rule table, and
  dropping it to make room would trade one missing fact for another.
- **The scope claim is "anything priced in plan value", not "every %".** The
  card prints percentages that are levels — every axis reading, every option's
  `after`, and `advice_switch_cost`'s `{share}% of the budget` — so the wider
  sentence would be false on most of the numbers on screen. Naming the unit
  scopes it exactly, and teaches the token the reader has to recognise.
- **The description states what plan value counts, never how often it
  disagrees with output.** "It counts how many tasks get hours" is a property of
  `Σ vᵢ·P̄ᵢ` with `P̄ᵢ(0) = 0` — true by construction, on every day. Rejected:
  "funding one more task raises it", which the probe finds on 284 of 284 days
  and still is not a law — the new term is provably positive, the net rise is
  not, since the hours it takes come off every other term. And rejected: the
  measured frequency itself, which is a fact about the fixture year, not about
  the reader's day. "Can rise while less work gets done" is the honest strength.
- **The bracket names the re-solve.** "At no switch cost this plan reads +10.4%"
  was wrong twice: "reads" makes a signed change sound like a level, and the arm
  is a different allocation, not this one re-read. Rejected: adding a verb of gain to the sentence, which breaks on
  the arm whose delta is negative and on the clamped 0 arm, since `{free}` and
  `{cost}` share one sentence.
- **The probe is the price of the sentence.** The card now tells the user that
  plan value is not the work the day does. That is a claim about the model, so
  it gets an instrument (`scripts/PROBES.md`) rather than an intuition — and the
  instrument keeps it honest when the allocator moves.
- **The e2e's pre-check assertion narrows to `/% plan value/`.** With the unit
  defined in the always-visible description, `/plan value/` would match the
  legend and the test would pass while proving nothing. The reading it means to
  find hidden is a priced one, and only a priced one carries the `%`.

## What execution turned up

- **The disagreement is the common case.** Over the fixture year's 284
  priceable days and the 851 defer levers on them, 812 (95.4%) cost plan value
  and 696 (81.8%) cost plan value **while the work the plan does rises**. Those
  696 read a median −8.3% plan value against +31.2% output; over all 851 levers
  the medians are −7.6% against +26.9%. A user reading the cost column as "how
  much worse my day gets" is reading it backwards four times in five.
- **Breadth is why, and it is not an artefact of the task chosen.** One more
  task was added to each day at three shapes — light 2/1/5, middling 5/4/5,
  heavy 8/7/2 — seating on 284, 278 and 180 of the 284 days. Wherever it seats,
  plan value rises on **every** day, by a median +16.1% / +8.1% / +4.7%, while
  output moves −14.4% / −20.5% / −24.8%; plan value rises while output falls on
  76.1% / 76.6% / 99.4% of them. The extra term in the sum outweighs what the
  hours it takes cost every other term, and the heavier the task the more
  starkly.
- **The panel found the scope bug in the first draft of the copy.** "Every %
  here is a change against today's plan value" was written, and is false: the
  same card renders `{share}% of the budget` and an axis reading per row, both
  levels. The shipped sentence claims only the readings denominated in plan
  value.
- **Averaging flattens the switch cost most.** Across the same days, the free
  arm reads a median +11.6% plan value against +48.2% output, and the doubled
  arm −13.3% against −14.9%; the per-day ratio |Δoutput| / |Δplan value| has a
  median of 4.26× on the free arm and 2.73× on the doubled one. The bracket
  understates the constant it exists to warn about.

## Open questions

None.
