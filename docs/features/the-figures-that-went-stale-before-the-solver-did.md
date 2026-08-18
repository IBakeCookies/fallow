# The figures that went stale before the solver did

**Status:** landed 2026-08-18 · **Roadmap:** closes nothing — a sweep finding
from the 2026-08-13 solver-drift re-run of the frozen probe set

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Five figures in MATH.md §14.1 defect 4 and §14.2 no longer match the
instruments that produced them. None of them moved with the 2026-08-13 energy
solver: the whole cause window is `8f01ca8` and `28e2e16`, both 2026-08-08, five
days earlier. Nothing the user sees changes, and no formula, constant, bound or
fit moves.

The lesson is the propagation failure, not the drift. MATH.md:2721 already
records "§14's frontier denominator (4450 → **4112**)" and §14's own unclamped-
delta paragraph already carries 4112 — while §14.1-4, two hundred lines below,
still stated 4450 twice. A reader could not tell which paragraph was current.
The earlier correction was applied to one paragraph of two, and the three
companion figures in the same two sentences were never re-measured at all.

## Scenarios

Every figure below was re-run today from the committed instrument named beside
it; none is transcribed.

- **§14.1-4, the 0-positive claim.** `0 of 4450` → `0 of 4112` priced
  frontiers, with `[2026-08-06: the same 0, over 4450]` kept beside it. The zero
  is intact — it is only the denominator that moved
  (`scripts/adv1-plan-advice-frontier.probe.ts`).
- **§14.1-4, the truncation rate.** `15 of 4450` → **27 of 4112** frontiers over
  3 options — 0.66%, against 0.34% on the 2026-08-06 draw. "Rare but exactly
  backwards when it fired" survives; the rate roughly doubled and is still rare.
- **§14.1-4, the frontier shape.** Longest `4` → **5**, and `2961` →
  **2468** single-option frontiers. The sentence now says why the fix is
  unaffected: `cap()` (`plan-advice-descriptor.ts:296`) keeps both ends at any
  length, so a frontier one option longer changes nothing about keeping the
  cheapest row.
- **§14.2, the bullet.** `215/216` → **216/216**, and "on all but one of those
  days" → "on every one". The five-line pool-starved mechanism is kept as a
  dated superseded reading, not deleted.
- **§14.2, the closing paragraph.** The same pair, `216/400 and 215/216` →
  `216/400 and 216/216`, and the headline "**all but one**" four words earlier
  reverts to "**every one**". Its parenthetical said this paragraph carried a
  superseded "every one"; "every one" is the measured reading again, so the note
  now records the 2026-08-06 draw and its cause instead
  (`scripts/adv2-budget-marginal.probe.ts`).

## Out of scope

- **MATH.md:2721's revision-log line.** `§14's frontier denominator (4450 →
4112)` is the historical record of this very correction and must keep both
  numbers.
- **§14's already-correct 4112** in the unclamped-delta paragraph, and its note
  that "the denominator drifted while the claim it carries did not". That
  sentence was right; it just never reached §14.1-4.
- **§8.10 and the stopping-value reconstruction.** A separate finding in the
  same sweep, and a code question, not a documentation one.
- **ROADMAP M33–M35.** Never measured — a classifier blocked that agent — so
  they stay in "Raised and not verified".

## Read before building

- `MATH.md` §14.1 defect 4 and §14.2.
- `scripts/adv1-plan-advice-frontier.probe.ts`,
  `scripts/adv2-budget-marginal.probe.ts` — the only instruments behind any
  figure here. Both run in under 3 s.

## Decisions

- **The exception is retired as a superseded reading, in brackets with its
  date, not deleted.** The day it describes no longer exists in the sweep, but
  the mechanism it explains (whole-percent Load rounding on a pool-starved day
  freezing both axes) was the correct explanation of why it once did, and the
  enclosing conclusion — a zero marginal must not be wired to suppress the
  unpriced `budget + 1` lever — holds _harder_ at 216/216 than at 215/216.
  Deleting the exception would delete the only worked example of the mechanism
  the paragraph two screens below still leans on.
- **The 0.66%/0.34% pair is arithmetic on two measured counts**, not a third
  measurement, and is written as a comparison between two dated draws so it
  cannot be mistaken for something a probe prints.
- **The probe's own docblock moves with the figure.** Same call 1aa90e6 made for
  `band.ts`: a stale mirror in a shipped file is the identical defect one file
  over.

## What execution turned up

- **The cause commit does the opposite of what the plan said.** The landing plan
  attributed the vanished exception to "8f01ca8, whole-percent Load rounding in
  `calculation.ts`", which reads as if that commit introduced the rounding.
  `git show 8f01ca8 -- src/lib/business/model/metric/calculation.ts` shows it
  _removed_ it: `Math.round((mentalHours / budget) * 100)` became
  `weightedLoad(...)` returning an exact `Math.min(100, (weightedHours / budget)
  - 100)`, with rounding left to display (§25). That is exactly why the
    exception died — with exact Loads, a wider budget always moves the axis on a
    pool-starved day, so the lever is always offered. MATH.md now says "made the
    Loads exact and left the whole-percent rounding to display".
- **The "quoted 0.34%" was never quoted.** The plan corrected `15 of 4450
(0.34%)` to `27 of 4112 (0.66%, against the quoted 0.34%)`, but §14.1-4 has
  never printed a percentage for this figure — only the two counts. Landed as an
  explicit comparison of the two draws rather than as a correction to a figure
  that was not there.
- **The propagation failure ran past MATH.md.** The instrument's own header,
  `scripts/adv1-plan-advice-frontier.probe.ts:25`, said its counts "compose with
  [`plan-advice.probe.ts`'s] 404 trim levers and 4450 priced frontiers". The 404
  still prints; the 4450 has not since 2026-08-08, and the sibling probe prints
  4112 today. Fixed here, in the same commit as the sections it backs, so the
  three places that carry the denominator agree for the first time since it
  moved.
- **The 2961 was wrong on the day it was written.** Not drift at all: the sweep's
  bisect ran the probe at `8f01ca8^` — the tree the 2026-08-06 measurement was
  taken on — and it prints 2960. The bracketed historical reading says so, so a
  future reader does not try to reproduce a number that never existed.

## Open questions

- **Nothing in the repo tests these five counts.** They are printed by probes
  and copied into prose; the probes assert only invariants (0 violations, worst
  relative < 1e-12), which is why a doubled truncation rate and a vanished
  counter-example survived eleven days of green builds. A figure-diffing gate
  over the probe output would have caught all five the day they moved.
