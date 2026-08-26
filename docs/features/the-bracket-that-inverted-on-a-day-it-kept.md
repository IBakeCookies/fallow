# The bracket that inverted on a day it kept

**Kind:** audit · **Status:** landed 2026-08-19 · **Roadmap:** item 31, finding M38

Backfilled 2026-08-21 from ROADMAP.md's M38 entry, whose text was written at land, and
moved here verbatim so the roadmap can hold a line and a link. Not a
pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M38 §8.10** — the reconstruction's bracket inverts on a day it then keeps,
and the docblock's tolerance is the casualty. At true λ₀ = 0.9 over a 12 h
window `stp-stopping-identifiability.probe.ts` reads `lo` 0.7001 above `hi`
0.6637, so the bracket excludes truth by 0.236 and its midpoint enters the fit
0.218 low — against the "midpoints track it within ~0.13" that
`zenith-energy.ts:1905-1906` states as the reconstruction's contract. The day
is **not** censored: the inversion gap is 0.036, inside
`STOP_INVERSION_MARGIN` = 0.25, so it is kept as a biased point estimate
rather than dropped. The same cell kills the other half of §8.10's
feasibility-2 paragraph — the V_T sweep at (12 h, λ₀ = 0.9) walks 9 / 8.25 /
7.5, monotone non-increasing over a span of 2 steps, where the paragraph says
"through three levels non-monotonically". Awaiting a ruling and **held out of
the round's edits on purpose**: whether the margin should censor an inversion
this size, or the contract should be restated, is a code question, and
"correcting" ~0.13 to 0.218 in the document would write the defect down as the
design. Unlike M14–M36, this one was **found by measurement** — the probe was
run, not read — so the "nothing below was executed" note above does not cover
it.

**Measured twice since, independently, and both times "shipped defect"
(2026-08-19). Every figure below is scratch — no committed instrument
reproduces any of them, so item 29's rule still applies:**

- **The published cell is not app-reachable, so the witness above is a grid
  artifact.** Its t2 (mental 4, physical 3) declares difficulty 6 where
  `toEnergyTask` gives 4.90, and t3 needs a physical slider of 0.5. Legalising
  the same demands removes the inversion entirely: 12 h reads 1.017, inside
  tolerance.
- **The phenomenon is reachable.** A fully app-legal witness, built through the
  app's own mappers and the app's own optimizer plan — tasks {mental 8,
  physical 3, enjoyment 8} and {mental 0, physical 3, enjoyment 2}, 14 h
  window, true λ₀ 0.7, plan t1 7.5 h — reads 0.407 with `lo` 0.469 above `hi`
  0.345, gap 0.124, inverted and KEPT, error −0.293. Three more witnesses at
  −0.322, −0.141, −0.210.
- **The mechanism is BREAK OMISSION, not the canonical reorder.** Re-bracketing
  on the real block order barely moves the error (mean |err| 0.108 against
  0.104 canonical), while keeping the breaks fixes every witness. 48.3% of the
  app's own plans carry an interior rest break, and |err| > 0.13 on 42.3% of
  those against 3.8% of break-free plans. §8.10's "absorbed as noise" is the
  sentence that does not survive, and the bias is one-signed — the fit reads
  LOW.
- **The real failure is CONTAINMENT, not inversion.** The bracket excludes the
  true λ₀ on roughly a third of app-legal days (34.2% of 427 in one arm, 32–49%
  across arms), p90 0.251, max 0.470 — and no censor flags any of them. That is
  the first half of the same `zenith-energy.ts:1905-1906` sentence, not the
  tolerance half. The 9-cell grid was too SMALL, not only off-surface.
- **The margin cannot be the fix.** The documented gap sits 6.9× inside it,
  halving it to 0.1 still keeps both witnesses, and raising it censors more days
  while §8.10's own margin sweep says censoring buys the fit nothing.
- **What the error costs.** A −0.2 λ₀ error moves the plan's worked hours on
  64.4% of plans (mean 2.48 lattice steps) and flips the live advisor's verdict
  on 77.1% of days; a repeating-day user at true 0.7 fits 0.414 ± 0.035, so the
  posterior std printed beside it understates the error 8×. The population mean
  signed error nearly cancels (+0.020 / −0.006), which is why a mean-based check
  would have closed this wrongly.

The V_T half of this entry is superseded by M41, which measures the same claim
over app-legal days.

**CLOSED 2026-08-19 — the ruling was "keep the breaks in the reconstruction,
fix the cause" and it shipped** (MATH.md §8.10, §8.11, §18 and §10's
2026-08-19 entry). `readFinishedDays` stopped summing the 🪫 rows by
`(date, taskId)`, so each row's own `createdAt` reaches the estimator and the
breaks between sessions are read rather than discarded; a day with no usable
moment, or one logged in a single batch, falls back bit-identically to the old
reading. Measured through the shipped function over 436 optimizer-funded days
drawn from integer sliders **at λ₀ {0.5, 0.7, 0.9, 1.1}**: |err| mean
0.106 → 0.065, past the bracket half-width 28.3% → 7.9%, the witness
−0.293 → +0.030 with its bracket un-inverted, a repeating-day user
0.415 → 0.709. That grid is the scope, and it was the narrow half of the Lab's
own λ₀ range: widened to 0.1 … 1.1 on 2026-08-19 the same probe reads
0.123 → 0.086 and 35.1% → 16.3% over 676 cells, with the residual concentrated
at the low end (MATH.md §8.10, and M42 for what is left of it). The margin was
NOT touched and no day was censored to achieve it. Two of this entry's own figures are
superseded by the committed instrument: 48.3% of plans carrying a break reads
63.5% on the slider-drawn population, and "the fit reads LOW" is now +0.032
signed rather than negative.
