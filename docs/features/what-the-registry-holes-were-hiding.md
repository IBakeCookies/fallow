# What the registry holes were hiding

**Status:** landed 2026-08-18 · **Roadmap:** item 31, findings M27, M28, M31,
M32, M36

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

Close the four sections `scripts/PROBES.md` had no row for (§8.2, §11.5, §18,
§22) and the three item-31 leads filed as cheapest (M27, M32, M36), measuring
each instead of transcribing it. Nothing the user sees changes and no shipped
behaviour moves; two probes, two suite fixtures and one probe header are added or
corrected, and five `MATH.md` sections gain the citation they lacked.

**The batch's result is that "cheap" was the wrong axis.** These were ranked as
the tail of item 31 — bookkeeping behind the fourteen upheld findings. Four of
the five turned out mis-scoped, and the two figures that had actually drifted
were both in the lead filed as citation-only.

## Scenarios

Two probes are new, both exhaustive or seeded, neither pinnable as a sweep:

- **M27 / §22** — `mtr-task-nature.probe.ts` enumerates all 121 integer slider
  pairs through the shipped `getTaskNature`, reading the pre-§22 rule through the
  same function by shifting both sliders +1 (preserves the gap, removes the zero)
  rather than restating the formula.
- **M28 / §18** — `session-row-truncation.probe.ts` prices the session-row
  inversion through the shipped `adviseStop`: the three marginals, every split of
  the 4.5 h day, and 200 seeded slider-drawn tasks.

Two suite fixtures, both watched fail first:

- **M31 / §8.2** — `zenith-energy.test.ts` pins the two survival shares against
  the shipped `resumptionTimeConstant`. Watched fail at the _rounded_ 0.85 / 0.02
  (off 2.8e-3 against a 5e-6 tolerance), so it pins the constant and not the sign.
- **M27 / §22** — `calculation.test.ts` pins the 45 balanced pairs; watched fail
  at 49.

**M32 / §11.5 needed no new fixture** — the one it asked for already existed.
Two assertions were added to it instead, each verified load-bearing by mutating
the shipped source, running, and restoring: deleting `if (budget === 0) return 0;`
and setting `DEFAULT_SWITCH_COST = 0.5` both left the old suite green.

**M36 / §8.12 adds no fixture at all.** A 448-second pooled sweep statistic is
not pinnable as one — `docs/testing.md` says pin a fixture, never the sweep.

## Out of scope

- **Any shipped-code change.** Every formula, constant, bound and fit is
  untouched. The two `src/` edits are test files; the one `scripts/` edit outside
  the new probes is a header comment.
- **§18's witness.** Its stated demands are not app-reachable, which the section
  now records — but §18 documents a shipped fix from 2026-08-05 and the fix is
  correct. Restating the witness at reachable sliders would rewrite history the
  section exists to hold.
- **The existing §18 test's weak pin.** `energy-lab-store.svelte.spec.ts`'s
  original §18 test uses mental 8 / physical 2 (difficulty 8.6), where the true
  4.5 h day still reads `continue`, so it pins only that the two readings differ
  and never that the truncation was dangerous. Left as found (AGENTS.md §0); the
  new fixture beside it carries the verdict flip.
- **The remaining seventeen item-31 leads.** M14–M21, M23–M26, M29, M30,
  M33–M35 stay unverified and stay unquotable.

## Read before building

- `ROADMAP.md` item 31 and its findings section — in particular that the list is
  a reading and not a measurement, so "unbacked" means no probe reaches the
  claim, never that the claim is false.
- `docs/testing.md` "Writing a probe" — seed the randomness, date the number
  where it is quoted, pin the finding with one fixture and never the sweep.
- `scripts/PROBES.md`'s header — it registers probe _files_, which is why a
  closed-form claim gets a citation and no row.

## Decisions

- **A closed form cites a suite fixture and gets no registry row.** §8.2 and
  §11.5 were both filed as registry holes; neither should have a row, because
  `probe-registry.mjs --check` fails a row with no file and a closed form has
  nothing to sweep. The registry header's definition of "unbacked" excluded
  counted a fixture-cited number as unbacked and no longer does, which is the
  rule the two sections needed and `MATH.md`'s own preamble already stated correctly.
- **§8.12's drifted figures are restated, not investigated.** 22 of 5040 (0.4%)
  → **17 (0.3%)**, and `kneeC` interior at λ₀ = 1.0 25/40 → **24/40**. The probe
  is untouched since 28e2e16 (2026-08-08); the allocator moved on 2026-08-13.
  A probe number legitimately moves when the model does, the direction runs the
  argument's way (fewer dips, none larger), and the worst dip is unmoved — so
  this is a re-measurement, not a defect hunt.
- **§22's "22 of 121" keeps both counts.** It is 22 against the ±3 gap alone and
  18 against the rule as shipped; the section now says which rule each is
  measured against rather than dropping the older number. The 22 was arithmetic
  left behind by §22's own fix, quoted in the paragraph defending it.
- **§18's caveat goes in §18, not in a code comment.** That `toEnergyTask` cannot
  pair difficulty 7 with w = (0.8, 0.2) — sliders 8/2 are difficulty 8.6, where
  the day does not flip at all — is a fact about the section's witness, so the
  section carries it. Same class as M35's unstated constants, one section over.
- **`enb-break-economics.probe.ts`'s header was corrected, not its row.** The
  header claimed §8.1–8.2 scope its arms never had; the row was right. The
  audit's usual failure was trusting the registry over the probe body, and this
  is the inverse — worth recording, because it means neither side is the
  authority on its own.

## Open questions

- **§18's flip is app-reachable but its own witness is not.** 133 of 200 seeded
  slider tasks flip, and difficulty 7 at w = (0.7, 0) flips, so the claim
  survives. Whether §18 should eventually be restated at a reachable witness is a
  question about what a frozen section owes a later reader, not a measurement.
- **Nothing re-runs a probe on a schedule.** §8.12's figures drifted for five
  days because a probe printed the truth and no citation pointed at it. The date
  beside a number is the only signal a reader gets, and it is written by hand.
