# The cap that outlived its measurement

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M47

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M47 was raised against §8.6's pair-seed cost prose: two timing tables and a
`C(n,2)` ladder that no committed instrument printed. `PAIR_SEED_TASKS = 3`
caps the pair-seed family at the three highest-amplitude tasks, and every
statement about what that cap saves came from a 2026-08-13 run whose only record
was the tables themselves.

The entry named its own blocker: the "Before" (no pair seeds) and unbounded
`C(n,2)` arms are unreachable through `optimizeSchedule`'s signature, so
measuring them means adding surface to a shipped module for a doc figure.

## What was found

**The tables were already gone.** `e61d207` (2026-08-25) cut MATH.md to
derivations only and deleted §10–§37 and every figure §8.6 carried, so the
finding's "delete the tables" option had resolved itself two days earlier. What
survived was worse than a table: six live sites still quoting it.

- `src/lib/business/model/AGENTS.md` — a **rules file**, instructing "do not
  unbound it" on the strength of "`~1.3×–2.3×`" and "unbounded `C(n,2)` measured
  12.5× / 13.1× at 10 / 15 tasks", citing a §8.6 that holds neither.
- `zenith-energy.ts`, on the constant itself — "costs 13× at 15 tasks (measured
  2026-08-13, MATH.md §8.6)". A single absolute ratio, quoted against the
  deleted source's own instruction: _"neither a millisecond figure nor any
  single ratio here is the number — quote the range."_
- `zenith-energy.ts` on `suggestBudgetCurve` and MATH.md §8.12, both pricing
  their 16 solves "by §8.6's table".
- `plan-advice.probe.ts`, quoting §8.6's "machine A is ~2× machine B" as the
  reason it prints its box.
- `energy-search-gap.probe.ts`, on §8.6's "frequency numbers" and its "one
  legacy objective pair" — the latter deleted on 2026-08-24.

`scripts/math-citations.mjs` sees none of this: every one of those `§8.6`
citations resolves, because §8.6 still exists. What moved was its contents.

## What was decided about the blocker

**The surface was already there.** `OptimizeOptions` carries `stepHours` and
`maxIterations`, and **no product caller sets either** — both are read only by
`zenith-energy.test.ts` and three probes. A third optional field on an
instrument-only bag is not the same cost as opening a shipped module, so
`pairSeedTasks` was added and threaded to `buildSeeds`; `0` removes the family
and `n` unbounds it. Nothing else sets it, and `zenith-energy.test.ts` pins that
`pairSeedTasks: 0` fails to reach the 2-of-4 witness optimum the family exists
to reach.

## What was measured

Two arms on `energy-search-gap.probe.ts`, on one box, printed with it. Both are
objective or wall-clock readings of the **same** search on the **same** lattice
— the arms differ in seeds alone.

**Cost.** The pair seeds run 1.28×–2.40× the search without them, and unbounded
`C(n,2)` runs 1.00× the capped search at 3 tasks (where every pair _is_ a
top-three pair) rising to 13.84× at 15 — 4147 ms against 300 ms, on a path
`EnergyLabStore`'s `$derived`, `plan-audit.ts` and `suggestBudgetCurve`'s
16-solve sweep all take. The ratio is composition-dependent and cost is not
monotone in n, which is what the old prose said and the new run reproduces:
the range is the result, no single cell is.

**What the cap forfeits**, over 400 seeded days at 3–8 tasks: the family beats
no pairs on 4 days, worst 0.395580 objective; unbounded `C(n,2)` beats the cap
on 2, worst 0.208672. That second number is new, and it is not zero — the
deleted prose asserted three tasks were "enough for both witnesses" and had
measured nothing wider.

## What was deliberately not done

- **Moving `PAIR_SEED_TASKS` from 3 to 4.** Both forfeited days are reached by a
  cap of four, at `C(4,2)` = 6 pair seeds instead of 3. That is a change to
  every plan the app proposes and to a hot path's cost, weighed against 2 days
  in 400 — a plan decision, not a provenance one, so it is **raised as M54**
  with the instrument that would settle it now committed. The mirror direction
  is already on record: 3 → 2 costs 0.038620 objective over 60 days
  ([`six-constants-the-suite-could-not-see-move`](six-constants-the-suite-could-not-see-move.md)).
- **Restoring any figure to MATH.md.** R7 is why the tables went. §8.6 keeps the
  design reason — a pair seed starts fragmented and climbs long, so the cap is
  stated in seeds rather than in a task threshold — and now names the probe
  that prices it, the way §8.11 already names `stop-advisor.probe.ts`.
- **A checker for this failure mode.** `math-citations.mjs` verifies that a
  `§N` resolves to a heading, not that the heading still says what the citing
  line claims. Every site above passed it. Naming this is the third time in
  three commits ([`the-third-site-deleted-with-its-section`](the-third-site-deleted-with-its-section.md),
  [`the-rule-that-outlived-its-document`](the-rule-that-outlived-its-document.md)).

## Where it landed

- `src/lib/business/model/zenith-energy.ts` — `OptimizeOptions.pairSeedTasks`,
  threaded through `optimizeSchedule` to `buildSeeds`; the 13× and the two
  "§8.6's table" prices replaced by the probe.
- `scripts/energy-search-gap.probe.ts` — the cost and forfeit arms, and their
  figures in the header.
- `src/lib/business/model/AGENTS.md`, `MATH.md` §8.6 and §8.12,
  `scripts/plan-advice.probe.ts` — the six dangling quotes.
- `src/lib/business/model/zenith-energy.test.ts` — the `pairSeedTasks: 0`
  fixture.
- `scripts/PROBES.md` — the widened registry row.
