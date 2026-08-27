# The censor that does not run forward

**Kind:** model · **Status:** landed 2026-08-27 · **Roadmap:** finding M39

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## The question

§8.10's `stopBracket` refuses a finished day whose bracket inverts past
`STOP_INVERSION_MARGIN`: the user declined a step worth more than the best step
they actually worked, so no λ₀ rationalizes the stop and the day's indifference
point is contaminated evidence. §8.11's `adviseStop` reads the **same**
reconstruction, through the same shared `reconstructStopDay` and `growBy`, and
refuses nothing.

M39 raised that asymmetry in the 2026-08-14 audit and it stayed open through
M38, which fixed the bias the unguarded path was exposed to (the day's own
breaks) but left the censor question untouched. §8.11 stated the asymmetry as a
bare fact — "§8.10 censors a day whose bracket contradicts itself; the advisor
censors nothing" — with no argument and no measurement behind it.

## What was decided

**The advisor carries no censor, and now says why.** Two reasons, one
derivational and one measured.

**The censor's premise does not survive the change of direction.** Retrospectively
`lo > hi` is a contradiction because there _is_ a stop to rationalize and it
cannot be rationalized. Run forward there is no stop yet: the same inequality
says only that the best available next step beats the best step already logged
— the ordinary state of a day with good work left in it, and precisely the
condition under which `continue` is the right verdict. The inversion is not
evidence against the forward verdict; it is the forward verdict's own case.

**And the two readings differ in what refusal costs.** §8.10 censors to keep a
contaminated point out of a mean, and a mean over the remaining days is still an
estimate. The advisor produces a verdict for a person and has no mean to
protect, so withholding is not abstention — it is silence at the moment the card
exists for. A censor would have to buy a measured reduction in wrong verdicts to
be worth carrying.

It buys none. That argument is now in MATH.md §8.11 in place of the bare
sentence; the figures below live in the probe that produced them.

## What was measured

A third arm in `scripts/stop-advisor.probe.ts`, on the same optimizer ground
truth as the two settled ones: walk the plan for the day's λ₀ in 45-min steps,
and at every checkpoint the card speaks on, ask both whether `stopBracket` would
refuse the day and whether the advisor's verdict is right (truth says continue
while the plan has work, stop at its last step).

The refusal **reason** is derived rather than exported. `stopBracket` returns
one null for four causes and three are structural and computable from parts the
probe already replicates — the clock censor, no `lo` (no room to extend), no
`hi` (nothing worked a whole step yet, which is every day's first checkpoint).
What is left over is the inversion. All four are printed, because a censor the
advisor "also carries" cannot pick one of its function's refusals and ignore the
rest.

Its days are drawn from integer sliders through `toEnergyTask`: this is the arm
whose reading is about app-level behaviour — would the card go quiet on a real
user's day — and that is the reading `docs/testing.md` requires a reachable day
for. Needing that surface is what exposed M49, landed the same day, which put
the file's other two arms on it as well; the figures below are read at that
final level.

**Mid-day the censor is strictly harmful.** The inverted cell is 8.3–16.4% of
every checkpoint the card speaks on, and the advisor's false-stop count in it is
**zero at all four λ₀ on both populations** — 0 of 118, 110, 88 and 23
random-day checkpoints at λ₀ 0.3 / 0.5 / 0.9 / 1.3, and 0 of 16, 17, 27 and 16
on the warm-up-heavy fixture — against 8 of 1,811 and 4 of 587 everywhere else.
The censor therefore removes no wrong verdict and silences 339 + 76 correct
`continue`s. It fires exactly where the advisor never errs, which is what the
derivation predicts.

**At the stop moment the signal is real, tiny, and not fixed by censoring.**
Agreement on the inverted cell is 8/20 against 213/232 elsewhere, so an inverted
bracket at a rational stop does mark a checkpoint the advisor gets wrong most of
the time. But censoring converts 8 right and 12 wrong verdicts into 20 silences
without fixing the 12, and silence at the stop moment is the card's worst
failure. Recorded, not acted on — the same shape as §8.10's own finding that
censoring nothing wins both contaminated arms.

**Nothing shipped moved.** `adviseStop` is unchanged; its docblock now records
the decision and where it was measured.

## Pinned

One fixture in `zenith-energy.test.ts`, under the advisor's `describe`: a day
whose whole morning went to a weak errand while the good work sat unstarted —
sliders mental 1 / physical 0 / enjoyment 1 and mental 9 / physical 2 /
enjoyment 9 through `toEnergyTask`, 2.25 h logged in an 8 h window. `stopBracket`
returns null on it and `adviseStop` returns `continue` on the unstarted task
above λ₀. That is the asymmetry as a witness rather than as a claim.

## What was deliberately not done

- **The two settled arms were not re-decided here.** That `randomDays` and
  `WARMUP_HEAVY` were off the slider surface is a separate finding — M40's
  lesson was that fixing a generator re-decides everything read through it — so
  it was filed as M49 and landed as its own change on the same day, with its own
  re-reading of §8.11's table. This one only needed a reachable population for
  its own arm.
- **`STOP_INVERSION_MARGIN` did not move.** Its value was settled 2026-08-13 by
  ROADMAP item 28 and re-read 2026-08-25; M39 is about which reader consults it,
  not what it is.
- **The at-stop inverted cell was not acted on.** 17 checkpoints across four λ₀
  is a signal to record, not to ship a gate on, and the gate available (silence)
  does not address it.
- **No refusal-reason field was added to `stopBracket`.** Deriving the three
  structural causes in the probe costs nothing and needs no surface added to a
  shipped module for a probe's benefit.
