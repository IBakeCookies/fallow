# The satiety price on the sliders

**Kind:** audit · **Status:** landed 2026-08-25 · **Roadmap:** finding M40 (fifth of five, CLOSED)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M40's fifth and last generator — FIXED 2026-08-25. `satiety-gaming.probe.ts`
built its tasks with `difficulty = Math.max(mental, physical)`, skipping the 0.3
spillover the app applies, so no day it generated was one a user could have
declared.** The fix is the recipe the four earlier generators took: `drawTask`
draws integer sliders — difficulty in [0, 10], enjoyment in [1, 10] — and returns
`toEnergyTask(task)`. Eleven lines, no shipped code touched.

**`grep 'difficulty: Math.max' scripts/` is now empty, which is the close
condition M40 carried since it was raised.** The entry named three generators;
there were five, each found by the fix before it, because the same eleven lines
had been copied from probe to probe.

A baseline run before the fix reproduced every committed §8.4 figure exactly —
`8.882e-15`, `1.96`/`82.3%`, `2.38`/`98.4%`/`−0.226%`/`−3.015%`,
`2.42`/`96.0%`/`−0.599%`/`−2.405%` — so the section was current and every
difference below is attributable to the surface change and nothing else.

## What moved in §8.4

**Arm A did not, because it is an identity.** The replica that reads only
per-task output totals reproduces the shipped `satiatedOutput` to
**1.07·10⁻¹⁴**, where it read 8.9·10⁻¹⁵. Over the same 300 random schedules,
297 of which split a task across a gap. This is the arm carrying §8.4's one hard
design constraint — satiety cannot see session count or gap length — and it was
never at risk: the claim is structural and holds for any task, reachable or not.
Keeping the two arms apart is what made that predictable in advance rather than
discovered afterwards.

**Arm B moved everywhere.** Argmax under three accumulators over every one of
6561 lattice plans, 24 days × 2 tasks:

| accumulator             | off-surface (2026-08-06)     | on-surface (2026-08-25)      |
| ----------------------- | ---------------------------- | ---------------------------- |
| cumulative (shipped)    | 1.96 sessions/day, 82.3%     | 2.04 sessions/day, 78.1%     |
| session-keyed           | 2.38, 98.4%, −0.226%/−3.015% | 2.42, 96.4%, −1.710%/−2.980% |
| phase-decaying `e^−g/τ` | 2.42, 96.0%, −0.599%/−2.405% | 2.38, 94.0%, −1.341%/−2.415% |

(the two percentages are the mutant's plan scored under the satiety term Σ V(O)
alone, then under the full objective the optimizer actually maximizes.)

- **The headline held and the second figure did not.** The mutants still lose
  ~2–3% of the full objective, which is the number §8.4 leads with. On the
  satiety term alone they lose ~1.3–1.7%, where the section said ~0.2–0.6% — a
  band that never overlapped the old one. §8.4's summary sentence carried both
  and now carries the new second half.

- **One claim died: the two scales no longer reverse.** Off-surface, the satiety
  term made the phase-decaying rule the worse mutant (−0.599% against −0.226%)
  while the full objective made the session-keyed one worse (−3.015% against
  −2.405%), and §8.4 reported that reversal in its own words. On the app's
  surface both columns rank the session-keyed rule worse. The clause is deleted
  from §8.4 and from the probe's own in-body comment, which asserted it too, and
  the reversal is recorded as a property of the unreachable population. What
  survives is the reason it was quoted: the mutants work more hours for less
  value, so the leisure term widens both gaps — 1.710 → 2.980 and 1.341 → 2.415.

- **The corner the constraint exists to close reproduces, less extremely and by
  a wider margin.** The session-keyed argmax puts **96.4%** of worked hours on a
  single task, where it put 98.4% — but the shipped rule's own share fell 82.3%
  → **78.1%**, so the two moved apart. Both mutants still fragment more AND
  concentrate harder than the shipped rule, which is the entire qualitative
  reading and the thing a future editor is told they would be breaking.

**No verdict changed anywhere in M40's five fixes.** Every figure moved and no
decision did — including item 4's refusal, the one with a decision resting on the
off-surface run. Two prose claims died on the way, both of them properties of the
unreachable population rather than of the model: §8.10's endpoint contrast that
said wider censors fit better, and §8.4's reversal above.

## What M40 leaves behind

**A finding, not a fix: M48.** M40 was about generators that DREW unreachable
days. The residue is witnesses that are unreachable **on purpose**, where nothing
in the repo says when that is allowed. `enb-simpson-error.probe.ts:47`'s
`FAST_TASK` is the live instance and it carries quoted numbers — §8.1's five
quadrature-error figures are read off a task declaring `difficulty: 1` beside
demands `0.9/0.1`, where those sliders give 9.3. Unlike M40 its direction is
knowable: it is the ϕ-floor worst case for the 1024-node cap, so an unreachable
extreme makes the error bound conservative rather than wrong. It simply does not
say so, which is the gap M44 closed for `energy-search-gap.probe.ts`.

**The rule is the more valuable half, and it is not "everything must be
reachable".** A scan of `zenith-energy.test.ts` found 64 of its 70 `makeTask`
calls off the surface. That is not 64 defects: it is the suite's deliberate
convention that `difficulty` and the two demands are independent knobs of the
MODEL's input type, and that the app's projection onto it is `toEnergyTask`'s own
business, tested where `toEnergyTask` is tested. The line worth writing down is
nearer: reachability is required wherever a day's numbers are QUOTED, or where the
day witnesses app-level behaviour; it is optional, and sometimes the point, for
model-level property and bound tests, which must then declare themselves. M48
carries that.

## What was deliberately not done

- **The suite's 64 off-surface `makeTask` calls were not touched.** They assert
  properties and behaviour, not figures, and the convention behind them is
  defensible — see above. Rewriting them would be a large diff resting on a rule
  nobody has agreed to yet, which is backwards.

- **`FAST_TASK` was not fixed or declared here.** §8.1's five figures rest on it,
  so it is its own change with its own run and its own section re-read — the
  reason all five of M40's generators were separate commits. Whether an
  on-surface ϕ-floor witness even exists is an open question (it needs low
  difficulty AND low demands together), not a known substitution.

- **Arm A's suite fixture was left alone.** `zenith-energy.test.ts:598` pins arm
  A on `makeTask(1, 'deep', 8, 5, 0.9, 0.1)`, also off the surface. The
  assertion is that two κ recoveries agree, which is the identity itself; making
  the task reachable would narrow a universal claim to a special case and change
  nothing about whether it passes.

## Where it landed

- [`scripts/satiety-gaming.probe.ts`](../../scripts/satiety-gaming.probe.ts)
  — `drawTask`, the header docblock's 2026-08-25 entry, and the arm-B comment
  that asserted the reversal.
- [MATH.md](../../MATH.md) §8.4 — the priced block, its table and its summary
  sentence; §10 — the dated entry.
- [ROADMAP.md](../../ROADMAP.md) — M40 closed and collapsed onto the five feature
  records that carry its history; M48 raised.
