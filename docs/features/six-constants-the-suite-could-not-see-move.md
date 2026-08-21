# Six constants the suite could not see move

**Status:** landed 2026-08-20 · **Roadmap:** finding M45

Backfilled 2026-08-21 from ROADMAP.md's M45 entry, whose text was written at land, and
moved here verbatim so the roadmap can hold a line and a link. Not a
pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M45 — CLOSED 2026-08-20. The probe was never the guard; six suite pins were
missing.** Two mutations of the behaviour `stop-inversion-margin.probe.ts`
documents left it GREEN (2026-08-19): dropping `DIFFICULTY_SPILLOVER` from
`getEffectiveDifficulty`, and forcing every recovered inter-session gap to zero
so a day's breaks become invisible. **That is the design, not a defect**, and
this lead's own framing — "a probe that cannot go red is a report, not an
instrument" — contradicts `scripts/PROBES.md`, which opens "Probes are
committed, and they are not tests" because a probe's number legitimately moves
whenever the allocator does. 39 of the 61 probes contain no `expect()`. The
rule that is testable is `docs/testing.md`'s "Pin what the probe found with one
fixture in the suite", so the sweep ran against the suite: all 40 module-level
model constants perturbed one at a time, 830 tests per run (2026-08-20). **31
caught, 9 survived** — eight of them a fit bound or a noise term, the ninth a
search seed count. Six were real and are now pinned to literals, taking the sweep to **37
of 40**: `ALPHA_FIT_MAX` (2 → 0.9 clamped fitted α 0.9627 → 0.9000 and widened
the worst prediction gap 1.236 → 2.024 notches) and `RECOVERY_FIT_MIN` (0.1 →
0.6 moved a rest set that already sat on the bound, 0.100000 → 0.600000) both
survived because their only assertions compared a bound against its own
constant, so both sides moved together; and the four noise terms behind the
Energy page's ± printed nothing anyone asserted — `DRAIN_NOISE_PRIOR_STD`,
`RECOVERY_NOISE_PRIOR_STD`, `STOP_NOISE_PRIOR_STD` (0.25 → 1 moved the stopping
± 0.130403 → 0.332799) and `CALIBRATION_NOISE_PRIOR_WEIGHT`, which feeds two of
them. `STOP_FIT_MIN`/`STOP_FIT_MAX` are deliberately left unpinned: over 108
slider/window combinations 197 indifference points span [0.039, 1.609] and 98
fits span [0.299, 1.060], none at a bound, and the fitted mean is a weighted
average of those points with `value0` ≤ 3, so neither clamp can bind. The one
hole left open is small: `PAIR_SEED_TASKS` 3 → 2 costs 0.038620 objective over
60 seeded days, all of it on one day.
