# The cross-scoring counts moved twice

**Kind:** repair · **Status:** landed 2026-08-19 · **Roadmap:** closes nothing — a sweep finding
from the 2026-08-13 solver-drift re-run of the frozen probe set

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Move the nine §15 cells that `scripts/mode-cross-scoring.probe.ts` no longer
prints, and the one copy of the same figure in ROADMAP.md. No formula,
constant, bound or fit changes; the probe, its seed (`0x290729`) and its 300
seeded days are untouched. Three of the same digits are mirrored in the model
layer's brief and move with them. What moved is the energy solver underneath it, in
two 2026-08-13 commits.

## Scenarios

All measured today by one run of `scripts/mode-cross-scoring.probe.ts` at
HEAD — the same instrument the section already cites.

- **The table.** Classic under `Σ P̄`: **283/300 → 284/300**, median
  **+38.8% → +39.5%**, p90 **+97% → +99%**. Energy under `Σ P̄`:
  **17/300 → 16/300**. The `[276]` and `[24]` brackets are the unseeded
  2026-07-29 draw and stay as written; the 2026-08-06 reading goes into a new
  paragraph under the table rather than into the cells, which are already
  carrying one bracket each.
- **The exceptions.** `16 of the 17` → **15 of the 16**, and the paragraph now
  states the load-bearing half as a count: every one of the 15 is infeasible
  for the classic allocator, **15 of 15**. Physical load max
  **7.20 h → 6.68 h**, with `[2026-08-06: 7.20 h]` beside it.
- **Concentration.** Funded tasks per day, energy **1.97 → 1.95**; the
  2026-08-06 pair is bracketed beside the 2026-07-29 one. Identical funded set
  **30/300 → 29/300**; the `(10%)` parenthetical survives, at 9.7%.
- **`src/lib/business/model/AGENTS.md` — the mirror.** Its settled-decision
  entry "The energy model is a peer mode" restates the same probe to the
  reader of the shipped model layer and carried the same three digits:
  283/300, "the 17 exceptions", and energy's 1.97 tasks/day. All three move
  with the section; 3.96 and 0/300 stay, because they did not move.
- **ROADMAP.md item 31(f).** Its SETTLED paragraph quotes §15's count as the
  evidence that withdrew the energy-plan promotion, so it moves in the same
  commit: **284/300**, with `283/300 when settled` kept and the re-measure
  dated.

## Out of scope

- **The conclusion.** Both load-bearing halves hold at HEAD — "every one is
  infeasible" (now 15 of 15) and "energy funds **more** on **0 of 300** days",
  not once on any of the three draws — and so does the whole
  two-definitions-of-a-good-day argument the section exists to make. Nothing
  here re-opens the settled peer-modes decision.
- **Classic funded tasks per day (3.96).** Unmoved at every archived tree the
  sweep ran; left as written.
- **The cognitive range 4.35–7.20 h.** The landing plan said it had not been
  re-measured. It had: today's run prints `cognitive 4.35–7.20h` on the same
  line as the physical max, so the range is confirmed unmoved rather than
  merely untouched.
- **Work planned (92% / 94% / 81% / 83%), overlap mean 0.58, median 0.58,
  p10 0.33, energy's 298/300 and 2/300 columns.** All reproduce exactly.

## Read before building

- `MATH.md` §15, "Two objectives, two modes".
- `scripts/mode-cross-scoring.probe.ts` — the only instrument behind any
  number in that section.
- `ROADMAP.md` item 31(f), the settled record that quotes it.

## Decisions

- **Brackets keep history; the note keeps the mechanism.** The section already
  brackets the 2026-07-29 draw, so a second bracket per cell would have made
  the table unreadable while saying nothing about why the cells moved. The
  cells take the new readings, and a paragraph under the table records the
  2026-08-06 values and the two-step bisect that moved them.
- **The section says out loud that a match is not stability.** The
  composition-overlap median is written 0.58 and prints 0.58, so no edit was
  due — but it went 0.58 → 0.57 → 0.58 across the same two commits. That
  belongs beside the figures, not only in this file, because the next reader
  re-running the probe will otherwise read a match as a guarantee.

## What execution turned up

- **Nine cells, two commits, and one that moved away and back.** The bisect
  splits the drift between `fce8eb9` (rest-break placement) and `350a0c3`
  (two-task seed): the classic win count read 283 before 2026-08-13, **282**
  at the tree between the two commits, and **284** after — it moved twice, in
  opposite directions, and a HEAD-vs-doc diff sees one move. That is the
  method finding worth freezing: a single re-run is evidence about the current
  tree only, never about stability.
- **The copy-paste guess is refuted.** The sweep entry proposed that §15's
  physical max of 7.20 h was a copy of the cognitive max on the line above.
  It was not: 7.20 h reproduces at `cbfff71`, `fce8eb9` and `eb9012e`, and
  `350a0c3` moved it to 6.68 h. The two figures agreeing was a coincidence of
  the draw, not a transcription error, so nothing else written that day
  inherits a suspicion from it.
- **One sentence in §15 was arguing from the wrong cause.** It read "the
  counts do not [reproduce], since the first draw recorded no seed" — true in
  2026-08-06's world, where the only two draws had different seeds. Today's
  draw has the _same_ seed as 2026-08-06's and still differs, so the sentence
  now names both causes: the unseeded first draw, and the 2026-08-13 solver
  commits.
