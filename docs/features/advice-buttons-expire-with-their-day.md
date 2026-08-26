# The advice card’s buttons must not outlive the day they priced

**Kind:** feature · **Status:** landed 2026-08-12 · **Roadmap:** item 25

Backfilled 2026-08-14 from ROADMAP item 25, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

A priced button stops offering the day it priced. Two cards, three buttons —
the advice card's defer and budget levers, and the Energy Lab's "Set the
window" on the budget curve, which prices the same class of thing behind the
same stale flag — now gate on `isBusy || isStale`. The recheck button stays
live, because it is the way out.

## Scenarios

### Scenario — the Energy Lab's "Set the window" during a sweep

- **Given** a budget-curve sweep in flight
- **When** the user clicks "Set the window"
- **Then** the button is disabled

That third button had no `disabled` at all — not even `isBusy` — so it was
clickable mid-sweep, holding a recommendation the run in flight was about to
replace.

### Scenario — the day moves while the previous day's tasks are still loaded

- **Given** an advice reading held from the previous day
- **When** the day moves at a URL navigation or at the midnight tick
- **Then** the card reads stale

`selectedDate` falls back to the live clock
(`session-store.svelte.ts:148-150`) and `#loadSession` is async, so through
that window the inputs are unchanged; before this change the fingerprint never
moved and the card read **fresh**, not stale. Both directions are pinned by a
store spec that fails without the date field.

## Out of scope

- **The load-failure path, found by the reviewer and left open on purpose.** If
  `#readSession` throws, `#loadSession` reports `load-failed` and leaves
  `#loadedDate` behind (`session-store.svelte.ts:476-486`), so the previous
  day's tasks stay on screen under the new date indefinitely. The card goes
  stale correctly, but Recheck is ungated and re-pins `#adviceFor`, so the
  defer buttons come back enabled and `moveTaskToTomorrow`'s
  `#loadedDate !== #selectedDate` guard swallows the click. That is a
  load-failure defect, not a staleness one, and it is bigger than these buttons
  — the whole list is the wrong day's, with the storage banner up. Fixing it
  here would have been fixing a different thing.
- **A disabled button carrying its own reason.** A disabled button is not
  focusable, so it cannot; the stale banner is that reason, and it renders
  before the rows.
- **Clearing the reading instead of disabling it** — refused: stale is a
  warning about the numbers, not a reason to hide them
  (`budget-curve-card.stories.svelte`).
- **No probe, no MATH.md change.** §14's contract is enforced here, not
  restated.

## Where it landed

- `session-store.svelte.ts:148-150` — `selectedDate` falls back to the live
  clock, which is what moves the day out from under a held reading.
- `session-store.svelte.ts:476-486` — the load-failure path that leaves
  `#loadedDate` behind, left open.
- `DailyPlanStore` — its fingerprint now carries the date, wrapped around
  `#input` rather than folded into it: that object is `calculateDailyMetrics`'
  argument, and the date is not a model input.
- `EnergyLabStore` — `#curveFingerprint` carries the date for the same reason
  one level down.
- `budget-curve-card.stories.svelte` — the stale reading stays on screen.
- MATH.md §14 — the single-step contract the gating renders. Unchanged.

## Decisions

- **All three buttons gate on `isBusy || isStale`; the recheck button stays
  live.** The Energy Lab's "Set the window" prices the same class of thing
  behind the same stale flag, so it belongs under the same gate. Rejected:
  leaving it as it was, which had no `disabled` at all — not even `isBusy` —
  so it was clickable mid-sweep, holding a recommendation the run in flight was
  about to replace.
- **Half (b) was a wider hole than the item claimed.** The item read it as
  advice surviving a day change and rendering with the stale banner plus dead
  buttons. It turned out that `selectedDate` falls back to the live clock and
  `#loadSession` is async, so at a URL navigation and at the midnight tick the
  day moves while the previous day's tasks are still in memory — and through
  that window the inputs are unchanged, so the fingerprint never moves and the
  card reads fresh, not stale.
- **Both fingerprints carry the date.** `DailyPlanStore`'s is wrapped around
  `#input` rather than folded into it, because that object is
  `calculateDailyMetrics`' argument and the date is not a model input;
  `EnergyLabStore`'s `#curveFingerprint` for the same reason one level down.
  That store is layout-scoped, so it sees every day `/` selects, but `/energy`
  refuses a dated URL, so the midnight tick is its whole exposure on screen.
  Both directions are pinned by a store spec that fails without the field.
- **The counter-case did not survive contact.** "Gating costs the user the one
  deferral they can still take honestly" is answered by the sequence: the first
  apply is taken from a fresh card and lands, and it is the _second_ row —
  priced against a day that first apply just changed — that §14's single-step
  contract calls wrong. Gating is that contract rendered.
- **The load failure the reviewer found was left open.** It is a load-failure
  defect, not a staleness one, and bigger than these buttons; fixing it here
  would have been fixing a different thing.

## Open questions

None — landed.
