# The witness that outlived its section

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** finding M35

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M35 — §8.12 stated the advisor/curve agreement witness without the constants
it was run at.** One task at P0/M8/E9, a 6 h window and λ₀ = 1.2, the curve
recommending 3 h and the advisor flipping to stop at 3 h logged — quoted as a
measured fact in prose, with `alphaCog: 0.25, alphaPhys: 0.35, recoveryRate: 1`
left in the probe where a reader of §8.12 would not meet them. A skeptic had
already refuted the entry's drift framing: the numbers reproduced then, and they
reproduce now.

**The section no longer states the witness.** The 2026-08-25 cut that took
MATH.md from 9,482 lines to its math (`e61d207`) deleted the measured sentence
along with every other measurement, on the rule that a number lives in the probe
that produced it. What §8.12 keeps is the derivation — that the agreement is not
forced by construction, but bought by §8.11's λ₀ break-even and §8.12's zero
break-even being net of the same λ₀ — which quotes nothing and needs no
constants. Grepping the witness's own figures across `MATH.md` returns nothing.

So the defect closed as a side effect of a change made for another reason, and
the only thing left to do was to check that the witness had landed somewhere it
could be read with its constants.

## Where the constants had to be said instead

`scripts/advisor-curve-agreement.probe.ts` spreads `DEFAULT_ENERGY_PARAMS` and
then overrides seven fields, so its constants were on the page but not
_declared_: nothing said they were off-default, and its `PARAMS` comment — "the
Model Parameters panel exactly as reported" — reads as provenance for the day,
not as a warning about the defaults. That is the same gap M44 closed for
`energy-search-gap.probe.ts`, whose "DELIBERATELY NOT realigned onto the sliders
… here that is the point" paragraph is the pattern. The docblock now names the
three constants that differ, the defaults they differ from, and why re-running
at the defaults would answer a different question.

## The witness, re-run

Run on 2026-08-27, and it holds on both halves:

- the curve recommends **3 h** — `valuePerHour` 0.2759 at b = 1.50 and 2.25,
  0.2518 at 3.00, then 0.0000 at every budget from 3.75 h to the 12 h cap;
- the advisor flips there — continue at 2.25 h logged (next session 0.75 h at
  **1.4495/h**), stop at 3.00 h logged (**1.1615/h**), against λ₀ = 1.2.

Read from the run, not carried over: these are the same numbers the deleted
sentence carried, which is why nothing about the finding was in dispute except
where its constants were written down.

## What was deliberately not done

- **No MATH.md change.** The witness is gone from it and the derivation that
  replaced it quotes no figure. Re-introducing the numbers _with_ their
  constants would undo the 2026-08-25 cut one paragraph at a time.
- **No re-run at the defaults.** The day is a reported day; scoring it at
  `0.35/0.3/0.7` would be a new witness for a question nobody asked, and the
  probe now says so rather than leaving the option open.
- **M35's `MATH.md:2173-2177` address was left as it stands.** It predates the
  2026-08-25 cut, `scripts/math-citations.mjs` exempts `ROADMAP.md` by name
  because a section it cites is a fact about its date, and ROADMAP's own
  preamble rules the sweep out. The entry was re-located by content.

## Where it landed

- [`scripts/advisor-curve-agreement.probe.ts`](../../scripts/advisor-curve-agreement.probe.ts)
  — the `PARAMS` declaration.
- [ROADMAP.md](../../ROADMAP.md) — M35 closed.
