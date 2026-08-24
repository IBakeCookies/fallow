# Friction Index — review

2026-08-22 · read-only review of the metric and its math · no code changed.

Scope read: MATH.md §11.4 (with §25, §27, §32), `calculateFrictionIndex`
(`src/lib/business/model/metric/calculation.ts`), `getEffectiveDifficulty`,
the task sanitizer (`src/lib/business/model/persisted.ts`), the advisor axis
(`src/lib/business/model/metric/plan-advice.ts`), band + descriptor wiring
(`src/lib/presentation/utils/band.ts`, `metric-descriptor.ts`),
`calculation.test.ts`, and `scripts/mtr-friction-index.probe.ts`.

## The formula, as verified

```
100 · Σᵢ max(0, Eᵤᵢ − βᵢ)·hᵢ / (9 · Σᵢ hᵢ)
```

over the plan's tasks (`SuggestedTask[]`), rounded to integer percent, clamped
to [0, 100]. `Eᵤ = min(10, max(1, max(p,m) + 0.3·min(p,m)))` is effective
difficulty; β is the raw enjoyment slider.

The code matches MATH.md §11.4 verbatim, and the probe pinned
`max |reading − formula| = 0` over 600 allocator-built days.

### What checks out

1. **The 9 is provably exact, not assumed.** Gap ≤ 9 requires Eᵤ ≤ 10 and
   β ≥ 1. Both hold structurally: the composite clamps at 10
   (`calculation.ts`), and `sanitizeTask` clamps enjoyment into [1, 10] on
   every read path. So `Math.min(100, …)` is slack on all app-reachable input —
   the same measured-slack-guard pattern MATH.md §25 formalized for Load.
   Maximum friction (m10/p0/e1, or 8/8/e1 via spillover 8 + 2.4 → clamp 10)
   genuinely lands at 100.
2. **The denominator choice is coherent across the sibling family.** Allocated
   hours, not budget: switch overhead and unbooked slack are excluded, matching
   §27's rationale for Sustainable Work, and it is what keeps 100% reachable.
   Unfunded tasks (h = 0) add zero to numerator _and_ denominator — they
   correctly drop out of a time-weighted average. Plan-scoped, completed
   included (§11.8), like grind/reward/deep-work; the contrast with
   active-scoped Momentum is documented in `daily-metrics.ts`.
3. **A consistency bound holds that the docs don't state:** since
   0 < gap ≤ 9 on positive-gap hours,
   **friction% ≤ 100 − SustainableWork%**. The two bands can therefore never
   contradict — a critical friction day beside a success Sustainable Work row
   is impossible. Worth a line in §11.4 someday.
4. **Monotonicity and discriminativeness are measured, not asserted:** +1
   enjoyment never raises and +1 difficulty never lowers it holding allocation
   fixed (0 violations / 4491 perturbations); re-plan inversions trace to the
   allocator, not the metric; the band ladder is occupied (p50 25 → p99 77);
   Spearman vs grind/reward confirms it is a third reading, not a duplicate.
5. **Degenerate-input handling is layered correctly:** empty / zero-hour lists
   return the sentinel 0; §32 gates the row N/A (`planned && funded`), and on
   the advisor baseline side badness 0 admits no improvement, so the axis goes
   silently empty — no alarm-about-nothing anywhere.
6. **Numerics:** no NaN/∞ path exists; division is only by a strictly positive
   denominator past the guards; floating-point magnitudes are trivially safe;
   deterministic in input order.

### Findings

**F1 — the UI description does not describe this quantity (the one to fix).**

`metric_friction_index_desc` (messages/en.json:211, mirrored by all four
locales) opens: _"Share of your allocated time spent on work that is harder
than it is enjoyable."_ That is **Sustainable Work's complement** (a share of
hours passing a threshold), not Friction Index (a time-weighted average
_magnitude_, normalized by max gap 9). Counterexample: every allocated hour at
difficulty 7 / enjoyment 3 → index 44%, but "share of time harder than
enjoyable" = 100%. The parenthetical gets the real definition right, but the
lead clause is a different number — precisely the disease §25 item 1 fixed on
Load's copy under the rule "displayed copy matches the formula."

Second nit in the same string: "difficulty-10" should say _effective_
difficulty — 8/8 reaches it via spillover, which MATH.md §11.4 itself flags as
the wording that matters.

**F2 — an undocumented asymmetry in the advisor's empty-plan treatment.**

Schedule Integrity NaN-guards the "plan funds nothing" reading because "defer
the last funded task" would otherwise win its frontier (`plan-advice.ts`). The
Friction Index has the identical shape — deferring the only funded task drives
the axis to its global optimum 0 — but keeps the option, priced honestly at
−100% Σ P̄ like the load axes. That is believed right under their own taxonomy:
friction's 0-on-empty truthfully means "no work, no friction", unlike
integrity's lying sentinel. But nothing in the AXIS entry or MATH.md §14
records why friction sits on the load side of that line. One sentence would
prevent a future change from re-litigating it.

**F3 — quantization at 1 pp inside the model (minor, likely fine).**

Friction rounds internally, so the advisor's `improvement > 0` filter works in
whole-percent steps; a real 0.4 pp improvement can tie-and-drop. This matches
burnout / time scarcity / schedule integrity but not the exactened loads /
deep work / sustainable work (§25–§27 moved those to exact-model,
round-at-display). Friction feeds no derived ratio, so the §25 defect mechanism
does not apply — noted so the inconsistency is known rather than discovered.

**F4 — two unpinned guard branches (minor).**

The friction describe in `calculation.test.ts` pins both endpoints, the
interior weighting, and the spillover interior — good coverage — but neither
sentinel branch (`[]`, all-zero hours). The empty-list test nearby belongs to
`calculateDailyQuadrant`; §32 pins only the display gate downstream. Two
one-line fixtures would match the quadrant describe's rigor.

**F5 — unreachable robustness nit (no action).**

A negative `suggestedHours` would corrupt both sides (negative numerator
contribution, shrunk denominator); the guard covers only `totalAllocated <= 0`.
Nothing in the app can produce it — the allocator emits ≥ 0.25 h multiples — so
per the repo's own "complexity needs a reachable failure" rule, leave it.

### Deliberate oddities verified, not flagged

- The spillover zero-boundary: 2.1% of the reachable cube reads > 0 although
  enjoyment beats both sliders (worst m7/p7/e8 → gap 1.1 → 12%), pinned by the
  "measures EFFECTIVE difficulty" fixture.
- Re-plan non-monotonicity (+1 enjoyment raising the index 87×) is the
  allocator responding; any Σh normalization has it.
- Momentum-vs-Friction scope split (active vs plan).
- A uniform mid-slider day reads ~17% (success): the scale's center of mass
  sits well inside the success band by construction, consistent with the
  probe's distribution (min 0, p50 25, p90 48, p99 77, max 100).

## Verdict

The math is sound, the normalization constant is exact rather than nominal,
and the metric is unusually well-instrumented (spec section, probe, pinned
fixtures, display gate). F1 is a genuine defect against the repo's own copy
rule; F2 is a missing sentence; everything else is context.
