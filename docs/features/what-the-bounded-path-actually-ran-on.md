# What the bounded path actually ran on

**Status:** landed 2026-08-19 · **Roadmap:** closes M29 (§34), M30 (§7)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Give two doc sites a source. `MATH.md` §34 said the bounded funded-subset search
"ran on about a quarter of the solves" and §7 quoted three crossover budgets —
and nothing in the repo emitted either, because `boundedSearchRuns` in
`scripts/subset-search-bound.probe.ts` was only ever called inside the
monotonicity arm's violation push. One probe change serves both: the arm now
counts every bounded solve, and a new arm walks the bounded region per
(n, `switchCost`).

Nothing shipped moves. No formula, constant, bound or fit changes; the allocator
is untouched. The diff is the probe, its registry row, §34, §7 and ROADMAP.

## What landed

- **`scripts/subset-search-bound.probe.ts`** — `boundedSearchRuns` is split into
  `boundedSearchSize` (returns `maxFunded` and the Σⱼ C(n, j) plan count) and the
  boolean predicate over it, because §7's parentheticals are those two numbers
  and the old helper threw them away. The monotonicity arm hoists the bounded
  test out of the violation branch and writes `bounded` / `boundedShare` beside
  `checks`. A fourth arm writes `/tmp/subset-search-crossover.json`: per
  (n, `switchCost`) the last bounded budget on the quarter-hour ladder to 24 h
  with its `maxFunded`, plan count and bounded-step count, plus the smallest n
  whose ONE-HOUR day falls through, per `switchCost`.
- **§34** — "about a quarter of the solves" → **1587 of 6400 solves, 24.80%**
  (2026-08-19, `scripts/subset-search-bound.probe.ts`). The sentence after it,
  that the ordinary 8 h day at n = 13 is a fallback day, was correct and stands.
- **§7** — the three crossovers are dated, sourced and carry their
  `maxFunded` / plan count, and the false causal clause is replaced by what the
  crossover arm supports.
- **`scripts/PROBES.md`** — the row's Backs column names §7 and the two new
  emissions. Registry still 60/60.

## The figures, as emitted

| Claim                          | Emitted                                              |
| ------------------------------ | ---------------------------------------------------- |
| §34 bounded share of the sweep | `bounded` 1587 of `checks` 6400, `boundedShare` .248 |
| §7, n = 13, `switchCost` 0.25  | 3 h — `maxFunded` 6, 4095 plans                      |
| §7, n = 14, `switchCost` 0.1   | 1.75 h — `maxFunded` 5, 3472 plans                   |
| §7, n = 20, `switchCost` 0.1   | 1.25 h — `maxFunded` 3, 1350 plans                   |
| ≤ 2 h band, `switchCost` 0.1   | 2.25 h at n = 13, 1.75 h at n = 14, 1.5 h at n = 15  |
| One-hour day to the fallback   | n = 30 at 0.1; n = 91 at 0.25, 0.33 and 0.5          |

## What execution turned up that the reading missed

**M29's figure was never wrong; only its emission was missing.** 24.80% is "about
a quarter", so this closed as a provenance hole with the digits intact. The audit
pass that raised it also confirmed 1587 a second way — branch counters on all
five exits of the shipped `bestPlanWithSwitchCost` — which agreed exactly. That
instrumentation is not committed, so `MATH.md` claims only what the probe prints
and the second reading is recorded here instead.

**M30's causal clause was false, and the lead never looked at it.** The lead
filed the two crossover figures as undated; the defect was the sentence after
them. "A long enough list sends even a one-hour day to the fallback, which is why
§34's after-table still shows shortfalls in the ≤ 2 h band" names a mechanism the
sweep never runs: a one-hour day needs n = 30 at `switchCost` 0.1 and n = 91
above it, while the after-table runs n = 13, 14, 15.

**The ≤ 2 h shortfalls are a deduction from the new arm, not a fourth
measurement.** From `switchCost` 0.25 up, every n in the after-table has a
crossover of 2 h or more, so every ≤ 2 h day there is bounded — and bounded days
are exact by §34's own argument. So the band's shortfalls can only be
`switchCost` 0.1 days, and the crossovers there (2.25 / 1.75 / 1.5 h) line up
with the band's 0.00% / 1.89% / 3.31% one n at a time. The band arm does not
record each day's switch cost, so §7 states the implication rather than a
per-day attribution.

**`zenith.test.ts:699-748` is not the backstop it reads as.** Its comment names
the n = 14 / `switchCost` 0.5 crossover at 3.75 h and its loop stops there, which
looks like the crossover is suite-pinned. Its sole assertion is budget
monotonicity, and running its own 14 tasks up to 10 h gives **0 violations at
`switchCost` 0.1, 0.25, 0.33 and 0.5** — the ceiling detects nothing on that
list, so the fixture would pass unchanged if the crossover moved anywhere. The
crossover is arithmetic, and until this commit no committed artifact evaluated
it.

**One commit, not two.** The probe change is the source for both doc sites, so
splitting §34 from §7 would have meant the second commit quoting a number the
first had not committed. The arm neither lead asked for — the last bounded budget
per (n, `switchCost`) — is what makes §7 probe-backed rather than
scratch-backed.

## Decisions

- **The eight per-n / per-`switchCost` bounded-share splits are declined.** They
  reproduce, but they are properties of the sweep's uniform 0.25–10 h budget grid
  and uniform switch-cost draw, not of days the app produces, and the probe emits
  only the aggregate. Landing them would have closed one provenance hole by
  opening six.
- **The crossover arm emits `steps` beside the last bounded budget.** §34 and §7
  both say the bounded search "runs up to" a budget, which is a claim that the
  region is an interval. `steps` equals `lastBoundedBudget / 0.25 h` in all 20
  cells, so the JSON carries the evidence for the wording instead of leaving it
  implied.
- **Dated 2026-08-19, not 2026-08-18.** The plan for this commit prescribed the
  earlier date; the probe ran today, and `docs/testing.md` wants the date the
  number was measured.
- **The wall-clock collapse at the crossover is not quoted.** The audit measured
  ~26× at n = 14 and ~6× at n = 20 either side of the crossover, in scratch. §34
  already has a wall-clock table from a committed arm, and a second timing figure
  from an uncommitted harness would be the exact defect this commit closes.
- **§34's crossover paragraph was rewrapped.** It carried a stranded short line
  from an earlier edit ("runs up to a **3 h** day and the"); the prose is
  unchanged apart from the new sentence.

## Out of scope

- **§8.10's reconstruction.** Excluded for this whole round: a genuine model
  finding awaiting a maintainer ruling on `zenith-energy.ts`, not a doc fix.
- **M33, M34, M35.** Never measured — a blocked agent, not a closed lead. They
  stay in ROADMAP's "raised and not verified" list.
- **The allocator.** Nothing about which branch runs when changed; the probe
  re-derives §34's rule at `startedCount` = 0 rather than asking the code under
  test which path it took, as its header already said.
- **ROADMAP's stale `MATH.md:` line citations.** M29's was 680 lines out and
  M30's 5; both were re-located by content and the closed entries now cite this
  file instead. Bumping the citations that this commit's 12 inserted lines moved
  is the open question the round has already filed.

## Open questions

- **Nothing links a §7 caveat to the section that owns its measurement.** §7
  quotes §34's arithmetic at three coordinates §34 itself never prints. The
  probe now emits all three, but the only thing tying the bullet to the arm is
  the filename in a parenthetical.
- **A fixture whose comment pins more than its assertion does.** The §34
  monotonicity fixture reads as a crossover pin and is not one. Whether the
  suite should assert the crossover — cheaply, since it is arithmetic — or the
  comment should stop implying it, is a testing decision this commit did not
  make.
