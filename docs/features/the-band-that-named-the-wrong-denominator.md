# The band that named the wrong denominator

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings M64–M70

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

Nothing the user sees moves here. Three things that were written down about the
pair-seed cap disagreed with the runs behind them: a live rules file priced the
unbounded family against a search that stopped shipping in the same commit that
renamed it, the two bands the wall-clock rule landed with did not survive a
re-run of their own arm, and the generators whose days those numbers come from
never said they were off the slider surface.

## The denominator

`8ac490c` moved `PAIR_SEED_TASKS` from 3 to 4 and rewrote the rules file around
the new constant: "the three highest-amplitude tasks (`C(3,2)`) — unbounded
`C(n,2)` runs up to 13.8× the CAPPED search" became "the four highest-amplitude
tasks (`C(4,2)`) — unbounded `C(n,2)` runs up to 14.4× the FOUR-TASK search".
The constant in the sentence moved. The arm the figure came from did not: the
cost row printed `full.median / capped.median` with `capped = solve(day, 3)`,
and the label in the same template string said `x cap 3`. `7c6ab95` then turned
14.4× into a band and carried the renamed denominator inside it.

**Against the four-task search that does ship, the ratio at 15 tasks is
8.7×–11.6×, not 14×–15×.** The cap-4 column sits between the two denominators
and is itself worth 1.2×–1.7×, which is the whole of the difference.

Nothing could catch it from the output, because every ratio in the row had one
denominator and it was the cap that had stopped shipping. So the row now prints
both, shipped cap first, and the rules file keeps its directive without the
digits — a measured figure belongs in the probe that can re-derive it
(`docs/testing.md`, "Writing a probe").

The directive survives the correction with room to spare. At 15 tasks the
unbounded family costs 4.4–4.8 s against the shipped search's 0.39–0.42 s on the
seeded day, and the 400-day forfeit arm still finds nothing `C(n,2)` reaches
that a cap of 4 does not. What the wrong denominator cost was not the decision;
it was the reader's ability to check the sentence against the instrument.

## What was measured

Four runs of the cost arm on one box (AMD Ryzen 7 7800X3D, 4 cores, node
v22.14.0), each started only with no other node process running. That condition
is not a formality: three earlier attempts overlapped another session's probe
runs, and in them two arms that are bit-identically the same search read
**2.84×** against each other. Those runs were discarded rather than averaged in.

**`C(n,2)` at 15 tasks**, the cell the rules file's sentence rests on:

| run | ladder ÷ cap 4 | ladder ÷ cap 3 | seeded ÷ cap 4 | seeded ÷ cap 3 |
| --- | -------------- | -------------- | -------------- | -------------- |
| 1   | 10.89×         | 14.27×         | 10.78×         | 13.98×         |
| 2   | 10.59×         | 14.09×         | 11.00×         | 13.96×         |
| 3   | 8.65×          | 13.71×         | 11.47×         | 14.33×         |
| 4   | 10.07×         | 13.84×         | 11.55×         | 14.55×         |

15× was never observed. 14× fails at the low end in four of the eight cap-3
cells. The 8.65× is one cell whose denominator read ±18% within its own five
reps, which is what a band is for — and the fourth run, taken after the header
was written to three, widened both ends by 0.1×, which is the same lesson a
second time.

**The noise floor.** At 3 tasks all three capped arms are one search
(`min(3, 3) = min(3, 4) = 3` pair tasks), and at 4 tasks `C(4,2)` IS the cap of
4 — so eight cells per run time identical work. They read **0.92×–1.16×** over
32 cells. The floor the previous commit quoted, `0.98×–1.01×`, was the cap-4 cell
at 3 tasks alone.

**The cap that ships.** Cap 4 against cap 3 over the sizes where they differ:
1.28–1.62, 1.27–1.60, 1.23–1.68, 1.26–1.58 — roughly **1.2×–1.7×**, where the
earlier three runs of the same arm read roughly 1.2×–1.6×.

**The absolute-ms arm**, run once against the edited file: the Lab's one solve
reads a median of 58.5 ms at cap 3 and 87.5 at cap 4, against ~55 and ~82 from
the three runs before it, so those figures are bands now too.

**The conclusion against the whole band.** The cap-4 decision does not move
anywhere inside any of these: a cap of 4 costs a fraction of one solve at every
reading in the table, against an order of magnitude for the unbounded family,
and the absolute-ms arm is unchanged. More reps would buy a rounder number, not
a different answer.

## The generators that never said what they were

M50's sweep set eight call sites aside as "built from loop variables and not
statically decidable" and closed. Two of them are this repo's signature fault,
and a site it did not set aside was decidable by inspection:

- **`energy-search-gap.probe.ts`'s `randomDays`** draws `difficulty` and the two
  demands independently, which is exactly what M40 and M49 chased. It is the
  file's only generator, and it feeds every population the branch quotes: 48 of
  2,210 tasks reachable on the 400-day forfeit/gain sweep, 266 of 10,990 (2.4%)
  across five seeds, 4 of 350 on the `[app]` arm, 0 of 58 in the cost cells. The
  miss is two-sided — 7,636 of the five-seed tasks sit below the difficulty
  their demands force and 3,088 above. The file's one surface declaration
  covered the hand-built `PROBE_DAY` next to it.
- **`sat-gate-floor.probe.ts`** carried no surface declaration anywhere. Its
  named day is on the surface — boxing 10 at 0.2/1.0, guitar 6 at 0.6/0,
  reading 4 at 0.4/0 each derive the difficulty they are stated at — and the arm
  around it leaves the surface twice: the demand sweep steps 0.05, half a slider
  notch, because §8.5's claim is a plan cliff from a 5% demand change; and its
  20 generated days draw difficulty independently, leaving 1 of their 20
  full-demand tasks reachable.
- **`enb-break-economics.probe.ts`'s chunk table** is a six-row literal fed to a
  `task()` factory — decidable without running anything, and all six rows are
  off the surface: five below the 10 that demand 0.8–1.0 forces, `[10, 10, 0.2]`
  above the 2.6 its own demand derives. That is the point of the arm, whose peak
  is claimed at full demand and low difficulty, the corner the coupling forbids.
  It was never said.

Two declarations gave a wrong reason, and one comment asserted the opposite of
what its fixture is:

- **`energy-search-gap.probe.ts`'s `PROBE_DAY`** blamed the demands. Guitar's
  0.4/0.3 are reachable demands (sliders 4/3); what is unreachable is its
  difficulty 6 against the 4.9 they derive. Reading's 0.05 has no slider, and
  that half was right.
- **`rv13-terminal-timing.probe.ts`** said a matched pure-cognitive /
  pure-physical pair is "unreachable by construction". It is reachable: sliders
  8/0 and 0/8 derive difficulty 8 at demands 0.8/0 and 0/0.8, and 10/0 and 0/10
  derive 10 at 1/0 and 0/1. The obstruction is the FULL demand — 1.0 forces
  slider 10, which forces difficulty 10 — so what the sliders refuse is
  difficulty 8 together with demand 1.0. The declaration stays; its reason is
  now the true one.
- **`zenith-energy.test.ts`'s cap-4 fixture** says its day was "realigned onto
  the sliders". None of its four tasks is one `toEnergyTask` could produce (two
  below the difficulty their demands force, two above), and the only alignment
  performed was rounding 0.30000000000000004 to 0.3.

## What M50 did not establish

`the-tenth-copy-of-a-day-declared-once` closed on "read against that rule the
repo is nearly clean, and the search's value is the two places it is not". That
was not established, and the eight set-aside sites are why: at least two of them
are the fault the sweep exists to find, one of the two in the file whose
populations decided `PAIR_SEED_TASKS` and whose ratios the model rules file
carries. M84, on the same branch, makes it three. The residue was not a set of
hard cases — it was the part of the search that had not been done. That spec is frozen at land, so this is where it
is recorded.

## What was decided

- **Both denominators print, shipped cap first.** One denominator in the output
  is what let a rename pass two commits of review.
- **A band comes from four runs on an idle box**, and a contended run is
  discarded, not averaged. Its own same-search cells are how it is caught.
- **The noise floor is read off every cell that times identical work**, not off
  one of them.
- **The rules file keeps "do not unbound it" and drops the digits.**
- **The generators declare, they do not realign.** Every figure read off them is
  a difference between two solves of one day, and coverage of the (task count,
  window, composition) space is what the cap decision needs from them.

## What was deliberately not done

- **No surface-restricted gain arm.** The cap-4 step was re-checked on
  slider-surface days while closing this finding — 5 gain days in 2000, all five
  changing the funded set, zero churn — so the constant does not rest on the
  off-surface share. A surface-only generator answers a different question at
  the same cost, and the sweep's job is coverage.
- **The suite fixture was not redrawn onto the sliders.** Its identity is that
  it IS the day the five-seed sweep found; a realigned copy pins a day nothing
  found. Its comment says which extreme it is instead.
- **The `[app]` one-solve rows were not given a ±.** That cell is already a
  distribution over 60 days and prints its percentiles; the header states the
  exemption rather than claiming every cell prints a half-range.
- **The desk and errand portfolios in `enb-break-economics.probe.ts` were not
  realigned.** They sit one spillover step below the difficulty their demands
  derive and now say so; moving them would move the shipped-default hours that
  arm exists to report, which is M46's record and not this repair's.
- **No lint check for reachability.** M50's reason holds: the rule turns on
  whether a number is quoted, which no checker can see.
- **The absolute-ms figures were not re-read three times.** One verification run
  of the edited file moved them enough to state as bands, and no finding claimed
  more than that; three runs of a 90-second arm nobody disputes is a measurement
  for the change that disputes it.

## Where it landed

- `scripts/energy-search-gap.probe.ts` — the `C(n,2)` cell prints both
  denominators; the header's `C(n,2)` band, noise floor, cap-4 envelopes and
  absolute-ms medians re-read on idle runs; the `[app]` exemption stated;
  `randomDays` declared; `PROBE_DAY`'s reason corrected; the half-range and
  `seedCount` docblocks cut back to what the code does
- `scripts/sat-gate-floor.probe.ts` — the sweep's surface declaration
- `scripts/enb-break-economics.probe.ts` — the header's surface declaration
- `scripts/rv13-terminal-timing.probe.ts` — the declaration's reason
- `src/lib/business/model/AGENTS.md` — the `C(n,2)` sentence
- MATH.md §8.6 — "6 seeds at every size", which is 3 seeds at three tasks and 0
  below
- `src/lib/business/model/zenith-energy.test.ts` — the cap-4 fixture's comment
