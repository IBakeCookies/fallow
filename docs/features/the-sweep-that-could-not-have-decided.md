# The sweep that could not have decided

**Kind:** repair · **Status:** landed 2026-08-31 · **Roadmap:** the 2026-08-20 rules eval

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The rules-eval finding ended "a properly powered condition comparison needs
n = 60 runs per arm", and nothing in the harness could produce that number or
check it. `eval/analyze.mjs` printed per-arm rates and a sign test, so a sweep
could report a tie without reporting that a tie was all six runs an arm were
capable of reporting. The number is now read off the sweep the claim rests on,
and every future sweep prints its own. Nothing the user sees changes, and no
arm was widened — the comparisons the harness has run are still undecided.

## Claims

Read off the committed sweeps in `eval/results/`, by running the analyzer on
each. Adherence is a per-run rate over that run's scored rows; a "point" is one
percentage point of it. All figures are α = 0.05, two-sided, 80% power, against
`TARGET_DELTA` = 20 points.

- **The 60 was real, and belongs to one sweep.** `2026-08-19T19-48-11.317Z`,
  `targeted` SD 36 and `monolith` SD 42 over six runs each: pooled SD 39, which
  asks for **n = 60 per arm**. The finding quoted it without saying which sweep
  it came from, which is why it read as a rule of thumb.
- **It is not stable, and the instability is the point.** The other two
  `targeted`-vs-`monolith` sweeps ask for **23** (`2026-08-19T22-08-29.542Z`,
  pooled SD 24) and **42** (`2026-08-20T12-31-25.374Z`, pooled SD 33). Six runs
  an arm cannot pin the SD that sizes the next sweep any better than they can
  pin the difference.
- **What the sweeps as run could see.** 63, 38 and 53 points respectively —
  against a scale whose whole observed range is 21% to 77%. The 08-20 sweep's
  five-of-six tie and p = 1.000 is what a comparison that resolves 53 points
  says about a 3-point difference.
- **Pairing by case cannot be planned on.** The paired SD is 43, 25 and 7 points
  on those three sweeps: worse than unpaired on the first, unchanged on the
  second, a fifth of it on the third. What varies is the same case run twice,
  not the case, so the arms are sized unpaired.
- **The one comparison that was decidable was decided.** `none` vs `effort`
  (`2026-08-20T16-58-17.077Z`) carries pooled SD 11 over eight runs and needs
  n = 5; it resolves 16 points and saw 10.
- **The instrument reproduces a figure it did not produce.** `21% (SD 8)` and
  `77% (SD 15)` in
  [`what-the-extraction-was-worth`](what-the-extraction-was-worth.md) were
  computed by hand at the time; the analyzer prints both off the same two files.

## What was deliberately not done

- **No sweep was widened.** 60 runs an arm across four conditions is 240
  containerized agent runs at ~6 minutes and ~$4 each. That is a decision about
  spending, not a repair, and it is the user's to make. The harness now states
  the price instead of the finding asserting it.
- **The sign test was not replaced by a t-test.** Its own comment gives the
  reason and the reason still holds; the power figure sits beside it and is
  normal-approximation sizing, which is what a t-test's n would round to anyway.
- **`TARGET_DELTA` was not made a flag.** One constant, documented in
  `eval/README.md`, edited when someone wants to size for a different
  difference — a flag nobody has passed is code that has to be maintained.
- **The per-rule table was not given power figures.** A rule's rows are a
  handful per arm and the failures move together — the eval's dominant failure
  was one decision moving six scored rows — so a per-rule interval would be
  narrower than the evidence, not wider.
