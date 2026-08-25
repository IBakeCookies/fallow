# The gate figures that moved with the seed

**Status:** landed 2026-08-19 · **Roadmap:** closes nothing (a sweep finding,
not a filed lead)

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Restate the two `MATH.md` §8.5 figures that the frozen
`scripts/sat-gate-floor.probe.ts` no longer prints, and — while in the same
paragraph — name the lattice the third figure was measured at, which is the
ambiguity that let one of the two go stale unnoticed.

Nothing shipped moves. No formula, constant, bound or fit is touched; the probe
is untouched; the only file in the diff is `MATH.md` (plus its regenerated
section index).

## What moved, and who owns it

Both drifted figures are **350a0c3**'s — _"Fix/a two-task optimum needs a seed
that stays inside the pair"_. Both reproduce at their documented values on
`eb9012e`, the commit before it, so the bisect is closed and neither is a
mystery:

- **§8.5 "Chosen — `1−(1−b)·w`"** — the gated demand sweep's `wp = 1.0`
  endpoint, **3.00 h → 3.75 h**. The other two points the bullet quotes, 4.50 h
  and 5.25 h, still reproduce exactly.
- **§8.5 "The residual pathology"** — mean biggest allocation jump per 0.05 of
  demand over the 20 seeded days, **0.825 h → 0.863 h**, and identically at
  b = 0 and b = 0.05, as before. "0 of 20 non-monotone, both" is unmoved.

**The section's conclusion is untouched.** The b = 0 sweep is still monotone
under today's search, so the gate's justification remains what the section
already says it is — the `w = 1` algebra and the floor — and not a smoothing
effect. A seed fix moving a lattice-quantized allocation by one 0.25 h step is
the model re-measuring, not the argument failing.

## What execution turned up that the reading missed

**Two sibling bullets quote the same sweep at two different lattices, and only
one of them said so.** That is the whole reason the same "3.00 h" could be true
in one place and stale in the other:

- The **"Chosen"** bullet sweeps the probe day at the **0.25 h** step, and names
  it. Its `wp = 1.0` point is 3.75 h — the figure that drifted.
- The **"residual pathology"** paragraph sweeps the _same day_ at
  `DEFAULT_STEP_HOURS` = **0.75 h**, and named nothing. At that lattice
  `wp = 1.0` and `wp = 0.95` really are both 3.00 h, which is the paragraph's
  point (the b = 0 world is already monotone). At the finer 0.25 h step they are
  3.00 h and 3.75 h — they separate.

So "3.00 h at both wp 1.0 and 0.95" was never stale; it was **unqualified**. A
reader checking it against the bullet three paragraphs down would find the
sibling contradicting it and no way to tell which reading was current. The
paragraph now names its lattice the way the bullet already named its step.

This is a documentation defect the drift merely exposed. It cost nothing to fix
and would have cost the next reader a probe run to rediscover.

## Decisions

- **The lattice is named qualitatively, with no new figure.** The paragraph
  gains "at the default 0.75 h lattice" and a parenthetical saying the finer
  0.25 h step does separate the two points. Both facts come straight off arm C's
  two printed rows; neither introduces a number the section did not already own.
- **Superseded readings are bracketed, not overwritten.** §8.5's own convention
  — it still quotes the retracted "2.65 h → 4.56 h cliff" in the same breath as
  refuting it — so `[2026-08-06: 0.825 h]` and `[2026-08-06: 3.00 h at wp = 1.0]`
  sit beside the new values rather than replacing them. A reader who finds the
  old number in git or in an older feature doc can tell it was measured, not
  wrong.
- **The re-measurement is dated where it is quoted, and 350a0c3 is named
  once.** `docs/testing.md` wants the date beside the number. The paragraph's
  probe citation now reads "2026-08-06, re-measured 2026-08-19", the "Why this
  form" header gains "and again 2026-08-19", and the paragraph records that
  350a0c3's seed fix moved exactly these two figures and nothing else in the
  section — so the next drift hunt does not re-bisect the arms that held.
- **No §10 revision-log entry.** R7 asks for one for explanation-only fixes.
  This is a figure re-measurement dated in place, which is how every other
  commit in this round handled the same class, and §10 is already the longest
  section in the file. The date beside the number is the record.

## Out of scope

- **The probe.** `scripts/sat-gate-floor.probe.ts` is correct and was re-run,
  not edited. Its arms A, B and D all still assert green; only arm C prints, and
  arm C is a sweep, which `docs/testing.md` says is never pinned as a fixture.
- **The retracted "2.65 h → 4.56 h cliff".** Pre-disclosed: the section already
  quotes it as superseded in the sentence that refutes it, so it is not a stale
  figure and was left exactly as found.
- **Every other §8.5 figure.** The floor identity (0.14894 phys / 0.13043 cog),
  the 8 h endpoints (0.1997 against 0.0907), the 34%-above-floor gap and the
  16 h/24 h approach all reproduce to the digit. So do the rejected gate's
  mid-range equilibria. Nothing else in the section moved.
- **ROADMAP's stale `MATH.md:` line citations.** See below.

## Open questions

- **Mechanically bumping ROADMAP's `MATH.md:` citations is theatre, so it was
  not done.** This change inserts 4 lines at §8.5, which shifts every citation
  below it. But no citation anywhere points _into_ §8.5, and the ones below it
  were already stale when this commit landed — M5 cites `MATH.md:1566-1567` for
  §8.9's retraction of the r lever arm, 44 lines below it at "roughly a THIRD of
  its lever arm, not the half once claimed", and M33 cites `:2033` for §8.12's
  `recommendedHours` pseudocode, 149 lines below it at "or null when that is W".
  Both have drifted further since, which is the point: the numbers above are M5's
  and M33's own, and what each should have pointed at is quoted rather than
  re-guessed. Adding 4 to a number already wrong makes it differently wrong.
  AGENTS.md's "sweep the `file:line` citations that moved" is satisfied in spirit
  only by re-locating by content, which is what this round's commits each do for
  their own targets.
  Whether ROADMAP should cite sections rather than lines is the real question,
  and it is a ROADMAP decision, not this commit's.
- **Nothing tells a section that its sibling quotes the same sweep.** The
  0.75 h/0.25 h ambiguity survived two prior audits of this section. A probe
  that prints four rows and a section that quotes two of them have no link
  between them beyond a filename.
