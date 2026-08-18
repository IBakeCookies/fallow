# What the retracted step still said

**Status:** landed 2026-08-18 · **Roadmap:** closes nothing — advances M17
(two of three sites) and files M37

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

§13 holds two figures about the stopping fit that no instrument prints. One is
a size claim §13.6 attributed to §8.10 and got backwards; the other is a bare
comparand inside §13.4's own retraction — a retraction that left an unbacked
number standing in the sentence that retracts an unbacked number.

The sweep drift and the audit lead land as one commit because they are the same
section, and because either one alone moves the other's line numbers.

## Scenarios

- **§13.6, the sweep size.** "a 12× V_T sweep moved the optimal stop by only two
  lattice levels" → **three distinct levels** at 12 h / λ₀ 0.9 (9 / 8.25 / 7.5 h,
  a 2-step span) and a **three-step** move at 8 h / λ₀ 1.3 (2.25 h → 4.5 h).
  Re-run today from `scripts/stp-stopping-identifiability.probe.ts`; the
  paragraph carries that date and that probe itself rather than leaning on
  §8.10's citation.
- **§13.4, the bare 0.067.** The retraction compared the fixture's 0.005 gap
  against "the 0.067 the quoted pair implied". Restated as arithmetic on the
  pair already in the sentence — 0.65 − 0.37 = 0.28 on one bracket endpoint,
  0.14 on the midpoint — with a note that the 0.067 itself traces to nothing.
  The retraction is otherwise untouched.
- **`growBy`'s docblock** (`zenith-energy.ts`) loses the retracted 0.65/0.37
  pair and keeps the mechanism plus its `(MATH.md §13.4)` citation.

## Out of scope

- **§8.10, entirely.** Its reconstruction figures are held under a separate
  maintainer ruling, and its feasibility-2 paragraph — which states both the
  "one or two 45-min lattice levels in 7 of 8" reading and, as live fact, the
  0.65/0.37 pair §13.4 retracts — is held with it. That is why M17 does not
  close and why §13.6 does not re-attribute its new figure to §8.10.
- **The Energy Lab's missing date filter.** Filed as M37, not fixed: it is a
  behaviour ruling, and this commit edits documentation.

## Read before building

- [MATH.md §13.4, §13.6](../../MATH.md)
- [AGENTS.md](../../AGENTS.md) — the archaeology rule at `:60`, which is why the
  docblock drops the pair instead of replacing it.

## Decisions

- **Drop-and-cite, not substitute.** M17 prescribed replacing the retracted pair
  in `growBy` with 0.8894/0.8840 from `rv13-stop-insertion.probe.ts`. Declined:
  those are whole-day indifference midpoints on one fixture day, not a step
  marginal, so substituting them would put a second wrong number where the first
  one was. The whole clause is archaeology under AGENTS.md — the docblock says
  why the code inserts at rank, and §13.4 holds the measurement.
- **§13.6 carries its own date and probe.** The old text cited §8.10 for a
  figure §8.10 does not state. Rather than re-pointing the citation at a frozen
  paragraph, the corrected sentence names the probe and the run date directly,
  and quotes §8.10's sibling reading as what it actually is: a count of how many
  cells barely move, not the size of the move in the ones that do.
- **Restate, do not delete, the 0.067 comparison.** Deleting it would lose the
  reason the retraction is a retraction. The arithmetic version is checkable
  from the two numbers already in the sentence and introduces no third figure.

## What execution turned up

- **§13.6 was already wrong against §8.10's own 2026-08-06 text, before the
  solver moved.** §8.10 feasibility 2 has said "it can move the stop by 3 steps
  (2.25 h → 4.5 h at an 8 h window, λ₀ = 1.3) and through three levels
  non-monotonically (12 h, λ₀ = 0.9)" since 2026-08-06. §13.6 cited that
  sentence and reported the opposite. So this is §13 hygiene, not sweep drift —
  the probe re-run confirmed the correction but did not cause it.
- **The "7 of 8" still reproduces.** Today's run: one distinct level at 8 h /
  λ₀ 0.3, 0.5 and 0.9 and at 12 h / λ₀ 1.3; two at 8 h / λ₀ 1.3 and 12 h /
  λ₀ 0.3 and 0.5; three at 12 h / λ₀ 0.9. Seven of eight cells at one or two
  levels, as §8.10 says. Nothing in §8.10's wording needed to move for §13.6 to
  be corrected, which is what made the hold survivable.
- **One half of §8.10's pair no longer reproduces, and it is not this commit's.**
  At 12 h / λ₀ 0.9 the sweep now walks 9 / 8.25 / 7.5 monotonically; "through
  three levels **non-monotonically**" was true pre-2026-08-13. Recorded here and
  left in place — it sits inside the held paragraph.
- **M17 cannot close, and its prescription was wrong twice over.** Both of its
  citations are stale (`zenith-energy.ts:2028-2029` → `:2031-2032`;
  `MATH.md:3319-3325` no longer reaches the retraction), and its fix —
  0.8894/0.8840 — is the wrong kind of number. The row stays in "Raised and not
  verified" with a dated note saying which two sites are fixed and why the third
  is held.
- **The 0.067 traces to nothing, and to a commit that should have caught it.**
  `git log -S"0.067" -- MATH.md` returns exactly one commit: `c5f4ef1`,
  **"Fix/unbacked math claims"**. It appears in no probe, fixture or test. A
  sweep for unbacked claims introduced one, inside the sentence retracting
  another — which is the strongest argument in either audit round that a
  human-run sweep is not a substitute for a gate.

## Open questions

- **Nothing pairs a MATH.md numeral with the probe that prints it.** `npm run
lint` runs math-index, probe-registry, brief-size and comment-density; none
  compares a quoted figure to a printed one. §13.6 held a figure contradicting
  its own cited section for twelve days of green builds.
- **M37 needs a ruling, not an edit.** Is the Energy Lab "a plan for day D"
  under §33, or a calibration surface that should see today's logs the moment
  they land? λ₀ already answers one way and α and r the other, in the same
  store.
