# The repairs that needed repairing

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings
M92–M98

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

M55–M91 repaired 37 defects a nine-reader review found in the twelve preceding
commits. AGENTS.md §3 requires a read-only reviewer over the working diff before
the work is reported done, and that pass found **seven more, all introduced by
the repairs themselves**. This is the sixth consecutive round on this subject in
which the repair round introduced a defect of its own, which is the pattern worth
recording as much as the seven.

Three of the seven are the same failure the round was fixing: a claim written one
level away from the thing that would falsify it. Two are arithmetic I got wrong.
Two are statements whose referent my own edit deleted.

## What was found

**M92 — two declarations claim a superset that is not one.** The reachability
repairs added, to `rv13-stop-insertion` and `stp-lattice`, that their generators
draw difficulty independently of the demands and are therefore "a strict superset
of the surface `getEffectiveDifficulty` admits" — and then inferred a bound from
it: "a superset's worst bounds the reachable worst", "an invariant that holds
over the superset holds over the surface".

Both generators draw difficulty as an **integer** (`1 + floor(rnd()*10)` and
`1 + round(random()*9)`). Enumerating all 121 slider pairs, the surface has **47
distinct difficulties and 37 of them are not integers** — sliders 9/1 give 9.3,
4/3 give 4.9, 2/2 give 2.6. So `(9.3, e, 0.9, 0.1)` is on the surface and in
neither population. The two are wider on one axis and coarser on another:
**incomparable, and no bound transfers in either direction.**

`stp-lattice`'s conclusion survives on other grounds — its arm pins an invariant
of `optimizeSchedule`'s move set that holds for any `EnergyTaskInput`, and
difficulty is not what the lattice reads. `rv13-stop-insertion`'s is the one that
leaned on the false inference, and its worst-case shift is the figure M17's
closed row quotes as "79% of `STOP_INVERSION_MARGIN`".

**M93 — an off-surface declaration with the direction wrong for one task.**
`enb-break-economics`' new declaration says `DEEP`, `FRAG` and the desk and
errand pairs "sit one spillover step below theirs". Five of the six do, all by
1.3. `errand` is `task(1, 'errand', 3, 5, 0.2, 0.2)`: demands 0.2/0.2 come from
sliders 2/2, which derive **2.6**, so at difficulty 3 it sits 0.4 **above**. The
declaration's own opening sentence already says "in both directions" about the
chunk table one paragraph up.

**M94 — a worked example mis-describing its own evidence.** The idle-box
paragraph added to `docs/testing.md` says three contended runs "put 2.84× on two
cells that are bit-identically the same search". The preserved logs carry exactly
one `2.84x`, and it is on the **cap-4-against-cap-3** cell — 25 seeds against 22,
which is the statistic the worked example is about, not two identical searches.
The cells that do time identical work in those runs read at worst 1.20×. The
point stands and is stronger stated correctly: 2.84× is outside the entire idle
band of 1.23–1.68, and that run printed ± up to 51% where an idle run reads 2%.

**M95 — a census wrong in two of its three cells.** M76 deleted the
`makeTask` count from `docs/testing.md` on the grounds that prose which cannot
re-run should not hold the figure, and recorded the measurement in
[`the-sites-the-sweeps-walked-past`](the-sites-the-sweeps-walked-past.md)
instead: "80 call sites: 72 off the surface, 7 reachable, 1 built from loop
variables". The file has **80 calls, all of them fully literal: 8 reachable, 72
off the surface, 0 non-literal.** The eighth reachable call is
`makeTask(2, 'the good work, unstarted', 9.6, 9, 0.9, 0.2)` — sliders 9/2 derive
exactly 9.6 — and my parser split arguments on commas, so the comma inside that
title turned a reachable call into an unparseable one. The dated file records the
count wrong, which was the whole point of moving it there.

`docs/testing.md`'s surviving replacement, "the majority of
`zenith-energy.test.ts`'s `makeTask` calls are", is true at 72 of 80 and
unaffected.

**M96 — the collapse deleted the only text a surviving rule referred to.**
`ROADMAP.md`'s findings preamble says "**Every `MATH.md:NNNN` below is as of the
date its entry carries and most have since drifted**, some by hundreds of lines."
At the parent commit the file held exactly one such citation below that
paragraph, inside the "The partition failed once" paragraph; M85's collapse
deleted it. `grep -c 'MATH\.md:[0-9]'` is 1 at the parent and **0** at HEAD. Same
shape as M75, which this branch fixed in `docs/testing.md` four commits earlier —
a present-tense rule about text that is gone.

**M97 — a reduction that describes a size the file never had.** M85's spec and
commit message say "1,016 lines → 811". The parent's `ROADMAP.md` is **1,015**
lines and the commit left it at **827**: the diffstat reconciles as
1015 − 217 + 29 = 827. 811 is the file's size after the twelve rows collapsed but
before the seventeen lines of M85–M90 rows the same commit added — an
intermediate state that was never committed. The reduction is 188 lines, not 205.

**M98 — an unscoped bound over the ϕ-floor regime, in the file M55 and M91
rewrote to stop exactly that.** `enb-simpson-error`'s new opening says composite
Simpson "holds a block's output to a relative error under 1.1e-6 out to a 9h
block; past there the cap thins the node density". Two errors in one sentence:
`FAST_TASK` reads **1.1107e-6** at 9 h, above the stated bound, and the cap
starts thinning the density at **6.4 h**, not 9 h — 9 h is where `FAST_TASK`
overtakes the reachable surface, a different boundary entirely. The sentence is
true scoped to the reachable surface, which line 39 says explicitly and the
opening did not.

## What was repaired

- **M92** — both declarations now state that the populations are incomparable and
  say what the reading is actually worth: `rv13-stop-insertion` reports the size
  and sign of an insertion-order error, a property of how blocks compose through
  the reservoirs rather than of any difficulty value; `stp-lattice` pins an
  invariant of the optimizer's move set, which needs a wide population and not a
  matching one.
- **M93** — "in both directions too", with the one task and its arithmetic named.
- **M94** — one run, the cell it was actually on, and the ± that gives it away.
- **M96** — the rule states that no such citation survives, and cites §0's ban.
- **M98** — the bound is scoped to the reachable tasks and the 6.4 h boundary is
  named separately from the 9 h one.

M95 and M97 are recorded here and not fixed: both live in
[`the-sites-the-sweeps-walked-past`](the-sites-the-sweeps-walked-past.md) and
[`the-rows-that-kept-their-figures`](the-rows-that-kept-their-figures.md), which
landed earlier the same day and are frozen. The corrected figures are above.

## What was deliberately not done

- **`rv13-stop-insertion`'s generator was not realigned onto the surface.**
  Realigning moves every figure the arm prints, including the 79% M17's closed
  row quotes as of its date. What changed is the claim, which now matches the
  population.
- **No probe was re-run for these five.** Every edit is a comment; the figures
  they describe were read in M55–M91 and are unchanged.
- **The three landed specs were not edited**, per the freeze rule this same
  program applied to twelve older ones.
- **The `2.84×` reading was not re-measured on a contended box.** Reproducing
  contention deliberately would measure this machine's scheduler, not the probe,
  and the point of the paragraph is to say do not do it at all.

## What this round is evidence for

The four repair agents each verified their own numbers against their own runs,
and the three arithmetic errors above still got through — M92's superset claim,
M93's direction and M95's census are all one enumeration away from being caught,
and none of the three was enumerated. The review pass that caught them enumerated
all 121 slider pairs and re-parsed all 80 call sites.

**A claim about a population is worth an enumeration, not an argument** — and
that is the same lesson as M48's, which is the finding this whole branch started
from.

## Where it landed

- `scripts/rv13-stop-insertion.probe.ts`, `scripts/stp-lattice.probe.ts` — M92
- `scripts/enb-break-economics.probe.ts` — M93
- `docs/testing.md` — M94
- `ROADMAP.md` — M96
- `scripts/enb-simpson-error.probe.ts` — M98
