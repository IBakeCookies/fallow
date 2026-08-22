# Burnout Risk — heavy review

_2026-08-22. Review of `calculateBurnoutRisk` (MATH.md §11.6). No code changed;
all measurements from throwaway probes in `/tmp/opencode/burnout-review/`
(vitest, seeded, ~5 s, reproducible). Read alongside: MATH.md §11.3/§11.6/§11.7/
§11.9, `src/lib/business/model/metric/calculation.ts`,
`zenith-energy.ts`, `energy-calibration.ts`, `metric/history.ts`,
`metric/daily-metrics.ts`, `presentation/utils/band.ts`._

**What the metric is:** `risk = 100·(1 − min(C_cog, C_phys))` at the end of the
_intended_ day — funded tasks in interleaved run order, switch gaps simulated as
full-rate rest, budget overhang stretching funded blocks pro-rata, evolved
through the §8.1/§8.5 reservoir law with user-fitted α/r.

---

## Findings, by severity

### F1 — Switch gaps are modeled as full-rate recovery: fragmentation lowers risk, contradicting Schedule Integrity

The rest gap between tasks recovers **both reservoirs toward 1 at r′ = r·m =
1.05/h** (`simulateReservoirs`: `taskId === null` → demand 0 → gate 1). Same
4 h of m=8 work, budget exactly covering worked hours + gaps:

| split   | risk | schedule integrity |
| ------- | ---- | ------------------ |
| 1 task  | 46   | 100                |
| 2 tasks | 42   | 91                 |
| 4 tasks | 34   | 76                 |
| 6 tasks | 26   | 66                 |

A user can buy **−20 points of Burnout Risk by paying +34 points of Schedule
Integrity** on identical work content. The app gives the same `(m−1)·s` minutes
two opposite valuations: lost time (Schedule Integrity §11.5, Time Scarcity)
vs therapeutic rest (Burnout). Attention residue is empirically not rest.

Internally consistent with the energy model — §16 settled the run order _under
this objective_, and gap-as-rest is half the mechanism behind the settled
budget non-monotonicity ("more tasks → more gap-rest"). Any change re-opens
that bullet. The endpoint-min reading also washes mid-day gaps out quickly:
one 4 h block reads 57 vs two halves + a gap at 53 — the benefit comes from
having _more gaps_, not better-placed ones.

Smallest possible repair if ever needed: partial-rate gap recovery (gate the
gap's r′). That is a §11.6 rewrite with its own probe and tests (R7/R6), not a
tweak.

### F2 — At default params the presentation bands are mostly dead

2000 seeded allocator-built days (1–7 tasks, sliders 0–10 uniform, budgets
0.25–16 h, switch costs 5–30 m) at `DEFAULT_ENERGY_PARAMS`:

```
p5=7  p25=12  p50=18  p75=30  p95=54  max=87
bands: success 1350 · neutral 524 · warning 111 · critical 15  (of 2000)
```

Warning+critical ≈ **6%**; the cuts at 25/50/75 sit far above the metric's
working range at defaults. "Past 60% Deep Work, Burnout Risk owns the verdict"
(band.ts, en.json) describes a regime random space almost never reaches.
Under fitted-extreme params (α at fit max, r at fit floor) the same days read
**p50=90, 87% critical** — personalization _is_ the scale, defaults are a
near-inert floor state. Defensible (your logs decide whether the row can warn),
but nowhere said: a default-params user's Burnout row essentially never leaves
green/neutral, and the advisor's burnout axis is correspondingly inert for them.

### F3 — Overnight carry-over is numerically tiny; the tooltip oversells it

`seedMorningReservoirs` simulates yesterday then rests `24 − Σ worked`. Because
the night is pure exponential recovery toward 1:

    morning ≈ 1 − deficit·e^(−r′·m·gap)

the carry-over ceiling is set by the _night's_ incompleteness, nearly
independent of how hard yesterday was. Measured (8 h demand-0.9 yesterday):

- defaults: morning cog **1.0000**, risk unchanged (**57 → 57**);
- r at fit floor (0.1): morning cog **0.921**, risk **69 → 71 (+2)**;
- α also at fit max: morning still ≈ 0.91.

Worst case anywhere in fit bounds is ≤ ~9 points of reservoir ≈ +2 risk
points. Rest-distribution sensitivity of the lumped-tail approximation (breaks
folded into the night instead of placed between sessions): ~1.7 reservoir
points ≈ 1 risk point — fine.

§11.9 documents all of this honestly ("under default recovery the metric
behaves exactly as before"), but `metric_burnout_risk_desc` leads with the
carry-over clause, which numerically does almost nothing for almost anyone.

### F4 — The overwork stretch saturates, bites mainly through budget–plan gaps, and interacts with budget prefill

- **Plateau.** Stretching a fixed 3 h m=6 plan from 3 h→12 h declared reads
  **27→32**; a 1 h m=9 task stretched 12× reads **25→67**, saturated by ~8 h.
  Long intended days converge to the demand's equilibrium depletion `C_eq(w)`,
  so moderate-demand overwork mathematically cannot warn — only high-demand
  overwork does. The §11.3 "intended hours" reading is honest but weak below
  w ≈ 0.7:
  ```
  1h m=9 task stretched: 1h→25 4h→57 6h→63 8h→66 12h→67
  3h m=6 plan stretched: 3h→27 6h→31 8h→32 12h→32
  ```
- **Distribution over seeded days.** Zeroing the stretch (same 2000 days):
  shipped − zero-stretch = **mean +1.0, p50 0, p90 +4, p99 +13, max +23**;
  band changes on 102/2000 (5%). Quiet most days, occasionally decisive.
- **Prefill interaction.** One added 2 h errand against an 8 h prefilled
  window (m=3/5/8): **12 / 24 / 52** vs 10 / 18 / **34** at a declared 2 h.
  The m=8 warning is phantom hours twice over — under the bigger budget the
  allocator books 4.25 h for the same task, then stretch fills to 8 h
  intended. A light day beside a habitual large window can read warning with
  no heavy work on it.
- **Nothing-funded branch quirks.** Average demands over ALL tasks lets zeros
  dilute: all-heavy unfunded list at 8 h reads 66, heavy+trivial mix reads
  **32**, all-trivial reads 0. It also ignores switch cost entirely (single
  block) and includes completed tasks' sliders. Scope documented in §11.6;
  the dilution is not.

### F5 — Sensitivity walks under re-solve (the dashboard gesture)

| lever                  | result                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| budget 0.5→12 h        | falls 219/1840 steps, worst −21 (matches settled §11.6 pin)          |
| **switch cost 0→60 m** | **falls on 329/480 steps (68%), worst −11; rises 35/480, worst +34** |
| +1 mental slider       | rose 152, fell 53 (13%), flat 195 of 400                             |

The switch-cost row is new territory: no settled bullet covers the _metric's_
response to `s` (§14.3 governs advice only). Two-thirds of the time declaring a
higher switch cost _lowers_ Burnout Risk — the F1 mechanism again. Rises are
rare but violent: at s = 45→50 m a 2-task interleaved plan collapses into one
concentrated 2 h block, reading **14 → 48**. Since `s` is user-set on the same
screen as the metric, this deserves a line beside the settled budget bullet.

The slider result mirrors the friction probe's finding (re-solve effects, not
metric defects); flat 49% is integer rounding of small demand moves.

### F6 — Code-level checks (clean)

- An independent mirror of the block construction reproduced the shipped
  reading exactly on every probed day.
- Allocator span invariant holds: **0/3000** days emit worked+gaps > declared
  budget, so the real planner never makes burnout simulate past the intended
  day (only hand-built lists could).
- NaN/negative switch cost clamped; empty-plan guards return 0; completed-task
  scope completion-invariant (test-pinned); min() is continuous so no
  band-edge cliffs; binding reservoir splits ~evenly (1073 cog / 926 phys), so
  both difficulty sliders matter; cog-only vs phys-only symmetric demand-0.9
  days read 63 vs 59 — the default α asymmetry is mild.

### F7 — Semantic observations (not defects)

Endpoint-min means early-day damage decays out of the reading unless late load
sustains it, and with F3 there is no chronic dimension at defaults: the metric
named "burnout" measures **acute end-of-day depletion only** — no
time-below-threshold exposure, no multi-day accumulation except through the
tiny carry-over above. Defensible and settled; it should be named that
precisely wherever the metric is explained. Mid-day plan scope (the card keeps
the morning's answer while tasks get ticked off) is documented §11.8; history's
cheap-solve plan priced at the day's real switch cost is §31-sized. Fine.

---

## What is solid

- v2 genuinely retires invented constants for calibrated ones; the fit order
  (r first, α conditioned on it) and the causal fit window are correctly wired
  and tested.
- The suite pins exactly the right things: pro-rata vs equal split (41 vs 8),
  dropped-task invariance including its documented nothing-funded hole, the
  non-monotonicity characterization test, enjoyment exclusion, negative switch
  cost.
- §11.9's one-day-lookback bound argument is sound; §13.6's workEnd choice is
  right; probe numbers reproduce (ceiling 87 ✓).

## Recommendations (ranked)

1. **Copy honesty** (cheap): quantify or soften the carry-over clause in
   `metric_burnout_risk_desc`; note that "Burnout owns the verdict" past the
   Deep Work optimum presumes calibrated params.
2. **Document F1/F5 in MATH.md §11.6**: spell out gaps-as-full-rate-rest with
   the fragmentation table, and record the switch-cost sensitivity beside the
   settled budget bullet. Doc-only.
3. **Only if fragmentation gaming shows up in practice**: gate gap recovery
   (r′·γ, γ < 1). Re-opens the settled budget non-monotonicity bullet; needs
   its own probe + tests per R6/R7. Do not do casually.
4. **Band decision**: either state "defaults are inert by design" or derive
   cuts from the calibrated distribution. Presentation-only.
5. **Nothing-funded branch**: document zero-dilution at minimum; weighting by
   effective difficulty would match `getEffectiveDifficulty`'s convention
   elsewhere.
6. **Leave alone** (measured, working): endpoint-min semantics, plan scope,
   stretch plateau, history pricing.
