# Destination preview for a defer

**Kind:** feature · **Status:** landed 2026-08-12 · **Roadmap:** item 21

Backfilled 2026-08-14 from ROADMAP item 21, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Before deferring a task, the user can see what the destination day already
holds: one day-level line on the advice card, above the axis menu and beside
the other day-level readings, giving tomorrow's active task count, the hours it
opens on, and how many of those tasks its own plan funds. Read-only.

## Scenarios

Not recorded at land.

## Out of scope

- **No Δ% pair and no per-task funding claim** (item 8). "Your task would get
  2.5 h tomorrow" is that superseded nudge one step removed, and after item 16
  it is worse: tomorrow's budget is frequently a weekday **median** rather than
  a declaration, so a per-task claim is a solve on a guess presented as a
  promise. The line reports what tomorrow already is.
- **No row per lever.** One reading, because every defer lever on the card
  sends the task to the same day.
- **No field on `AdviceDisplay`, and `plan-advice.ts` untouched.** The reading
  is no part of the advice objective; `AdviceDisplay` is built from
  `PlanAdvice`, contractually today's inputs alone (MATH.md §14), so this is a
  separate descriptor and card prop.
- **A stale-window-and-document-it was considered and refused.** The stale
  banner warns that numbers were priced on a day that moved; this would be a
  reading claiming to be fresh about a day the user had just edited.
- **No `isStored` flag on the reading.** Item 16 already settled that a prefill
  IS the day's hours everywhere else on screen (the constraints bar marks
  none), so a provenance clause here would contradict the rest of the UI. The
  copy splits on the task count instead.
- **No second §33 window fitted for tomorrow.** The preview is solved under the
  **viewed** day's ϕ fit: two window definitions for a reading that reports
  counts.
- **The stated kill criterion was restated, not run** — item 15's and 16's
  precedent. The criterion (0 tasks **and** 0 budget on >80% of real defer
  moments) is a question about habit: real defer moments are not recorded, no
  exported history exists on the author's machine, and `generate-fixture.mjs`
  can never gate an item whose question is what the user habitually does. Item
  16 also closes the budget half **by construction** — with any budgeted day in
  history an unseen tomorrow opens on a nonzero prefill — so only "0 tasks"
  survives, and an empty tomorrow is information the user wants before
  deferring, which is what the second copy is for. Run the original the moment
  a real backup exists, jointly with item 15's and 24's gates.
- **Known limit: the word "Tomorrow" is the button's, and on a future day it is
  wrong while the counts are right.** The card renders on any non-past day and
  `moveTaskToTomorrow` sends to `selectedDate + 1`, so viewed three days out
  the line describes the right day by the wrong name. Inherited, not introduced
  — `advice_apply` has read "To tomorrow" since the defer button shipped — but
  this is the first time a factual COUNT rides on that word. Deliberately not
  re-worded here: the copy and the five locales stay as they are, because
  re-opening the button's wording re-opens ground item 25 settled.

## Where it landed

- `business/model/metric/defer-destination.ts` — the reading, one classic
  solve.
- `describeDeferDestination` in `plan-advice-descriptor.ts` — the copy,
  including the `null` for an empty and unbudgeted tomorrow.
- `SessionStore.#readDestination` — the one definition the move and the preview
  both read through.
- `SessionStore.#writeGenerations`, `#persistSession`, `writeGenerationFor` —
  landed session writes counted per date; the preview's freshness key.
- `deferDestinationDate` — where a defer sends, read by the move, the preview
  and the key.
- `plan-advice.ts` — untouched, and named for that: the reading is no part of
  the advice objective.
- MATH.md §14 — `AdviceDisplay` is built from `PlanAdvice`, today's inputs
  alone.
- MATH.md §33 — the fit window the preview is solved under, the viewed day's.

## Decisions

- **One day-level line, not a row per lever** — every defer lever on the card
  sends the task to the same day. It sits above the axis menu, beside the other
  day-level readings.
- **The line reports what tomorrow already is** — count, hours, funded count.
  Rejected: a Δ% pair or a per-task funding claim (item 8's superseded nudge one
  step removed), because after item 16 tomorrow's budget is frequently a weekday
  median rather than a declaration, making a per-task claim a solve on a guess
  presented as a promise.
- **A separate descriptor and card prop rather than a field on
  `AdviceDisplay`** — the reading is no part of the advice objective, and
  `AdviceDisplay` is built from `PlanAdvice`, contractually today's inputs alone
  (MATH.md §14). `plan-advice.ts` is untouched.
- **The destination fallback turned out to be a shared definition.**
  `moveTaskToTomorrow` already spelled "what tomorrow's record is, or will be" —
  `dest?.availableHours ?? prefillBudgetFor(…)`, the switch cost, both pools —
  and the preview has to show exactly those numbers or the line and the write
  are free to disagree. `SessionStore.#readDestination` is now the one
  definition both read through (R3); the preview adds nothing to it but the
  solve.
- **The advice fingerprint could not cover this reading, and that is the one
  piece of machinery the item cost.** The fingerprint is a value over `{date,
input}`, so today → tomorrow (edit it) → today reads identically: today's
  advice has no such hole because it prices today alone, and this is the first
  reading that speaks about another day. So `SessionStore` counts its landed
  session writes **per date** (`#writeGenerations`, one increment in the one
  `#persistSession`; `writeGenerationFor(date)`) and the preview is keyed on the
  destination day's own count, withdrawn rather than shown once that day has
  been written. Rejected: a stale window documented as such, because the stale
  banner warns that numbers were priced on a day that moved, and this would be a
  reading claiming to be fresh about a day the user had just edited.
- **Per date, and one global counter was the first cut's bug** (review, same
  day): only a write to the destination day can change what the line says, so a
  single counter withdrew the reading on today's own auto-save — add a task,
  press Check inside the 500 ms debounce, and the flush landed after
  `computeAdvice` had snapshotted the key, so the line silently never appeared
  on the commonest path there is.
- **The counter is a `SvelteMap`** because it is mutated per write rather than
  replaced, which a plain `Map` would not re-derive from.
- **`deferDestinationDate` is one definition too** — the move, the preview and
  the key all read it rather than spelling `selectedDate + 1` three times (R3).
- **An empty and unbudgeted tomorrow prints nothing.** With no budgeted day in
  history `prefillBudgetFor` returns 0, and "nothing planned yet, 0m to spend"
  is exactly the dead row this item's own kill criterion names — the one state
  the restated gate excepts. `describeDeferDestination` returns `null` for it:
  the reading is factually fine, there is simply no sentence worth printing,
  which makes it a copy decision and puts it beside the plural split rather than
  in the summarizer. Suppressed only as a PAIR — a 0-hour tomorrow that has
  tasks on it is the most useful thing this line says.
- **Two things the plan expected that the code did not need.** The reading
  carries no `isStored` flag: item 16 already settled that a prefill IS the
  day's hours everywhere else on screen (the constraints bar marks none), so a
  provenance clause here would contradict the rest of the UI — the copy splits
  on the task count instead. And the preview is solved under the **viewed**
  day's ϕ fit rather than a second §33 window fitted for tomorrow: two window
  definitions for a reading that reports counts.

## Open questions

None — landed. The original kill criterion (0 tasks and 0 budget on >80% of
real defer moments) is to be run the moment a real backup exists, jointly with
item 15's and 24's gates.
