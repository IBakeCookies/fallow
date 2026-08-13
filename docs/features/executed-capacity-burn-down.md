# Executed capacity burn-down

**Status:** landed 2026-08-12 · **Roadmap:** item 14

Backfilled 2026-08-14 from ROADMAP item 14, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

`RemainingDay.capacity` reports the pool today's logged hours load hardest and
the share of it spent, and `buildMetrics` renders the share LEFT as a reference
row beside Human Capacity. The day's executed hours now have a reading against
the capacity constraint, which previously only the plan had.

## Scenarios

The source names no test file for any of these.

### Scenario — the burn-down row

- **Given** today has at least one log
- **When** the metrics are built
- **Then** a reference row appears beside Human Capacity
- **Then** it shows the share of the binding pool LEFT
- **Then** the reading is a share, not a duration

### Scenario — the reading crosses 100%

- **Given** logged hours that load a pool past it
- **Then** the reading reaches `AXIS_BAND.humanCapacity`'s critical band above
  100%
- **Then** the value floors at 0%

### Scenario — the row is withheld

- **Given** today has no log at all
- **Then** the row does not render
- **Given** a non-finite saturation
- **Then** the row does not render

## Out of scope

- **A duration.** Pool hours are weighted ones, and "12m" beside the clock-time
  rows reads as time the user could still work (§35). The row is a share for
  that reason.
- **Re-deriving anything.** The draw and the clamped pools are the two
  quantities the §35 solve already builds; the row reads them.
- **Re-spelling "which pool binds, and how saturated is it" at the new call
  site.** That would have been R3's mirror case.
- **Any change to Human Capacity's behaviour.** It is unchanged and still
  pinned by its existing tests.
- **A row on a day with no log.** A full pool is a claim about a day that may
  be half gone.
- **A row on a non-finite saturation.** A 0-hour pool carrying a draw would
  print "Infinity%" in the tooltip, the way §20 already gates Human Capacity's
  value.

## Where it landed

The source names no file paths. It names these sections and symbols:

- MATH.md §35 — the solve that already builds the draw and the clamped pools,
  and the reason the reading is a share and not a duration.
- MATH.md §20 — Human Capacity's own gate on a non-finite value; §20's tie,
  which must be decided before rounding.
- `RemainingDay.capacity` — reports the pool today's logged hours load hardest
  and the share of it spent.
- `buildMetrics` — renders the share LEFT as a reference row beside Human
  Capacity.
- `calculatePoolSaturation` — the shared function this item cost.
- `calculateHumanCapacity` — where the pool-binding logic was before.
- `AXIS_BAND.humanCapacity` — the band the reading is read against.

## Decisions

- **The reading is a share, not a duration** — pool hours are weighted ones,
  and "12m" beside the clock-time rows would read as time the user could still
  work (§35).
- **The row reads the §35 solve rather than re-deriving** — the draw and the
  clamped pools are the two quantities that solve already builds. It was free,
  as this item predicted.
- **"Which pool binds, and how saturated is it" came out as a shared
  function** — it was inside `calculateHumanCapacity`. That was the one thing
  this item cost. Rejected: re-spelling it at the new call site, because it
  would have been R3's mirror case — the two rows would have been free to name
  different pools off the same tie rule.
- **`calculatePoolSaturation` is exact and the caller rounds** — §20's tie is
  decided before rounding, or the row names the wrong pool.
- **Human Capacity's own behaviour is unchanged** — and still pinned by its
  existing tests.
- **The pitch held** — the reading reaches `AXIS_BAND.humanCapacity`'s critical
  band above 100%, which no plan-family reading can, because the allocator
  enforces the pools and a 🪫 log does not.
- **The value floors at 0%** — the overrun is carried by the percentage, which
  is what the band reads.
- **The row is gated on today having a log at all** — a full pool is a claim
  about a day that may be half gone.
- **The row is gated on a finite saturation** — a 0-hour pool carrying a draw
  would print "Infinity%" in the tooltip the way §20 already gates Human
  Capacity's value.

## Open questions

None — landed.
