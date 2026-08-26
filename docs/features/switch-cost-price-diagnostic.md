# Switch-cost price diagnostic

**Kind:** feature · **Status:** landed 2026-08-04 · **Roadmap:** item 17

Backfilled 2026-08-14 from ROADMAP item 17, whose text was written at land. Not
a pre-implementation spec.

Frozen at land: this file says what was decided on the date it carries, never
how the code works today — that is MATH.md and the area `AGENTS.md`. When later
work changes the behaviour, it writes its own feature file; it does not edit
this one. Same status as [zenith.md](../../zenith.md), for the same reason.

## Goal

The declared switch cost gets a price: `switchCostPrice` on `PlanAdvice`, from
two extra solves at `s = 0` and `s = 2s` inside `suggestPlanAdjustments`,
surfaced as one quiet line on the advice card. The reading also reports the
hours the plan reserves for switching — a median **23.08%** of the day's
budget.

## Scenarios

### Scenario — the advice card prices the declaration

- **Given** a day whose plan is advised
- **When** the advice card renders
- **Then** one quiet line reports the switch-cost price

### Scenario — each alternative is worded conditionally

- **Given** the switch-cost line on the advice card
- **When** an alternative is read
- **Then** it reads "if your switch cost were X, this plan would read Y"

## Out of scope

- **No floor**, unlike §14.2. Not because inversions cannot happen: 0 of 298
  fixture days invert at their **stored** budget and pools, and off those
  values they do (§13.3's pooled suboptimality). The floor is refused because
  it would zero the doubled arm, which is the arm that carries the message.
- **The planned copy — "halving it would buy X" — was refused.** It prices a
  quantity the app cannot compute: the cost of _mis_-declaring `s` needs to
  know which value is true.
- **The estimator proposed alongside the diagnostic stays unbuilt.** Fitting
  `s` from the observed funded-task count died on three measurements: `m(s)` is
  not monotone (195 violations on 115 of the 298 fixture days × 101 `s`
  values); median one-day bracket width is 0.50 h against a [0,1] h range, with
  25% of days consistent with the entire range; and one mis-counted task shifts
  the bracket edge by median 0.34 h off opt-in logs.
- **Known limit:** the 8.14% over the author's own four logged days is
  unrecorded — the only figure here with nothing behind it.

## Where it landed

- `PlanAdvice` — carries the new `switchCostPrice` reading.
- `suggestPlanAdjustments` — runs the two extra solves at `s = 0` and `s = 2s`.
- The advice card — one quiet line.
- MATH.md §14.3 — the diagnostic and its table of numbers.
- MATH.md §14.2 — the floor this one does not copy.
- MATH.md §13.3 — the pooled suboptimality under which inversions do occur.

## Decisions

- **Shipped because the gate cleared by 8×.** The kill criterion was a median
  |Δ value| under ~1% between `s = 0.25` and `s = 0.5` on 2–4-task days. The
  measurement through the real solver is **8.47%** over the fixture's 180 such
  days, **8.14%** over the author's own four logged days, and **18.77%** on
  5+-task days.
- **The signal is constant-independent** — 8.50% under the fixture's own
  ground-truth ϕ constants.
- **The framing had to become conditional**, on contact with the measurement.
  The planned copy priced a quantity the app cannot compute, so each
  alternative now reads "if your switch cost were X, this plan would read Y".
  Rejected: "halving it would buy X", because the cost of _mis_-declaring `s`
  needs to know which value is true.
- **The old asymmetry figures answer a different question.** Those figures — 2×
  too high 10.13%, too low 1.04%, ignoring it 1.18% — are not this reading. The diagnostic's own numbers are the table in §14.3,
  where `s → 0` reads **+10.95%** rather than 1.18%, because planning as if
  switching were free _raises_ reported value while switching for
  free-that-isn't lowers realized value.
- **No floor on the arms.** Rejected: §14.2's floor, because it would zero the
  doubled arm, which is the arm that carries the message. Inversions are real —
  they just do not occur at a day's stored budget and pools (0 of 298 fixture
  days), only off those values (§13.3).

## Open questions

None — landed.
