# What the output tile was scored against

**Status:** landed 2026-08-19 · **Roadmap:** item 31, finding M24

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

M24 was filed as a one-token rename annotation: §11.8's closing paragraph names
`outputVsClassic`, and the shipped field is `valueVsClassic`. Landing it means
two things, and the second is the one that matters. §11.8 gets the annotation.
§30 — the section that performed the rename, and the only place the tile's
figures live — gets re-measured, because the pass that verified M24 marked
§30's headline pair provenance "transcribed — probe not run", and that is
exactly where the round's only measured drift was sitting.

No formula, constant, bound or fit moves. Nothing the user sees changes.

## Scenarios

Every figure below was re-run today from
`scripts/rv16-output-vs-classic.probe.ts` at its committed seed `0x290729`;
none is transcribed.

- **§30's table, three cells.** `totalOutput` median **+61.4% → +61.03%** and
  mean **+73.1% → +73.20%**; `satiatedOutput` mean **+45.8% → +45.65%**. The
  other twelve cells reproduce to the printed precision, wins counts included.
- **§30 consequence 3, the per-worked-hour edge.** **+39.9% → +41.97%**, and
  the `+61.4%` it contrasts against follows the table to `+61.03%`. The paired
  "+12.5% more hours (median)" reproduces exactly.
- **The table gets a dated re-measurement note**, in §13.1's style: the four
  superseded readings in brackets beside their date, the bisect result, and the
  statement that every other cell reproduces.
- **§11.8's retired identifier is annotated in place**, not swapped — the
  convention MATH.md §24 writes down for this section, and what §11.8 already
  does twice in the same list (Task Variety's "retired outright in §24",
  Bottleneck's "is retired with the `E/β` formula"). The parenthetical says the
  field is now `valueVsClassic`, that §30 renamed it and repointed it from raw
  `totalOutput` to the `objective` on 2026-08-07, and that neither move touches
  the reading §11.8 is making.

## Out of scope

- **§30's record of the rename** ("`#outputVsClassic` → `valueVsClassic`").
  That occurrence must keep the old name verbatim; it is the history.
- **Renaming `scripts/rv16-output-vs-classic.probe.ts`.** Declined: the probe's
  subject really is the `totalOutput` "before" row, `probe-registry.mjs --check`
  is intact at 60/60, and a rename churns `scripts/PROBES.md` and §30's
  citations of the path for no correctness gain.
- **§30's two rounded mirrors of the median.** `energy-lab-store.svelte.ts:410`
  and the probe's own docblock both say "+61% against the objective's +17%",
  which is still true at 61.03/17.36. A stale mirror gets fixed; a correct one
  at coarser precision does not get re-cut.
- **§8.10 and the stopping-value reconstruction.** A code question awaiting a
  ruling, not a documentation fix.
- **ROADMAP M33–M35.** Never measured — a classifier blocked that agent — so
  they stay in "Raised and not verified".

## Read before building

- `MATH.md` §30 (the table, its three consequences, "The fix") and §11.8's
  "Also in this change:" paragraph.
- `scripts/rv16-output-vs-classic.probe.ts` — the only instrument behind any
  figure here. Runs in ~11 s.

## Decisions

- **The moved cells are quoted at the probe's own two-decimal precision**
  (61.03, 73.20, 45.65) rather than re-rounded to the table's one decimal. Two
  of the three differ from the old reading in the first decimal, so rounding
  would hide nothing, but re-rounding a measured figure is a second judgement
  call between the instrument and the page and this round exists to remove
  those.
- **The table row is dated, not just corrected.** §13.1 dates its own
  re-measurement under the table it belongs to; §30 now does the same, so the
  next drift shows up as a date gap and not only as a wrong digit.
- **No §10 revision-log entry.** The five commits before this one in the same
  round all recorded their re-measurements in place with a date and no §10
  entry, and §10's own preamble scopes it to corrected _explanations_. The
  record here is the dated note, on the table it corrects.
- **The two figures the table is quoted for were checked, not assumed.**
  61.03/17.36 = 3.52 keeps consequence 1's "~3.5×", and
  (61.03 − 36.69)/61.03 = 39.9% keeps "satiety alone accounts for 40% of the
  raw margin". Had either moved, the section's argument — not its digits —
  would have been the finding.

## What execution turned up

- **The plan's cause attribution was backwards, and the bisect says so.** The
  landing plan filed this as "the same root cause and the same five-day window
  as M36: probe frozen `8f01ca8` on 2026-08-08, energy solver moved
  2026-08-13". M36's own doc concluded the opposite for its figures — they
  moved on 2026-08-08 and _not_ with the solver. Here the solver is the whole
  cause. Running the probe at `cbfff71`, the commit immediately before the
  three 2026-08-13 fixes, prints **61.38 / 73.06 / 45.80 / 39.85** — every
  figure §30 quotes, to its stated precision. `fce8eb9` (the off-midpoint rest
  break) moves the median to 61.03 and the per-hour edge to 40.43; `3e2f0c4`
  (the stop margin) moves nothing; `350a0c3` (the two-task pair seeds) finishes
  the job at 73.20 / 45.65 / 41.97. §30 was correct on the day it was written
  and for six days after.
- **"Transcribed" was the tell, and it is the third repeat.** ROADMAP already
  records this pattern twice (M36, and the §14 denominator). M24 was filed as
  the cheapest kind of lead — a name — and the drift was one section away,
  inside the figures the verifying pass declined to re-run because the lead was
  "about a name, not a figure". Cheapness is not the risk marker. Provenance
  "transcribed" is.
- **Every stale fact in the M24 row was in the citations, not the finding.**
  The retired name is real. The store citation (`:371-373`), the rename-record
  citation (`:6048`), "the old name greps empty" and "name-only" were all
  wrong; the ROADMAP row now carries the corrections rather than the claims.
- **The rename was never name-only.** §30 repointed the tile from raw
  `totalOutput` to the `objective` in the same change, so the bare token swap
  the lead prescribed would have rewritten a 2026-07-20 entry into a claim it
  never made — §11.8 was describing a bias in a raw-output comparison that no
  longer exists as such.

## Open questions

- **Nothing gates a probe's printed figures against the prose that quotes
  them.** Four figures in one section drifted the day the solver changed and
  survived six days of green builds, exactly as M36's five did. The probe
  prints the truth on demand; no build reads it. A figure-diffing gate over
  probe output is now the third finding in this round to ask for one.
