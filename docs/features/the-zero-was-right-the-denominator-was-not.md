# The zero was right, the denominator was not

**Status:** landed 2026-08-18 · **Roadmap:** closes nothing — a sweep finding
from the 2026-08-13 solver-drift re-run of the frozen probe set

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Correct one denominator, in the two places it is written. MATH.md §25's second
bullet said "**0 of 803** options on every other axis lost this way"; the
figure is 811. The same 803 was mirrored in the shipped docblock of
`src/lib/presentation/utils/band.ts`. Nothing the user sees changes, and no
formula, constant, bound or fit moves.

## Scenarios

- **§25 — the bullet.** `0 of 803` becomes `0 of 811`, and the bullet now
  carries the split in parentheses: 628 + 94 + 28 + 37 + 21 + 3, equivalently
  1404 options in total − 593 Energy Balance. Re-measured today with
  `scripts/adv3-advice-display-resolution.probe.ts` (seed 42, 600 days): 438
  days render at least one row, 1404 options in all, per-axis timeScarcity 628,
  frictionIndex 94, burnoutRisk 28, physicalLoad 37, cognitiveLoad 21,
  scheduleIntegrity 3.
- **`band.ts` — the mirror.** The docblock on `energyBalanceReading` states the
  same claim to the reader of the shipped code and carried the same 803. It now
  reads `(0 of 811)`.

## Out of scope

- **The claim itself.** Zero options are lost on any axis that already prints a
  percentage — the numerator is 0 on all six axes, today and at the commit that
  wrote the sentence. The bullet's argument ("the three-word bucket is the whole
  mechanism") is untouched.
- **Every other §25 figure.** 274 of 600 days / 593 options, Time Scarcity
  268/628, the post-fix residue 111 of 593 (18.7%) with median 0.0 / p90 0.4 /
  max 0.9, and the 2-of-274 suppression line all reproduce exactly in today's
  run. The pre-fix figures (365 of 593, median 1.7, max 39.3, 99 of 274) are
  before-state and no longer emittable — the shipped `energyBalanceReading`
  prints the share beside the word — so they are left as written.

## Read before building

- `MATH.md` §25, "The second rounding: the WORD was coarser than the number".
- `scripts/adv3-advice-display-resolution.probe.ts` — the only instrument behind
  any number in that section.

## Decisions

- **The parenthetical is the point of the commit.** A denominator no single
  print carries is a denominator nobody re-checks. Writing the six addends and
  the 1404 − 593 identity beside it means the next reader confirms the figure
  from one probe run's output rather than re-deriving it, and a seventh axis
  appearing makes the arithmetic visibly stop adding up.
- **Both halves of the identity, not one.** The per-axis sum is what the probe
  prints; `1404 − 593` is the cross-check that the six axes are all of them.
  Either alone would have been enough to catch 803; together they say which
  print to look at.

## What execution turned up

- **This was never drift.** The sweep re-ran the probe from git archives of
  `cbfff71` (immediately before the 2026-08-13 solver change) and of `28e2e16`
  — the commit that authored the §25 sentence — and both print byte-identical
  output, 811 included. 803 was wrong on the day it was written, so no solver
  or allocator change is implicated and nothing else written that day inherits
  a suspicion from it.
- **The probe never printed 803, or 811.** It prints seven per-axis lines and a
  total; the "every other axis" denominator only exists once a reader sums six
  of them. That is the whole failure mode — the numerator was read off the
  output (six lines each saying `0 of N`), the denominator was done in someone's
  head, and only the half that was arithmetic went wrong.

## Open questions

- **The probe's arms cite the wrong section.** Its three `it()` titles read
  `(MATH.md §14)`, `(MATH.md §14/§25)` and `(MATH.md §14)`, while the file
  header, the probe registry row and every figure it emits are §25 — §14 holds
  none of these numbers. Left alone here because it is a citation defect in a
  different file with no figure behind it, but a reader who follows an arm title
  lands in the wrong section.
