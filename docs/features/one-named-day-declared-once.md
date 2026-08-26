# One named day, declared once instead of ten times

**Kind:** audit · **Status:** landed 2026-08-21 · **Roadmap:** findings M44 and M41

Backfilled 2026-08-21 from ROADMAP.md's M44 and M41 entries, whose text was written at land, and
moved here verbatim so the roadmap can hold a line and a link. Not a
pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What was found, and what closed it

**M44 — CLOSED 2026-08-21. One named day was declared ten ways; it is now
declared once, and nine of the ten sites moved.** `zenith-energy.test.ts`
aligned its §8.10 fixture to the sliders on 2026-08-19 and left four other
copies of the pre-slider triple in the same file, plus six probe files holding
it by hand — `guitar 6, 9, 0.4, 0.3` pins sliders 4/3, which
`getEffectiveDifficulty` sends to 4.90 rather than the 6 declared, and
reading's 0.05 physical demand is a slider of 0.5. Difficulties held, secondary
demands moved: guitar 0.4/0.3 → 0.6/0 (sliders 6/0), reading 0.5/0.05 → 0.4/0
(sliders 4/0). The four suite copies are now ONE module-level `PROBE_DAY`,
which is the actual guard — there is no second place left to drift from.
**One site is deliberately held:** `energy-search-gap.probe.ts:112` keeps the
unreachable demands on purpose and now says so in its docblock, because it is
the historical day that broke the §8.6 search, and a realigned day would keep
the name and lose the question.
What the nine moves cost, by section:

- **§8.8** — the 8 h ratio 0.9831 → **0.9843**, 12 h 0.9936 → **0.9810**, worst
  0.9693 at 4 h unmoved; the enumerated optimum 10.7331 → **10.6274** with the
  search still exact on all 1 048 576 plans; timing 26.9 ms vs 500.7 ms. The
  documented **exception disappeared**: the probe day at 8 h funded 3 coarse
  against 2 fine, and now reads {1,2,3} both ways with no rest either side, so
  structure matches in **12 of 12** cells and the suite's funded-set assertion,
  which skipped the probe day because of the exception, now covers both days.
  A documented quirk of the model was a quirk of demands no user can enter.
- **§8.5** — the demand ladder wp 1.0 → 0.7 goes 3.75 → 4.50 → 5.25 h to
  **3.25 → 4.50 → 5.25 → 5.50**, still monotone, largest single step 0.50 h →
  **1.25 h**. Arms A/B/D are parameter identities and did not move.
- **§8.3/§8.4** — the graded W\*(λ₀) ladder 12/11.25/10.5/6/4.5/0 →
  **12/12/9.75/6/4.5/0**, same shape; the pre-fix-dynamics reading 12 h ≤ 0.5
  and 10.5 h from 0.8 → **12 h through λ₀ 1.2 and 9 h at 1.5**, still two-step,
  still no collapse; guitar's fragmentation trio 1.4511/1.1687/1.2750 →
  **1.3971/1.1475/1.2402**. **M46 survives untouched**: λ₀ 0.5 still plans
  11.25 h of 12, and the whole portfolio spread and λ₀ = 1 reprice re-read
  identically — only its flat step narrows from λ₀ 0.4–0.6 to **0.5–0.6**,
  because 0.4 now plans the full window.
- **§13.6** — the fixture day's shipped optimum 0.8391/0.8391 → **0.8408/0.8408**,
  still ending at the window edge so the two readings still coincide.
- **§8.10 and §13.6 — the one that was not a figure swap.** BOTH witnesses
  §8.10 cited for "V_T is not free" were artifacts of the unreachable demands:
  the 3-step move at 8 h / λ₀ 1.3 and the three-level walk at 12 h / λ₀ 0.9
  both vanish on the reachable day, where all 8 cells move at most **one**
  step. Rather than restate the conclusion on one day a third time, the probe
  gained a **300-seeded-day V_T sweep**: span median 1 step, **p90 2, worst 5**
  (a 4-task 11 h day at λ₀ 0.8 walking 10.5 → 6.75 h), **25 of 300 non-monotone**,
  236 of 300 at one or two levels, and V_T moves the stop at all on 150 of 300
  — an occurrence counter, so a small number cannot be read off an empty
  region. The conclusion is unchanged and now rests on a distribution instead
  of a witness, and one suite fixture pins the mechanism against literals.
  The lesson is the cheap one: four copies of a fixture in one file is not
  duplication, it is four figures that can disagree, and the disagreement is
  invisible to every gate the repo has.

## M41, made quotable by the same arm

**M41 §8.10 — CLOSED 2026-08-21, confirmed in shape by a committed
instrument.** The lead read 18 of 200 cells non-monotone with up to 5 levels
and a 4-step span from SCRATCH, so under item 29's rule it was unquotable. The
V_T arm added to `stp-stopping-identifiability.probe.ts` with M44 measures the
same question on committed ground and agrees in shape: over 300 seeded
slider-reachable days the span is a median 1 step, 2 at p90 and **5 at worst**,
with **25 of 300 non-monotone**. Those are this arm's numbers, not the lead's —
different generator and sweep, so they confirm the shape and replace the
figures rather than reproducing them. The §8.10 hold that kept this filed
lifted when M38 shipped, so both stale texts are fixed: §8.10 and §13.6 now
quote the sweep, and `fitStoppingValue`'s docblock no longer says stop times
carry "almost no signal" about V_T — the reason V_T stays user-owned is that it
is a preference the slider states, not that it is unidentifiable.
