# The breaks the fit could not read

**Kind:** feature · **Status:** landed 2026-09-01 · **Roadmap:** item 4 (the obligation that outlived its closure)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one.

## Goal

A user whose Stopping Calibration reads worse than they expect can see why: the
card names how many of the days behind the fit were read as one unbroken
stretch because their 🪫 ratings carry no break between them. Today the card
reports the days the clock censored and the days it observed, and a day logged
in one batch is indistinguishable from a day whose breaks were read — the fit
silently degrades to its pre-2026-08-19 accuracy and says nothing.

## Scenarios

### Scenario — a past day logged in one batch is named on the stopping card

`e2e/energy-lab.e2e.ts`

- **Given** a past day with two 🪫 ratings whose log moments recover no gap
  between them, and which still yields a two-sided bracket
- **When** the user opens `/energy` on the following day
- **Then** the Stopping Calibration card says 1 of the days behind the fit had
  no readable breaks

### Scenario — a day whose breaks were read is not named

`e2e/energy-lab.e2e.ts`

- **Given** a past day whose two 🪫 ratings were logged hours apart, so a break
  is recovered between them
- **When** the user opens `/energy` on the following day
- **Then** the Stopping Calibration card shows no unreadable-breaks line

### Claim — a single-session day is not counted

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a used day with exactly one logged session
- **Then** `unreadBreaksCount` is 0 — one session has no break to read, and the
  contiguous fallback represents that day exactly

### Claim — the count is over the days the fit used, not over every observation

`src/lib/business/model/zenith-energy.test.ts`

- **Given** two batch-logged past days, one of which is censored (every task
  checked off, so it reveals no indifference point)
- **Then** `unreadBreaksCount` is 1, and `usedCount` is 1

### Claim — the count agrees with the schedule the fit read

`src/lib/business/model/zenith-energy.test.ts`

- **Given** a used day with two sessions and a recoverable gap between them
- **Then** `unreadBreaksCount` is 0, and it becomes 1 when the same day's rows
  carry the same log moment instead

## Out of scope

- **The always-visible ratio.** "9 of 12 days read with their own breaks" was
  considered and rejected; the line mirrors the clock censor's and is hidden at
  zero.
- **Counting every stop observation.** Days the fit never used are not behind
  the fit, so they are not in this count.
- **Changing the reading.** The contiguous fallback stays bit-identical
  (`business/model/AGENTS.md`); nothing is dropped, re-weighted or censored for
  being batch-logged. This item reports, it does not repair.
- **The same count for §8.11.** The live advisor reads the same reconstruction
  and is not touched.
- **Item 4's censored likelihood**, decided against 2026-08-21
  ([censored-stopping-fit.md](censored-stopping-fit.md)). Re-opening it is not
  this.

## Read before building

- `src/lib/business/model/zenith-energy.ts` — `fitStoppingValue` (the
  `usedCount` / `clockCensoredCount` siblings the new field joins),
  `reconstructStopDay`, `recoveredRest` and `loggedStructure` (the predicate the
  count must reuse rather than restate), `isClockCensored` (the shape to copy:
  a cheap per-observation pass beside the fit).
- `src/routes/(app)/energy/+page.svelte` — the Stopping Calibration card body,
  inline here because the calibration cards share a shell and not a body; the
  `clockCensoredCount > 0` block is the line's neighbour and its template.
- `e2e/energy-lab.e2e.ts` — the "ran out of clock" test, which already builds a
  past day with 🪫 ratings under `page.clock` and is the pattern both scenarios
  follow.
- `messages/en.json` (`energy_stop_out_of_clock` / `_one`) plus `de`, `es`,
  `fr`, `zh` — five locales, singular and plural.
- MATH.md §8.10 — the batch-logging approximation ("a day with no usable
  moment, and a day logged in one batch, fall back to one contiguous session")
  gains the sentence that the fit now counts those days. No formula moves.
- [src/lib/business/model/AGENTS.md](../../src/lib/business/model/AGENTS.md) —
  the fallback bullet, which is where a new public field on `StoppingValueFit`
  is priced.
- [ROADMAP.md](../../ROADMAP.md) item 4 — its outstanding obligation collapses
  to a date and a link to this file in the landing commit.

## Decisions

- **The count is a new `unreadBreaksCount` field on `StoppingValueFit`, beside
  `clockCensoredCount`** — the card already reads that fit, the store passes it
  through untouched (`energy-lab-store.svelte.ts:713`), and nothing else needs
  plumbing. Rejected: threading a flag out of `stopBracket` /
  `stopIndifferencePoint`, because it widens two public signatures to carry a
  display count.
- **The predicate is: the day has two or more logged sessions AND
  `loggedStructure` returns null for it.** The second half is the exact
  condition under which `reconstructStopDay` falls back, so the count cannot
  drift from the schedule the fit actually read. The first half is not
  defensive — without it the line fires on every single-session day, which is
  most days and which the contiguous reading represents exactly. Rejected:
  `recoveredRest === null` alone, which is equivalent only because the rest cap
  never bites on a day that reaches the fit — true today, and not a thing the
  count should depend on.
- **Recomputed per used day rather than returned from the fit's own
  reconstruction** — the predicate reads log moments and builds no curves, so it
  is cheap, and `isClockCensored` already established this shape. Rejected:
  restructuring `fitStoppingValue`'s `map`/`filter` into a paired reconstruction
  cache, which buys nothing at these day counts.
- **The copy says the breaks could not be read, not that the day was
  batch-logged** — the fallback also catches a day whose rows carry no usable
  moment (a restored backup), and two sessions genuinely worked back to back
  read the same way. Naming the cause would be a claim the instrument cannot
  make.
- **Hidden at zero.** A well-logged profile sees nothing; the line appears only
  when the fit is weaker than its `n` suggests, which is the whole reason for it.

## Open questions

None.
