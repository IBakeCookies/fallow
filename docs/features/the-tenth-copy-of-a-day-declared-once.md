# The tenth copy of a day declared once

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M50

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M49 closed on a residue rather than a proof. M40's sweep for off-surface task
fixtures had closed on `grep 'difficulty: Math.max' scripts/` returning empty —
one hand-built spelling — and M49 then found two more generators in a file that
matched no such string. So the count was never the point, and "seven" was not
safely the count either.

The fault is not a spelling. It is an `EnergyTaskInput` whose `difficulty` is
not the one `getEffectiveDifficulty` derives from its two demands, or whose
demands and enjoyment are not values the three integer sliders can produce.
That is decidable, so it was decided.

## What was searched

Every `EnergyTaskInput` the repo constructs, matched by AST rather than by
text: **9 inline object literals** plus **113 call sites** of the eight
`task`/`makeTask` factories, each factory resolved by mapping its parameters to
the fields they fill and then checking every call whose arguments are literals.
Eight further call sites are built from loop variables and are not statically
decidable. Demand-only records — `DrainObservation` and friends, which carry
the two demands but no `difficulty` — are not tasks and were not in scope.

Each construction was tested against the surface directly: demands a slider/10
in [0,1], enjoyment an integer 1–10, and `difficulty` equal to
`min(10, max(1, max(m,p) + 0.3·min(m,p)))` at those demands.

## What was found

**84 of the 122 sit off the surface, and 68 of those already declare it** — 64
under the class declaration `docs/testing.md` gives `zenith-energy.test.ts`'s
`makeTask` calls, four individually (`enb-simpson-error.probe.ts`'s
`FAST_TASK`, `session-row-truncation.probe.ts`'s `WITNESS`, and
`energy-search-gap.probe.ts`'s two, kept unreachable on purpose). Of the 16
left, ten are verbatim mirrors of suite fixtures that same class declaration
covers — `enb-break-economics.probe.ts`'s "the suite's fragmentation fixture
task", `stp-lattice.probe.ts`'s "the suite's second §8.8 day".

So the generator-counting frame was the wrong frame, and M48 had already
replaced it: reachability is required where a number is QUOTED or APP-level
behaviour is witnessed, optional elsewhere and then declared. Read against that
rule the repo is nearly clean, and the search's value is the two places it is
not — not a fourth revision of a count.

## What was repaired

**Exactly one of the 16 is a wrong number rather than an undeclared one.**
`plan-audit.test.ts` held a TENTH copy of the 2026-07-14 named day
(boxing / guitar / reading), still carrying the pre-slider `guitar 0.4/0.3` and
`reading 0.5/0.05`. `physicalDemand: 0.05` has no slider at all — the demands
are slider/10.

The day has ten declarations. M44 aligned eight of the nine it should have on
2026-08-21 and did not reach this one, the only copy outside a probe.

The two committed sentences about that count survive the finding, and it is
worth being exact about how. `energy-search-gap.probe.ts` says it is
deliberately unaligned "with the other nine declarations of this day" — the
count is right, and always was; what was false is the presumption that those
nine were aligned, so the repair makes the sentence true rather than correcting
it. `zenith-energy.test.ts`'s guard, "there is no longer a second place for it
to drift from", is scoped to the four describe blocks inside that file and is
true as scoped. It is simply not the repo-wide guarantee it reads as, and
reading it as one is what let a tenth copy sit unexamined.

Aligned to guitar 0.6/0 and reading 0.4/0, the demands the sliders reach at the
difficulties this day is stated in, with the alignment recorded in a sentence
the way M44 recorded the other nine. **Its nine tests pass unchanged**, which is
the reason the drift survived two days of sweeps: the file compares a plan
against itself — overlap 1, spread 1 versus 3 — and quotes no magnitude that a
wrong day could move.

The second residual, `rv13-terminal-timing.probe.ts`'s undeclared matched pair,
is a declaration gap rather than a wrong number and landed as M51.

## What was deliberately not done

- **The 64 were not touched.** `docs/testing.md` declares them as a class and
  gives the reason: `difficulty` and the two demands are independent knobs of
  the MODEL's input type, and coupling them is `toEnergyTask`'s business. A
  model-level unit test is entitled to the whole input type.
- **The ten mirrors were not individually declared.** They copy fixtures the
  class declaration already covers, and a per-copy sentence would restate it ten
  times without adding a fact.
- **No lint check was added.** The rule that matters turns on whether a number
  is quoted or app behaviour witnessed, which no checker can see; a checker for
  the mechanical half would flag the 64 legitimate fixtures every run and train
  the reader to ignore it.
- **`plan-audit.test.ts` was not made to import the canonical day.** M44's guard
  is one declaration per file, not one per repo; the probes each keep an aligned
  copy with a sentence saying so, and this now matches them.
