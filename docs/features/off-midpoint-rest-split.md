# §8.6's missing off-midpoint rest split

**Status:** landed 2026-08-13 · **Roadmap:** item 27

Backfilled 2026-08-14 from ROADMAP item 27, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`neighbors` yields every interior lattice split of a funded block — one step to
rest at unchanged worked hours — instead of the rounded midpoint alone.

## Scenarios

### Claim — the exhaustive tier is exact after the split

- **Given** the stated probe, run before and after the change, with both kill
  conditions checked
- **Then** the exhaustive tier goes from 58 of 60 exact, worst −0.5951%, to 60
  of 60, worst 0.0000%
- **Then** wall time does not move: 9.0 → 8.9 ms at 3 tasks / 8 h on one machine
- **Then** wall time does not move: 94.2 → 94.4 ms at 6 tasks / 12 h on one
  machine
- **Then** the harder tier's funded-set mismatches go 3 → 2 of 12

### Claim — the frontier tier is exact at 5 and 6 tasks

- **Given** the FRONTIER tier — 4 × 6.75 h, 5 × 6 h, 6 × 5.25 h, 3 days each,
  ~7 min
- **Then** 5 tasks is 3 of 3 exact
- **Then** 6 tasks is 3 of 3 exact
- **Then** 4 tasks holds a proven 0.3075% funded-set defect

## Out of scope

- **The variant that takes the rest step out of the block** rather than out of
  spare `room`. It would survive a fully-spent window, but the enumeration
  covers fully-spent plans and no day of the 60 asked for it. It was swept
  rather than argued: 0 uphill on all 12 harder-tier days and all 9 frontier
  days.
- **Raising the harder tier to an exhaustive reference** — the stated follow-up,
  closed as UNREACHABLE, 2026-08-13. Its two mismatch days enumerate to
  6¹³ = 1.31·10¹⁰ and 7¹⁵ = 4.75·10¹² lattice plans at 35.5 / 39.8 µs per
  `evaluateSchedule`, i.e. 129 h and 6.0 years.
- **The 4-task frontier defect** — a proven 0.3075% funded-set defect. It became
  item 30 rather than being fixed here.

## Where it landed

- MATH.md §8.6 — the section the change ships under.
- `neighbors` — the generator that now yields every interior lattice split of a
  funded block.
- `evaluateSchedule` — the per-plan cost the unreachability estimate is priced
  in, at 35.5 / 39.8 µs.

## Decisions

- **`neighbors` yields every interior lattice split of a funded block, one step
  to rest at unchanged worked hours** — the rounded midpoint alone left the
  exhaustive tier at 58 of 60 exact, worst −0.5951%. Rejected: taking the rest
  step out of the block rather than out of spare `room`, because no day of the
  60 asked for it.
- **The stated follow-up is closed as UNREACHABLE, not deferred** — the two
  harder-tier mismatch days price out at 129 h and 6.0 years. The probe now
  prints both figures so nobody re-proposes it.
- **Three measurements replaced the unreachable reference.** (i) The mismatches
  turned out to be half-attributable after all, from the SIGN of their
  shortfall: day 6 is 0.0540% behind the reference, a proven product-search
  shortfall, and day 4 is 0.0840% ahead of it, a proven reference shortfall.
  (ii) A new FRONTIER tier takes the exhaustive reference as far as it goes —
  4 × 6.75 h, 5 × 6 h, 6 × 5.25 h, 3 days each, ~7 min. (iii) The not-built
  variant was swept rather than argued: 0 uphill on all 12 harder-tier days and
  all 9 frontier days.
- **Both kill conditions were checked before and after** — exactness improved
  and wall time did not move, 9.0 → 8.9 ms at 3 tasks / 8 h and 94.2 → 94.4 ms
  at 6 tasks / 12 h on one machine.

## Open questions

On the two harder-tier mismatch days, only which funded set the true optimum has
stays open.
