# The refusal the replica mis-derived

**Kind:** repair · **Status:** landed 2026-08-27 · **Roadmap:** findings M59–M63

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## What disagreed with what

`stopBracket` returns one null for four causes and exports no reason, so M39's
censor arm derives which refusal a checkpoint hit. The derivation read the
wrong quantity, and its headline — "agreement on the inverted cell is 8/20
against 213/232" — is a reading of the **clock** censor. There are no inverted
brackets at a rational stop in either population: the cell is empty in all
eight rows.

Nothing the user sees changes. `adviseStop` is untouched, and the decision it
carries — no inversion censor, deliberately — survives the correction and gets
stronger: the one signal M39 recorded against it was never there.

## The mechanism (M59)

`stopBracket` tests `isClockCensored` first, and `isClockCensored` reads
`recoveredRest` — the breaks the day's own log moments recover, with **no** room
scaling. The replica read `loggedStructure`'s `restTotal` instead, and that
function returns null when the scaled rest rounds away:
`room = max(0, window − total − STEP)`, `scale = min(1, room / restTotal)`.

On a day whose worked hours plus one step exactly fill the window, `room` is 0,
so `scale` is 0, the replica returns null, the rest it reports is 0, and the
clock test `total + 0 + STEP > window + 1e-9` is strictly false. The no-hi test
missed as well, and the checkpoint fell through to the last branch — `inverted`.
The arm's own docblock stated the correct rule, "worked hours plus the UNCAPPED
recovered breaks", so the code disagreed with the comment beside it.

Twenty checkpoints hit that hole — 6, 10, 1 and 0 at λ₀ 0.3 / 0.5 / 0.9 / 1.3 on
the random days and 1, 1, 1 and 0 on the warm-up fixture — and every one of them
is at the plan's stop. Each is refused by the clock before `stopBracket` reaches
its inversion clause at all, which is why the misroute was invisible: the
labelled population was real, only its label was not.

The repair is the shipped split. The probe now replicates `recoveredRest` and
`loggedStructure` as the two functions the module has, and reads the day's span
and the clock censor off the uncapped one. `searchMarginals` was taking the
day's span from the capped sum too — the same misroute, one function along. That
one moves no figure: the session length it feeds is floored at one step, and a
day the cap zeroes has exactly one step of room left, so the floor was already
returning the right answer. The one-step replica still agrees with `adviseStop`'s
own `marginalValue` at every checkpoint in every arm, 0 mismatches, and every
line the file prints outside the censor arm is byte-identical to the run before
the fix.

## The taxonomy (M60)

The arm printed four categories and `stopBracket` has four refusals, but they
were not the same four. The function returns null on: the clock censor;
`reconstructStopDay` null or an empty `byTask`; `lo === null && hi === null`; an
inversion past `STOP_INVERSION_MARGIN`. The arm printed clock, no `lo`, no `hi`,
inversion.

- **"No `lo`" is not a refusal.** A day with `hi` and no `lo` returns a one-sided
  bracket, and `stopBracket`'s own docblock says so. The branch was also
  unreachable: reaching it needed `total + STEP > window` with something logged,
  which makes the clock test fire first. Its printed "no lo 0" in all eight rows
  was forced, not measured — so the branch is deleted (AGENTS.md §0).
- **"No `hi`" was the empty-`byTask` path**, in every row: 72 of 72 per random
  row and 13 of 13 per warm-up row are the day's first checkpoint with nothing
  logged at all, not a day where nothing yet reached a whole step.

The arm now prints `stopBracket`'s own four in `stopBracket`'s own order of
tests, because the first refusal reached is the one the day gets: **clock**,
**nothing logged**, **neither bound**, **inverted**.

## What the corrected arm reads

`npx vitest run --config vitest.probe.config.ts --disableConsoleIntercept
scripts/stop-advisor.probe.ts`, twice, byte-identical both times (roughly
150–170 s on this box across three runs, which is the only quantity here that is
a range rather than a figure).

| population | λ₀  | speaks on | clock | nothing logged | neither bound | INVERTED    | mid-day false stops in it | at stop |
| ---------- | --- | --------- | ----- | -------------- | ------------- | ----------- | ------------------------- | ------- |
| random 72  | 0.3 | 851       | 26    | 72             | 0             | 119 (14.0%) | 0/119                     | 0/0     |
| random 72  | 0.5 | 814       | 26    | 72             | 0             | 111 (13.6%) | 0/111                     | 0/0     |
| random 72  | 0.9 | 543       | 5     | 72             | 0             | 88 (16.2%)  | 0/88                      | 0/0     |
| random 72  | 1.3 | 161       | 0     | 72             | 0             | 23 (14.3%)  | 0/23                      | 0/0     |
| warm-up    | 0.3 | 204       | 2     | 13             | 0             | 16 (7.8%)   | 0/16                      | 0/0     |
| warm-up    | 0.5 | 202       | 5     | 13             | 0             | 17 (8.4%)   | 0/17                      | 0/0     |
| warm-up    | 0.9 | 172       | 9     | 13             | 0             | 27 (15.7%)  | 0/27                      | 0/0     |
| warm-up    | 1.3 | 118       | 0     | 13             | 0             | 16 (13.6%)  | 0/16                      | 0/0     |

The refusals still total 217, 209, 165, 95 and 31, 35, 49, 29 — the same eight
totals the mis-derived arm printed, because the four categories partition one
null set and only the routing was wrong. The clock column carries the twenty
that moved, row for row.

**The mid-day verdict is untouched.** Zero false stops in the inverted cell at
all four λ₀ on both populations, against 8 of 1,809 and 4 of 587 everywhere
else. The censor would still remove no wrong verdict and silence 341 + 76
correct `continue`s.

**The at-stop verdict collapses to nothing.** The inverted cell is empty in all
eight rows: an inverted bracket is a day with work still left in it, so a
rational stop never draws that refusal. Agreement where the day is kept reads
14/27, 41/49, 70/71, 72/72 and 0/2, 0/5, 12/13, 13/13 — **222 of 252** — and
those are exactly the eight at-stop readings §8.11's own one-step-vs-session arm
prints for the same populations. That identity is the check that the cell is
empty rather than relabelled: with the inverted cell gone, the censor arm's kept
column has to reproduce the arm above it, and it does, row for row.

**Five header figures were also stale for a second reason (M61).** 8ac490c moved
`PAIR_SEED_TASKS` from 3 to 4, which changed the plans this arm walks, and
nothing re-read it: the mid-day cells 118 and 110 are 119 and 111, "8 of 1,811"
is 8 of 1,809, "339 + 76" is 341 + 76, and the kept cell's "213/232" was
214/232 at HEAD before the misroute correction handed it back the twenty, 8 of
them agreeing, for 222 of 252. The quoted inverted range moves for both reasons
at once, 8.3–16.4% → **7.8–16.2%**.

## What two landed specs now claim falsely

Both are frozen; neither is edited, and M85 has since taken the figures out of
their ROADMAP rows, so this is where they are recorded.

**`the-censor-that-does-not-run-forward.md` (M39).** Its taxonomy paragraph
names the wrong four causes and calls "no `lo`" a refusal. Its mid-day
paragraph's "8.3–16.4%", "0 of 118, 110", "8 of 1,811" and "silences 339 + 76"
are the figures above. Its at-stop paragraph is false whole: agreement on the
inverted cell is not "8/20 against 213/232", an inverted bracket at a rational
stop does **not** mark a checkpoint the advisor gets wrong most of the time, and
there are no "8 right and 12 wrong verdicts" to convert into silences. So is the
residual it filed under what was deliberately not done — the "17 checkpoints
across four λ₀" is the random-day subtotal of the twenty clock-censored days,
and the cell it describes has none.

**`the-sweep-that-missed-two-generators.md` (M49).** Four cells do not
reproduce (M63) and one attribution is wrong (M62):

- "M39's random-day cells are literally the same numbers" — true when written,
  false at HEAD, by both M61 and M59.
- the eight-row at-stop list's `40/49` — the run reads 41/49 at λ₀ 0.5.
- "at-stop agreement 15/18 → 18/18 off-surface becomes 6/15 → 15/15 on it" —
  HEAD reads filtered 14/15 against unfiltered 6/15. The stated pair is the
  off-surface reading, in a paragraph that claims to state the on-surface one.
- "filtered max lateness is 0 in every row against up to 1 unfiltered" — the
  λ₀ 0.3 filtered row reads 1.
- the headline attribution "moves 19.7% → 14.2% at λ₀ = 0.9 and 24.7% → 28.1% at
  1.3, against the session arm's 6.6% → 1.3% and 6.2% → 0.0%" (M62). The
  on-surface halves are confirmed here — one-step 14.2% against session 1.3% at
  λ₀ 0.9, 28.1% against 0.0% at 1.3. The off-surface halves are not M49's: the
  spec's own table, directly above the sentence, prints 11.0/0.7 and 19.1/0.6,
  and the probe header carries 19.1% → 0.6% for λ₀ 1.3. 19.7 / 24.7 / 6.6 / 6.2
  are a pre-existing `adviseStop` docblock's figures, stale before M49 and
  re-attributed to its surface fix.
- its off-surface table's random λ₀ 0.3 cell, stated 0.0/0.0 where the
  off-surface run printed 0.5/0.5 — quoted, not re-measured here.

## What was deliberately not done

- **No shipped behaviour moved.** The correction touches a probe's derivation of
  a refusal reason, not the refusal, and the two edits below in
  `zenith-energy.ts` and its test are comments. `adviseStop`'s docblock quotes
  the inverted-cell range and nothing else from this arm, so re-reading that
  range is the whole edit; the two λ₀ it quotes from the one-step arm — 14.2%
  and 28.1% against 1.3% and 0.0% — are confirmed by this run and stay.
- **`stopBracket` still exports no refusal reason.** M39 declined to add a
  surface to a shipped module for a probe's benefit, and the derivation is
  correct once it reads the quantity the module reads; the finding is that the
  replica must be the shipped split, not that the split should be exported.
- **The off-surface halves of M62 and M63 were not re-measured.** Reading
  2214d9f needs a second worktree this change did not have. They are quoted from
  the review that measured them, and marked as quoted.
- **The neither-bound category is printed even though it reads 0.** It stays
  empty on a lattice plan, where every logged row is a whole step, so `hi` is
  never null once anything is logged — but it is one of `stopBracket`'s
  refusals, and dropping the branch puts its days back in the inverted bucket,
  which is the defect this repair exists for.
- **No new fixture.** The arm's mid-day finding, which is what the suite pins, is
  unchanged; an empty cell pins nothing.

## Where it landed

- `scripts/stop-advisor.probe.ts` — `recoveredRest` and `loggedStructure` split
  as the module has them, `searchMarginals` reading the uncapped span,
  `censorReason` deriving `stopBracket`'s four refusals in its order of tests,
  the unreachable no-lo branch deleted, and the header's censor paragraph re-read
- `src/lib/business/model/zenith-energy.ts` — the inverted-cell range in
  `adviseStop`'s "NO INVERSION CENSOR" docblock, 8.3–16.4% → 7.8–16.2%
- `src/lib/business/model/zenith-energy.test.ts` — the λ₀ = 0.9 fixture's
  counterfactual comment, which quoted the misattributed off-surface pair
- `ROADMAP.md` — M59–M63, one line each, under M85's convention
