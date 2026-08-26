# The hull held while the staircase moved

**Kind:** repair · **Status:** landed 2026-08-19 · **Roadmap:** closes nothing — a sweep finding
from the 2026-08-13 solver-drift re-run of the frozen probe set

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

§8.12 exists to argue one thing about `valuePerHour`: the raw step difference of
`dayValue` is a spike train and unfit to plot as a marginal, so the card plots
the slope of the concave majorant instead. The section states that argument as
two arms of one probe — a RAW arm that shows the spike train misbehaving and a
MAJORANT arm that shows the hull well-behaved.

The 2026-08-13 §8.6 solver fixes moved the RAW arm and left the MAJORANT arm
untouched. Three numerals go stale; the argument gets stronger. Land the three,
and record that the split between which figures moved and which did not is
itself the paragraph's thesis arriving from the other side.

No formula, constant, bound or fit moves. Nothing the user sees changes.

## Scenarios

Every figure below was re-run today. Nothing here is transcribed.

- **RAW arm, `scripts/curve-shape.probe.ts`** (~6 min). Days whose step
  difference returns above zero after touching it: **34 of 60 → 32 of 60**. Days
  with a recommendation whose first zero lands before it: **7 of the 8 → 8 of
  the 8** — `rawOffsets` is `{-6:2, -9:1, -4:2, -2:1, -13:1, -1:1}`, eight
  entries, every one negative, so the single exception the sentence carved out
  no longer exists.
- **The same paragraph's other three readings hold**: 0 of 60 fell
  monotonically, up to 11 zero-touches on one day, and the 1–13 step span
  (13 × 0.75 = 9¾ h) is exact. The prose around the two numerals is unchanged.
- **`objective` bullet, `scripts/budget-advisor.probe.ts`** (21 min measured,
  against the ~27 the plan quoted).
  Maximizing `objective` picks the top of the range on **99% → 100%** of days,
  exactly 120/120: the argmax reads 14.00 h at min, median and max alike.
- **The MAJORANT arm did not move**: 60/60 non-increasing, last positive step ==
  `recommendedHours` on 8/8, first zero at `recommendedHours + step` on all 8,
  telescoping error 1.78e-15 against the quoted 1.8e-15.
- **The λ₀ figures did not move either**: the no-work ladder (0/60 at λ₀ ≤ 0.75,
  9/60, 29/60, 57/60, 60/60), the e2e one-task day crossing 0.5 at 3 h with the
  knee at 8.25 h, and 13 of 16 points below the line on the two-task day.
- **Three code mirrors of the RAW figure**, not one. `zenith-energy.test.ts`
  (comment above the majorant test) and `zenith-energy.ts` (the `valuePerHour`
  docblock) both said 34; both now say 32.
- **The correction is dated and bracketed**, in the convention the round's
  earlier commits set: the 2026-08-08 readings kept beside the new ones with the
  bisect result, not overwritten.

## Out of scope

- **The `valueVsClassic` bullet above the `objective` one.** The landing plan
  said it had not been re-measured and to leave it. Running the probe re-measured
  it anyway, and it reproduces exactly — median 2.25 h (p10 1.50, p90 3.25, max
  5.25) at a median 59.22% of net value (p10 46.53, p90 67.63). Nothing to
  correct, so nothing was touched.
- **MATH.md §8.10's reconstruction.** A code question awaiting a ruling, not a
  documentation fix.
- **ROADMAP M33, M34 and M35.** Never measured — a classifier blocked that agent
  — so they stay in "Raised and not verified" exactly as they are. M34 is in
  this very section and this commit re-ran the probe it doubts; that still is
  not the check M34 asks for, and closing a lead on adjacent evidence is the
  failure this round exists to purge.
- **Sweeping M33–M35's `MATH.md:NNNN` citations.** All three are already ~110
  lines stale from commits earlier in this round, and this edit adds ~9 more.
  ROADMAP's own preamble rules the sweep out and says why: twenty re-guessed
  line numbers read as verified when only the quoted text is.

## Read before building

- `MATH.md` §8.12, "Why the marginal is a hull slope and not a step difference"
  and the "Two obvious objectives, both ill-posed" bullets.
- `scripts/curve-shape.probe.ts` (6 min) and `scripts/budget-advisor.probe.ts`
  (21 min) — the two instruments behind every figure here, both timed on this
  run.

## Decisions

- **`budget-advisor.probe.ts` was re-run rather than landed on one reading.**
  It is the only drifted figure in the whole sweep with no bisect behind it,
  precisely because it is the sweep's most expensive instrument, and that cost is
  why the sweep took one reading. One reading is how a wrong figure gets in; the fix for
  an expensive instrument is to pay for it once at the point of landing, not to
  lower the bar for it.
- **No bisect for the 99% → 100%.** Bisecting it means three more 21-minute
  runs. The two figures that were bisected already name the cause window, the
  `objective` argmax is a property of the same staircase, and the bullet's claim
  ("it rises with the window whatever the day contains") is strengthened, not
  threatened, by the count going to 120/120. The bisect would buy attribution,
  not confidence.
- **The bracketed history keeps both superseded readings in one bracket**, since
  they are one sentence and one cause window. §8.12 had no prior bracket of its
  own; the convention is borrowed from §13.1 and §14.1, which the round's
  earlier commits already extended to §15 and §30.
- **The re-measurement note states what held, not only what moved.** A dated
  note listing two corrections reads as "two things were wrong here". The point
  of this paragraph is the ratio — two RAW cells moved, every MAJORANT reading
  held — and a note that omits the denominator loses the finding.

## What execution turned up

- **The plan found two code mirrors short.** It named
  `zenith-energy.test.ts:2652-2653` as "the" mirror of the stale 34 and framed
  the lesson as "a comment is not a pin". True, and there were two comments, not
  one: `zenith-energy.ts:1181` carries the same "34 of 60 seeded days, up to 11
  times" in the `valuePerHour` docblock — the source file, above the field the
  whole section is about. A grep for the figure found it in three seconds; the
  audit that filed the finding had looked only where the test was. The lesson
  survives and gets sharper: when a doc figure moves, grep the figure across the
  repo, do not follow the citation you were handed.
- **The `objective` figure went to a clean 100%, not a rounded one.** The plan
  allowed for 99.5% presenting as 100%. It is exactly 120/120 — min, median and
  max of the argmax are all 14.00 h, so the distribution is a point mass and the
  old 99% was either a different draw or never measured. That is why the bullet
  now says "exactly 120/120" rather than a percentage: a percentage is what let
  a point mass read as a near-miss for ten days.
- **The RAW arm moved in the direction the paragraph argues, both times.** 32
  days still sawtooth, and the early-zero count went from 7 of 8 to 8 of 8 —
  the exception the sentence had to carve out is gone. A correction that
  weakens its own paragraph is worth pausing on; this one does the opposite,
  which is the cheapest available evidence that the two numerals are drift and
  not a defect.
- **`budget-advisor.probe.ts` cost 21 minutes to move one digit, and its arm 2
  has no home in MATH.md.** The whole knee-vs-λ₀ sweep it spends most of that
  time on is not quoted anywhere in §8.12 — those tables come from
  `budget-knee.probe.ts`, on a different grid. The registry row describes arm 1
  only. Not fixed here: it is a probe question, not a documentation one, and it
  wants a measurement of what arm 2 is for before anything is cut.

## Open questions

- **Nothing gates a probe's printed figures against the prose that quotes
  them.** Three figures in one section drifted the day the solver changed and
  survived six days of green builds — and the suite was green the whole time
  while a test file quoted one of them wrong, because it quoted it in a comment.
  This is the fourth finding in this round to ask for a figure-diffing gate over
  probe output.
- **What is arm 2 of `budget-advisor.probe.ts` backing?** Roughly half its
  twenty-one minutes go to a sweep no section cites, on a grid that deliberately
  differs from the probe that does back those tables. Either it has
  a claim to be pointed at or it is paying for itself in nothing.
