# Zenith — Mathematical Model, Derivations, and Change Log

This document is the authoritative record of the math implemented in
`src/lib/business/model/zenith.ts`: what the model is, how every formula is
derived, and — most importantly — **what we changed relative to the source
article and why**, so future readers don't have to reverse-engineer the
reasoning from code.

- Source article: [The Zenith Gradient Algorithm](https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e)
  (copy in `/zenith.md`)
- Model **v1** = the article's math plus our earlier robustness fixes
  (ridge-regularized constants fit, ϕ floor, per-task optimum caps,
  switch-cost drop search).
- Model **v2** = the 2026-07 revision documented here: new productivity curve,
  per-task optimal stopping, discrete exact allocator, Bayesian
  personalization.

Most derivations below are verified numerically in the model's suite tests —
`src/lib/business/model/zenith.test.ts` (integration vs. closed form,
derivatives vs. finite differences, root equations, allocator vs. brute force),
plus `zenith-energy.test.ts`, `energy-calibration.test.ts` and the metric
tests. Not all of them: a claim that is a sweep rather than a fixture is backed
by a probe under `scripts/` instead, cited and dated beside the claim (see
`AGENTS.md` §4). A number with neither is unbacked — that is the list to work
down, and it is why §2's concavity property reads the way it does.

---

<!-- section-index:start -->

## Section index

Read a section, not the file: `Read MATH.md offset=<first line> limit=<span>`.
The whole document is ~63k tokens; the largest single section is §8 at ~13k
(§14 is ~10k), and most of the 65 rows below are under 2k. Ranges shift
whenever a section is inserted — reprint the headings with

    node -e 'require("fs").readFileSync("MATH.md","utf8").split("\n").forEach((l,i)=>/^#{2,3} /.test(l)&&console.log(i+1,l))'

```text
§0          110-129  Objective
§1          131-156  Inputs and parameter mappings (unchanged from the articl…
§2          158-274  Productivity curve — v2 change
§3          276-322  Optimal stopping — v2 change: per-task, no longer a univ…
§4          324-422  Allocation — v2 change: discrete blocks, exact greedy, e…
§5          424-747  Personalization — v2 change: full Bayesian posterior
  §5.2      473-558  Recency weighting of the ϕ fit (added 2026-08-04)
  §5.1      560-747  Posterior-aware allocation (added 2026-07-18)
§6          749-761  Summary of v1 → v2 changes
§7          763-794  Known approximations and deliberate non-changes
§8         796-1728  Energy model (zenith-energy.ts) — fatigue-recovery exten…
  §8.1      814-839  Intermittent-rest recovery correction
  §8.2      841-861  Warm-up carryover instead of binary reset
  §8.3      863-900  Verified consequences and an open calibration question
  §8.4     902-1003  Per-task satiety — concave daily value (added 2026-07-14)
  §8.5    1005-1064  Micro-recovery gate — a positive floor for full-demand t…
  §8.6    1066-1125  Optimizer reliability — compound moves and drop-one seed…
  §8.7    1127-1257  Drain-rate calibration from end-of-session ratings (adde…
  §8.8    1259-1320  45-minute plan granularity (added 2026-07-18)
  §8.9    1322-1396  Recovery-rate calibration from pre/post-rest pairs (adde…
  §8.10   1398-1605  Stopping-value calibration from observed stop times (add…
  §8.11   1607-1728  Live stop advisor — §8.10 run forward mid-day (added 202…
§9        1730-1777  References
§10       1779-1865  Revision log (doc-only corrections)
§11       1867-2207  Metric-layer corrections (2026-07-18)
  §11.1   1869-1883  Scope and principle
  §11.2   1885-1909  Zenith Gain: cap instead of a silent 0% when the naive p…
  §11.3   1911-1938  Burnout Risk: overhang counts funded tasks' T* only (for…
  §11.4   1940-1954  Friction Index: raw scales instead of the asymmetric map…
  §11.5   1956-1971  Schedule Integrity: overhead share instead of the small-…
  §11.6   1973-2083  Burnout Risk v2: re-derived from the energy model (2026-…
  §11.7   2085-2109  Momentum: burnout claim removed, fed active tasks (2026-…
  §11.8   2111-2147  Metric scope families: plan / progress / next-up (2026-0…
  §11.9   2149-2207  Overnight reservoir carry-over (2026-07-28)
§12       2209-2333  Plan-adherence audit (2026-07-23)
  §12.1   2250-2333  Per-day fit snapshots (2026-08-03)
§13       2335-2689  Math review, 2026-07-26
  §13.1   2352-2387  Zero ⚡ logs was treated as perfect certainty (§5, §5.1)
  §13.2   2389-2461  Zenith Gain measured the block lattice, not allocation q…
  §13.3   2463-2528  The pooled allocator's "within 1–2%" was a curated-scena…
  §13.4   2530-2566  The stopping fit probed unlogged tasks at an arbitrary p…
  §13.5   2568-2605  Also in this change
  §13.6   2607-2689  The two end-of-day energy readings: a timing difference,…
§14       2691-3343  Plan advice — priced counterfactuals over the day's leve…
  §14.1   2876-3012  Five corrections to the first cut (2026-07-28)
  §14.2   3014-3157  The marginal of the budget (added 2026-08-03)
  §14.3   3159-3343  The price of the switch cost (added 2026-08-04)
§15       3345-3418  Two objectives, two modes (2026-07-29)
§16       3420-3501  Run order stays a heuristic (2026-07-29)
§17       3503-3661  Per-task ϕ offsets stay unbuilt (2026-08-04)
§18       3663-3731  Drain logs are one row per SESSION, not per task-day (20…
§19       3733-3897  The gain's naive baseline paid for switches it never mad…
  §19.1   3745-3804  Defect 1 — billed (n−1) switches, seated fewer than n ta…
  §19.2   3806-3834  Defect 2 — the displayed number moved with the order of …
  §19.3   3836-3874  What this costs, and the one guarantee that weakened
  §19.4   3876-3897  GAIN_PERCENT_CAP is not dead, but its documented trigger…
§20       3899-3961  Human Capacity: the reading is the constraint, but it na…
  §20.1   3940-3961  The tie went to cognitive, so the row blamed the wrong p…
§21       3963-4122  What the gain has room to report (2026-08-07)
  §21.1   3985-4003  The edge is SELECTION at tight budgets and SHAPE at loos…
  §21.2   4005-4028  Why shape has a low ceiling: the activation bonus
  §21.3   4030-4050  Population distribution
  §21.4   4052-4077  The number is a property of the comparison, not of the o…
  §21.5   4079-4094  Under the total-output objective the ranking inverts
  §21.6   4096-4122  Correction: on an ordinary day it is FLOW that binds, no…
```

<!-- section-index:end -->

## 0. Objective

For each task `i`, `p_i(t)` is productivity `t` hours into the task and
`P̄_i(T) = (1/T)∫₀ᵀ p_i(t) dt` its average over a session of length `T`. The
planner maximizes the **sum of average productivities**

```
maximize   Σᵢ P̄ᵢ(tᵢ)
subject to Σᵢ tᵢ + (m − 1)·switchCost ≤ T_budget      (m = tasks with tᵢ > 0)
           [pooled variant] Σᵢ wcᵢ·tᵢ ≤ cognitive pool,  Σᵢ wpᵢ·tᵢ ≤ physical pool
```

This objective (the article's choice, deliberately kept) optimizes the
_quality of hours worked_, not the amount of work done. It is what creates
"optimal stopping" at all: total output `∫p dt` is strictly increasing in `T`
(p > 0 everywhere), so a total-output maximizer would always consume the whole
budget. Under the average-productivity objective, pushing a task past its
optimal stopping time **lowers** the objective, so an abundant budget
correctly leaves slack. (The `zenith-energy.ts` model takes the total-output
alternative; see §8. It is a peer mode, not a successor — §15.)

## 1. Inputs and parameter mappings (unchanged from the article)

User inputs per task: difficulty `Eᵤ ∈ [1,10]`, enjoyment `βᵤ ∈ [1,10]`.

```
E = (4/9)·Eᵤ + 5/9   ∈ [1, 5]      (true effort)
β = (1/9)·βᵤ + 8/9   ∈ [1, 2]      (true enjoyability)

ϕ  = c₁E + c₂β + c₃                 (time to reach flow state, hours)
p₀ = β/E                            (initial productivity)
a  = E·β                            (peak productivity scale)
```

Defaults `c₁ = 0.56, c₂ = −0.24, c₃ = 0.5`; ϕ is floored at 0.1h because a
fitted plane can extrapolate to ≤ 0 far from the measured tasks.

**v2 amplitude cap.** The v2 curve (§2) requires `p₀ < a`. With the mappings
above, `p₀/a = 1/E²`, which reaches exactly 1 at `E = 1` (user difficulty 1) —
a degenerate flat curve. We therefore cap the effective ratio:

```
r = p₀/a  clamped to  r ≤ 0.9        (AMPLITUDE_RATIO_CAP)
```

The cap only binds for `E < 1/√0.9 ≈ 1.054`, i.e. user difficulty below
≈ 1.12 — one sliver of the slider — and keeps `k` (below) strictly positive.

## 2. Productivity curve — **v2 change**

### What changed and why

The article defines `p₀ = β/E` as _initial productivity_, but its curve

```
v1:  p(t) = (a + p₀)·k·t·e^(−kt),   k = 1/ϕ
```

forces `p(0) = 0` for every task — `p₀` was silently just an amplitude term,
and the story the article tells about it ("we start easier on enjoyable,
low-effort tasks") was not actually in the math. v2 uses a curve where the
claim is true:

```
v2:  p(t) = (a·k·t + p₀)·e^(−kt),   k = (1 − r)/ϕ,   r = p₀/a
```

### Properties

`p(0)`, the peak's position and height, the closed-form average and the
marginal are asserted in `zenith.test.ts`. Concavity on the working range and
the decaying tail are **not** — no suite fixture evaluates `p″` or `p` at large
`t`, so they are measured over the slider grid by
`scripts/curve-marginal-facts.probe.ts` instead (2026-08-06: max `p″` on
`(0, T*]` = −1.21e−2, min `(2−r) − kT*` margin 0.256, max `p(200h)` = 6.5e−10).

- **Starts at p₀:** `p(0) = p₀`.
- **Peak exactly at ϕ:**
  `p'(t) = k·e^(−kt)·(a − p₀ − a·k·t) = 0  ⇔  t = (a−p₀)/(a·k) = ϕ`
  (this is why `k` changed from `1/ϕ` to `(1−r)/ϕ`).
- **Peak value:** `p(ϕ) = a·e^(r−1)`. First-order in `r` this is
  `(a/e)(1+r) ≈ (a+p₀)/e` — the v1 peak was the small-p₀ approximation of the
  v2 peak. The gap is `1 − (1+r)·e^(−r)`, which is only small at high
  difficulty: under 1.5% for user difficulty ≥ 4 — and only just, 1.49% at
  difficulty 4 itself — 8.4% at difficulty 2, 22.75% at the r-cap (20 of the 100
  integer slider cells move more than 5%, the whole difficulty 1 and 2 rows;
  enjoyment cannot move the gap at all, since `r = p₀/a = 1/E²` depends on the
  difficulty slider alone — `scripts/curve-marginal-facts.probe.ts`,
  2026-08-06). Nothing displays it either way: `peakProductivity` is carried on
  `TaskAllocation` and `SuggestedTask` and rendered by no component.
- **Concave on the working range:** `p'' = a·k²·e^(−kt)·(kt − (2 − r))`, so
  the only inflection sits at `x = kt = 2 − r` — and `x* < 2 − r` holds for
  every r (fact 3 under "Marginal of the average" below), so the curve has
  no convex kink before you'd stop anyway. (An earlier revision argued
  `x* ≤ 1.7933 < 2 − r`, which only covers `r ≤ 0.207` since `2 − r` drops
  to 1.1 at the r-cap; the claim was always true, but that wasn't a proof —
  see §10.)
- **Decays to 0** as `t → ∞` — the burnout tail is preserved.

(Pedantic note: the article calls the v1 shape "a Poisson distribution"; it is
a Gamma(2)/Erlang-2 _density_ shape. Poisson is discrete.)

### Average productivity (closed form)

With `x = kT`, `f(x) = 1 − e^(−x)(x+1)`, `g(x) = 1 − e^(−x)`:

```
∫₀ᵀ a·k·t·e^(−kt) dt = (a/k)·f(x)          (integration by parts)
∫₀ᵀ p₀·e^(−kt) dt    = (p₀/k)·g(x)

P̄(T) = a·[f(x) + r·g(x)] / x
```

Series `f ≈ x²/2 − x³/3`, `g ≈ x − x²/2 + x³/6` are used below `x < 10⁻⁴` to
avoid catastrophic cancellation.

### The activation bonus (important structural consequence)

```
lim T→0⁺ P̄(T) = p₀   but   P̄(0) := 0
```

A task you _touch at all_ immediately contributes ≈ p₀ of average
productivity; a task you skip contributes nothing. The objective is therefore
**discontinuous at tᵢ = 0 and not concave** — this is the single deepest
consequence of the v2 curve, and it is what forced the allocator redesign
(§4): v1's Lagrange/KKT machinery ("equalize marginals at λ") and the pooled
dual coordinate descent both _require_ a concave objective, so their
optimality guarantees do not survive the new curve.

### Marginal of the average

```
dP̄/dT = a·k·N(x)/x²,   N(x) = e^(−x)·(x² + (1+r)x + (1+r)) − (1+r)
lim T→0⁺ dP̄/dT = a·k·(1−r)/2 = k(a−p₀)/2
```

Three structural facts about N, all provable on paper — so the allocator's
exactness does not hang on a numeric sweep (these were stated as "verified
numerically" before 2026-07-14, see §10; the sweeps in `zenith.test.ts`
remain as regression checks):

1. **Sign structure.** `N(0) = 0` and `N'(x) = e^(−x)·x·(1 − r − x)`: N
   rises on `(0, 1−r)`, peaks at `x = 1−r`, then decreases strictly toward
   `−(1+r)`. So N has exactly one positive root `x*` (with `x* > 1−r`),
   `N > 0` on `(0, x*)`, and `N < 0` on `(x*, ∞)`. The marginal stays
   negative FOREVER past the optimum — a later block can never turn
   positive again, which is what makes §4's
   truncate-at-first-non-positive-increment rule sound.

2. **Strictly decreasing marginal.** Writing the marginal shape as
   `M(x) = N(x)/x²`, we get `M'(x) = D(x)/x³` with `D(x) = x·N'(x) − 2·N(x)`.
   Then `D(0) = 0` and `D'(x) = e^(−x)·x²·(x + r − 2) < 0` for `x < 2 − r`,
   so `D < 0` and M strictly decreases on all of `(0, 2 − r)` — a range that
   strictly contains the whole working range `(0, x*]` by fact 3. This
   monotonicity is what makes the per-block increments diminishing, which
   the greedy allocator's exactness (§4) rests on.

3. **Stopping happens before the inflection:** `x* < 2 − r`. Substituting
   `x = 2 − r` into N gives `u(r) := N(2−r) = e^(r−2)·(7 − 2r) − (1+r)`,
   which is convex in r (`u'' = e^(r−2)·(3 − 2r) > 0` on `[0, 1]`) with
   negative endpoints (`u(0) = 7e⁻² − 1 ≈ −0.053`,
   `u(1) = 5e⁻¹ − 2 ≈ −0.161`), hence negative on the whole range. By fact
   1's sign structure the root must lie earlier: `x* < 2 − r`. This is the
   missing piece behind §2's concavity-on-the-working-range property.

## 3. Optimal stopping — **v2 change: per-task, no longer a universal 1.79ϕ**

Setting `N(x) = 0` and rearranging:

```
eˣ = 1 + x + x²/(1+r)
```

- `r = 0` recovers the article's `eˣ = x² + x + 1` with root
  `x* = 1.7933` (kept exported as `OPTIMAL_PHI_MULTIPLIER`, now documented as
  the r→0 limit and upper bound).
- `x*(r)` is strictly decreasing in r. The stopping time is

  ```
  T* = x*(r)/k = ϕ · x*(r)/(1−r)
  ```

- **Multiplier range:** expanding `eˣ` to third order at small x gives
  `x*(r) → 3(1−r)/(1+r)` as r → 1, hence `T*/ϕ → 3/(1+r) → 1.5`. That 1.5 is
  an ASYMPTOTE, not a reachable value: `AMPLITUDE_RATIO_CAP` bounds r at 0.9,
  where the multiplier is **1.5194**. So every task stops between
  **1.5194ϕ and 1.7933ϕ**, approaching 1.5ϕ only as r → 1 (which the cap
  forbids — §1). Interpretation: tasks that start
  productive (high p₀ relative to peak) stop _earlier_ — their early hours
  were already good, so the declining tail drags the average down sooner.
- Solved by 60-step bisection of `q(x) = eˣ − 1 − x − x²/(1+r)` on
  `(0, 1.80]`; `q < 0` before the root and `> 0` after, and the root is
  ≤ 1.7933 for all r ≥ 0. `findOptimalSingleTaskTime` is now closed-form via
  this root — the v1 Newton-Raphson iteration is gone.

The best achievable average `P̄(T*)` is computed per task and exposed as
`TaskAllocation.optimalAvgProductivity`; it replaced the v1 constant
`OPTIMAL_AVG_FRACTION = x/(x²+x+1) ≈ 0.2984` (removed — only valid when the
multiplier was universal). The metric layer's _priority score_ is this value:
a task's intrinsic worth independent of what the current plan gives it.

That independence holds at **every** budget, zero included (2026-07-29). `ϕ`,
`T*`, the peak height `a·e^(r−1)` and `P̄(T*)` are functions of the task's own
(E, β) and the user constants alone, so the empty plan reports them unchanged
and only the two allocation-dependent fields — `allocatedHours` and
`avgProductivity` — go to 0 (`P̄(0) := 0`, §2). Previously the `budget ≤ 0`
short-circuit zeroed all of them, which made a task's intrinsic priority read 0
at exactly the boundary where it is the only thing left to rank by, and made a
stored day with completions but no recorded hours read 0% complete (the
priority-weighted completion rate divided by a zero total). Under a fit
posterior the empty plan is hedged like any other — it carries the expected
values, not the certainty ones.

## 4. Allocation — **v2 change: discrete blocks, exact greedy, exact subset search**

### Why v1's continuous solver was replaced

1. **Humans plan in blocks.** v1 emitted "1.84h"; v2 plans whole 15-minute
   blocks (`BLOCK_HOURS = 0.25`). Budget below one block is left unplanned —
   a sub-15-minute sliver is not a real session.
2. **The activation bonus (§2) broke v1's math.** λ-bisection over "marginal
   = price" cannot see a fixed jump at t = 0, and the pooled dual descent's
   convergence argument assumed concavity. Their "exact" answers were exact
   for a model we no longer have.
3. **The discrete problem is _more_ exactly solvable, not less.** With
   diminishing per-block increments, greedy marginal analysis is provably
   optimal for a single shared budget (Fox 1966; Ibaraki & Katoh 1988) — no
   tolerances, no rescaling patch-ups, no rounding-residual redistribution
   (all deleted).

### The algorithm

Per task, precompute block increments
`Δᵢ(j) = P̄ᵢ(j·δ) − P̄ᵢ((j−1)·δ)`, truncated at the first non-positive value
(the discrete optimal stopping point — later blocks would lower the
objective and are never offered). `Δᵢ(1)` carries the activation bonus
(≈ p₀ᵢ), and subsequent increments decrease — verified across the domain in
tests, including under fast-flow fitted constants that hit the 0.1h ϕ floor.

- **Single budget:** greedily fund the highest remaining increment until the
  block budget runs out. This is _exactly_ optimal (equivalently: take the
  top-B increments of the merged sorted lists; the diminishing property makes
  per-task prefixes valid). Ties break toward lower task index, which
  round-robins identical tasks into the equal split the article's sanity
  check demands.
- **Switch cost (fixed charge):** a plan funding m tasks pays
  `(m−1)·switchCost` off the budget before any block is placed. Which tasks
  deserve funding is a combinatorial decision greedy can't price, so for
  n ≤ 12 we **enumerate every funded subset** (≤ 4095 greedy runs — instant)
  and keep the best plan; ties prefer funding more tasks. This is exact and
  replaced v1's iterative count-resolution + greedy drop-search heuristic.
  A subset that leaves a member at 0 blocks is never strictly better than
  the smaller subset (which gets more budget), so enumeration stays exact
  without special cases. For n > 12: greedy forward selection on the funded
  set (documented heuristic; a daily planner rarely exceeds 12 tasks).
- **Capacity pools:** same greedy, but a block is eligible only while both
  pools can absorb its weights. Multi-constraint greedy is not provably
  exact (multi-dimensional knapsack), and it has a known blind spot: it
  ranks blocks by _value_, not value per unit of _scarce resource_ — e.g. an
  hour off a weight-1.0 task frees enough pool for ~3.3h of a weight-0.3
  task. So whenever greedy was actually blocked by a pool, the pool-bound
  path builds a second, ratio-ranked candidate plan and runs a
  **resource-aware improvement pass** on both, keeping the better end state:
  donate 1, 2 or ALL of a donor's blocks and greedily refill the freed time +
  pool capacity, plus an admission move that forces one block into an
  unfunded task and evicts the cheapest funded blocks. Every move is kept
  only on strict improvement (strictness prevents cycles). The three pieces,
  and why one-block-at-a-time stalls, are in §13.3. Regression tests hold the
  result within 1–2% of brute-force block optima on the scenarios that broke
  earlier heuristics — a report on those scenarios, not a bound: §13.3
  measures per-seed worsts of 3.37–5.28% over app-reachable days. The
  single-constraint path skips the pass entirely and keeps its exactness.

The allocator's verified exactness claim, precisely stated: **with σ_ϕ = 0,
for the single-budget problem with switch cost and n ≤ 12, the returned plan
attains the true maximum of the objective over all block-quantized plans.**
(Test: brute force over every block distribution × funded-subset overhead.)
Under a fit posterior it does **not** hold: §5.1's monotone-prefix truncation
takes blocks off the menu before the search sees them, and the plan-level cost
is 21 of 4000 cases non-exact at σ/ϕ̂ ≈ 0.5 — the shipped
`PHI_UNCERTAINTY_RELATIVE_CAP` — mean forfeit 0.0074%, worst **5.2607%**, and
all 21 are truncation rather than search (probe 2026-08-06). At σ/ϕ̂ ≤ 0.3 it
is 0 of 4000.

**Measured, not just proved** (`scripts/allocator-exactness.probe.ts`,
2026-08-06). The test behind that sentence is one hand-picked case — 3 tasks
(8/3, 4/9, 6/6), budget 3 h, `switchCost` 0.25, default constants. The seams
it cannot reach are now pinned by a second single-budget brute-force test
beside it (`zenith.test.ts`, 9 cells: budgets 2.75 ± 1e-9 and 3.13 ×
`switchCost` ∈ {0.1, 0.33, 0.5}); every _other_ brute-force comparison in the
suite is on the POOLED path, the one §4 does _not_ claim exact. Swept against
full enumeration over **6400 cases**
(n ∈ 2–5, four budget families, `switchCost` ∈ {0, 0.1, 0.2, 0.25, 0.33, 0.5,
1.0}, four constant sets spanning ϕ 0.10–7.60 h): **0 non-exact, worst gap
0.0000%**. The three seams the single fixture cannot reach — budgets a hair
either side of a block boundary and budgets nowhere near one (its own budget of
3 h sits exactly _on_ the lattice, and its `switchCost` is exactly one block),
switch costs that are not multiples of `BLOCK_HOURS`, and ϕ far from mid-range
— are all clean.

One methodological note worth keeping, because it cost a run. The first cut
charged feasibility in HOURS (`used·BLOCK_HOURS + overhead ≤ budget + 1e-9`)
and reported non-exactness that was pure admissibility. Re-measured 2026-08-06
(`scripts/alloc-epsilon-methodology.probe.ts`) the hour rule reports **158/2400**
non-exact, worst **49.3341%**, and 158/158 of them are a lattice±ε budget whose
optimum the allocator is not allowed to place — against **0/2400** under the
block rule. (The original run's own 98/2400 and 49.72% cannot be reproduced: it
was thrown away with the first cut.) `budgetBlocksFor`'s
epsilon is 1e-9 of a BLOCK, four times tighter, so the two sides disagreed
about which plans were _admissible_ rather than which was _best_. A reference
that admits plans the allocator may not place measures the tie-break
convention, not the search.

## 5. Personalization — **v2 change: full Bayesian posterior**

The article prescribes measuring time-to-flow ("⚡ logs") and fitting
`ϕ = c₁E + c₂β + c₃` by least squares. v1 already used ridge regression
toward the defaults; v2 recognizes that ridge as the MAP of a Bayesian model
and exposes the whole posterior:

```
Model:      ϕᵢ = c·xᵢ + εᵢ,   εᵢ ~ N(0, σ²),   xᵢ = [Eᵢ, βᵢ, 1]
Prior:      c ~ N(c₀, (σ²/λ)·I),   c₀ = defaults,   λ = 4

Posterior:  mean  ĉ = (XᵀX + λI)⁻¹(Xᵀϕ + λc₀)       ← identical to v1's ridge
            cov   Σ = σ̂²·(XᵀX + λI)⁻¹
Noise:      σ̂² = (ν₀σ₀² + Σ(ϕᵢ − ĉ·xᵢ)²)/(ν₀ + n),
            σ₀ = 0.25h (15-minute stopwatch noise floor), ν₀ = 4
Predictive: std of a new measurement at (E, β):  √(σ̂² + xᵀΣx)
```

Why: the MAP point estimate is unchanged (no behavior change from v1 fits),
but a 2-log fit and a 200-log fit are no longer indistinguishable —
`phiPredictionStd` quantifies it (parameter uncertainty shrinks with data and
grows with distance from the logged region). Intended uses: UI bands
("ϕ ≈ 1.4h ± 0.4h") and robust allocation — the latter is now implemented:
since 2026-07-18 the allocator consumes the posterior directly (§5.1).

Unchanged v1 safeguards: fallback to defaults on zero observations or when
the fitted plane predicts ϕ > 16h anywhere on the domain; negative
predictions at unobserved corners are allowed (fast-flow users legitimately
tilt the plane) and absorbed by the 0.1h floor. **Every return carries a
posterior, including those fallbacks** — falling back means "the prior is all
we know", and at n = 0 the formulas above give exactly Σ = (σ₀²/λ)·I and
σ̂² = σ₀² (§13.1). `fitted` still reports whether the DATA moved the
constants; that is what the UI keys on.

**Removed 2026-07-26 — the optional forgetting factor.** Observation weights
wᵢ = γ^(n−1−i) let a user whose flow behavior drifts shed stale logs
(recursive-least-squares style; γ ≈ 0.98 ≙ ~34-log half-life). It was never
passed by any caller, never reached the UI, and was not on the roadmap, while
carrying a paragraph of doc and a silent ordering contract (observations had
to arrive oldest-first, which nothing enforced). With it gone `Σwᵢ` collapses
to `n` everywhere, and `FitPosterior.nEff` — which existed only to report the
weighted count — went with it; callers that wanted a count had
`observations.length` (which `readUserFit` returned as `usedCount`, until §5.2
made it a weighted sum). §10's half-life correction is kept below as history.
If drift-forgetting is ever
wanted again, the right instrument is probably a timestamp on each ⚡ log,
not a decay over arrival index. **That is what §5.2 now does** — the weights
are back, keyed on the log's date rather than its position.

### 5.2 Recency weighting of the ϕ fit (added 2026-08-04)

**The problem.** Every fit above reads the user's ENTIRE ⚡ history at equal
weight, and ϕ is not stationary. Someone who reached flow in 1h at 20 and needs
2h at 30 is fitted at 1.5h — a person who never existed, and who is wrong about
the person logging today. Ageing is the slow version; a new job, a newborn, an
illness, a medication change or a shifted sleep schedule move ϕ in weeks.

**The weights.** Each observation carries `ageDays`, the calendar days between
its log date and today, and enters the fit with

```
wᵢ = 2^(−max(0, ageDaysᵢ)/H),   H = PHI_RECENCY_HALF_LIFE_DAYS = 365
```

Every `n` in §5 becomes `Σwᵢ`, and the sums become weighted sums:

```
Posterior:  ĉ = (XᵀWX + λI)⁻¹(XᵀWϕ + λc₀),   W = diag(w)
            Σ = σ̂²·(XᵀWX + λI)⁻¹
Noise:      σ̂² = (ν₀σ₀² + Σwᵢ(ϕᵢ − ĉ·xᵢ)²)/(ν₀ + Σwᵢ)
Data mass:  effectiveCount = Σwᵢ
```

`ageDays` omitted ⇒ wᵢ = 1 ⇒ every formula collapses **exactly** to §5, and a
test pins that bit-equality. The `max(0, …)` floor exists for one reachable
case: a backup restored from a device with a fast clock carries a log dated
ahead of today, and an unfloored 2^(−age/H) would exceed 1 and let that single
log outvote the rest.

**Why a half-life and not a cutoff.** A hard window ("only the last 2 years")
is a step function: a log at 2y−1d counts fully and one at 2y+1d counts zero.
Worse, it interacts badly with sparse logging — drop a light user under the
data the fit needs and `fitted` goes false, so the model falls back to
`DEFAULT_USER_CONSTANTS`. Falling back to a stranger's defaults is a larger
error than a somewhat stale personal fit. The exponential has no cliff, never
fully discards a log, and degrades toward the prior exactly as a fit with
little data already does — the ridge machinery needs no new case.

**Why H = 365 days.** Slow enough that a steady logger keeps a personal fit
through a quiet stretch; fast enough that the 10-year problem above is gone
(a decade-old log lands at 2⁻¹⁰ ≈ 0.001, and the effective memory is ≈ 1.44
years of logs). Shrinkage compresses the effect: at 3 half-lives (w = ⅛) a
single log still moves the prediction ≈ ⅓ as much as a fresh one, not ⅛ —
the ridge denominator is λ-dominated at small Σw, so the weights bite less
than their ratio suggests. Directionally right, deliberately gentle.

**Σw is the number the UI prints, and the usual n_eff is the wrong statistic.**
The "Your model" card's ϕ row says "N ⚡ logs"; with weighting, N raw logs no
longer describes what moved the fit, so the row reports Σw — "what this history
is worth in fresh logs" — fractional, one decimal, labelled recency-weighted.

The textbook effective sample size (Σwᵢ)²/Σwᵢ² was tried first and is wrong
here: it measures how EVENLY weight is spread, not how much of it there is. A
user who logged 20 times ten years ago and stopped has equal weights, so it
scores a full 20.0 — printed beside a fit that has essentially returned to the
prior. Measured on the card's reference task (difficulty 5, enjoyment 5), 20
logs of ϕ = 4h aged ten years: Σw = 0.0195, and the row reads 109.4 min against
a 102.5 min default — 6.9 of the 135 minutes the same 20 logs move when fresh
(237.5 min). Σw reports 0.0; n_eff would have reported 20.0. Every figure in
this paragraph is `scripts/post-recency-weighting.probe.ts` (2026-08-06), which
also prints the shrinkage profile above and checks Σw ≤ n over 2000 seeded
histories.

Σw ≤ n always, with equality exactly when no log is older than today — same-day
logs, and (via the `max(0, ·)` floor above) future-dated ones — which is
also what makes "3.5 ⚡ logs" read correctly.

**Scope: ϕ only.** `fitRecoveryRate` (r, §8.9), `fitDrainRate` (α, §8.7) and
`fitStoppingValue` (λ₀, §8.10) are **unweighted** and read their whole history
— unchanged by this section. Three reasons, and they should be revisited
together rather than one at a time:

- ϕ has by far the most log-years behind it. r and α come from ☕/🪫 ratings
  that only became loggable later, and λ₀ needs finished days, so none of the
  three yet spans a period over which drift dominates noise.
- The three energy fits are 1-D ridges over much noisier self-reports; halving
  the data mass costs proportionally more there than it does on ϕ's 3-parameter
  plane, and the drain fit already saturates at large α (§8.7).
- Calibration order is load-bearing (§8.7/§8.9/§8.10): α is fitted conditioned
  on r, and λ₀ on both. Weighting one and not its conditioner would fit α from
  recent drain logs against an r averaged over all history — an inconsistency
  the current all-or-nothing scope avoids.

Consequence to keep in mind when reading the card: its five rows (four fits) do
not all answer "over what period?" the same way.

### 5.1 Posterior-aware allocation (added 2026-07-18)

**What changed.** Both allocators (`calculateTaskAllocations`,
`calculatePooledAllocations`), `calculateTotalProductivity`, and both gain
functions now take an optional `FitPosterior`; the metric layer, dashboard,
energy-lab comparison, and calendar/analytics summaries pass the live fit's
posterior through. With it, each task's objective term becomes the
**expected** average productivity under that task's ϕ-uncertainty:

```
E[P̄(T; ϕ)],   ϕ ~ N(ϕ̂, σ_ϕ²),   σ_ϕ = √(xᵀΣx),  x = [E, β, 1]
```

Without a posterior (or at σ_ϕ = 0) every formula collapses **exactly** to
the §2–4 model — the certainty model is the zero-uncertainty special case,
not a separate code path, and a test pins `expectedAverageProductivity(…, 0)`
to bit-equality with `averageProductivity`. Before this change the allocator
consumed only the posterior mean: a plan built from 2 logs and one built from
200 logs were identically confident (flagged as future work in §5; now done).

**The expectation.** Only `k = (1−r)/ϕ` depends on ϕ — `a`, `p₀`, `r` do not
— so the mixture is over curves of identical shape and different time scale:

```
E[P̄](T) = Σₙ wₙ · P̄(T; kₙ),   kₙ = (1−r)/ϕₙ,   ϕₙ = max(0.1, ϕ̂ + √2·σ_eff·ξₙ)
```

with (ξₙ, wₙ) the 5-node Gauss–Hermite rule (exact for polynomial integrands
through degree 9, so its own leading error rides on the 10th ϕ-derivative of
P̄ and is negligible; moment checks to 4.5·10⁻¹⁶ through degree 9, and 12.7%
at degree 10 — `scripts/post-quadrature-floor.probe.ts`, 2026-08-06).
**The accuracy floor is not the rule's order** — it is the ϕ-floor clamping of
the outer nodes (weight 0.0113 each), which narrows the effective mixture below
N(ϕ̂, σ²) once `ϕ̂ − √2·σ·2.0202 < 0.1h`, and the INNER nodes (weight 0.2221
each) join it below ϕ̂ ≈ 0.31h. Inside the σ-cap that is a sub-1% shift of the
mean ϕ for every ϕ̂ ≳ 0.31h, rising to **16.7%** for a ϕ̂ pinned at the 0.1h
floor — the same graceful degradation the cap exists
to bound, at the one ϕ̂ where the floor is most of the story. Structural facts
that survive the mixture untouched:

- **Activation bonus unchanged:** `lim T→0⁺ P̄(T; kₙ) = p₀` for every node, so
  the first-block jump (§2) is exactly p₀ regardless of σ.
- **Peak height unchanged:** `p(ϕ) = a·e^(r−1)` is ϕ-free, so
  `peakProductivity` needs no expectation — uncertainty moves WHEN your best
  hours happen, not how good they are.
- **Uncertainty is a strict penalty:** every component attains the same
  maximum value `F(x*)` at its own T*, so no single T reaches it for all
  components at once ⇒ `max_T E[P̄] < P̄(T*; ϕ̂)` whenever σ > 0. A task's
  `optimalAvgProductivity` (= the dashboard priority score) now decreases
  with uncertainty — hedging emerges from the math, no ad-hoc discount.
- **Expectation is linear across tasks:** `E[Σᵢ P̄ᵢ] = Σᵢ E[P̄ᵢ]`, so the
  cross-task correlation of the ϕᵢ (they share the fitted c) is irrelevant
  to the objective. It would matter only for risk measures beyond the mean
  (CVaR-style robust allocation), which is out of scope.

**Why parameter std and not the predictive std.** `phiPredictionStd` adds the
irreducible noise σ̂², which is floored at 15 minutes by construction (§5) —
using it would make the allocator hedge forever, even for a user with
hundreds of consistent logs. `phiParameterStd = √(xᵀΣx)` is the part the
data can actually remove: it shrinks to 0 as logs accumulate (and grows with
distance from the logged region), so a well-measured user recovers the
classic plan exactly. That matches the §5 motivation — distinguishing the
2-log fit from the 200-log fit — rather than modeling day-to-day ϕ drift,
which the rating instrument cannot separate from stopwatch error.

**Keeping the allocator exact — two guards** (both probe-driven,
2026-07-18). The §4 greedy needs per-task increment menus that are positive
and non-increasing. The mixture can break this: past a component's inflection
(x = 2−r, §2) its marginal rises back toward 0⁻, so a wide mixture of a
"spike" component (ϕ floor) with slow components turns bimodal in T. The
uncapped probe grid (r × ϕ̂ × σ, 504 cases) showed pre-crossing monotonicity
violations and 18 bimodal cases losing up to 59% of a task's value to
truncation. The guards:

1. **Relative σ cap** `σ_eff = min(σ_ϕ, 0.5·ϕ̂)`
   (`PHI_UNCERTAINTY_RELATIVE_CAP`): at 0.5·ϕ̂ the probe grid has zero
   bimodal cases and zero truncation loss. Beyond it a Gaussian is a poor
   posterior for a positive quantity anyway (significant mass below 0), so
   the cap is graceful degradation, not information loss.

   **Re-measured 2026-08-06 by `scripts/phi-uncertainty-cap.probe.ts`, and
   "zero and zero" is false as written.** Rebuilding the grid — r × ϕ̂ (0.1–8h)
   × σ/ϕ̂ ∈ 0…1.5 in 0.05 steps, 4340 cells, menus built exactly the way
   `buildBlockIncrements` builds them (same span, same 1e-12 tolerances) —
   finds INSIDE the cap 7 bimodal cells, 51 cells that forfeit value to the
   menu cut — 44 of them to the monotone-prefix cut and the 7 bimodal ones to
   the non-positive cut (worst **26.53%** at r = 0.3, ϕ̂ = 8h, σ = 2.8h) — and
   7 of 1400 σ > 0 cells whose bisection bracket holds ≠ 1 crossing. All three
   first appear at σ/ϕ̂ ≈ 0.35 (4000 seeded random cells put the first loss at
   0.342), which is where the low outer node ϕ̂·(1 − 2.857·σ/ϕ̂) collapses onto
   the ϕ floor — so **0.5 is not the boundary, ≈ 0.35 is**, and the cap was set
   a round number OUTSIDE the regime it exists to exclude, not inside it.

   Two things keep that from being a live defect. Restricted to ϕ̂ ≤ 3.06h, the
   ceiling `DEFAULT_USER_CONSTANTS` can reach, the same sweep is clean — 0
   bimodal, 0 truncation loss, 0 miscrossings over 990 cells — so the damage
   needs a fitted ϕ̂ past 3h, the same "extreme corner" guard 2 already names.
   And the cap does buy what it was chosen for: unclamped, σ/ϕ̂ > 0.5 gives 909
   bimodal cells and up to 53.14% truncation loss (the same order as the 18 /
   59% recorded above, from a smaller grid), and clamping removes all of it —
   2800/2800 above-cap cells are bit-identical to their σ/ϕ̂ = 0.5 twin. The
   honest statement is that 0.5 bounds the mixture's misbehavior for every ϕ̂ a
   default-constants user can have, not that it eliminates it everywhere.

   **The cap stays at 0.5, and that is now measured rather than argued**
   (2026-08-06, `scripts/phi-cap-reachability.probe.ts`). The paragraph above
   defends 0.5 with a statement about a GRID — "the damage needs a fitted ϕ̂ past
   3h" — which says nothing about whether a real ⚡ history can produce ϕ̂ > 3.06h
   and σ/ϕ̂ > 0.35 **at the same time**. It essentially cannot, and the reason is
   structural: the ridge anchors ĉ to the default with λ = 4 pseudo-observations,
   so few logs (large σ) pull ϕ̂ back into the clean region while many logs (ϕ̂
   free to move past 3h) shrink σ. The two requirements are in opposition, and
   the sweep shows them never meeting. Over 576 000 (fitted user × slider) cells
   from habit-shaped histories (1–34 logs, three coverage widths, σ_log ∈ {0.25,
   0.5}, true constants drawn out to ϕ(5,1) ≈ 8h): **0 cells in the corner**. The
   extremes are the proof — the largest σ/ϕ̂ seen is 3.951, at ϕ̂ = 0.10h (the
   floor), and the largest ϕ̂ seen is 8.04h, at σ/ϕ̂ = 0.024.

   Extrapolation is the one mechanism that can satisfy both, since
   `σ_ϕ = √(xᵀΣx)` grows with distance from the logged region. Probed on purpose
   — every log at the easy/enjoyable corner, every query at the hard/unenjoyable
   one — it reaches the corner and **the corner turns out to be empty of
   damage**: 5 cells of 28 800, all at its very edge (ϕ̂ 3.23–3.49h, σ/ϕ̂
   0.351–0.365), every one forfeiting **0.0000%**. Their r is 0.040–0.048, while
   the 26.53% cell above needs r = 0.3 — and r spans 0.04–0.90 over the slider
   grid, so that is the fit declining to go there, not an unreachable curve
   shape. A control arm with truth = `DEFAULT_USER_CONSTANTS` also finds 0 corner
   cells, though it does put fitted ϕ̂ as high as **3.73h**: the 3.06h ceiling
   bounds the CONSTANTS, not the fit, and log noise carries ϕ̂ past it harmlessly.

   **Lowering the cap to 0.35 would cost more than it buys, which is why it was
   rejected.** It is the obvious repair and it is the wrong one: it changes the
   hedging of **1.23%** of habit-shaped cells — every cell past σ/ϕ̂ = 0.35,
   newly clamping those up to 0.5 and clamping the rest harder — and clamping means
   hedging LESS — worst case **+6.809%** of reported task value conjured out of a
   tighter σ, with T\* moving up to 0.244h, at ϕ̂ = 0.47h with σ/ϕ̂ = 0.53 (a cell
   the shipped cap already clamps; the newly-clamped band (0.35, 0.5] approaches
   that figure from below). Those
   are precisely the few-log users §5.1 exists to hedge for. Against 0.0000% of
   measured loss, the trade is ~7% harmful and 0% helpful. What is real here is a
   **documentation** defect, now fixed: guard 1's original "zero and zero" was
   false, and the cap's actual warrant is that the fit cannot reach the region
   the cap fails to exclude. The two fixes that would address the root cause —
   renormalizing the floor-clamped quadrature node, or a lognormal ϕ posterior —
   remain available if the fit ever changes, and both are unmotivated today.
   Synthetic histories, as everywhere in this repo; re-run on a real export.

2. **Monotone-prefix menu truncation:** `buildBlockIncrements` stops at the
   first non-positive OR non-decreasing increment. Inside the cap the
   violations are small in absolute terms (worst `Δ(j) − Δ(j−1)` = 1.3·10⁻⁴)
   but not small relatively — up to **117%** of the preceding increment — and
   they are not one corner: 44 of 1540 grid cells, ϕ̂ 5–8h × σ/ϕ̂ 0.35–0.5, with
   the low outer node floor-clamped in every one (2026-08-06,
   `scripts/post-monotone-prefix-cost.probe.ts`).
   Cutting the menu there restores Fox's diminishing-increments premise BY
   CONSTRUCTION rather than by sweep, at a cost that is a few low-value blocks
   in most of those cells and up to 44 blocks (11h, 26.53% of the task's value)
   in the worst; after budget competition the plan-level forfeiture is 21 of
   4000 cases and at most **5.26%** (`allocator-exactness.probe.ts` arm B at
   σ/ϕ̂ ≈ 0.5, mean 0.0074%). Guard 1's reachability argument is what keeps that
   off a real user's plan. At σ = 0 the cut can never
   trigger (increments are strictly decreasing — proved in §2).

**Expected optimal stopping.** `T*_E = argmax E[P̄]` has no closed form; it is
found by 60-step bisection of the mixture marginal `Σ wₙ·dP̄/dT(T; kₙ)` on
`[T*(ϕ_min), T*(ϕ_max)]` — below the bracket every component's marginal is
positive, above it every one is negative, and inside the cap the bracket holds
exactly one crossing for every ϕ̂ a default-constants user can reach — with 7 of
1400 σ > 0 grid cells at ϕ̂ > 3h the exception (2026-08-06,
`scripts/phi-uncertainty-cap.probe.ts`), the corner guard 1 shows a real fit
cannot reach. `TaskAllocation.optimalHours` and
`optimalAvgProductivity` are now these expected quantities (σ = 0: the §3
closed form, unchanged).

**Consequences** (locked in as unit tests): exact σ = 0 collapse across the
domain grid; strictly lower achievable average for σ > 0; diminishing
mixture increments at σ/ϕ̂ ∈ {0.1, 0.3, 0.5} across the domain; ϕ̂ and peak
displays unchanged by hedging; and end-to-end, a 2-log fit hedges every
task's priority more than a 200-log fit of the same user (measured against
each fit's own zero-posterior twin, isolating the uncertainty effect from
the constants shift).

**Rejected alternative — delta method.** `E[P̄] ≈ P̄ + ½σ²·∂²P̄/∂ϕ²` (with
`∂²P̄/∂ϕ² = (x²F″ + 2xF′)/ϕ²`) needs a hand-derived F″ with the same
catastrophic-cancellation care as the §2 kernels, is exact only to O(σ⁴),
and can go negative at wide σ. The quadrature reuses the existing verified
kernels, is exact to higher order, and costs 5 curve evaluations per block —
negligible next to the subset enumeration.

## 6. Summary of v1 → v2 changes

| #   | What                   | v1                                                                     | v2                                                                                    | Why                                                                                                                                    |
| --- | ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Curve                  | `(a+p₀)·k·t·e^(−kt)`, `p(0) = 0`                                       | `(a·kt+p₀)·e^(−kt)`, `p(0) = p₀`                                                      | Make "initial productivity" actually true; article's own story about p₀ wasn't in its math                                             |
| 2   | `k`                    | `1/ϕ`                                                                  | `(1−r)/ϕ`                                                                             | Keep the peak exactly at t = ϕ under the new curve                                                                                     |
| 3   | Peak value             | `(a+p₀)/e`                                                             | `a·e^(r−1)`                                                                           | Exact peak of new curve; v1 value is its small-r approximation                                                                         |
| 4   | Optimal stopping       | universal `1.7933·ϕ`                                                   | per-task `ϕ·x*(r)/(1−r) ∈ [1.5194ϕ, 1.7933ϕ]`                                         | Follows from the new curve; root of `eˣ = 1+x+x²/(1+r)`                                                                                |
| 5   | `OPTIMAL_AVG_FRACTION` | constant 0.2984                                                        | removed → per-task `optimalAvgProductivity`                                           | Only valid when the multiplier was universal                                                                                           |
| 6   | Allocator              | continuous λ-bisection + dual descent + drop-search + rounding patches | 15-min blocks, greedy marginal analysis, exact subset enumeration, pool transfer pass | Activation bonus breaks concavity (v1 guarantees void); discrete greedy is provably exact for the single budget; humans plan in blocks |
| 7   | Allocation output      | arbitrary 0.01h values                                                 | multiples of 0.25h; `optimalHours` + `optimalAvgProductivity` fields added            | Executable plans; downstream metrics need per-task T*                                                                                  |
| 8   | Constants fit          | ridge point estimate                                                   | same MAP + posterior covariance, noise estimate, predictive std                       | Quantify uncertainty; the ridge already _was_ the MAP of this Bayesian model (v2's forgetting factor was removed 2026-07-26, §5)       |
| 9   | Switch-cost meaning    | unspecified                                                            | documented as attention residue (Leroy 2009), distinct from ramp-up (already in ϕ)    | Prevents future double-counting "fixes"; 0.25h grounded in Mark et al. 2008                                                            |

## 7. Known approximations and deliberate non-changes

- ~~**Naive baselines stay continuous.**~~ **REVERSED 2026-07-26 (§13.2):**
  the naive split is now block-quantized like the optimized plan. The old
  reading ("quantization is part of what Zenith imposes") charged the lattice
  to one side of the comparison and made the reported gain negative on
  3.8–7.8% of random days (the "4–19%" first quoted here came from an
  uncommitted draw that does not reproduce — §13.2, 2026-08-06).
- **The naive baseline is rotation-averaged, not order-free.** §19 removed the
  gain's dependence on task-list order by averaging over the n cyclic rotations.
  That is EXACTLY permutation-invariant only while no pool binds — the objective
  is a sum of per-task terms, so only each task's marginal frequency matters.
  When a pool binds, the skips are not separable and a residue survives:
  permutation-exact on 96.13% of 2400 days, worst baseline spread 1.61%, worst
  reported-gain spread 3.4pp (2026-08-06, §19.2). A displayed metric that still
  moves 3.4pp on a reorder is the kind of thing this list exists to name.
- **Pooled greedy + ratio candidate + improvement pass + admission move is a
  heuristic** (multi-dimensional knapsack is NP-hard). There is no envelope to
  quote: five seeds × 2000 app-reachable days (2026-08-06, §13.3,
  `scripts/pool-allocator.probe.ts`) come out exact on 93.55–94.50% with
  per-seed worst shortfalls 3.37–5.28%. The 99.5% / 0.09% pair once quoted here
  was one draw, not a bound. Single-budget remains exact (σ_ϕ = 0, §4).
- **Forward selection for n > 12 funded-subset search** is a heuristic for a
  regime a daily planner rarely reaches.
- **Budgets below 0.25h are left unplanned** (v1 would allocate slivers).
- **`zenith-energy.ts` intentionally still uses the v1 curve.** It is a
  standalone total-output model with its own fatigue dynamics (documented in
  §8); migrating it to the v2 curve is a separate decision.
- **`a = E·β` (peak monotone in effort) is kept from the article** even
  though flow research suggests an inverted-U in challenge (see references);
  changing it alters the meaning of the difficulty slider and deserves its
  own revision.

## 8. Energy model (`zenith-energy.ts`) — fatigue-recovery extensions

The total-output model keeps the v1 curve (see §7) but got two
literature-grounded corrections on 2026-07-13 (§8.1–8.2), a per-task
satiety term on 2026-07-14 (§8.4), and a micro-recovery floor for
full-demand tasks plus optimizer-reliability fixes on 2026-07-14
(§8.5–8.6). The corrections were driven by an
empirical probe of the old behavior: on a 10-hour window with a demanding
task the optimizer scheduled **zero** interior rest, and micro-breaks always
_reduced_ output at equal work-hours — contradicting the well-replicated
finding that short interspersed breaks raise total output (Jaber & Neumann
2010; Bechtold, Janaro & Sumners 1984). The break half re-measures cleanly
under the pre-fix dynamics (1/2/4/8 interior 15-minute breaks cost −14.5% /
−29.6% / −48.6% / −66.2% of a 4-hour block's output — `scripts/enb-break-economics.probe.ts`,
2026-08-06); the "zero interior rest" half belonged to the pre-§8.6 search and
does not — under those same dynamics today's optimizer rests once, 2.25 h, and
works 7.5 h.

### 8.1 Intermittent-rest recovery correction

The reservoir law `dC/dτ = −α·w·C + r·(1−w)·(1−C)` shares its structure with
the three-compartment muscle fatigue model of Xia & Frey Law (2008). That
model's documented failure mode is ours too: it **over-predicts fatigue when
rest intervals are interspersed with work**, and the published fix (Looft,
Herkert & Frey Law 2018) is a multiplier on the recovery rate. We adopt it:

```text
r' = r · restRecoveryMultiplier          (default 1.5)
ρ  = α·w + r'·(1−w),   C_eq = r'·(1−w)/ρ
```

The existing `(1−w)` gate concentrates the boost exactly where the reservoir
is idle — full effect at rest, none at full demand — so the closed-form
solution and Simpson quadrature are unchanged. `restRecoveryMultiplier = 1`
reproduces the old dynamics. (§8.5 later generalizes the recovery gate
`(1−w)` to `1−(1−b)·w`.)

Composite Simpson takes 16 nodes per fastest timescale (min of ϕ, 1/ρ) but is
**capped at 1024 nodes**, so at the 0.1 h ϕ floor the node density thins once a
block passes 6.4 h: relative error against a 400 000-interval reference (itself
checked against 800 000) is ~3e-7 up to a 6 h block, 6.9e-7 at 8 h, 1.7e-6 at
10 h, 3.5e-6 at 12 h and 5.6e-5 in a 24 h block
(`scripts/enb-simpson-error.probe.ts`, 2026-08-06). Under the
default constants the smallest ϕ is 0.58 h, where the cap never binds.

### 8.2 Warm-up carryover instead of binary reset

v1 energy reset the session phase `s` to 0 on _any_ interruption: a 5-minute
switch cost as much warm-up as a 3-hour gap, which is empirically wrong —
task-resumption cost grows with interruption duration (Monk, Trafton &
Boehm-Davis 2008), consistent with exponential decay of goal activation
(Altmann & Trafton 2002, memory-for-goals). Warm-up is now **per task with
decaying carryover**: leaving a task at phase `s_end` and returning after a
gap `g` resumes at

```text
s_resume = s_end · e^(−g/τ),   τ = resumptionTimeConstant   (default 0.5 h)
```

With τ = 0.5 h, ~85% of task state survives a 5-minute break and ~2% survives
a 2-hour gap. `blockOutput` integrates `p(s_resume + u)` over block-local time
`u`; the reservoirs stay indexed by `u` since they carry their own level.
`resumptionTimeConstant ≤ 0` reproduces the old hard reset. Because `p(s)` is
hump-shaped, one decay does double duty: below the peak it prices lost warm-up
(breaks hurt), above it prices boredom relief (a break moves you back toward
the peak).

### 8.3 Verified consequences and an open calibration question

Post-fix probes (the signs are locked in as unit tests, the numbers are
`scripts/enb-break-economics.probe.ts`, 2026-08-06): the optimizer now inserts
interior rest on long demanding windows — 1 rest block on the 10-hour probe at
the §8.8 45-minute lattice (work 3 h, rest 45 min, work 2.25 h), 4 at a
15-minute step; the "6 breaks, a Pomodoro-like pattern" once claimed here
reproduces at no step size, and no test asserts a count. And a ~30-minute break
placed mid-session _raises_ total output at equal work-hours (+5.1% on the deep
8/5 task, +6.9% on the fragmentation fixture) — the Jaber–Neumann result the old
model could not produce, and the one post-fix consequence with no suite fixture
of its own. Fragmentation still costs (contiguous ≈ 1.5× confetti on the
standard probe: 1.5500×, against 4.1839× under a hard reset), just no longer
catastrophically.

**Open:** making sustained work efficient made it attractive. At the default
`freeTimeValue = 0.5` the optimizer now recommends ≈ 9.9 h of work in a 12-hour
window (pre-fix ≈ 5.4 h), and because the leisure term is _linear_ in hours the
response to `freeTimeValue` is bang-bang: ≈ 1.0 still yields ≈ 9.5 h, ≈ 1.5
collapses to all-leisure. A humane default day needs a structural change — a
concave (diminishing-returns) leisure value or a soft work-hour cap — not a
retuned constant. Defaults were deliberately left alone pending that decision.
(Those two hour figures are from the pre-§8.6 search and the pre-§8.8 lattice
and no longer reproduce. Restoring only the pre-fix _dynamics_ under today's
optimizer gives 12 h at λ₀ ≤ 0.5 and 10.5 h at every λ₀ from 0.8 through 1.5 —
a two-step response, and no collapse to all-leisure anywhere in [0.2, 1.5]
(`scripts/enb-break-economics.probe.ts`, 2026-08-06). So the bang-bang
diagnosis was right about the _kind_ of response and wrong about where it
lands: the pre-fix model never stopped working within the swept range.)

**Resolved by §8.4 (noted 2026-07-19).** The structural change arrived, just
on the other side of the margin: satiety's concave V(O) makes the marginal
value of late work hours _decline_, which is equivalent at the stopping
margin to a concave leisure value. Re-probing the sweep above under the
current model (satiety on, §8.5 gate, §8.8 lattice): W\*(λ₀) on the 12-hour
probe day is monotone and **graded** — 12 h → 11.25 → 10.5 → 6 → 4.5 → 0
across λ₀ ∈ [0.2, 1.5] — no longer bang-bang (locked in as a unit test).
That well-posedness is what §8.10's calibration is built on.

### 8.4 Per-task satiety — concave daily value (added 2026-07-14)

**The pathology.** The pure total-output objective is winner-take-all
(probe-verified 2026-07-11 on a real 3-task day, reproduced 2026-07-14):
the optimal plan put 7 h in **two sessions** on one task plus a 1-hour token
block, because a second session on the best task restarts its hump-shaped
`p(s)` near the peak at zero cost — re-running the winner always beats
switching to a weaker task. Two mechanisms were identified; this section
fixes the missing-satiety one. (The other — a full-demand task has reservoir
equilibrium `r′·(1−w)/ρ = 0` because the recovery gate `(1−w)` vanishes at
`w = 1` — is fixed in §8.5; a sublinear _drain_ mapping `w^q` was probed and
does **not** fix it, since the zero floor comes from the recovery gate, not
the drain.)

**The form.** Each task's raw daily output `O_i` (the sum of its block
outputs) enters the objective through a concave wrapper:

```text
V(O) = κ_i · ln(1 + O/κ_i),      κ_i = satietyScale · O_ref,i
```

where `O_ref,i` is task i's **reference single-session output** — one
contiguous `T* = 1.7933·ϕ_i` run from full reservoirs — so κ auto-scales with
how much a good session on that task yields. Properties: `V(0) = 0`,
`V′(O) = 1/(1 + O/κ)` so `V′(0) = 1` (early output counts at face value) and
`V′(κ) = ½` — at the default `satietyScale = 1`, output beyond one good
session is worth half at the margin. V is strictly increasing (work never
becomes worthless) and concave (diminishing marginal daily value — Gossen's
first law applied per task). `satietyScale ≤ 0` disables the wrapper exactly,
recovering the old objective; the objective is now

```text
Σ_i V(O_i) + freeTimeValue·(idle hours) + terminalEnergyValue·(C̄(T)).
```

**The one hard design constraint.** Satiety must key on a **monotone**
per-task accumulator. The session phase `s` decays over gaps
(`s·e^(−g/τ)`, §8.2), so anything keyed to it could be laundered away by
taking breaks — and the re-run-the-winner exploit would return. Keying on
cumulative output satisfies this (output only accumulates), and has the side
benefit that a drained, low-output session barely satiates.

**Measured, and priced** (`scripts/satiety-gaming.probe.ts`, 2026-08-06). The
rule holds exactly: over 300 random schedules — 297 of which split a task
across a gap — `satiatedOutput` is reproduced to **8.9·10⁻¹⁵** by a replica
that reads only the per-task output TOTALS, so satiety demonstrably cannot see
session count or gap length. What the rule BUYS had never been measured, and
it is not nothing. Enumerating every one of the 6561 lattice plans on 24 days
× 2 tasks and taking the argmax under three accumulators built from the same
per-block outputs:

| accumulator             | sessions/day | top task's share | worth under the satiety term Σ V(O) |
| ----------------------- | ------------ | ---------------- | ----------------------------------- |
| cumulative (shipped)    | 1.96         | 82.3%            | —                                   |
| session-keyed           | 2.38         | **98.4%**        | −0.226%                             |
| phase-decaying `e^−g/τ` | 2.42         | 96.0%            | −0.599%                             |

Both mutants fragment more AND concentrate harder — the session-keyed one puts
98.4% of worked hours on a single task, which is the re-run-the-winner corner
§8.4 was written to close, reproduced on demand. That last column is the satiety
term alone, not the objective: scored against what `optimizeSchedule` actually
maximizes (Σ V(O) plus the leisure and terminal terms) the mutants' plans lose
**3.015%** (session-keyed) and **2.405%** (phase-decaying), and the order
_reverses_ — the mutants work more hours for less value, so the leisure term
widens the gap (both columns printed by `scripts/satiety-gaming.probe.ts`,
2026-08-06). The constraint is worth ~2–3% of the objective, and
~0.2–0.6% of output value alone.

**Why this form and not the alternatives** (all probed 2026-07-14 against a
validated replica of this module, same multi-seed local search):

- **Chosen — concave value on cumulative output.** Lives entirely outside the
  dynamics: warm-up, reservoirs, and the Simpson quadrature are untouched, so
  ϕ keeps its exact meaning (time-to-peak) and §8.2's calibration story is
  unaffected. Probe: turns the 7h/1h winner-take-all plan into one session
  per task; fragmentation stays priced — the same 4 h chopped into 0.5 h slices
  with 0.5 h gaps yields 1.45× less raw output (a ratio satiety cannot move,
  since it lives outside the dynamics), and the objective still prefers
  contiguous by 1.17×, against 1.28× before satiety (re-measured 2026-08-06 at
  1.4511× / 1.1687× / 1.2750×, `scripts/enb-break-economics.probe.ts`); the
  plan responds
  _smoothly_ to a demand sweep that flips the unsatiated plan violently
  between opposite winner-take-all corners; introduces no new
  break-then-resume gaming incentive.
- **Rejected — multiplicative decay on cumulative task time,
  `p·e^(−S/κ)`.** Also breaks winner-take-all, and is analytically tidy (for
  contiguous work it stays in the curve family with `k′ = k + 1/κ`), but that
  is exactly the problem: the effective peak moves to `ϕκ/(ϕ+κ)`, so a fitted
  ϕ would no longer mean "time to peak", silently corrupting the shared
  semantics with the classic model. κ is also knife-edgy (2ϕ strong, 4ϕ
  nearly inert on the probe).
- **Rejected — a third per-task "boredom" reservoir with within-day
  recovery.** Double-counts boredom relief (§8.2 already prices it via the
  above-peak region of the hump) and its recovery knob reintroduces the
  laundering exploit; its safe limit (no within-day recovery) is just the
  multiplicative form above.

**Implementation.** `TaskCurve.refOutput` is computed once in `buildCurves`
(full reservoirs by design — a standardized yardstick independent of
`initialCog/initialPhys`); `evaluateSchedule` accumulates `outputByTask` and
reports both `totalOutput` (raw, still what the UI charts) and
`satiatedOutput` (what the optimizer maximizes, plus the two value terms).

### 8.5 Micro-recovery gate — a positive floor for full-demand tasks (added 2026-07-14)

**The residual pathology.** Satiety (§8.4) fixed the winner-take-all task
mix, but a knife-edge remained **exactly at w = 1**: under the pure `(1−w)`
recovery gate a full-demand task has equilibrium `C_eq = r′·(1−w)/ρ = 0`, so
it drains toward literally zero energy with no basal floor. Probe (2026-08-06,
`scripts/sat-gate-floor.probe.ts`): the pathology is the algebra, not a measured
cliff. With today's search and lattice the b = 0 world's demand sweep on the
probe day is already monotone (3.00 h at both wp 1.0 and 0.95), and over 20
seeded days the demand→allocation response is indistinguishable at b = 0 and
b = 0.05 (mean biggest jump 0.825 h, 0 of 20 non-monotone, both). The original
"2.65 h → 4.56 h cliff from a 5% demand change" was measured with the search
§8.6 then found unreliable **on this same day**, so it is not separable from
search slack and does not reproduce.

**The fix.** A fraction `b` of recovery capacity stays active even while
working flat out (micro-pauses between efforts — the same intermittent-effort
regime that motivates `restRecoveryMultiplier`, §8.1):

```text
g  = 1 − (1−b)·w          (recovery gate; b = microRecoveryFraction)
ρ  = α·w + r′·g,   C_eq = r′·g/ρ
C_eq(w=1) = b·r′/(α + b·r′) > 0
```

`b = 0` recovers the pure `(1−w)` gate exactly. The law stays linear with
constant coefficients, so the closed form and quadrature are untouched. At
rest (`w = 0`) the gate is 1 regardless of b — recovery behavior is
unchanged.

**Calibration anchor.** Default `b = 0.05` puts the w = 1 floor at ≈ 0.15
(phys) / 0.13 (cog) with the default rates — matching Rohmert's (1960)
finding that static effort below ~15% of maximum voluntary contraction is
sustainable indefinitely. The floor is where output stabilizes, not zero.

**Why this form and not the alternatives** (probed 2026-07-14; re-measured
2026-08-06, `scripts/sat-gate-floor.probe.ts`):

- **Rejected — gate `(1−w^q)`.** Still exactly 0 at `w = 1` for every q: the
  within-session decay of a full-demand task is bit-identical to the pure
  `(1−w)` law it was meant to replace (ρ = α, eq = 0) — not to the shipped one,
  where b = 0.05 gives ρ = α + b·r′ and eq = 0.13. Its only effect is _moving_
  mid-range equilibria — up for q > 1 (eq(w = 0.5) 0.75 → 0.82 at q = 2), down
  for the sublinear q < 1 the roadmap suggested (0.75 → 0.64 at q = 0.5) — a
  side effect, not a fix. (This was the earlier roadmap suggestion; the probe
  killed it.)
- **Rejected — clamp `C_eq = max(C_eq, F)`.** Produces the right floor but is
  non-smooth in w (the clamp binds only above w ≈ 0.95 at F = 0.15), is
  purely phenomenological, and decouples C_eq from ρ.
- **Chosen — `1−(1−b)·w`.** Smooth and monotone in w, one parameter with a
  physical reading and a literature-anchored default, targeted where the
  problem is (eq at w = 0.5 moves ~1% at b = 0.05), exact opt-out at b = 0.
  Probe: the demand sweep wp 1.0 → 0.7 runs 3.00 → 4.50 → 5.25 h at the 0.25 h
  step in even ~0.5 objective increments — but the b = 0 sweep is monotone as
  well under today's search, so the gate's justification is the `w = 1` algebra
  and the floor below, not a smoothing effect. Long full-demand sessions do
  decay _toward_ the floor instead of grinding to zero (8 h at w = 1 ends at
  0.1997 physical against 0.0907 without the gate) — but 8 h is not yet near
  it: that is 34% above the 0.1489 floor, which the decay reaches only after
  ~16 h (0.1520 at 16 h, 0.1491 at 24 h).

### 8.6 Optimizer reliability — compound moves and drop-one seeds (added 2026-07-14)

While probing §8.5 the multi-seed steepest-ascent search was caught leaving
~0.5–1% of objective on the table, and worse, returning the wrong plan
_structure_ (dropping a task that the true optimum funds, and vice versa).
Root cause, both times, is that steepest ascent only takes single moves that
are uphill on their own:

- **Reallocation plateaus:** moving time from task A to task B requires a
  shrink and a grow, each downhill alone. Fix: a **transfer move** (shrink
  block i, grow block j, one candidate).
- **Cold-start slivers:** inserting an unfunded task at step size (0.75 h
  today; 0.25 h when this was written)
  never pays because of warm-up, even when a full session would. Fixes: a
  **half-block reassign** (hand the second half of a block to another task)
  and a **T\*-session insert** (insert a new task at its full single-task
  optimum length).
- **Unreachable "fund all but X" optima:** dropping a funded task is downhill
  until its hours are redistributed, so those basins need their own starting
  points. Fix: **drop-one classic seeds** (classic seed built without task X,
  for each X).
- The T\*-insert puts totals off the step lattice, so the grow move also
  learned to grow by the sub-step window remainder (with worthless leisure,
  a stranded idle sliver is pure loss). Both were retired by §8.8: the
  T\*-insert is now snapped to the lattice and the remainder-grow is gone.

All fixes are deterministic (the search stays reproducible; a test asserts
this). Verification: both previously-failed probe cases now beat their
hand-built witnesses, and the b = 0 legacy world's optimum improved too
(10.70 vs 10.65) — meaning even pre-§8.5 results had mild search slack.
Cost: ~13 ms for 3 tasks / 8 h on the 45-min lattice (re-measured 2026-08-06;
~60 ms when written, at the 0.25 h step and before the 2026-08-01 `buildCurves`
hoist — 211 ms at that step today), still interactive.

**Residual gap, measured** (Probe 2026-08-06,
`scripts/energy-search-gap.probe.ts`). The slack is smaller than the ~1% above,
not gone. Scored against the exhaustive optimum on the same 45-min lattice —
every lattice plan enumerated, so a shortfall is a proven search defect — 60
seeded random days of 2–3 tasks × 3–6 h give 58 exact (within 1e-9), median
shortfall 0.0000%, p99 0.5951%, worst 0.5951% below the optimum. That worst day funds a single
task over a 6 h window: the search returns one 5.25 h block, the optimum works
the same 5.25 h split 3.75 + 1.5 around an interior 45-min rest — a break the
search cannot reach, because splitting a block and re-growing it is downhill in
between. The split-around-rest move itself **ships**: on that day it fires (7
steps ≥ 2, and the window leaves exactly one spare step of `room`) but only at
the rounded midpoint, 3 + rest + 2.25, scoring 7.6297 against the incumbent's
7.6521 — downhill by 0.0224. Two of the six interior splits are uphill
(3.75 + 1.5 = 7.6979, 4.5 + 0.75 = 7.6946), and one transfer step out of the
rejected midpoint split lands exactly on the optimum. So the optimum is two
shipped moves away with the first downhill, and no improving move is left on the
table — a steepest-ascent limit, not a missing candidate. What ROADMAP item 27
would add is the **off-midpoint** split (every interior lattice point, one step
handed to rest at unchanged total hours, so it stays available on a fully-spent
window where `room` blocks the shipped move); it carries the case against
building it too. The failure mode §8.6 calls the worse one is the clean one: **0
funded-set mismatches of 60**, and the witness day above is exactly optimal at
all six windows 3–8 h. On the harder tier the reference is only a 200-restart
hill climb, a LOWER bound, so its numbers are evidence and not proof: 12 days of
4–6 tasks × 8–12 h, 8 exact, worst −0.1104%, 3 funded-set mismatches —
unattributable, since either search can be the one that is wrong there.

### 8.7 Drain-rate calibration from end-of-session ratings (added 2026-07-15)

**The data signal.** Every other energy parameter was hand-tuned; this adds
the first _measured_ personalization. After working a session on a task, the
user logs a 🪫 rating: session length `H` plus "how drained do you feel now"
for mind and body on a 0–10 scale (a Borg CR10-style category-ratio
instrument). The task's reservoir demands `wc, wp` are captured at logging
time, like E/β on ⚡ flow logs, so later slider edits don't rewrite past
measurements. Ratings are stored **one row per session** in a new IndexedDB
store (`drainObservations`, DB v3): `hours` is that session's `H`, and a
task's hours for a day are the SUM of its rows. It was an upsert on
(taskId, date) until 2026-08-05, which silently deleted a task's earlier
session from that sum — see §18. Corrections edit the row in place and keep
its log moment; a new log is always a new session.

**The model.** A rating is read as the drained fraction of one reservoir,
`d/10 = 1 − C(H)`, where C follows the §8.1/§8.5 law from a full reservoir:

```text
D(w, H; α) = 1 − C(H),   C(H) = C_eq + (1 − C_eq)·e^(−ρH)
ρ = α·w + r′·g,   C_eq = r′·g/ρ,   g = 1 − (1−b)·w
```

Two independent 1-D fits share each observation: the mind rating with
`w = wc` calibrates `alphaCog`, the body rating with `w = wp` calibrates
`alphaPhys`.

**What is (not) identifiable.** Only **α** is fit. The fit _conditions on_
the current `recoveryRate`, `restRecoveryMultiplier` and
`microRecoveryFraction` — that conditioning is what makes α identifiable at
all. `recoveryRate` itself cannot be recovered from end-of-session ratings:
it enters the observable D only jointly with α through ρ and C_eq, and its
own signature (how fast a _rest_ refills the tank) never appears in a rating
taken at the end of _work_. Separating it needs pre/post-REST rating pairs —
a different instrument, out of scope HERE (built later as §8.9; this fit now
conditions on the fitted r rather than a hand-set one). Observations with
`w = 0` (or `H = 0`) are dropped entirely: D is then constant in α, so the
rating says nothing about this reservoir's drain rate, and keeping it would
only pollute the noise estimate. This was also deliberately sequenced AFTER
the §8.5 gate fix, so α doesn't absorb gate mis-specification.

**The fit** (`fitDrainRate`, the `fitUserConstants` pattern in 1-D):

```text
minimize  Σᵢ (dᵢ − D(wᵢ, Hᵢ; α))² + λ·(α − α₀)²   over α ∈ [0.05, 2]
```

- **Prior.** α₀ = the model default; λ = `DRAIN_PRIOR_STRENGTH` = 0.25 is
  the Bayesian ridge weight (prior α ~ N(α₀, σ_d²/λ)). Unlike the ϕ fit's
  λ = 4, the effective "design" here is the sensitivity dD/dα (≈ 0.7–1.0 for
  typical 1–3 h full-demand sessions, vanishing as w → 0), so λ was tuned by
  probe in those units (λ sweep, 2026-07-15): one consistent full-demand log
  moves α ~50% of the way to what it implies, three ~70%, ten ~85%
  (50.1 / 69.1 / 85.2% re-measured 2026-08-06,
  `scripts/sat-drain-identifiability.probe.ts`, which also prints the
  r-conditioning profile above and the reported stds below); λ = 0.5
  left three logs at only 57% while buying almost no extra outlier
  resistance (a wild outlier among 4 on-default logs lands 0.013 from the
  λ = 0.25 result: 0.4610 against 0.4740 — robustness comes from the other
  logs, not the prior).
- **Solver.** D has no closed-form minimizer, so: deterministic 128-point
  grid to bracket the global minimum, then golden-section refinement. The
  bounds equal the Energy Lab's α input range, so a fitted value is always
  representable in the UI; they also play the role of the ϕ fit's absurdity
  guard — wildly inconsistent ratings can at worst pin α to an
  extreme-but-valid drain rate (probe: six "10/10 drained after 15 min"
  ratings pin α = 2).
- **Posterior.** Noise σ̂² = (ν₀σ₀² + SSR)/(ν₀ + n) with σ₀ = 0.15 (1.5
  notches — self-reported drain is fuzzier than a stopwatch) and
  ν₀ = `CALIBRATION_NOISE_PRIOR_WEIGHT` = 4, shared by all three calibration
  fits (§8.7/§8.9/§8.10); posterior std via the Gauss–Newton/Laplace
  curvature √(σ̂²/(Σ(dD/dα)² + λ)). Probe: std shrinks with consistent data
  (0.088 → 0.033 from 2 → 8 logs) and grows with scatter (0.090 for the same
  8-log mean with ±3-notch noise).

  _ν₀ ≠ λ (2026-07-19 math-review fix; changes reported stds only, never the
  MAP)._ Originally ν₀ reused the ridge λ "like the ϕ fit" — but in the ϕ fit
  λ = ν₀ = 4 only by coincidence, and the roles are unrelated: λ prices how
  far data moves the MAP (probe-tuned per fit in sensitivity units: 0.25
  here, 0.05 in §8.9, 1 in §8.10), while ν₀ says how much prior evidence
  backs "ratings are at least this noisy". Reusing the small tuned λs as ν₀
  erased the noise floors at small n and made the reported ±stds several-fold
  tighter than a floor-honest posterior _on clean data_ (probe 2026-08-06,
  `scripts/stp-recovery-fit.probe.ts`: the §8.9 tests' own 6-observation pair
  set — three logged rests, mind and body — reports r 0.700 ± 0.195 at the
  prior and 1.196 ± 0.312 at true r = 1.4 under ν₀ = 4, against ± 0.028 and
  ± 0.077 under ν₀ = λ, so 7.0× and 4.0× wider; the "6 clean rest pairs report
  r ± 0.036 — 4% precision on recovery rate from six fuzzy self-ratings" that
  motivated this fix was that artefact, and the ± 0.249 once quoted here is the
  same generator at true r ≈ 1.0, ± 0.041 pre-fix). **But ν₀ is a blend toward
  σ₀, not a floor under the ±**, so it cuts both ways: the adversarial-pairs
  case (§8.9), whose residuals are far noisier than σ₀, _tightened_ —
  ± 0.781 → ± 0.615. Both moves are steps toward the σ₀-only ± (0.309 / 0.487 /
  0.508) and neither passes it, which is the invariant the probe asserts. The
  "std shrinks with data / grows with scatter" orderings all survive
  (test-locked).

**Known approximations (deliberate).**

- **Fresh-start assumption.** D assumes the session began at C = 1, like
  `refOutput`'s standardized yardstick — the rating carries no information
  about the pre-session level. A mid-day session that starts drained rates
  higher than the model predicts and biases α upward. Accepted as noise
  (σ₀ is wide); the honest fix — chaining the whole day's reservoir
  trajectory through every rating — needs a complete work log, not a
  per-session rating.
- **Linear rating map.** d/10 ↔ drained fraction assumes the subjective
  scale is linear in reservoir depletion with fixed anchors (0 = fresh,
  10 = spent). Borg's psychophysical work supports ratio-scale behavior for
  CR10-style instruments; any per-user nonlinearity is absorbed by α to
  first order.
- **Saturation shrinkage.** For large true α, D saturates near 1 and dD/dα
  vanishes, so the data genuinely cannot distinguish α = 1.0 from 1.4; the
  prior then wins and the fit under-reports extreme drain rates (probe: 8
  clean logs from α* = 1.2 fit to 0.96 — but the _predictions_ differ by
  under one rating notch, which is all the ratings can see).

**Probe results** (2026-07-15, locked in as unit tests): exact recovery of
α* at the prior mean from 8 clean synthetic logs; monotone in the reported
rating; w = 0 logs have zero influence; deterministic.

**UI.** The Energy Lab's task list gets the 🪫 inline editor (today-only by
construction — the lab always views today); a "Drain Calibration" card shows
each reservoir's fitted α ± std with its informative-log count and an
**Apply fitted rates** button that writes the fits into the manual α inputs.
Unlike the classic model's fit (which the allocator consumes directly), the
energy lab's parameters stay user-owned sliders — the fit is applied
explicitly, so slider experiments and the calibration never silently fight
over the same knob. The fit itself re-derives live from the observations
(delete/reset a rating and it refits), and re-fits under the _current_
recovery sliders, since it conditions on them.

### 8.8 45-minute plan granularity (added 2026-07-18)

**What changed.** The optimizer's plans are now quantized to a 45-minute
lattice: every block is a whole number of 0.75 h units (`DEFAULT_STEP_HOURS`;
`stepHours` still overrides for probes). Before this the search _moved_ in
0.25 h steps but two moves deliberately left the grid — the T\*-session
insert (1.79ϕ, an arbitrary real) and the sub-step remainder-grow — so plans
came out as "Guitar 3.19 h": mathematically optimal, humanly unschedulable,
and more precise than 0–10 slider inputs can justify.

**How the invariant holds.** Inductively: seeds are built on the lattice
(the all-in and classic seeds use the lattice-floor of the window), T\*
sessions are snapped to the nearest whole step (floored at one step), block
halves split an odd step count as larger/smaller whole-step shares, insert
room is the lattice-floor of the remaining window, and every other move adds
or removes exactly one step. `normalizeSchedule`'s window clip therefore
never fires (lattice totals never exceed the lattice-floored window), and
merging preserves multiples.

**Deliberately different from the classic model's 15-min blocks.** The
classic allocator (§4) keeps `BLOCK_HOURS = 0.25`: its blocks are an
_accounting_ unit for an exact greedy over a single number per task, where
finer quantization only helps. The energy optimizer's step is a _scheduling_
unit — its output is an ordered day a human executes, where 45 min is the
plausible granularity of real sessions and breaks. Do not unify them: shrinking
this lattice re-opens the rest-confetti degeneracy below, and coarsening the
classic blocks would throw away exactness for nothing.

**The window tail.** A window that is not a multiple of 45 min (e.g. 8 h =
10 units + 30 min) leaves its sub-step remainder as free time — it is not
schedulable at this granularity by definition, and the objective already
values it at λ₀ per hour plus terminal energy. The old remainder-grow move
(which existed only because T\*-inserts broke the lattice) is gone; with
`freeTimeValue = 0` up to one step minus ε can now idle, which is the honest
price of quantization rather than a regression. The pre-existing "never
leaves the window end idle" test keeps passing because its 12 h window is
lattice-exact.

**Probe results** (2026-07-18, re-measured 2026-08-06 with
`scripts/stp-lattice.probe.ts`). (a) _Quantization loss is small:_ objective
ratio coarse/fine (0.75 vs 0.25 step) is 0.9865 (probe day, 8 h) / 0.9979
(mixed day, 8 h) / 0.9936 (probe day, 12 h) / 0.9759 (mixed day, 12 h) — the
fourth cell was quoted as 0.9886 and no cell in a 12-point sweep produces that.
Over windows 4–14 h the worst is **0.9693** (probe day, 4 h): a short window has
too few lattice points to hide the remainder in. The suite's ≥ 0.97 bound is
asserted at the 8 h window, which is where it was measured — it is not a lattice
property. (b) _Structure survives:_ the funded-task set matched the fine-step
optimum in all four cases, and in all 12 of the sweep. (c) _No new search
slack:_ exhaustive enumeration of all 45-min plans on the 2026-07-14 probe day
(every assignment of the 10 lattice slots to a task or to rest — 1 048 576
evaluations, not the ~10⁴ once claimed) equals the search's 10.7331 exactly —
locked in as a probe-time check, not a unit test (too slow). (d) _Faster:_
~13 ms vs ~210 ms on the 3-task/8 h day, post-`buildCurves`-caching (the
~55/~330 ms pair predates it). (e) A side benefit: fine-step optima at long
windows degenerate into 15-min rest confetti (five 0.25 h rests across the mixed
day's 12 h); the coarse lattice returns one 45-min break — closer to what a
human would actually do, at ~2.4% objective cost on that day.

**Test guard note.** The 2026-07-14 local-search regression test compares
against a hand-built witness (3.5/1.5/3 h) that is itself off the 45-min
lattice, so it now runs at `stepHours: 0.25` explicitly — it guards search
reliability, not granularity; granularity has its own §8.8 tests.

### 8.9 Recovery-rate calibration from pre/post-rest pairs (added 2026-07-18)

**Why this closes §8.7's open loop.** The α fit conditions on the current
`recoveryRate`; if the hand-set 0.7 is wrong, α silently bends to compensate
(probe: true α = 0.5 under true r = 1.4 fits to 0.415 at the default r), and
every plan's rest lengths inherit the error. §8.7 already named the missing
instrument: pre/post-REST rating pairs. This section builds it.

**The data signal.** Around a break, the user logs a ☕ pair: break length
`g` plus mind and body drain ratings (0–10) going **in** and coming **out**.
Stored in a new IndexedDB store (`restObservations`, DB v4). Like drain
ratings these append one row per logged event (§18); unlike them there is no
task to hang the row on, and corrections happen by deleting a pair from the
calibration list rather than re-opening it.

**The model.** During pure rest the §8.1/§8.5 law loses α entirely: demand 0
gives `ρ = r·m` (with `m = restRecoveryMultiplier`), `C_eq = 1`, so the
drained fraction decays exponentially:

```text
d_after = d_before · e^(−r·m·g)
```

Both reservoirs obey the same rest law, so each logged pair contributes TWO
observations (mind and body) to the ONE shared `recoveryRate` fit.

**Identifiability, and the conditioning order.** This fit needs no drain
parameter at all — which un-circularizes the whole calibration story:
`fitRecoveryRate` identifies r α-free, and `fitDrainRate` then conditions on
the fitted r. What rest data _cannot_ separate is r from the rest multiplier:
only the product `r·m` is observable, so the fit conditions on the current
`m` and r absorbs the data (test-pinned: generating at r·m = 1.8 and
refitting under m = 1 lands r near 1.8, not 1.2). Pairs with
`d_before = 0` (nothing to recover) or `g = 0` (no time to recover in) are
dropped — the prediction is constant in r, and keeping them would only
pollute σ̂². A pair that reports MORE drain after resting fits no r ≥ 0; it
pushes the estimate toward the lower bound and honestly widens the posterior
std (test-pinned).

**The fit.** Identical machinery to §8.7 (the 1-D minimizer is now shared
code): ridge MAP toward the DEFAULT r with
`RECOVERY_PRIOR_STRENGTH = 0.05`, bounds = the UI input range [0.1, 3],
noise prior `RECOVERY_NOISE_PRIOR_STD = 0.21` (a residual compares TWO fuzzy
ratings, so the single-rating floor 0.15 is widened by √2), Laplace posterior
std from the Gauss–Newton curvature. λ probe-tuned 2026-07-18 to match the
α fit's calibration profile: one consistent logged rest moves r **53%** of
the way to what it implies, three **71%**, ten **88%** (λ = 0.1 sits at 39%
for the first log — too anchored; λ = 0.25, the §8.7 value, reaches only 22%,
worse still because dD/dr ≈ 0.22–0.26 here against the drain fit's
dD/dα ≈ 0.6–0.9 — roughly a THIRD of its lever arm, not the half once claimed).
Re-measured 2026-08-06, `scripts/stp-recovery-fit.probe.ts`.

**Probe evidence** (2026-07-18, re-measured 2026-08-06 with the same probe).
Noiseless 8-log recovery across the range:
true 0.3 → 0.307, 0.7 → 0.700, 1.0 → 0.976, 1.5 → 1.365. Under 0–10 notch
quantization plus ±1-notch jitter the fit stays within a median ~0.06 of truth
for r ≤ 0.7 and ~0.09 for r ≈ 1–1.5, with a p90 of 0.13–0.23 and a worst case
of ~0.36 over 200 seeded trials per level — honest stds throughout, but a single
day's jitter moves r by more than one notch of its own, and the "within ~0.05"
this line used to claim was not measured. Known shrinkage at high true r mirrors
§8.7's α saturation: from breaks averaging ~43 min, true 2.5 fits to 1.81 (1.88
from uniform 36-min breaks), because any r ≥ 2 leaves less than one
rating notch of residual drain — the data genuinely can't distinguish.
Consequence worth knowing: **short breaks carry the high-r signal** (true 2.5
from 15-min-break pairs fits to 2.0 vs 1.58 from 1h-break pairs), noted in
the UI's empty-state hint. Downstream, the motivating bias shrinks as built:
with 5 logged rests the α example above recovers 0.469 instead of 0.415
(bias 0.085 → 0.031); test-pinned as a regression.

**UI.** A second calibration card ("Recovery Calibration") mirrors the drain
card: ☕ inline pair editor (minutes + before/after Mind/Body), fitted
r ± std with rating count, explicit "Apply fitted rate" button (lab params
stay user-owned — same deliberate UX as §8.7), collapsible pair list with
per-pair delete and two-step reset. The §8.7 card's hint now points here
("calibrate recovery first") instead of claiming recovery is slider-only.

### 8.10 Stopping-value calibration from observed stop times (added 2026-07-19)

**The last hand-set stopping knob gets a fit path.** `freeTimeValue` (λ₀) and
`terminalEnergyValue` (V_T) are the entire stopping mechanism of the energy
model, and until now both were pure priors. Observable data exists: the 🪫
drain logs already record worked minutes per task per day, so a finished day
reveals _when the user actually stopped_ versus their declared window — a
revealed-preference measurement of what an hour of leisure is worth to them.
No new logging instrument is needed.

**Feasibility (probe 2026-07-19, all pre-implementation).** Three findings
gate the design:

1. **The inversion is well-posed** — but only since satiety. §8.3's
   bang-bang warning predates §8.4; today W\*(λ₀) is monotone and graded
   (see the §8.3 update note), so distinct stop times map back to distinct
   λ₀ ranges. Noiseless multi-window inversion recovers a synthetic user's
   λ₀ uniquely at 0.1 resolution; ±0.5 h noise on the stops still recovers
   it exactly by least squares.
2. **λ₀ dominates, but V_T is not free.** Sweeping V_T over [0, 6] (13 levels)
   leaves the optimal stop on one or two 45-min lattice levels in 7 of 8
   (window, λ₀) cells — but it can move the stop by 3 steps (2.25 h → 4.5 h at
   an 8 h window, λ₀ = 1.3) and through three levels non-monotonically (12 h,
   λ₀ = 0.9): re-measured 2026-08-06,
   `scripts/stp-stopping-identifiability.probe.ts`, against the earlier
   "almost constant in V_T". So the fit targets
   λ₀ alone and **conditions on** the user-owned V_T — a slider left far from
   the truth is a real unfitted error source, not a negligible one — completing the
   conditioning chain: r is fitted α-free (§8.9), α conditions on r (§8.7),
   λ₀ conditions on everything (α, r, m, b, satietyScale, V_T). Calibrate
   recovery and drain first; this fit inherits their quality.
3. **Naive inverse optimization is too slow.** Fitting by re-running the
   optimizer over a λ₀ grid costs ~60 ms per run — seconds per fit, and the
   fit must re-derive on every conditioning-slider change. Rejected.

**The estimator: discrete stationarity of the user's own day.** The work-side
value `V(schedule) = satiatedOutput + terminalBonus` never contains λ₀
(leisure enters the objective only through `freeTimeBonus`), so marginals of
V are λ₀-free — no circularity with the current slider (test-pinned). A
rational stop at worked hours W on the 45-min lattice means, per task t:

```text
stopped  ⇒  λ₀ ≥ max_t Δ(one more step on t)/step     =: lo
worked   ⇒  λ₀ ≤ max_t Δ(last step of t)/step         =: hi
```

The first max runs over ALL of the day's tasks — declining to extend a
logged task and declining to _start_ an unlogged one are both part of the
stop decision. The second runs over tasks with ≥ 1 whole step logged: the
work order is unobserved, so "some worked step was worth ≥ λ₀" gives the
loose max as the honest bound. The day's **indifference point** is the
bracket midpoint `(max(0, lo) + hi)/2`; each bound costs one
`evaluateSchedule` call, ~2n+1 per day, no optimizer runs.

**Why the reference schedule is the observed per-task hours** (probed against
two alternatives). The bracket needs a schedule representing the user's day;
by the envelope theorem the marginal should be taken along the
best-arrangement-at-W, which we cannot know. Candidates probed with the
optimizer's own plan at the true λ₀ as gold standard:

- **Chosen — one session per logged task at its observed hours,** canonical
  amplitude order (`a + p₀` descending, the seed ordering), breaks omitted.
  The composition is REAL (drain logs record it), only the order is
  canonical. An UNLOGGED task probed on the `lo` side is inserted at its own
  canonical rank, not appended last (§13.4). Probe: brackets contain the true
  λ₀ across the whole grid
  (true 0.5 → [0.49, 0.78], 0.9 → [0.85, 1.18], 1.3 → [1.16, 1.48]);
  midpoints track truth within ~0.13.
- **Rejected — classic seed truncated to W** (each task at snapped T\*,
  best-first): invents the composition; biased +0.2 to +0.4 at mid λ₀
  because it over-weights the high-amplitude full-demand task.
- **Rejected — λ₀ = 0 max-work plan truncated to W:** erratic (probe
  midpoints 0.7–1.5 for true 0.9); truncating a max-work day leaves a
  composition no λ₀-rational user would have chosen at W, exactly the
  envelope error predicted.

**Censoring.** A day worked to the window edge has no forgone step — it
reveals only `λ₀ ≤ hi`, not an indifference. Symmetrically a zero-work day
reveals only `λ₀ ≥ lo`, and sub-step sessions give no shrink side. A fourth
category (added 2026-07-19, below): a bracket inverted beyond
`STOP_INVERSION_MARGIN` — the day's own data contradicts a rational stop, so
only the one-sided `λ₀ ≤ hi` reading survives. All four are dropped, like
demand-0 drain logs (§8.7): keeping a one-sided reading as a point estimate
would bias the mean. (A cleverer censored-likelihood fit is possible; not
worth it while every real day with any logged work is two-sided.)

**The fit** (`fitStoppingValue`): treat each day's indifference point mᵢ as
`λ₀ + noise`. The prediction is the _identity_, so the §8.7/§8.9 ridge
machinery collapses to an exact closed form — no numeric minimizer:

```text
λ̂₀ = (Σ mᵢ + λ·λ₀_default)/(n + λ),   λ = STOP_PRIOR_STRENGTH = 1
```

- **Prior strength is exact arithmetic here** (sensitivity ≡ 1 per day):
  one day moves λ₀ 50% of the way to its point, three 75%, ten 91% —
  matching the α and r fits' probe-tuned profiles by construction
  (test-pinned to 10 decimal places).
- **Noise/posterior:** σ₀ = `STOP_NOISE_PRIOR_STD` = 0.25 in λ₀ units (the
  lattice bracket's half-width — a median 0.110 over 279 non-inverted days
  (`scripts/stop-inversion-margin.probe.ts`, 2026-08-06), not the 0.15 this line
  asserted from one probe day —
  plus day-to-day mood
  in the stop decision, which no instrument separates); σ̂² blends σ₀ with
  residual scatter as in §8.7; posterior std = √(σ̂²/(n + λ)).
- **Bounds** = the Energy Lab's freeTimeValue input range [0, 3], same
  representability/absurdity-guard role as the α and r bounds.

**Known approximations (deliberate).**

- **Breaks are omitted from the reconstruction** — the drain logs don't
  record them. Reservoirs run slightly hotter than reality, understating
  late marginals; absorbed as noise.
- **Partial logging under-counts W.** A user who rates only some tasks
  looks like they stopped earlier than they did, biasing λ₀ up. Accepted:
  the calibration is for users who log consistently, and σ₀ is wide.
- **The loose max on the `hi` side** biases midpoints up by ~+0.1 on the
  probe grid — inside one lattice bracket's half-width, i.e. below the
  instrument's resolution. **Re-measured 2026-08-06 and smaller than that**
  (`scripts/stop-inversion-margin.probe.ts`): against the honest `hi` (the
  marginal of the step actually worked last, knowable on optimizer-generated
  days) the bias over 282 days is **mean 0.045, median 0.000, p90 0.164** —
  it is zero on most days and only occasionally reaches the quoted 0.1. The
  conclusion is unchanged and the direction is right; the magnitude was
  overstated.
- **Block ORDER is a modeling choice on both sides of the bracket.** The
  reconstruction fixes it canonically, but the marginals genuinely depend on
  it through the reservoirs — the same probe step scored 0.65 appended last
  vs 0.37 inserted first. Canonical placement (§13.4) makes the estimator a
  function of the day rather than of an implementation convention; it does
  not make the marginal order-free, which only knowing the real order would.
- **Inverted brackets beyond a margin are censored; small inversions keep
  their midpoint** (probed and revised 2026-07-19). The two revealed
  inequalities can contradict: `lo > hi` means extending some task was worth
  MORE per step than the most valuable step actually worked — no λ₀
  rationalizes such a day (typical cases: a session cut short mid-warm-up,
  or a long grind on a weak, satiating task while a high-amplitude task sat
  unstarted). On arbitrary random compositions about HALF of days invert
  (89/185; **re-measured 2026-08-06: 144/368 = 39%**,
  `scripts/stop-inversion-margin.probe.ts`) — but on the estimator's intended
  regime they mostly don't. **"Zero" was too strong, and that is now
  measured**: on a wider grid than the 2026-07-19 one, optimizer-generated
  days invert on **4 of 315**, and those days perturbed by ±1 lattice step of
  "mood" invert on **44 of 1179**, of which **6 land past the margin and are
  censored** — worst gap **0.421**, well beyond the 0.25 boundary. So a small
  number of genuinely near-rational days ARE discarded, and the inversion gap
  does not cleanly separate the two populations: inverted random compositions
  gap a median 0.282 (p90 0.583, max 0.815) while honest mood days reach 0.421.
  Inversion remains a
  useful DETECTOR — 39% against 3.7% is a strong signal, and the contamination
  it screens out is worse than the loss — but it is a noisy one, not the clean
  partition this paragraph used to assert. A day past the margin is therefore
  treated as a stop that was not a leisure choice
  (interruption, sickness, deadline elsewhere), and such a day's midpoint
  is NOT centered on the user's λ₀: it lands at the task curves'
  characteristic marginal regardless of the true value (probe: 1-step
  interrupted days read ~0.7–1.1 whether the true λ₀ was 0.3 or 1.5,
  shifting a true-0.3 user's 3-day fit from 0.47 to 0.64 with two such days
  added — systematic shrinkage toward curve scale, which the symmetric
  σ₀ = 0.25 residual model cannot absorb). The day therefore degrades to
  its one-sided reading `λ₀ ≤ hi` and is dropped by the same principle as
  the other censored categories. The margin
  (`STOP_INVERSION_MARGIN = 0.25` = the hi-side loose-max bias ~+0.1 plus a
  lattice bracket half-width ~0.15) answers the over-censoring concern: a
  day has to contradict itself by more than the instrument's own slack
  before it is discarded. **Neither half of that decomposition survived
  re-measurement** (2026-08-06,
  `scripts/stop-inversion-margin.probe.ts`): the loose-max bias is median
  0.000 / mean 0.045, and the bracket half-width on non-inverted days is
  median **0.110** (mean 0.109, p90 0.159) rather than 0.15. The two medians
  sum to **0.110**, not 0.25 — so 0.25 is roughly twice the instrument slack
  it is described as, and the arithmetic in the parenthesis above should be
  read as a rationalization rather than a derivation. It is nonetheless not
  obviously mis-set: widening slack is what keeps mild inversions, and even at
  0.25 six near-rational mood days out of 1179 are still censored, so tighten
  it and that number grows. Re-deriving the constant from the measured
  distributions — rather than from these two terms — is the open item. Probe
  on the standard
  day: interruption slivers gap 0.33–0.65 (censored); a 2.25h reading-only
  day gaps 0.07 (kept, midpoint 0.88). An earlier revision kept ALL inverted
  midpoints, reasoning σ₀ would absorb the contradiction — the
  contamination probe above superseded that. Locked in as unit tests: a
  strongly inverted day is censored and a mildly inverted day still enters
  the fit.

**Probe results (2026-07-19, locked in as unit tests):** synthetic user at
λ₀ = 0.9 over three windows fits to within [0.75, 1.05] against the 0.5
prior; extraction bit-identical under freeTimeValue 0 vs 3; earlier stops
yield higher indifference points; censored/empty/sliver days drop to
`fitted: false`; std shrinks with data; W\*(λ₀) graded (the §8.3 update);
deterministic.

**UI.** A third calibration card ("Stopping Calibration") follows §8.7/§8.9's
pattern — fitted λ₀ ± std with used-day count and an explicit **Apply**
button — but needs no editor of its own: its observations are derived from
already-logged 🪫 drain ratings joined with each day's stored session
(tasks + window), excluding today (an unfinished day has not revealed its
stop yet).

**Visibility (2026-07-23).** All fitted values also surface read-only on the
Analytics page ("Your model" card): each parameter next to its default and
the fit's own used-observation count — ϕ for a mid-scale reference task
(difficulty 5, enjoyment 5, so the fitted c-plane reads as one number),
r ± std, α_cog/α_phys ± std, λ₀ ± std. The snapshot runs the full
conditioning chain on ALL logs (ϕ from ⚡, r from ☕, α given r from 🪫,
λ₀ given everything from finished days) — the same fits the planners and
Burnout Risk consume; the card changes no state, calibration stays in the
Energy Lab (α, r, λ₀) and ⚡ logging (ϕ).

### 8.11 Live stop advisor — §8.10 run forward mid-day (added 2026-08-03)

**The question inverted.** §8.10 reads a _finished_ day's stop to learn λ₀;
the advisor takes the fitted (or hand-set) λ₀ and answers the in-day
question: _given the work logged so far, is more work still worth it — and on
what?_ Same instrument both ways: today's 🪫 drain logs are the day so far,
reconstructed exactly as §8.10 will reconstruct them once the day is
finished — one block per logged task at its observed hours (its sessions
summed), canonical amplitude order, breaks unknown and omitted — and priced
by the same λ₀-free
work value `V = satiatedOutput + terminalBonus`. No new parameters, no new
logging instrument.

**Sessions, not steps** (`adviseStop`). The verdict is

```text
continue  ⇔  max over open tasks t, whole-step durations d ≤ room of
             [V(day + d on t) − V(day)] / d   >   λ₀
```

with the argmax reported as the recommendation (task, duration, average
value per hour). The naive candidate — §8.10's own one-step marginal, i.e.
its `lo` bound — is deliberately NOT the verdict: a fresh task's first 45 min
is mostly warm-up ramp, so its one-step marginal sits below a λ₀ that the
full session clears, and the one-step advisor cries stop mid-day exactly
when λ₀ is high. Probe 2026-08-03 (40 random days × 4 λ₀ levels; ground
truth = the optimizer's own plan walked chronologically step by step, the
advisor seeing only the composition so far):

| Reading of the probe            | one-step       | session-lookahead |
| ------------------------------- | -------------- | ----------------- |
| mid-day false stops, λ₀ 0.3/0.5 | 0.9% / 2.2%    | 0.7% / 1.9%       |
| mid-day false stops, λ₀ 0.9/1.3 | 16% / 25%      | 5.2% / 6.4%       |
| at-stop agreement (true λ₀)     | 33–39/40       | 33–39/40          |
| when late, late by              | 1 step (one 2) | 1 step (one 2)    |
| at-stop agreement (fitted λ̂₀)   | —              | 34–40/40          |

The duration axis is the optimizer's own move shape (grow, T\*-session
insert), which is why at-stop agreement survives the stronger test: at a
rational stop no session of any length clears λ₀, so maxing over durations
does not push the user past it. Of the residual false stops at λ₀ = 0.9,
roughly a third sit immediately before a _planned_ rest — the known
breaks-omitted approximation (§8.10), not a new one.

**The sweep, rebuilt and re-run (Probe 2026-08-06,
`scripts/stop-advisor.probe.ts`).** The 2026-08-03 table above was quoted from
a sweep that was never committed — the §14.1-2 failure mode — so it was rebuilt
to the same design (72 seeded random days × the same four λ₀, ground truth the
optimizer's own plan walked chronologically, the advisor seeing only the
composition so far). The one-step arm exists nowhere in the code, so the probe
reconstructs the search from exported parts and VALIDATES it: its max over all
admissible m equalled `adviseStop`'s own `marginalValue` at every checkpoint of
the run (0 mismatches), so the two arms are one search at two lookaheads.

The direction holds and the ≥ 0.9 gap is real. Mid-day false stops, λ₀
0.3 / 0.5 / 0.9 / 1.3: one-step 1.3% / 5.4% / 19.7% / 24.7% versus
session 0.9% / 4.0% / 6.6% / 6.2%, over 759 / 680 / 407 / 162 mid-day
checkpoints — a 3× gap at λ₀ = 0.9 and 4× at λ₀ = 1.3, wider than the table
claimed. At-stop agreement is IDENTICAL between the arms at every level
(22/31, 42/52, 67/69, 71/72) and neither arm is ever more than 1 step late,
so pricing sessions costs nothing at a rational stop.

Three corrections to the table's own reading. The agreement denominator is not
the day count: at λ₀ = 0.3 only 31 of 72 days stop INSIDE the window, the rest
fill it and read `window-full` (§8.10's censored category), so "33–39/40" was
counting days that revealed no stop decision. Agreement is λ₀-dependent, not
flat — 71% at λ₀ = 0.3 against 99% at λ₀ = 1.3. And the residual session false
stops are rest-adjacent 2 of 27 at λ₀ = 0.9, not "roughly a third" (6 of 27 at
λ₀ = 0.5) — the breaks-omitted approximation explains less of the residue than
claimed.

Where it does bend (curated fixture, 13 windows of 6–18h over four
high-amplitude, high-demand tasks — a day the plan spends on planned rest):
BOTH arms run 2–3 steps late and at-stop agreement collapses to 0/4, 0/9,
1/13 at λ₀ ≤ 0.9. That is the breaks-omitted bound sized rather than a new one,
and at the stop itself it separates the arms not at all — while mid-day it
separates them most: on the same fixture at λ₀ = 1.3 the one-step arm
false-stops on **31.7%** of checkpoints against the session arm's **9.9%**, the
largest gap measured.

**Candidates vs reconstruction.** The max runs over the OPEN tasks only
(`candidateTaskIds`, the store passes the unchecked ones): "one more session
of a task you already checked off" is no advice. Every logged task stays in
the reconstruction regardless — a completed task's hours drained the
reservoirs the open ones must work with (test-pinned: the same open task
prices strictly lower after 4.5 logged hours on a completed one). This makes
the advisor a **next-up-family** reading under §11.8 — it responds to
completion, unlike the plan — and it is the one deliberate asymmetry with
§8.10, whose `lo` bound maxes over all tasks because a finished day's stop
declined them all.

**Bounds of validity, stated on the card's tooltip:** the reading trusts
today's 🪫 logs, so unlogged work reads as free time (the advisor will say
"continue" too eagerly) and batch-logged sessions blur it — same
partial-logging caveat as §8.10, now visible in-day.

**One bound is specific to the forward reading** (added 2026-08-05): `growBy`
places the probed session at the candidate's CANONICAL rank, so a candidate
that outranks the logged work is priced AHEAD of it — on fresher reservoirs,
with an intact warm-up, than the session it actually describes, which can
only over-price `continue`. Kept rather than appended for two reasons.
`StopObservation` carries no order, so the reconstructed past is itself
canonical, not chronological — appending places the future after a fiction,
not after the real day. And appending does not measurably help: re-running the
probe design above put the two conventions within one checkpoint of each other,
with canonical taking fewer mid-day false stops — the metric the table
optimizes. (The 2026-08-05 counts once quoted here — 104 vs 103 wrong, 79 vs 84
false stops, a 2.4× gap on the days §8.10 calls non-rational — came from a sweep
that was not committed; `scripts/stop-advisor.probe.ts` has no append-last arm
and prints none of them.) Verdicts: `continue` /
`stop` (strictly: continue iff best session > λ₀, so exact indifference reads
as stop, matching §8.10's `stopped ⇒ λ₀ ≥ lo`), plus `window-full` when no
whole 45-min step fits in what remains of the window — logged hours filled
it, or the window is smaller than one step — and no verdict at all when
there is no window, no tasks, or nothing left unchecked.

**Implementation sharing (R3).** `reconstructStopDay` + `growBy` are one
definition used by both readings; `stopIndifferencePoint`'s `lo` is
`bestNextStep`, the m = 1 slice of the advisor's search. The fit itself is
untouched — its bracket stays one-step, because discrete stationarity of an
observed stop is a statement about the marginal step, not about hypothetical
sessions.

## 9. References

- Fox, B. L. (1966). _Discrete optimization via marginal analysis._
  Management Science 13(3) — exactness of greedy marginal allocation under
  diminishing increments.
- Ibaraki, T. & Katoh, N. (1988). _Resource Allocation Problems: Algorithmic
  Approaches._ MIT Press — the general reference for §4.
- Leroy, S. (2009). _Why is it so hard to do my work? The challenge of
  attention residue when switching between work tasks._ Organizational
  Behavior and Human Decision Processes 109(2) — interpretation of
  switchCost.
- Mark, G., Gudith, D. & Klocke, U. (2008). _The cost of interrupted work:
  More speed and stress._ CHI 2008 — empirical ~23-minute refocus time
  grounding the 0.25h default.
- Boksem, M. A. S. & Tops, M. (2008). _Mental fatigue: Costs and benefits._
  Brain Research Reviews 59 — separate-systems rationale for the dual pools.
- Peifer, C. et al. (2014). _The relation of flow-experience and
  physiological arousal under stress — Can u shape it?_ J. Experimental
  Social Psychology — inverted-U evidence relevant to the §7 note on `a = E·β`.
- Xia, T. & Frey Law, L. A. (2008). _A theoretical approach for modeling
  peripheral muscle fatigue and recovery._ J. Biomechanics 41(14) — the
  three-compartment fatigue-recovery structure behind §8's reservoir law.
- Looft, J. M., Herkert, N. & Frey Law, L. (2018). _Modification of a
  three-compartment muscle fatigue model to predict peak torque decline
  during intermittent tasks._ J. Biomechanics 77 — recovery-rate multiplier
  correcting over-predicted fatigue under interspersed rest (§8.1).
- Monk, C. A., Trafton, J. G. & Boehm-Davis, D. A. (2008). _The effect of
  interruption duration and demand on resuming suspended goals._
  J. Experimental Psychology: Applied 14(4) — resumption cost grows with
  gap length, grounding §8.2's decaying warm-up carryover.
- Altmann, E. M. & Trafton, J. G. (2002). _Memory for goals: an
  activation-based model._ Cognitive Science 26(1) — exponential decay of
  goal activation, the functional form used in §8.2.
- Jaber, M. Y. & Neumann, W. P. (2010). _Modelling worker fatigue and
  recovery in dual-resource constrained systems._ Computers & Industrial
  Engineering 59(1) — dual-reservoir precedent and the short-breaks-help
  benchmark behavior in §8.3.
- Bechtold, S. E., Janaro, R. E. & Sumners, D. L. (1984). _Maximization of
  labor productivity through optimal rest-break schedules._ Management
  Science 30(12) — the original optimal rest-break scheduling formulation.
- Rohmert, W. (1960). _Ermittlung von Erholungspausen für statische Arbeit
  des Menschen._ Internationale Zeitschrift für angewandte Physiologie 18 —
  static effort below ~15% MVC is sustainable indefinitely; anchors §8.5's
  default micro-recovery floor.
- Borg, G. A. V. (1982). _Psychophysical bases of perceived exertion._
  Medicine & Science in Sports & Exercise 14(5) — the category-ratio (CR10)
  0–10 perceived-exertion scale behind §8.7's drain-rating instrument and
  its (approximately ratio-scale) linear reading.

## 10. Revision log (doc-only corrections)

Changes to this document and to code comments that did **not** change any
formula, constant, bound or fit — pure explanations, code moves, and
display-only corrections. Each entry says which of those it was; three of them
(the band-table move, the `Infinity%` reading, the curve cache) do change
runtime behavior without touching the model. Recorded so future readers can
tell a corrected explanation apart from a model change. If an entry here seems
to contradict older commit messages or comments, this log is the current truth.

### 2026-07-14 — math review of the v2 revision

1. **Forgetting-factor half-life corrected** (§5 and the `fitUserConstants`
   comment in `zenith.ts`). γ = 0.98 has a half-life of
   ln 0.5 / ln 0.98 ≈ **34 logs**; the previous "~50-log half-life" figure
   was actually the 1/e time constant (0.98⁵⁰ ≈ 0.37). Wording only — no
   code ever consumed the number.
2. **Inflection-beyond-stopping justification replaced** (§2 properties).
   The old argument "`x* ≤ 1.7933 < 2 − r`" only covers `r ≤ 0.207`, since
   `2 − r` drops to 1.1 at the r-cap. The claim itself was always true and
   now has a real proof: `N(2−r) = e^(r−2)·(7−2r) − (1+r)` is convex in r
   with negative endpoints, hence negative everywhere, so `x* < 2 − r`
   (§2 marginal fact 3).
3. **Marginal monotonicity upgraded from "verified numerically" to proved**
   (§2 marginal facts 1–2): the D-function argument
   (`D = x·N' − 2N`, `D(0) = 0`, `D' = e^(−x)·x²·(x + r − 2) < 0` below
   `2 − r`) proves the strictly decreasing marginal on the whole working
   range, and the sign structure of N (`N < 0` for all `x > x*`) proves the
   soundness of §4's truncate-at-first-non-positive block increment. The
   numeric sweeps in `zenith.test.ts` were kept as regression checks.
4. **Garbled formula sentence fixed** in the `zenith-energy.ts` header,
   which accidentally equated the session phase `s` with the curve formula
   ("p(s) uses a session phase s = (a+p₀)·k·s·e^(−ks)"); it now reads
   `p(s) = (a+p₀)·k·s·e^(−ks)` with `s` the session phase (task time, not
   clock time).

### 2026-07-28 — banding policy moved within the presentation layer

1. **§14's band pointer retargeted.** The per-axis band table and
   `isOutOfBand` moved from `presentation/utils/metric-descriptor.ts` to
   `presentation/utils/band.ts` (renamed `BAND` → `AXIS_BAND`), which now owns
   the whole banding vocabulary: thresholds, tokens and the words a screen
   reader hears. Same thresholds, same call for the card and the metric rows —
   a file move, no threshold, formula or constant touched.
2. **Infinite readings render as N/A, not as a judgement.** §14 already notes
   that Human Capacity can read `Infinity` (a pool of 0 hours with demand on
   it) and that badness excludes such a candidate. The two display paths now
   agree with each other about it: the metric row and the advice row both show
   N/A with no band, where the row used to print `Infinity%` and the card used
   to colour "N/A" critical. Display only — the model's ordering is unchanged.

### 2026-08-01 — §14's "next lever" pointed at the wrong path

1. **`buildCurves` caching never applied to advice.** §14's cost note claimed
   caching `buildCurves` was "the next lever if this ever has to be
   interactive" — but no advice candidate calls it: the solves are
   classic-model (`calculateDailyMetrics`) and Burnout Risk enters through
   `simulateReservoirs`, which is deliberately curve-free (§11.6). The cache
   was built the same day where the function does run — `optimizeSchedule`
   and the §8.10 stopping fit now build one curve map per search/fit and
   thread it through every evaluation (`evaluateWithCurves`; task reservoir
   laws ride along on the curve). Identical arithmetic per evaluation, so no
   formula, constant or plan changed — measured 2.6× on a 4-task/8h solve
   (104 → 40 ms).

### 2026-08-06 — §14.1-2's "free trim" was a claim, not a property

1. **The budget trim is feasible, not free.** §14.1-2, `AGENTS.md` and
   `plan-advice.ts`'s comment all said trimming to `budget − planSlack` costs
   no Σ P̄. It does not hold: `allocate` is path-dependent on `budgetBlocks`,
   so a pool-bound day re-solves the same hours into a worse distribution —
   **103 of the 126** budget × switch-cost combinations that carry a trim lever
   at all (of 280 tried), worst **−0.9%**, none of them cutting funded
   work (`scripts/plan-advice.probe.ts`). No formula, constant or bound moved
   and the card's arithmetic is unchanged; the number it always printed was
   right and the sentence describing it was wrong. The delta is deliberately
   **not** clamped — see §14.1-2.
2. **Two code comments were re-dated, not re-measured.** `plan-advice.ts` and
   `daily-plan-store.svelte.ts` quoted the pre-solve-once ~950 ms for a 12-task
   advice run; §14 has recorded 421 ms since 2026-07-28 and both now say so.
3. **The `improvement > 0` filter's comment gave the wrong reason.** It
   credited `>` with excluding an Infinity reading improving on itself;
   `Infinity − Infinity` is `NaN` and every `NaN` comparison is false, so `>=`
   would exclude it identically. Strictness excludes candidates that _tie_ the
   baseline. §14 line "the improvement test is `<`" is correct for a direct
   badness comparison — the code subtracts, and the comment carried the reason
   across a form change where it stopped holding.

## 11. Metric-layer corrections (2026-07-18)

### 11.1 Scope and principle

The dashboard metrics (`metric/calculation.ts`) are derived DISPLAYS, not
allocator inputs — none of the fixes below change the plan the allocator
solves. (Since 2026-07-28 these same readings are the plan advisor's search
objectives, §14, so a redefinition here _does_ change which lever it offers:
`frictionIndex` and `scheduleIntegrity` are both `AXIS` entries.)
They had not received the §2–4 level of scrutiny; a 2026-07-18 review
(scratchpad property probes against the real functions, same method as §8's
probes) found four defects, fixed below. Each entry records the old formula,
the new one, and why — this section is to the metric layer what §6 is to the
model. The i18n metric descriptions (en/de) were updated to match, which
also removed two stale claims: "Lagrange multiplier solution" (v1; the v2
allocator is discrete greedy, §4) and "1.79×ϕ per task" (v1; T* is per-task
since v2, §3).

### 11.2 Zenith Gain: cap instead of a silent 0% when the naive plan achieves nothing

- **Before:** `gainPercent = naive > 0 ? (optimized − naive)/naive·100 : 0`.
- **After:** ratios saturate at `GAIN_PERCENT_CAP = 999`; `naive = 0` with
  `optimized > 0` reports the cap instead of 0.
- **Why:** the naive baseline attempts all n tasks and pays `(n−1)·switchCost`
  (§7); with many tasks and a small budget its effective budget hits 0 and its
  productivity is 0. Probe: 10 tasks on a 2h budget → optimized 3.44,
  naive 0, displayed gain **0%** — the metric hid Zenith's advantage in
  exactly the scenario its drop-weak-tasks logic wins hardest. A capped value
  reads as "≥ 10× the naive plan"; beyond that the ratio carries no decision
  value.
  **SUPERSEDED 2026-08-06 (§19).** The fix was right about the old guard being
  wrong and about 0% being the wrong display. It was wrong about the cause: the
  `naive = 0` it was displaying honestly was itself an artifact of billing the
  baseline for switches its plan never made. That same 10-tasks-on-2h day now
  seats 4 tasks over 5 blocks and reports a finite gain; `GAIN_PERCENT_CAP`
  survives as a ratio guard with no reachable trigger left.
- ~~**Noted, unchanged:** negative gains remain possible and honest.~~
  **SUPERSEDED 2026-07-26 (§13.2).** This entry called the negative readings a
  consequence of the §0 objective. They were mostly a consequence of the
  BASELINE having a finer grid than the optimizer: measured, the gain was
  negative on 3.8–7.8% of random days (2026-08-06 replica; the 4–19% draw does
  not reproduce — §13.2). The naive split is now block-quantized
  too, and the single-budget gain is provably ≥ 0.

### 11.3 Burnout Risk: overhang counts funded tasks' T* only (formula since superseded by §11.6; the `availableHours` = intended-work reading survives)

- **Before:** `overhang = max(0, effectiveBudget − Σ T*ᵢ)` with the sum over
  ALL active tasks, funded or not.
- **After:** the sum runs over tasks with `suggestedHours > 0`.
- **Why:** a task the allocator dropped (zeroed pool, switch not worth
  paying) is one the user won't work — its `T*` was absorbing budget hours
  that actually land on the funded tasks' diminishing-returns zones. Probe
  (injured user: `physicalHours: 0`, 10h budget): the dropped gym task's
  `T* = 4.38h` suppressed the overhang from 6.16h to 1.78h, silencing the
  overwork warning. (Those three figures are from a 2026-07-18 scratch probe of
  a formula that no longer exists — history, not a re-runnable number.)
  Property now locked in a test: adding a dropped task to a plan that funds **at
  least one** task leaves the risk unchanged. It is _not_ invariant when nothing
  at all is funded — that branch simulates the declared budget at the task
  list's average demands (§11.6), so one more dropped task moves the average and
  the reading with it (32 → 16 on a 10 h budget). Those two readings are
  themselves pinned by value since 2026-08-07: the test asserted only that they
  DIFFER, which a mean → max (32 → 48), a sum (32 → 48), or a
  cognitive/physical swap (28 → 18) all satisfy, so the averaging rule was
  unconstrained.
- **Documented semantic choice (deliberate):** `availableHours` is read as
  hours the user INTENDS to work, so budget beyond the funded workload is
  treated as overwork risk. The alternative reading ("available ≠ intended";
  a free Saturday shouldn't warn) was considered and rejected for now — the
  metric's job is to warn when the declared budget exceeds what the model
  thinks is productive, and the slack display on the dashboard already shows
  the benign interpretation.

### 11.4 Friction Index: raw scales instead of the asymmetric mapped gap

- **Before:** `Σ max(0, E − β)·hours / (4·Σhours)` on MAPPED values,
  E ∈ [1,5], β ∈ [1,2].
- **After:** `Σ max(0, diffᵤ − βᵤ)·hours / (9·Σhours)` on RAW user scales
  (effective difficulty and enjoyment, both 1–10).
- **Why:** with β capped at 2 and E reaching 5, the mapped gap measured
  difficulty, barely modulated by enjoyment. Probe: a difficulty-10 task at
  enjoyment **10** read 75/100 "friction" while a hated trivial task read 0 —
  contradicting the metric's own description ("high-difficulty,
  LOW-ENJOYMENT work"). Difficulty you love is not friction. `Momentum` and
  `Grind Density` had already switched to raw values for exactly this
  asymmetry; Friction was the sibling that never got the fix. 100% now means
  every allocated hour is difficulty-10/enjoyment-1 work; the loved-hard
  task reads 0.

### 11.5 Schedule Integrity: overhead share instead of the small-allocation count

- **Before:** `100 − 100·|{tasks with suggestedHours < switchCost}|/n`.
- **After:** `100·worked/(worked + (m−1)·switchCost)`, m = funded tasks —
  the share of the plan's committed time that is productive work rather than
  attention-residue overhead. Guards kept: no tasks → 100, no budget → 0;
  new: budget set but nothing funded → 0.
- **Why, twofold.** (1) The minimum funded allocation is one 15-minute block,
  which EQUALS the default switch cost — so at default settings the old rule
  could never flag a funded task; the only tasks it counted were dropped ones
  (0 hours). (2) Counting drops as "fragmentation" inverts the semantics:
  dropping a task is how the allocator CONSOLIDATES a day (§4's fixed-charge
  logic), so the metric punished exactly the behavior that protects schedule
  integrity. The new ratio measures fragmentation directly: the same 4
  worked hours read 100% as one session, 94% across two tasks, 70% across
  eight.

### 11.6 Burnout Risk v2: re-derived from the energy model (2026-07-20)

- **Retired:** the standalone strain-hours heuristic

  `risk = min(100, (Σ max(0, E/β − 1)·h·cogIntensity + overhang·avgStrain·2) / 5 · 100)`

  with `STRAIN_CAPACITY = 5`, `cogIntensity = 1 + 0.3·mentalDifficulty/10`,
  and the overwork term weighted 2×.

- **Replaced by:** a reservoir simulation of the day the user actually
  intends. Build the plan's schedule — funded tasks in the interleaved run
  order, switch costs as rest gaps (`taskId = null`), budget hours beyond the
  funded plan stretching the funded blocks pro-rata — and evolve both
  reservoirs through the §8.1/§8.5 law
  (`dC/dτ = −α·w·C + r′·(1−(1−b)·w)·(1−C)`, closed-form per block). Then

  `risk = 100 · (1 − min(C_cog(T), C_phys(T)))`

  — the depletion of the MOST-DRAINED reservoir at the end of the intended
  workday (min, not a blend: burnout follows the exhausted system).

- **Why retired.** The heuristic borrowed the model's symbols but derived
  from nothing: 5 strain-hours, the 2× overwork weight, and the 1.3×
  cognitive multiplier were invented constants beside a calibrated model.
  Probes (2026-07-20): worst-case work saturated the scale after ~1.4h — 4h
  of high-demand work read 100%, as did any day from 1.5h up, so the metric
  was in practice a binary "planned any hard work" flag. It double-counted
  difficulty (in E and again in `cogIntensity`, which correlate) and was
  connected to NO user-capacity quantity — the complaint that triggered the
  rework.
- **What the derivation buys.**
  - _Personalization:_ the main page seeds `DEFAULT_ENERGY_PARAMS` and
    applies the user's own calibration fits — recovery `r` first (§8.9), the
    two `α` fits conditioned on it (§8.7) — so the same plan reads differently
    for a fast- vs slow-draining user. This is the capacity connection the
    heuristic lacked (declared pools additionally enter via allocation, as
    before).
  - _Overwork without a magic weight:_ intended hours beyond the plan
    (§11.3's documented `availableHours` reading, unchanged) simply drain the
    reservoirs longer in simulation.
  - _Resolution:_ defaults give 25/41/57/63/66% for 1/2/4/6/8h of
    demand-0.9 cognitive work — monotone and discriminating where the old
    scale was pinned at 100.
- **Deliberate semantic changes.**
  - _Enjoyment no longer enters._ In the energy model drain is
    f(demand, duration); enjoyment shapes output value (warm-up amplitude,
    satiety), not depletion. Loved-hard = hated-hard in risk — the §11.4
    boundary ("difficulty you love is not friction") applied to burnout.
    Locked by test.
  - _100% is unreachable._ Micro-recovery (§8.5) floors each reservoir at
    `eq > 0`; a full-demand cognitive day tops out near 87% at defaults, and
    sustained moderate work plateaus at its equilibrium depletion (an 8h and
    a 16h demand-0.5 day read alike — the model's statement that such load is
    sustainable, per the Rohmert threshold behind §8.5).
  - _Probe 2026-08-06_ (`scripts/burnout-risk.probe.ts`; 600 seeded random
    days — 1–7 tasks, difficulties 0–10, budgets 0.25–16h, switch costs
    5–30m — with the plan built by `calculateSuggestedTasks`, so the simulated
    blocks are the real interleaved order). At `DEFAULT_ENERGY_PARAMS`: 0 days
    read ≥ 100%, 0 read > 87%, sweep max 82%; the pure single-task full-demand
    cognitive day reads 70/83/87/87% at 4/8/16/24h; the demand-0.5 8h and 16h
    readings are identical (0 points apart); and the resolution ladder above
    reproduces exactly — 25/41/57/63/66% for 1/2/4/6/8h at demand 0.9. The
    ceiling is a claim about the DEFAULTS, not about the law: α at
    `ALPHA_FIT_MAX` reads max 97% over the same days, `RECOVERY_FIT_MIN` 95%
    (and loses the plateau — 8 points between the 8h and 16h demand-0.5 days,
    a slow recoverer not yet at equilibrium by 8h), b = 0 reaches 100% on a
    16h full-demand day, b = 0.3 reads a sweep max of 52% (53% on the
    full-demand cognitive day — the same two-basis split as the defaults'
    82 vs 87).
  - _Monotone in demand and duration, NOT in the declared budget_ (duration
    and the budget walk from the same probe, 2026-08-06; the demand arm is
    `scripts/mtr2-carry-over.probe.ts` — walking demand 0→10 at 1/2/4/8 h, 0 of
    10 steps fell at any duration). Walking `availableHours` 0.25→16h over a FIXED task
    list, the reading FELL on 3006 of 37800 steps, on 531 of the 600 days,
    worst drop 29 points (4 tasks, 3.25h → 3.5h at s = 25m: 41% → 12%). Not
    min() switching reservoirs — the cognitive one binds on both sides — but
    the re-solve: the larger budget funds 4 tasks instead of 2, and their
    three switch gaps are 1.25h of REST against one gap's 0.42h, so the
    simulated WORK falls from 2.83h to 2.25h even though the budget rose
    (2.75h allocated over two tasks stretches by 1.03 to fill 3.25h; the
    four-task plan's 2.25h already fills 3.5h with its gaps). The ladder is
    monotone because it raises demand-hours; the budget alone is not a
    monotone lever on this metric.
  - _Properties preserved:_ dropped tasks (0h) leave the risk unchanged
    (§11.3, now by construction — they contribute no block); a declared
    budget with nothing funded still warns (simulated at the task list's
    average demands); no tasks or no intended hours → 0.
- **Non-positive switch cost means no switching** (2026-08-07). The overhead
  the budget must cover is `(m − 1)·s`, so a NEGATIVE `s` grew the overhang
  while the rest gaps were only emitted for `s > 0` — the simulated day then
  ran longer than the declared budget with the whole difference counted as
  work (4 funded tasks, 10 h budget, s = −30 m: an 11.5 h span), reading 1–2
  points high. `s` is now clamped at entry to `max(0, s)`, which is the
  allocator's own convention (`zenith.ts`: `switchCost <= 0` skips the
  switching search entirely), so the two agree on the degenerate input instead
  of diverging. Reachable only mid-typing — the number input defers clamping
  to blur — and for every `s ≥ 0` the span was and remains exactly the budget.
- **Pro-rata is pinned by value** (2026-08-07). The "stretching the funded
  blocks pro-rata" clause above was locked by nothing: every other
  multi-task fixture in the suite sits where pro-rata and an equal split
  coincide (one at stretch 1.03 over two blocks that agree to the rounded
  point, one at overhang exactly 0), so an equal-split regression passed all
  616 server tests. The separating fixture now in the suite reads 41 against
  the equal split's 8 — it ends on a TINY light task, which pro-rata keeps
  short (0.25 h × 1.875) so the day ends on the heavy block, while an equal
  split hands it 2.33 h of extra low-demand time and lets the reservoirs
  refill. It also kills stretching the gaps too (33) and omitting them (53).
- **Rejected alternative:** scaling the heuristic's `STRAIN_CAPACITY` with
  the declared cognitive pool. It fixes the reported symptom (capacity
  disconnect) but keeps the invented constants, the double-counting, and the
  saturation cliff — patching a formula the model can simply replace.

### 11.7 Momentum: burnout claim removed, fed active tasks (2026-07-20)

- **Before:** computed over ALL session tasks (completed included), with a
  tooltip claiming "Reset Reqd = burnout risk".
- **After:** same formula — `round(avg(enjoyment − effectiveDifficulty))`,
  raw 1–10 values — but over ACTIVE (uncompleted) tasks, tooltip reworded to
  motivation drain.
- **Why, twofold.** (1) After §11.6, Burnout Risk is demand × duration
  through the reservoirs with enjoyment deliberately excluded; Momentum is
  pure affect with no time dimension. The old tooltip made the two
  contradict on the dashboard: a loved-hard 12h day read "Upward /
  sustainable" next to ~85% burnout risk, a hated-trivial half hour read
  "Reset Reqd = burnout risk" next to ~5%. Both numbers were right; the
  label merged two orthogonal concepts. Burnout Risk now owns depletion;
  Momentum owns motivation. (2) Over the full backlog the metric was static
  as you worked — completed tasks kept counting, so only editing the list
  moved it, and it disagreed with its affect siblings (Grind Density, Quick
  Wins, Recovery Ratio), which already read active tasks. Over active tasks
  it responds as the day progresses: finishing the draining tasks makes the
  remaining-day outlook tick upward — which is what "momentum" should mean.
- **Deliberate non-change:** still unweighted by hours. Hour-weighting over
  `suggestedHours` would silently erase unfunded (0h) tasks from the
  average; the metric reads the whole remaining backlog, funded or not.
  (The "affect siblings" clause in (2) is superseded by §11.8: Grind Density
  and Recovery Ratio moved to plan scope; Momentum stays active-scoped.)

### 11.8 Metric scope families: plan / progress / next-up (2026-07-20)

Every dashboard metric now answers exactly one of three questions, and its
task set follows from the question — the test being "should this move when I
check a task done?":

- **Plan** ("what does today look like as designed?") — all `suggestedTasks`,
  completed included; completing a task must NOT move them, since its hours
  stay allocated. Fallow Gain, Human Capacity, Time Scarcity, Burnout Risk,
  Cognitive/Physical Load, Energy Balance, Schedule Integrity, Friction,
  Deep Work, Sustainable Work, Day Profile, averages — and, rescoped from
  active in this change: **Flow Coverage, Task Variety, Grind Density,
  Recovery Ratio**. (Variety previously flashed a red 0 as the last tasks
  completed; coverage read the plan as "worse" when a flow-reaching task was
  checked off.)
- **Progress** ("how well am I executing the plan?") — all tasks by
  construction; completed tasks are the numerator, so these MUST move on
  completion. Completion Rate, Yield Index.
- **Next-up** ("what should I grab / watch out for next?") — active
  (uncompleted) tasks; these SHOULD deplete as the day progresses. Momentum
  (§11.7 reading kept; over all tasks it would duplicate Day Profile, which
  classifies the same two averages), Quick Wins, Bottleneck (tooltip now
  states it may name an unfunded task), suggested run order.

Also in this change: `flowCoverage.optimal` dropped (computed, never
displayed), and the Energy Lab's classic-plan comparison no longer strips
completed tasks from the classic side only — both plans simulate the full
intended day, so `outputVsClassic` is no longer biased toward the energy
plan once anything is checked off.

**The display gate belongs to the same family (2026-07-30).** Scoping the
calculation is only half of it: `buildMetrics` withholds a reading whose
inputs are missing, and gating a plan-scoped row on _active_ tasks blanks it
to N/A the moment the last task is checked done — the red-0 defect above in a
different colour. Flow Coverage, Task Variety and Grind Density were gated
that way and now gate on the plan (tasks, plus a budget where a budget-0 plan
reads degenerately). Only a next-up row may be gated on active tasks.

### 11.9 Overnight reservoir carry-over (2026-07-28)

Burnout Risk (§11.6) simulated every day from full reservoirs — yesterday's
boxing did not exist this morning. Now the viewed day's `initialCog`/
`initialPhys` come from the previous day's 🪫 drain logs
(`seedMorningReservoirs`, `energy-calibration.ts`): each log carries the
worked hours and the demands captured at logging time, so the previous day
is simulated from fresh reservoirs through the §8.1/§8.5 law — its logged
blocks, then one rest block filling the remainder of a 24 h cycle,
`gap = max(0, 24 − Σ hoursᵢ)`.

No logs → 1 exactly (the previous behavior). Keyed to the **viewed** day's
predecessor, so a past day reads with its own morning.

- **Why a 24 h cycle.** No clock times are stored anywhere (sessions and
  logs are dated, not timed), so work-start-to-work-start = 24 h is the only
  available anchor. Everything not worked in the cycle — evening leisure and
  sleep alike — recovers at the §8.1 rest law (ρ_rest = r′ = r·m, the demand-0
  gate is 1).
- **Why one-day lookback, not recursion.** A deficit two mornings back
  reaches today attenuated by two nights: ≤ e^(−2·ρ_rest·gap). Even at the r
  fit floor (r = 0.1 → ρ_rest = 0.15/h, 16 h gap) that is e^(−4.8) ≈ 0.8 %;
  at defaults it is ~0. Starting yesterday fresh IS the fixed point to first
  order, so recursing over history would model noise.
- **Defaults heal completely.** ρ_rest = 0.7·1.5 = 1.05/h leaves
  e^(−16.8) ≈ 5·10⁻⁸ of an 8 h day's deficit by morning — under default
  recovery the metric behaves exactly as before. Carry-over becomes visible
  when the user's own ☕ fit (§8.9) says recovery is slow: at the fit floor, a
  fully-drained 8 h day starts the next morning near 92 %, and a 16 h day
  (8 h gap) near 71 % (`scripts/mtr2-carry-over.probe.ts`, 2026-08-06:
  91.6 % and 70.6 % cognitive). Morning-awareness appears exactly where calibration
  evidence supports it — deliberate, not a shortfall.
- **Inherited approximations** (same class as §8.10's reconstruction, all
  documented there or in §12): breaks inside the worked day are omitted, and
  block order is taken as logged — both wash out exponentially through the
  trailing rest, which dominates the cycle; partial logging under-counts the
  previous day's work, biasing the morning level **up** (risk reads low, the
  conservative direction for a metric that warns); the ☕-calibrated awake
  rest law stands in for sleep — no instrument identifies a separate sleep
  rate (the §8.3 circadian boundary: rejected until there is an instrument).
- **Scope.** A metric-input policy only: the energy optimizer, the Energy Lab
  (whose `initialCog` sliders stay session-isolated), and the §12 audit
  (which compares plans under a common fresh-morning assumption) are
  untouched. Full multi-day optimization stays shelved — this is its cheap
  first step, not its start.

Locked by tests: `energy-calibration.test.ts` pins the closed form (work
from fresh, rest out the cycle, 12 decimal places), the no-logs identity,
default-recovery healing, monotonicity in worked hours, the 24 h cycle
constant itself, and the > 24 h guard — the last two added 2026-08-07, when
a verification pass found both unpinned: the guard's test asserted only
`0 < level < 1`, which a sign slip (`|24 − Σh|`, handing a 26 h day 2 h of
bonus rest) passes while moving the reading 98 → 73, and the 12-decimal
oracle imports `RESERVOIR_CYCLE_HOURS` into its own expectation, so 24 → 17
passed the whole suite. The guard is now pinned as an identity — an
over-logged day must read exactly its own pure-work simulation.
`daily-plan-store.svelte.spec.ts` pins the wiring — the same heavy log moves
Burnout Risk only when dated the viewed day's predecessor (the α fit sees it
identically from any date, so the difference is carry-over alone).

## 12. Plan-adherence audit (2026-07-23)

**The question.** The two planners disagree structurally: the classic Σ P̄
objective spreads (every touched task collects its ≈ p₀ activation bonus —
§0/§2; probe 2026-08-06, `scripts/mtr2-carry-over.probe.ts`: Σ P̄ prefers the
split in all 100 difficulty × enjoyment cells — two identical
difficulty-7/enjoyment-7 tasks on 1 h score 1.958 split vs 1.361 concentrated,
where the 2026-07-11 pair "1.955 vs 1.58" read the split off one cell and the
concentration off another), the
energy model concentrates (satiety-tempered total output, §8.4). Which
composition does the user's REAL behavior track? The 🪫 drain logs already
record worked hours per task per day, and §8.10 already joins them with the
stored sessions — so the audit is a revealed-preference measurement with no
new instrument, pointed at the planner itself this time. It was built as the
evidence gate for promoting the energy plan out of the lab; **that gate was
withdrawn on 2026-07-29 (§15)** — the two models are peer modes and the audit
is a descriptive signal, not a verdict.

**Per finished day** (`auditPlanAdherence` in `plan-audit.ts`; days from the
§8.10 join plus that day's stored switch cost and pools):

- Three allocation vectors over the day's task list: **actual** (logged
  hours), **classic** (`calculatePooledAllocations` under that day's pools
  and switch cost, with that day's fit posterior — the plan the user would
  actually have seen), **energy** (`optimizeSchedule` under that day's
  calibrated §8.7/§8.9 params).
- Compared as **shares** of worked time, not absolute hours: how much total
  to work is the stop decision, priced separately by §8.10 — the audit asks
  only "which tasks got the day".
- **Composition overlap** `Σᵢ min(actualShareᵢ, planShareᵢ) ∈ [0,1]` — the
  total-variation complement; 1 = identical composition, 0 = disjoint task
  sets.
- **Task spread** = inverse Herfindahl `1/Σᵢ shareᵢ²` — the effective number
  of tasks funded (1 = all time on one task, n = equal split over n). Reads
  the §0 spreading question directly: actual vs classic vs energy.

Days with no logged work on the day's task list are skipped (nothing to
compare); a plan that allocates nothing scores overlap 0 against any worked
day. The audit is descriptive — means over days, no noise model — because
its job is a model-selection signal, not a parameter estimate.

### 12.1 Per-day fit snapshots (2026-08-03)

The audit used to score every past day against the **current** fit, so an early
day was compared against plans built from months of later logs. Measured on a
synthetic year of a heavy logger whose true rates drift (α 0.25 → 0.55 over 365
days, 730 ⚡ / 730 ☕ / 1095 🪫): α_cog fitted from logs up to day 10 is
**0.3069**, the whole-history fit is **0.4973** — the day-10 plan was audited
against a drain rate **62 % higher** than that day's own logs supported. The
bias is an early-history bias and it does not show up inside the 30-day audit
window (0.4809 → 0.4965 there), which is why it went unnoticed.

**Re-measured and confirmed** (`scripts/fit-snapshot-drift.probe.ts`,
2026-08-06). On an independently generated year at the same volumes: the
whole-history α_cog is 0.5240 against **0.3447 as of day 10 — 52% higher**,
and the whole-history fit still exceeds the as-of-day fit by 35–59% everywhere
through day 120 (the as-of-day fit sitting 26–37% _below_ it — the two
directions are not the same number, and this line quoted the excess as if it
were the shortfall). The subtle half holds too: across the last 30 days the as-of-day fit
moves only 0.5075 → 0.5240, **3.3% apart**, against the document's 3.2%. A
FLAT-α control run through the same generator sits at 1% on day 10 and −0.1%
in-window, so the effect is the drift and not the estimator.

The cost half — the whole reason recomputation was rejected over the option
that "would fix history retroactively" — holds too, and it is the ratio rather
than the milliseconds that matters, since those are machine-specific. A
per-audited-day refit costs **≈1.0× a whole-history fit** (measured 0.93–1.04×
across runs), and that per-day cost grows **linearly with log volume** —
~16 ms/day at 1825 logs, ~35 at 3650, ~69 at 7300 (2026-08-06 baseline; the ms
are machine-specific, the doubling per volume doubling is not). So recomputation really is
O(auditDays × totalLogVolume), and really does get worse every time the user
logs anything.

**The fix.** One record per day, keyed by the ISO date (`fitSnapshots`), holding
exactly the values a fit can move: the ϕ plane (c₁, c₂, c₃) with its posterior
covariance and σ̂², the three §8.7/§8.9 rates (α_cog, α_phys, r), and λ₀ from
§8.10. Everything else in `EnergyParams` is a model constant, restored from the
defaults on read — storing them would freeze a constant into history rather than
record a measurement. The posterior is stored and **required**: a snapshot
missing it leaves σ_ϕ = 0 downstream (§13.1), i.e. an early day audited as
though the user had been perfectly certain, which is the bias itself.

`readModelReport` hands today's fit back for its caller to write; only **today's**
record is ever written, so a day's fit becomes immutable once the day passes. A
finished day with no snapshot — before the store existed, or a day the user never
opened analytics on — falls back to the live fit, i.e. the old behaviour, per day.

**Why stored rather than recomputed.** The fit as of day D is a pure function of
the logs dated ≤ D, so it could be refitted instead — and that would fix history
retroactively, which storing cannot. It is rejected on cost: refitting per
audited day costs the WHOLE-history fit each time (measured 16.4 ms per day at
the volume above, 492.5 ms for a 30-day audit, against 17.7 ms for one
whole-history fit — 2026-08-06), so recomputation is O(auditDays × totalLogVolume) and grows every time the
user logs anything — the wrong direction for an instrument read on every visit to
analytics. Storing is one `put` per day and one range read per report. The
accepted cost is that the correction only accrues forward from 2026-08-03.

**Known approximations (deliberate).** Partial logging under-counts a
task's true share exactly as it under-counts W in §8.10 — the audit is for
users who log consistently. A day's snapshot is stamped whenever the user opened
analytics that day, so it is the fit as of that moment rather than as of the
morning they planned; and it necessarily includes that day's own logs, so the
fit is not strictly prior to the behaviour being scored.

**UI.** Analytics page, "Plan adherence" card: mean overlap per planner,
the three spreads, and a verdict line (energy vs classic vs tie at a ±0.05
overlap margin), over the last ≤ 30 finished logged days (one optimizer run
per day, ~60 ms each, loaded after the main view paints).

The "Your model" card draws each fit's recorded history as a sparkline beside its
value, over the last 30 **calendar** days. That is deliberately not the audit's
window, which is the last ≤ 30 **worked** days and so reaches further back for
anyone who skips days: once the user has 30 finished logged days the audited
stretch contains the plotted one, never the reverse, so the sparkline only ever
shows movement the audit also scored. Before that a plotted day can sit outside
it — a snapshot is stamped on any day analytics was opened, while an audited day
must carry logged work, so 25 days of visits against 2 days of work plots wider
than it audits. Either way the two are not the same span, and the snapshot read
is widened past the plotted
window precisely so an older audited day still gets its own recorded fit. The
last point is the **live** fit rather than today's stored record, or the line
would contradict the number printed next to it. The row default is inside the
drawn range and drawn as a dashed line: auto-scaling to the data alone turns a
fit that has barely moved into a dramatic climb, and there is no axis to say
otherwise. Fewer than two recorded days draws nothing.

## 13. Math review, 2026-07-26

A full re-review of `business/model` against this document. **No derivation
was wrong** — the §2 proofs were re-derived symbolically (N′ = e^(−x)·x(1−r−x),
D′ = e^(−x)·x²(x+r−2), u(r) = e^(r−2)(7−2r) − (1+r) with u″ = e^(r−2)(3−2r))
and every closed form re-checked numerically: peak identity to 2.6·10⁻¹⁶,
P̄(T) vs Simpson to 2.6·10⁻¹³, stopping-root residual < 10⁻⁹ over all r,
P̄(T\*) ϕ-independent to 12 decimals, GH-5 nodes/weights correct, σ = 0
collapse to 2·10⁻¹⁵, reservoir closed form vs RK4 to 2.2·10⁻¹⁴, §11.6 burnout
figures reproduced exactly.

What the review DID find was four places where the model's behavior or this
document's claims did not match what the code does. All four are fixed below.
The through-line: **each was a case where a property held on the curated
scenarios that were tested, and failed on a randomized sweep of the same
space.** That is the method to reach for first next time.

### 13.1 Zero ⚡ logs was treated as perfect certainty (§5, §5.1)

- **Before:** `fitUserConstants` returned no `posterior` on any fallback path
  (zero observations, absurd-ϕ guard, singular solve). Downstream, "no
  posterior" means σ_ϕ = 0, which is the CERTAINTY model.
- **The defect.** §5.1's entire premise is that hedging should track how much
  the user has measured. It did the opposite at the low end. Measured σ_ϕ at
  a mid-scale task (E = 2.78, β = 1.44):

  | ⚡ logs         | 0         | 1     | 5     | 20    | 200   |
  | --------------- | --------- | ----- | ----- | ----- | ----- |
  | σ_ϕ (h), before | **0.000** | 0.191 | 0.072 | 0.023 | 0.003 |
  | σ_ϕ (h), after  | **0.411** | 0.191 | 0.072 | 0.023 | 0.003 |

  (the same mid-scale task logged n times; the n = 0 entry is generator-free.
  Re-measured 2026-08-06, `scripts/rv13-prior-posterior.probe.ts` — the n = 1
  cell was quoted as 0.194)

  So logging your FIRST flow time made the model less confident than logging
  nothing — the priority score visibly dropped (17.90 → 17.80 on the probe
  day), and the plan changed on **6.8%** of 1000 seeded random days at n = 1
  versus 0% at n = 0 — while the prior posterior the fix installs at n = 0 moves
  **26.3%** of them (2026-08-06; the 21.7% once quoted here is not reachable on
  any generator I could build). Uncertainty must be monotone decreasing in data;
  it wasn't.

- **After:** every return carries a posterior. `priorPosterior()` is not a new
  model — it is literally the n = 0 limit of the fitted formulas (XᵀX = 0 ⇒
  Σ = σ̂²(λI)⁻¹ = (σ₀²/λ)·I, no residuals ⇒ σ̂² = σ₀²), so there is no second
  code path to keep in sync. `fitted` is unchanged and still means "the data
  moved the constants", which is what the UI keys on.
- **Consequence worth knowing:** a brand-new user now gets a hedged plan
  (σ_ϕ ≈ 0.41h, ≈ **24%** of the ϕ̂ at that task — 1.71h, the centre of both
  sliders — capped at 0.5·ϕ̂ for short-ϕ tasks).
  That is the intended reading of "we know nothing about you yet", but it IS
  a behavior change for the zero-log case, not just a bookkeeping fix.

### 13.2 Zenith Gain measured the block lattice, not allocation quality (§7, §11.2)

- **Before:** the naive baseline was deliberately continuous (§7: "quantization
  is part of what Zenith imposes"), so it could hand every task a 0.373h
  sliver and collect the ≈ p₀ activation bonus (§2) on each — a plan Zenith
  structurally cannot produce.
- **The defect.** The metric was therefore measuring two things at once, and
  the handicap dominated the signal. Over 400 random days per task count:

  | tasks                          | 2   | 3   | 4   | 5   | 6   | 8   |
  | ------------------------------ | --- | --- | --- | --- | --- | --- |
  | gain < 0, before               | 4%  | 4%  | 10% | 11% | 19% | 17% |
  | gain < 0, after                | 0%  | 0%  | 0%  | 0%  | 0%  | 0%  |
  | naive = 0 (999% cap), pre-§19  | 0%  | 0%  | 0%  | 7%  | 7%  | 14% |
  | naive = 0 (999% cap), post-§19 | 0%  | 0%  | 0%  | 0%  | 0%  | 0%  |

  The two "before" rows are the 2026-07-26 draw and its generator was not
  committed; neither reproduces. A seeded continuous-baseline replica over 400
  app-reachable days per count (2026-08-06,
  `scripts/rv13-naive-lattice.probe.ts`) puts `gain < 0, before` at
  **7.8 / 3.8 / 5.0 / 4.5 / 4.3 / 6.8%** — no trend in n rather than rising with
  it — and `naive = 0` at
  **0.0 / 1.8 / 6.3 / 8.5 / 12.5 / 15.8%** — that last row is fully determined by
  P(budget < n·0.25h), so the shipped "0% at n = 3–4 then 7% at n = 5" cannot
  come from one budget draw. §19 later read that same P(budget < n·0.25h) as the
  tell it is: the row measures the switch bill, not the planner, and it is 0.0%
  at every count since (`rv14` arm B reproduces the figures above as its
  "before" column).

  The **after** row reproduces exactly on the single-budget path: 0% at every
  count over 2400 days. The pooled row held at 0% only while the baseline was
  over-billed — since §19 it reads 1 negative day in 2400 at −0.5% (§19.3).

  §11.2 had recorded negative gains as "possible and honest, a consequence of
  the §0 objective". The sweep says otherwise: they were routine, and the
  cause was the comparison, not the objective.

- **After:** `naiveBlockPlan` hands out whole blocks round-robin over all
  tasks (equal to within one block, ties toward the lower index like greedy),
  skipping any task whose next block would overdraw a pool. Both planners now
  face the same feasible set.
  **AMENDED 2026-08-06 (§19):** it now takes an explicit `order`, `target` and
  `maxFunded`, ties break toward the front of `order` rather than the lower
  index, and it is called n times by `naiveBaselineValue` — once per cyclic
  rotation. The reported baseline is the mean of those n plans, not this single
  one.
- **Why this reverses §7's decision.** The lattice is an accounting choice,
  not a cost Zenith imposes on the user — nobody executes 0.373h either way.
  Charging it to one side made the number unusable as a quality measure.
- **New guarantee:** on the single-budget path the gain is provably ≥ 0,
  because the naive plan is one of the block distributions the exact greedy
  maximizes over (Fox 1966, §4). ~~The pooled path has no proof (its greedy is
  a heuristic, §13.3) but found no counterexample in the sweep.~~ Both are
  test-locked. **AMENDED 2026-08-06 (§19):** the single-budget theorem survives
  §19's change of baseline. The pooled path's clean sweep does not — once the
  baseline stopped being over-billed it is strong enough to expose §13.3's own
  greedy gap, and reads negative on 1 day in 2400 at −0.5%. The test now allows
  a small negative reading (a −6% tripwire sized clear of the −0.5% measured)
  rather than asserting ≥ 0. Deliberately NOT derived from §13.3's shortfall:
  that section has no envelope to quote and forbids citing its worsts as bounds.
- ~~**Unchanged:** the `naive = 0 → GAIN_PERCENT_CAP` case. That is a real
  scenario — the naive planner attempts all n tasks and its switch overhead
  eats the whole budget — and the cap is the honest display for it. It still
  dominates the MEAN gain at n ≥ 5 (and already contributes 72% of it at n = 3),
  so read the mean with that in mind; the typical non-capped day gains ~4–6% at
  four tasks or more, and under 3% at two or three (2026-08-06).~~
  **RETRACTED 2026-08-06 (§19).** It was not a scenario, it was the accounting:
  the baseline was billed (n−1) switches for tasks its plan never seated, and
  `naive = 0` fires exactly when `budget < n·BLOCK_HOURS`. Every firing in a
  2400-day sweep disappears once the bill matches the plan, so the cap's
  contribution to the mean is moot — there is no capped day left to contribute
  on that generator. The cap itself is NOT dead; only this trigger is. See
  §19.4 for the one that survives.

### 13.3 The pooled allocator's "within 1–2%" was a curated-scenario claim (§4, §7)

- **Before:** §4/§7 claimed the pooled heuristic lands "within 1–2% of
  brute-force block optima on the regression scenarios" — true as written, but
  read as a bound. The 2026-07-23 review had checked 40 random instances
  (worst ratio 0.9955).
- **What a wider sweep found.** 1471 random pool-bound days against exhaustive
  brute force: exact on 97.4%, p99 1.44% short, **worst 5.46%** — and the
  worst case was structural, not noise. Greedy ranks blocks by VALUE, so a
  task whose blocks are pool-expensive never gets admitted; the transfer pass
  could not repair it because its refill is also value-ranked and immediately
  re-buys the cheap blocks it just freed. This is exactly the blind spot §4
  already named in prose ("ranks blocks by value, not value per unit of
  scarce resource") — the transfer pass had been the earlier, insufficient
  attempt at it.
- **After — three changes, all confined to the pool-bound path:**
  1. **A ratio-ranked second candidate plan.** `greedyAllocateBlocks` gained a
     `byPoolRatio` mode ranking by increment ÷ fraction-of-the-scarcer-pool
     consumed. Both candidates are improved by the transfer pass and the
     better END STATE wins — comparing them before the pass is not enough,
     since the ratio plan can start higher and finish lower.
  2. **Multi-block donation** in the transfer pass (1, 2, or all of a donor's
     blocks): freeing enough pool for a cheap task can need several hours off
     an expensive one, and every intermediate single-block state is downhill.
  3. **An admission move:** force one block into an unfunded task, evicting
     the lowest-value funded blocks until budget and pools allow, then refill.
- **Measured after (same 1471 days): exact on 99.5%, p99 0.00%, worst 0.09%.**
  Cost 0.32 ms → 0.6 ms per pooled solve (n = 5–7, tight pools) — irrelevant.
- **That 0.09% is the maximum of one draw, not an envelope** (added 2026-08-05).
  It is not independently reproducible — the 1471-day generator was never
  committed, and no seed was ever cited — but a fresh draw from the **same
  generator** reaches **6.03%** over 19,683 days, keeping the exact rate and the
  p99 — and the tail survives restriction to app-reachable inputs (worst 3.92%
  over 11,434 days). It also exceeds this section's own pre-fix worst of 5.46%:
  the three changes above made suboptimality **rarer, not smaller**. Nothing
  downstream may cite this number as an error bound, and §14.3 no longer does —
  it clamps instead. A real envelope over app-reachable inputs, and whether the
  value-ranked greedy can be fixed at the worst case rather than documented
  around, are both open.
- **There is no envelope to quote — measured on five seeds** (Probe 2026-08-06,
  `scripts/pool-allocator.probe.ts`). 5 seeds × 2000 days per space against
  exhaustive enumeration of every block distribution feasible under both pools
  and the (m−1)·s overhead, 0 days skipped. **App-reachable** (n 2–6, integer
  sliders, budget ≤ 14h on 0.25h steps, pools 0.5–8h, s ≤ 30m): exact on
  93.55–94.50%, p99 0.52–0.70%, per-seed worsts 4.56%, 3.37%, 4.81%, 3.83%,
  **5.28%** — a **1.91pp spread between draws that differ in nothing but the
  seed**. The **wide** space (continuous difficulties and pool weights) is
  tamer, not wilder: exact 97.15–97.80%, worsts 1.03–2.78%. So 0.09% and 6.03%
  are two more samples of one tail: every app-reachable seed here exceeds 0.09%
  by 37–59×, and **18 of the 10,000 app-reachable days exceed 2%**, which
  falsifies §4's "within 1–2%" read as a bound (it stands only as a report on
  its scenarios). Two further qualifications this section did not have: the
  exact RATE is draw-dependent too — 93.6–94.5% here against the 99.5% quoted
  above — and the suite's `worst < 0.005` holds on its own narrower generator
  only; every seed of both spaces here exceeds it. The probe's curated
  pool-trap fixture (value-ranked greedy's blind spot: two pool-expensive
  high-value tasks against two cheap ones, budget 0.25–8h × pools 0.5–4h) is
  exact on 98.96% with worst 1.59%, identical at every s — with those weights
  the pools bind before the clock does. Worst app-reachable day: five tasks at
  difficulty 7.9–10, weights 0.4–0.7 cognitive / 0.3–0.9 physical, 10.5h of
  budget against 1.5h/1.5h pools at s = 15m — the probe prints it as a
  copy-pasteable fixture line.
- **The single-constraint path is untouched:** with infinite pools nothing
  ever reports `poolBlocked`, so none of the three run and plain greedy's
  exactness (§4) stands. Test-locked by the randomized envelope test, which
  the pre-fix behavior fails on both bounds.

### 13.4 The stopping fit probed unlogged tasks at an arbitrary position (§8.10)

- **Before:** `stopIndifferencePoint` reconstructs the day in canonical
  amplitude order, but when probing the `lo` side for a task with NO logged
  hours it appended the candidate block at the END of the day.
- **The defect.** Block order changes a marginal through the reservoirs — not
  mainly via the new block's own output, but via what it does to everything
  after it. Re-measured over 3182 seeded days carrying an unlogged task
  (2026-08-06, `scripts/rv13-stop-insertion.probe.ts`): across their 2258
  two-sided readings the convention moves the day's
  indifference point by a median 0.0000, **0.070 at p99 and 0.196 at worst** —
  79% of `STOP_INVERSION_MARGIN`, so the 0.087 once quoted here was the maximum
  of one draw, not an envelope. (The "0.65 appended last vs 0.37 inserted first"
  step is not identifiable: the day was never recorded. Its _sign_ survives on
  §8.10's own fixture day — 2.25 h of reading at a 12-hour window with boxing
  and guitar unstarted, the only §8.10 fixture whose logged task is last in
  canonical rank and therefore the only one that can tell the two conventions
  apart at all — where inserting reads _higher_, midpoint 0.8894 against
  0.8840. But the gap there is 0.005, not the 0.067 the quoted pair implied
  (`scripts/rv13-stop-insertion.probe.ts`, 2026-08-06).) And since `lo` is a
  max over all tasks, appending moved it **either way** — deflating it on 734 of
  the 939 affected days and inflating it on 205, mean signed midpoint shift
  −0.002 — so λ̂₀ picked up a convention-dependent error with no reliable sign,
  not a systematic upward bias. None of this was in §8.10's
  approximation list — the estimator depended on an implementation convention.
- **After:** the canonical amplitude order is computed over ALL of the day's
  tasks and the candidate is inserted at its own rank. The estimator is now a
  function of the day, not of insertion convention. λ₀-invariance of the
  extraction and the synthetic round-trip recovery are both unchanged — both
  conventions give bit-identical midpoints on every day of the §8.10 fixture
  grid. The recovery trio once printed here (0.3 → 0.297, 0.5 → 0.407,
  0.9 → 0.966) does not reproduce on the only committed synthetic generator:
  true 0.9 → 0.892 over windows 8/10/12, true 0.5 yields one usable day, and
  true 0.3 yields none — every day censored at the window edge (2026-08-06).
- **Still an approximation, now documented as one:** this does not make the
  marginal order-free. Only knowing the real work order would, and the drain
  logs do not record it.

### 13.5 Also in this change

- **`forgettingFactor` deleted** (§5) — dead parameter, no caller, not on the
  roadmap; `FitPosterior.nEff` went with it.
- **Two stated-range/comment corrections (no behavior change):**
  - **The stopping multiplier's lower end is 1.5194ϕ, not 1.5ϕ** (§3, §6
    row 4, and five code comments — three in `zenith.ts`, two in
    `metric/calculation.ts`). 1.5 is the r → 1 asymptote, and
    `AMPLITUDE_RATIO_CAP = 0.9` forbids r → 1, so 1.5 was a bound the text
    invited you to read as attained. Nothing consumed the number.
  - **The GH-5 error claim pointed at the wrong term** (§5.1). "Error
    ~O(σ⁶)" understated a rule that is exact through degree 9 — its own
    leading error sits at the 10th ϕ-derivative. The actual accuracy floor is
    the ϕ-floor node clamp, which §5.1 named but never connected to the error
    statement; it now does.
- **Reviewed and left alone, with reasons:**
  - `OPTIMAL_PHI_MULTIPLIER = 1.7933` vs the true root 1.79328 — a 1.8·10⁻⁵
    literal used by the energy model's T\* and `refOutput` (and NOT by
    `optimalStoppingX`, which brackets at a separately-hardcoded 1.8). Below
    every tolerance in the model; not worth the churn of a computed constant.
  - `terminalBonus` averages the two reservoirs while Burnout Risk (§11.6)
    takes the min — see §13.6.
- **Energy-model properties, re-scoped 2026-08-06.** Break "gaming" is bounded
  _on the parameters probed_ — at fixed 6h of work in a 12h window with demand
  0.8 on a difficulty-8 task, raw output peaks at 2 chunks (+19.5%, the intended
  Jaber–Neumann effect, §8.3) and falls monotonically to 24 chunks — but it is
  not bounded in general: at full demand the peak moves out to k = 3 (+70.1% at
  difficulty 8), k = 4 (+99.2% at 5), k = 8 (+150.7% at 3) and k = 24 (+296.3%
  at 1), so on an easy full-demand task chopping 6 h into 15-minute pieces
  nearly quadruples raw output. One of those four is non-monotone after its
  peak, and by +0.095% — quadrature noise, not a second gaming channel
  (`scripts/enb-break-economics.probe.ts`, 2026-08-06). What actually pins
  laundering is §8.4's monotone accumulator on
  `satiatedOutput`, not this shape. "The optimizer matches exhaustive
  enumeration" holds only for the small day checked here: over an input space it
  is exact on 58 of 60 (§8.6, worst 0.5951%). The calibration fits do recover
  synthetic truth with the documented shrinkage — with §13.4's stopping
  round-trip the exception noted above.

### 13.6 The two end-of-day energy readings: a timing difference, not an aggregator one

**The observation that started this.** `evaluateSchedule`'s
`terminalBonus = V_T·(C_cog + C_phys)/2` averages the reservoirs, while
Burnout Risk (§11.6) is `100·(1 − min(C_cog, C_phys))`. The app therefore
carries two non-identical "how spent are you at the end of the day" numbers.

**The aggregator is second-order — do NOT "fix" it.** Re-scoring plans with
`min` in place of `avg` moves the objective by ≤ 0.08 and reorders nothing
(probe 2026-07-26, re-measured 2026-08-06 by
`scripts/rv13-terminal-timing.probe.ts` — every cell reproduces, worst |Δ|
0.0767; 10h window, one pure-cognitive and one pure-physical task at
difficulty 8 / enjoyment 6):

| plan            | objective (avg) | objective (min) |
| --------------- | --------------- | --------------- |
| lopsided 6h cog | 6.8197          | 6.8107          |
| balanced 3+3    | 8.6160          | 8.6100          |
| lopsided 8h cog | 5.9377          | 5.8610          |
| balanced 4+4    | 8.4885          | 8.4304          |

Switching would buy no measurable behavior change while perturbing a
calibrated chain (§8.10 conditions λ₀ on V_T and would need re-probing).

**What actually differs is WHEN each is measured.**

- `terminalBonus` reads the reservoirs at the end of the **window**, after
  the trailing implicit rest. This is deliberate and load-bearing: "stopping
  early both earns leisure AND recovers energy" is the stopping mechanism
  (§8 header).
- Burnout Risk reads at the end of the intended **workday** — its simulated
  blocks total exactly the budget, with no tail (§11.3's `availableHours` =
  intended-work reading).

Same day, 6h of full-demand cognitive work in a 10h window: work ENDS at
C_cog = 0.21 (risk 79%), then 4h of implicit rest refills to 0.988, so
`terminalBonus` = 1.491 of a 1.5 maximum. Both numbers are right for their
own question. Neither is a defect.

**The consequence worth knowing: V_T barely discriminates.** Because it is
read after recovery, the terminal term is near-saturated — 1.4911 at 6h of
work vs 1.4233 at 8h, i.e. **0.034 of stopping pressure per hour against
`freeTimeValue`'s 0.5**, about 7% of the total. That is almost certainly the
mechanism behind §8.10's independently-observed finding that **V_T is not
identifiable from stop times** (a 12× V_T sweep moved the optimal stop by
only two lattice levels). Two facts recorded separately are the same fact.

**Why nothing is being changed now.** The two never meet today: the main
page's plan comes from the classic allocator, which has no terminal term at
all, and Burnout Risk only SCORES that plan. The collision is latent.

**Latent, and staying that way (§15).** Promotion was settled against on
2026-07-29, so these are not on the path to anything — but they are the
conditions that would have to be settled FIRST if a metric defined against the
classic allocation is ever pointed at the energy plan:

1. **The objective lacks a peak-depletion term.** Promoted, the optimizer
   would be choosing plans while Burnout Risk grades them — and its
   near-saturated V_T makes it nearly blind to exactly the quantity the
   dashboard warns about. The right shape is a term on the day's MINIMUM
   reservoir level, not on a level at one instant. Moving `terminalBonus`
   itself to end-of-work is the wrong fix: it would double-count against λ₀,
   which already prices not-working.
2. **`availableHours` means different things to the two.** Burnout Risk
   reads it as hours the user WILL work and stretches the plan pro-rata to
   fill it; the energy model reads the same number as a WINDOW and
   deliberately leaves slack priced at λ₀. Share that input between them
   unchanged and Burnout Risk would inflate the energy plan's intentional
   slack back to a full workday — warning about a day the plan explicitly
   declined to schedule.

   **The input is now shared unconditionally (2026-07-29), and that does not
   make this live.** The Lab's day window used to seed off `availableHours`
   and then fork into a lab-local override; it is now the same value, written
   from either page. What blocks promotion is the **plan** crossing over, not
   the input: Burnout Risk stretches whatever allocation it is handed, and it
   is still handed the classic one. Two consequences of the merge worth
   recording. The user can no longer express "8 h of work inside a 10 h
   window" — one field cannot hold both readings, and the honest resolution
   for a peer mode is that the day has one length. And a day with no budget
   yet now has no window in the Lab either (the old `|| 8` fallback is gone),
   because a window the main page does not have is the same divergence in
   miniature.

## 14. Plan advice — priced counterfactuals over the day's levers (2026-07-27)

**The question.** The dashboard says the day reads badly — Burnout Risk 82%,
Day Profile "Grind", Cognitive Load 88% — and then stops there. §11 made
every reading honest; none of them says what to _change_. The obvious
implementation is a rule table ("if burnout > 70, drop the hardest task"),
but a rule table has to **guess the consequence of its own advice**. It does
not have to guess: `calculateDailyMetrics` is a pure function of (tasks,
hours, switch cost, pools, constants, energy params), so a candidate
adjustment can be re-solved and measured by the same optimizer that produced
the plan being criticised. Advice is therefore a search over the day's
levers, and every number it shows is a real model output rather than an
extrapolation.

**Levers.** Only inputs the user can honestly move on the day itself:

- **Defer task i** — one candidate per _active_ task that is not flagged
  `mustDoToday`. Completed tasks are not deferrable (and the plan keeps their
  hours either way, §11.8). Unfunded tasks are included: dropping one leaves
  the allocation untouched but does move Time Scarcity (Σϕ runs over all
  tasks, §11.8) and the Day Profile averages.
- **Set the budget to h** — three candidates: `budget − planSlack` (declare
  only the hours the plan actually spends), `budget − 1`, `budget + 1`.
  Clamped at 0, and any candidate within **one minute** of the current budget
  or of an earlier candidate is dropped. That tolerance is the whole of the
  deduplication: `planSlack` is a float difference, so a plan that spends its
  whole budget puts `budget − planSlack` ~1e-16 away from `budget`, and a
  sub-minute budget change is not advice either. The hours are **not rounded**
  to quarters — see §14.1.

Deliberately _*not*_ levers: `switchCost` and the two capacity pools are
measurements of the user, not choices about the day — advising someone to
raise their cognitive pool is advising them to lie to the model. Per-task
difficulty and enjoyment are excluded for the same reason.

**A plan's value** is the model's own objective, Σᵢ P̄ᵢ(tᵢ) over the funded
tasks (§0/§2) — and it is already computed. Measured
(`scripts/adv1-plan-advice-frontier.probe.ts`, 2026-08-06):
`zenithGain.optimized` and `Σ avgProductivity` over the funded tasks are the
same sum on all 600 seeded days — bit-identical on 466 of them and 1–2 ulps
apart on the rest, worst relative gap 3.5·10⁻¹⁶, because
`calculateTotalProductivity` adds the terms in the tasks' own order while the
plan comes back priority-sorted (the code comment says this; "to the last digit"
here did not). So a candidate's cost is
`ΔΣP̄ / ΣP̄` and no new quantity enters the model.

**Axes and badness.** Nine readings are searchable, each with a _badness_
function so that lower is always better:

| Axis                                                                                                      | badness     |
| --------------------------------------------------------------------------------------------------------- | ----------- |
| Burnout Risk, Human Capacity, Cognitive Load, Physical Load, Friction Index, Grind Density, Time Scarcity | `v`         |
| Energy Balance                                                                                            | `abs(v−50)` |
| Schedule Integrity                                                                                        | `−v`        |

Energy Balance is a **target** between the two pools, not a maximum — both
80% cognitive and 80% physical are worse than 50/50, which `v` alone cannot
express. On a zero-load plan the advisor reads it as `NaN`, not the 50 that
`calculateEnergyBalance` displays — an empty plan has no balance, and the
sentinel is also the target (§14.1 defect 5). Human Capacity may read
`Infinity` (a pool of 0 with demand on it, §11 `calculateHumanCapacity`); the
improvement test is `<`, so `Infinity` never beats `Infinity` and such a
candidate is silently excluded rather than producing `NaN`.

Badness only **orders** candidates. It never decides that a reading is bad:
whether 82% burnout deserves advice at all is a band, and bands are
presentation policy (AGENTS.md §5) — `presentation/utils/band.ts` owns them
(`AXIS_BAND` + `isOutOfBand`) and both the card and the metric rows consult
them. The model is threshold-free on purpose, and answers the
same question for every axis unconditionally: what would help this, and what
would it cost.

**What is returned: the per-axis Pareto frontier.** For a given axis, a
candidate qualifies iff its badness beats the current plan's. Returning only
the single largest improvement is bad advice — that is nearly always "defer
your biggest task", which is also the most expensive one — and returning all
of them is noise. So the options are the candidates **not dominated** on
(improvement ↑, plan value ↑): sort by improvement descending, walk the list,
keep a candidate only if its plan value strictly exceeds every candidate
already kept. Ties in improvement resolve to the higher-value candidate. What
survives is the honest menu — the most relief, and most of the relief for a
fraction of the cost — ordered by decreasing improvement and increasing
value, with no weight λ to justify. The frontier is returned whole; how many
rows to show is the card's decision.

The domination walk runs over the **Σ P̄-priced** levers only — the defers and
the budget _decreases_. An improving `budget + 1` is returned beside the
frontier as `unpriced`, never inside it (§14.1). The delta is `null`, not `0`,
when the current plan's Σ P̄ is 0.

**The frontier's delta is published unclamped, and that is the deliberate
asymmetry with §14.2 and §14.3** (recorded 2026-08-06). Both priced levers have
a provable sign at the exact optimum: a defer can only be ≤ 0, since the plan
without task _i_ is feasible for the with-_i_ problem at P̄ᵢ(0) = 0, and a budget
decrease can only be ≤ 0 by the monotonicity §14.1-1 rests on. So a positive
cost is §13.3 suboptimality, exactly the kind of sign §14.2 floors and §14.3
clamps per arm. This one is not clamped, for two reasons.

The first is size. Measured (`scripts/plan-advice.probe.ts`, 2026-08-06): **0
positive deltas over 4450** non-empty priced frontiers on 600 seeded days. Two
independent draws during the same review each turned up exactly one, at +0.1%,
so the rate is around 1 in 4000 and the damage is one wrong sign character on a
cost that reads as small either way. §14.3 clamps because its inversions reach
−6.53% and are indistinguishable from real readings; nothing here is.

The second is that a clamp would delete a reading this document now depends on.
§14.1-2's trim residual is the **same mechanism in the other direction** — the
pooled path landing short of the optimum — and it is a number the card must
keep printing, because the plan it prices is one the allocator really produces.
A `Math.min(0, ·)` on the frontier would leave the −0.9% intact while hiding
its mirror image, which is a policy about signs rather than about the model. If
the rate ever moves, the honest fix is the allocator, not the display.

Alongside the frontiers the advice reports the active tasks the plan funds no
hours for. That needs no search, and it is the one piece of advice that is
purely a read of the existing plan.

**Cost.** One `calculateDailyMetrics` per candidate — the deferrable active
tasks plus at most 3 budget levers, one fewer whenever the dedup drops a
candidate (14 on a 12-task day) — plus, since §14.2/§14.3, three further solves
per run (one `calculateTaskPlan`, two `calculateZenithGain`).
Measured 2026-07-27 (default constants and pools, 8h budget):
1.6 ms per solve at 3 tasks, 3.9 at 6, 12.5 at 9, **95 at 12** — the 2ⁿ
funded-subset enumeration of §4, which the linear candidate count amplifies
into 12 ms for a 6-task day but **946 ms for a 12-task one**. Advice is
therefore computed **on demand and never in a `$derived`**: a 12-task day
would otherwise freeze the main thread on every keystroke in the budget
field.

Since 2026-07-28 each of those solves costs half what it did: a
`calculateDailyMetrics` used to run the pooled allocator **twice** on identical
inputs, once for the plan and once for Zenith Gain's optimized side, and the
gain is now handed the plan's own allocation (`calculateTaskPlan`). Re-measured
on one 12-task day, one solve went 103.6 ms → 51.2 ms and the whole advice run
421 ms — the ratio is exactly 2, the absolute numbers are not comparable with
the row above (different task mix). Nothing the gain reports changed: §13.2's
naive baseline is derived from the task list, not from the allocation, and the
optimized side is the same Σ P̄ over the same hours — but only because they are
passed in the tasks' own order, since `calculateTotalProductivity` pairs hours to
tasks by index. (An earlier revision named caching `buildCurves` as the next
lever here — wrong path: no advice candidate ever calls it, the solves are
classic-model and Burnout Risk's `simulateReservoirs` is deliberately
curve-free. The cache exists since 2026-08-01 where the function does run:
`optimizeSchedule` and the §8.10 stopping fit build one curve map and thread
it through every evaluation. See §10.)

**Deliberate approximations.**

- **Single-step only.** No two levers are evaluated jointly — the search is
  `n + 3`, not `2ⁿ`. Applying one suggestion and asking again is the intended
  loop; a day that needs two deferrals surfaces the second one after the
  first is taken.
- **"Defer" is a counterfactual, not an operation.** The lever is exactly
  `tasks.filter(t => t.id !== id)` re-solved: it asks _suppose this task were
  not on today's list_, and the model has no opinion on where it goes. The
  reading is the price of the option; performing it is separate — the card's
  "To tomorrow" button calls `moveTaskToTomorrow` (AGENTS.md §6), a store
  operation the model knows nothing about. The reading's label stays "move it
  off today" because that is all the model prices; only the button commits to
  a destination.
- **A deferred task is not scored against tomorrow.** The model has no
  multi-day horizon, so "defer" prices the relief and not the debt. The real
  move exists now, and this stays true: applying a deferral changes tomorrow's
  plan without tomorrow's readings ever entering today's advice.
- **Obligation is a flag, not a model.** `Task.mustDoToday` removes a task from
  the defer candidates entirely, which is the whole of what the model knows
  about obligation: there is no deadline date, no priority order, and no cost
  for missing one. So the advisor cannot trade "this slips a day" against
  "this slips a week" — it can only be told not to suggest the move. A day
  where every task is flagged reduces the search to the budget levers, which
  is the correct answer to "nothing here can move".
- **The flag says nothing about hours, so an unfunded flagged task is reported
  on its own** (2026-07-29). `mustDoToday` does not enter the allocation: a
  flagged task competes for hours exactly like any other and can be funded
  zero (§0/§2 fund the subset that maximizes Σ P̄, and the flag is not in that
  objective). That combination is the one state the menu cannot speak to —
  removing the task from the defer candidates removed its only per-task
  lever — so `unfundedTaskIds` is **partitioned**, with the flagged ids in
  `unfundedMustDoTaskIds`, and the card says so in its own line. No number
  changes; this is a read of the same plan, and the honest resolution is the
  user's (more hours, or let it move) rather than a funding privilege the
  objective would then have to defend. The UI is worded to match: the badge
  reads "Stays today" and not "Must do", because the model only ever promised
  the day.

### 14.1 Five corrections to the first cut (2026-07-28)

A math review of §14 as first shipped found four defects, all reproduced by a
probe sweep of 200 random days (2–7 tasks, budget 1–12 h in 0.25 steps, switch
cost 5–30 min in 5-min steps → 1580 axis-frontiers). All four are fixed. The
fifth below was found in live use the same day, off the sweep entirely — hence
the count in the heading.

§13's through-line held for a second time, and in a sharper form: every one of
these four is invisible on the curated fixtures and obvious on the sweep. The
sharper form is that a curated fixture can make a test pass **vacuously** —
`plan-advice.test.ts` asserted the frontier's ordering on a 10 h grind day where
every priced frontier turns out to be a single option, so the assertion had
nothing to order and only ever ran because `budget + 1` was padding those
frontiers. Fixing defect 1 emptied the padding and the test failed honestly.
Randomize the sweep _and_ check that the invariant has more than one case to
bite on.

**1. `budget + 1` was an unpriced lever competing on the priced axis, and it
evicted real alternatives.** Σ P̄ is monotone non-decreasing in the budget —
probe (`scripts/adv1-plan-advice-frontier.probe.ts`, 2026-08-06): `budget + 1`
raised plan value on **297 of 600** seeded days, left it flat on 303, and lowered
it on **none** — so `budget + 1` holds the highest plan value of every candidate.
Once the domination walk kept it, `bestValue` was maximal and every later
candidate was discarded. Where it also had the largest improvement the frontier
collapsed to it alone: **99 of 1580** frontiers were `budget + 1`-only, and in
**75** of those an improving defer existed and was dominated off the menu — both
counts measured on the 2026-07-28 pre-fix sweep, since discarded; the mechanism
is what the suite pins now. On
those axes the card's entire advice was "work more".

The domination test was never wrong about plan value; the lever was wrong about
its cost. Deferring and trimming pay in Σ P̄, in full. Adding an hour pays in an
_hour_, which the objective cannot see at all — and for Cognitive and Physical
Load part of the apparent improvement is denominator mechanics, since both are
`weightedHours / budget` (§11). So the two are not comparable on one axis and
must not dominate each other.

Fix: partition the candidates by whether Σ P̄ prices them (`isPriced` —
`defer-task`, or `set-budget` below the current budget). The frontier is the
domination walk over the priced set; an improving budget increase is returned
alongside as `AdviceFinding.unpriced`, and an axis is reported when _either_ is
non-empty. The card lists the frontier first and the extra hour last, labelled
in hours rather than in plan value — "costs an extra hour of your day". Showing
its Σ P̄ _rise_ in the cost column is what made "work more" look free. The label
is exact because `budget + 1` is the only unpriced lever; adding another would
have to make it parametric.

**2. Quarter-rounding the budget levers broke the pure trim.** The hours were
`Math.round(h * 4) / 4`, which this document never said. Switch cost steps in
5-minute units while the budget steps in quarters and allocations come in 0.75 h
blocks (§8.8), so `planSlack` is usually not quarter-aligned: **246 of 404**
trim levers are off-quarter (re-measured 2026-08-06 on the same 600 seeded days
as §14.1-2 below, `scripts/adv1-plan-advice-frontier.probe.ts`). Two
consequences, both reproduced. Rounding _down_
cut past the hours the plan actually spends — budget 1.5 with slack 0.15 gives
1.35, rounded to 1.25, so 0.1 h of funded time went with it and the trim was no
longer free (**114** levers round down, **107** of them lose value). Rounding
_up_ to the budget made the dedup
filter delete the lever outright (**65 of 404**), silently losing one of
the three candidates this section promises.

Fix: drop the rounding from the model. `Math.ceil` was considered and rejected —
it preserves the trim but makes the silent deletion _more_ frequent, since any
slack under 0.25 h ceils back to the budget. The card has no Apply for
`set-budget`, so the hours are never written back to an input and there is
nothing to align them to; the descriptor rounds the **label** to two decimals
and the lever stays exact. Distinctness is now the one-minute tolerance above,
which is what the rounding had been incidentally providing against float noise.

**The trim is feasible, not free** (corrected 2026-08-06). The paragraph above
treats the trim as costless — it takes only hours the plan cannot spend, so it
changes no allocation and pays no Σ P̄ — and `AGENTS.md` and `plan-advice.ts`
both stated that outright as "the one lever that must be free". The premise
holds and the conclusion does not. The same subset with exactly its blocks does
still fit at `budget − planSlack`, but `allocate` (`zenith.ts`) is
path-dependent on `budgetBlocks`: on a pool-blocked day `improveWithTransfers`
starts from more headroom at the wider budget and can reach a better
pool-feasible distribution of the **same** total hours, which the trimmed
re-solve then cannot. Measured (`scripts/plan-advice.probe.ts`, 2026-08-06) on a
7-task pool-bound day (pools 4.5/4.5 h): the trim loses value on **103 of 126**
budget × switch-cost combinations, worst **−0.9%**, and on **0 of those 103**
does the funded count or the allocated total move — the hours are all still
there, arranged worse, which is what tells this apart from defect 2's rounding.
It is invisible on random days — **0 of 404** trim levers over 600 seeded ones —
the inverse of §14.1's own lesson above, and the reason the original sweep
missed it: a random sweep and a curated fixture each hide what the other finds,
so a claim this load-bearing needs both.

The delta is **not** clamped to 0. Unlike §14.2's floor and §14.3's per-arm
clamp, it is the Σ P̄ of a plan the allocator really would produce at that
budget, and §14.1-3 below is the standing rule against rendering a real
difference as costless. What changes here is the claim, not the arithmetic: the
trim is the lever that keeps the plan **feasible**, not the lever that is free.

**3. A zero-value baseline reported gains as free.** With `baseValue = 0` (a
0 h budget, nothing funded) the guard returned `0` for every option, and the
card renders 0 as "costs no plan value" — so a lever that _created_ value read
as costless. Probe: at budget 0, `set-budget 1h` reached a positive plan value
and displayed "costs no plan value" (the 2.568 once quoted here has no recorded
day; the suite's own budget-0 grind day reaches 1.038 against a baseline of
exactly 0 — `scripts/adv1-plan-advice-frontier.probe.ts`, 2026-08-06). Fix: the
delta is `null`
there, and the card
renders `null` as N/A. There is no ratio to a zero baseline, and saying so is
cheaper than inventing one.

**4. Card truncation dropped the end of the frontier this section exists to
surface.** The walk keeps only strictly increasing plan values, so the frontier
is monotone in plan value by construction — 0 of 4450 priced frontiers violate
it (2026-08-06, `scripts/adv1-plan-advice-frontier.probe.ts`) —
which makes the **last** row the cheapest option, the "most of the relief for a
fraction of the cost" one. `slice(0, maxOptions)` therefore cut exactly that.
Rare but exactly backwards when it fired: **15 of 4450** frontiers exceed 3
options, longest **4** (2961 hold a single option). Fix: keep both ends —
`maxOptions − 1` from the front plus the last — and drop from the middle.

**5. The empty plan read as perfectly balanced, and the advisor chased it.**
Found in live use the same day, not by the sweep — the sweep's budgets started
at 1 h, so `budget − 1` never clamped to an empty plan. `calculateEnergyBalance`
returns 50 for a zero-load plan (§11): a display sentinel, chosen so an empty
dashboard reads neutral rather than extreme. But 50 is also this axis's
_target_, so under `abs(v − 50)` the empty plan is the global optimum of Energy
Balance. On a 2 h physical-heavy day (balance 36) the advisor recommended
trimming to 1 h; re-asked at 1 h (balance 37, and every defer flips the
imbalance rather than fixing it) the only "improving" priced lever was
`set-budget 0` — sold as "Balanced (Optimal) · −100% plan value". Each number
was a real solve; the reading was fabricated. No work is not balanced work,
it is no reading at all. Fix: the advice axis reads `NaN` when
`cognitiveLoad + physicalLoad = 0`. `NaN` fails the `improvement > 0` test in
both directions — a zero-load candidate never improves the axis, and a
zero-load baseline never generates balance advice — the same silent-exclusion
mechanism the Infinity Human Capacity reading already uses. The dashboard
sentinel itself is untouched: an empty day showing a neutral 50 is fine as
long as nothing optimizes toward it. The `v`-badness axes keep offering the
empty plan (a zero-load day genuinely has zero Physical Load — that reading is
true, and the −100% price is shown); only the fabricated optimum is removed.

### 14.2 The marginal of the budget (added 2026-08-03)

**The question.** §14 already offers `budget + 1` as a lever and, since §14.1-1,
prices it honestly as costing "an extra hour of your day" — the cost side.
Nothing said what the hour _buys_. This adds the yield side: the time budget's
shadow price.

**The definition.** One extra solve at `budgetHours + BLOCK_HOURS` (§4, 15
minutes), read over the tasks still OPEN — the next-up scope family of §11.8:

```text
open                 = tasks not completed
planValueGain        = max(0, Σ_open [P̄ᵢ(after) − P̄ᵢ(before)])
planValueGainPercent = planValueGain / Σ P̄(budget)      (null when that is 0)
recipient            = argmax over open of (hours after − hours before), if > 0
```

Both plans come from the same allocator the day's plan came from, so this is a
model output, not a derivative of a curve. Σ P̄ is a per-task sum, so restricting
it to open work needs no second gain solve — the per-task `avgProductivity` the
allocator already returns _is_ P̄ᵢ at that task's allocation, and on a day with
nothing completed the sum is the plan's own Σ P̄ rise exactly.

The recipient is the **largest** gainer rather than the only one: the pooled
path's transfer and admission moves (§13.3) can reshuffle several tasks to fit
the new block in. Multi-gainer days are real but rare — **22 of 400** probe days,
**2** of them with gainers of differing size (re-measured 2026-08-06,
`scripts/adv2-budget-marginal.probe.ts`; the 36-of-600 pair was the lost sweep's)
— which is why the tie-break is pinned
by a fixture found in that sweep rather than a curated day, where it never bites.

**Why open-scoped, and not the whole plan.** The allocator is blind to
`completed`: a ticked-off task keeps its allocation, deliberately, so that
finishing something cannot move a plan-scoped metric (§11.8). A wider budget can
therefore spend its extra block on work already done — a true statement about
the plan and a useless one as advice, since the sentence this feeds is read as
"what would I do with 15 more minutes". Measured on a two-task day (a completed
mental-10/enjoyment-1 task beside an active physical-9 one), the plan-scoped
reading named the **completed** task as recipient at five of six budgets, worth
up to **+33.4%** of plan value. Scoping both halves to open work is what makes
the sentence true; on a day with nothing completed the two readings coincide.

**Why the floor.** Σ P̄ is monotone non-decreasing in the budget at the true
optimum — every allocation feasible at `b` is feasible at `b + ε`. The pooled
path is a near-exact heuristic (§13.3: exact on 99.5% of the cited draw), so two
adjacent budgets can invert. `max(0, ·)` keeps the reading inside a claim the
model actually makes. The size of a suppressed inversion is **not** bounded by
§13.3's 0.09%, which is a single-draw maximum — but nothing here depends on that,
because this floor is in the direction monotonicity allows and only ever hides a
value the model rules out. The same argument, applied per arm, is what §14.3
clamps with.

**No attribution when the block buys nothing.** `recipient = null` says a wider
budget buys no remaining work; it deliberately does not say why. A capacity pool
at its limit, a plan whose tasks are all near their stopping times, and a block
spent on work already ticked off are indistinguishable from one extra solve, and
naming the wrong one is the §14.1-5 mistake (a real number, a fabricated
reading). The card says the same thing when a task DOES take the block but the
day's value nets out flat: the floor below can leave `recipient` set with a 0%
gain, and "goes to X · +0% plan value" is the same non-advice.

**What the probe found** — 400 seeded random days, 2–7 tasks, budget 1–12 h in
0.25 h steps, switch cost 5–30 min in 5-min steps, **no completed tasks** (which
is why the scoping above was found by review rather than by the sweep):

- **On 54% of days another block buys nothing at all** (216/400: no recipient,
  gain 0 — re-measured 2026-08-06; the 35% once printed here does not reproduce
  under any reading of this space).
- **On all but one of those days (215/216) the card was still offering "work an
  extra hour."** The exception funds 3 tasks for 1 h inside a 7.75 h budget with
  pools 5/0.5: both Load axes are rounded to whole percent, so on a pool-starved
  day the wider budget moves no axis at all and no lever is offered.
  Not a defect in §14.1-1's split, which was about domination, not about
  suppression: Cognitive and Physical Load are `weightedHours / budget` (§11),
  so a wider budget lowers them by denominator mechanics with no allocation
  change whatsoever, and that reading is true. It is also, on those days, the
  entire content of the advice — the extra hour changes the ratio and buys no
  work. This line is what says so.
- Where a block does buy something, it is worth a **median 2.9%** of plan value,
  **p90 10.3%**.
- The recipient is the **top-priority task only 28.3%** of the time, so the
  reading is not a restatement of the priority column.

**A per-task marginal column is still the wrong shape — but not for the reason
this was planned under.** The plan record (and ROADMAP item 3) asserted that
marginals equalize at the optimum, so a column would degenerate. **Measured, it
does not.** Over 400 seeded multi-task days, the naive
column — bump task _i_'s
hours by one block on the curve, hold the rest — has relative spread
`(max − min)/max` with **median 0.573, p90 0.977, max 1.061**; only **8.1%**
fall under 0.10 (2026-08-06 — the old 0.265 / 0.803 / 20.6% trio is not
reachable on this space under any column definition I could reconstruct, and the
conclusion holds more strongly than it claimed). Greedy marginal analysis (§4) equalizes only in the sense that
every funded task's next block sits _below_ the admission cutoff, and that is a
wide band, not a point. The related guess that tasks run to `T*` would price at
zero is also wrong, and only just: **15 of 1651 funded tasks** (0.9%) sat at or
past their peak. Blocks are admitted while `Δ(j) > 0`, which can still hold a
hair past `T*`, so "0 of the funded tasks" was too strong.

Two reasons that do survive:

1. **The column is not the price of anything the user can move.** The budget is
   a number the user owns (and now drags); which task receives a block is the
   allocator's decision, not an input. A column answers a question no lever
   corresponds to.
2. **The column is arithmetic on a curve, not a solve.** It ignores both
   capacity pools and the switch cost, so it is not a feasible plan. Its best
   entry **overstates** what a wider budget actually delivers on **63.0%** of
   days (mean overstatement 0.18 in Σ P̄ units; on the days the marginal is
   non-zero (183 of 400), 21.9% and 0.10 — re-measured 2026-08-06,
   `scripts/adv2-budget-marginal.probe.ts`, against the lost sweep's 16.0% and
   0.005). The budget marginal re-solves,
   so what it reports is what the model would really produce.

**A zero marginal does not retire the unpriced `budget + 1` lever, and must not
be wired to suppress it.** The two co-occur constantly: on the **54%** of probe
days where another block buys no Σ P̄, **all but one** still offered the extra
hour somewhere on the menu (216/400 and 215/216, as measured above — this
paragraph carried the superseded 35% and "every one" pair).
That is not a contradiction, because the two readings
measure different things. The marginal is Σ P̄ — output. The lever appears on any
axis it improves, and Cognitive and Physical Load are `weightedHours / budget`
(§11), so on precisely these days the numerator is frozen and the whole
improvement is denominator mechanics — the effect §14.1-1 named when it refused
to _price_ the lever, while keeping it as advice. Keeping it is right: §11 defines
those axes as how packed the day is, and the same work in a longer day genuinely
is less packed. Slack is the relief on offer and "costs an extra hour of your
day" is its honest price. So the marginal is the missing half of that lever's
story — it says the hour buys relief and _no output_ — and the two lines are
complementary. What this cost was one word of scope in the copy: "would add
nothing to this plan" read as _the time is worthless_, directly above a row
recommending you spend it, so the sentence is now "would get nothing more done".
Do not instead hide the lever when the marginal is zero: that deletes correct
advice on exactly the over-loaded days that need it, inverts §14.1-1's failure
(the card going silent rather than only saying "work more"), and gates a
per-axis reading on a day-level one, across the §11.8 scope split.

**Cost.** One `calculateTaskPlan` and nothing else — the per-task decomposition
above is what removes the second gain solve — so exactly one extra solve on top
of the advisor's `activeTasks + 3`. It therefore lives in `suggestPlanAdjustments`
and inherits its on-demand contract; it is deliberately **not** in
`calculateDailyMetrics`, which runs inside a `$derived` on every keystroke and
every drag of the budget slider, where a second solve would double the
dashboard's cost.

### 14.3 The price of the switch cost (added 2026-08-04)

**The question.** §14 rules `switchCost` and the two capacity pools
"measurements of the user, not choices about the day", which correctly excludes
them from the lever set — and leaves `switchCost` with **no instrument
anywhere**. `DEFAULT_SWITCH_COST = 0.25` is a literal with a CHI-2008 citation
(Mark, Gudith & Klocke; ~23 min to regain focus, discounted to 15 for a
_planned_ switch), it is subtracted from the budget as `(m−1)·s` before any
block is placed (§4), and while the constraints bar does let the user set it,
nothing anywhere reported what setting it does. That same sentence in §14 licenses this: a declared measurement may be
instrumented even though it may not be advised. This is a diagnostic, not an
`AdviceLever` and not an axis option.

**The definition.** Two extra solves at the same tasks and the same budget:

```text
funded          = tasks with allocated hours > 0        (not tasks on the list)
reservedHours   = (funded − 1)·s   if funded > 1, else 0
reservedShare   = reservedHours / budget               (null when budget is 0)
alternatives    = [0, 2s], each dropped when within one minute of s
  planValue              = Σ P̄(plan solved at that s)
  planValueDeltaPercent  = (planValue − Σ P̄(s)) / Σ P̄(s)   (null when that is 0)
```

`funded` and not `tasks.length` because the allocator pays for the switches it
makes: a task the pools zeroed out costs nothing to switch to. Zero and double
are a **bracket, not a menu** — zero is the whole price of having a switch cost
at all, double is the asymmetry check, since an over-declared cost reserves
overhead the day never spends. At `s = 0` both candidates collapse onto the
declaration and `alternatives` is empty: there is nothing to price.

The one-minute tolerance doing that collapsing is §14.1-2's, which described it
as a rule about budget levers; it is now the general rule that two hour-valued
declarations less than a minute apart are the same declaration, and the constant
enforcing it is named `MIN_HOUR_STEP` rather than `MIN_BUDGET_STEP` for that
reason. Its reach is bounded by being **sub-minute**, not by the input's step:
`NumberInput` never snaps typed input to `step`, so a typed `0.4` in a field
reading "0" settles 0.00667 h and `sanitizeSession`'s `atLeastZero` persists it
across a reload. A declaration under a minute therefore empties `alternatives`
while `(m−1)·s` is genuinely non-zero — the second of the two empty-bracket
cases, which is why the descriptor suppresses the reservation sentence and the
bracket **independently**. Unioning them was a real defect: a plan can reserve
nothing precisely because the declaration priced every task but one out of it,
and on a 3-task day at a 0.5 h budget with `s = 15 min` the suppressed bracket
carried **+41.8%**. The bracket is dropped only when both arms would read 0 or
null, which is what a single-task list looks like and what a starved plan does
not.

**It stays a diagnostic.** It gets no `AdviceLever`, no `AdviceAxis`, no entry on
any per-axis frontier, and no Apply button, because there is no honest action for
one to perform: the user cannot decide to switch tasks faster, they can only
report how fast they do. Nor may it be wired to suppress anything — the §14.2
prohibition applies unchanged.

**What it reports, and what it does not.** Each alternative is the plan value
**under that declaration** — what the model would plan, and what that plan would
be worth, if the user's switch cost were that number. It is _not_ the cost of
**mis**-declaring: that would be the plan chosen under `s'` and then valued under
the true `s`, which requires knowing which of the two is true, and the app does
not. The two differ in sign as well as size — planning as if switching were free
_raises_ reported value (more hours reach the tasks) while actually switching for
free-that-isn't _lowers_ realized value. The copy this feeds must stay
conditional ("if your switch cost were really X, this plan would be worth Y%
more"), never "halve your switch cost and gain Y%".

**Plan-scoped, unlike §14.2.** The budget marginal is open-scoped because it
answers "what would I do with 15 more minutes". This one is compared against
`planValueOf(baseline)` = `zenithGain.optimized`, which `calculateDailyMetrics`
builds from the **whole** task list (§11.8); restricting one side to open work
would report a difference that is mostly the scope change. Completing a task
therefore does not move this reading, which is what §11.8 requires of a
plan-scoped number.

**Clamped per arm to the direction the optimum allows — not floored like §14.2.**
The budget marginal publishes a shadow price, where a negative would be a claim
the model does not make, so it floors. Here the two numbers are plans the
allocator really solved, and the signed difference between them is a fact about
those plans — but not every sign is a fact about the **day**.

**The monotonicity.** The exact optimum is monotone non-increasing in `s`: any
allocation feasible at `s` is feasible at every smaller `s`, with the same pool
draw and the same Σ P̄, because lowering `s` only frees reserved time. So a lower
declaration can be worth **only ≥ 0** and a higher one **only ≤ 0**. The opposite
sign is not a reading; it is §13.3's pooled greedy falling short at the other `s`.

**Inversions are reachable, and they are not small.** At each fixture day's own
stored budget, switch cost and pools, 0 of 298 days invert — an exact measurement
that licenses nothing beyond itself. Move only the pool inputs or the budget onto
other values the constraints bar itself offers and the sign flips both ways. Over
71,520 grid configurations across the 298 days (budgets 1/2/3/4/6 h × pools
{0.5, 1, 2, 4} × {0.5, 1, 2, 6} h × `s` 5/15/30 min): **112 visible inversions,
70 of them past 1%, worst free arm −6.53%** (2026-05-14, budget 3 h, pools
0.5/2, `s = 5 min`) and **worst doubled arm +1.36%**; with both pools held at
≥ 1 h the worst free arm is −1.34%. **40 of them need no change to `s` at all** —
budget and pools alone. (The original run quoted 322 / 181 / +1.95% / −2.76% over
"178,800 configurations" without saying what the grid was; the rate is the same
order — 0.16% of configurations here against 0.18% — and the −6.53% counterexample
is exact on the same day and inputs. 2026-08-06,
`scripts/adv2-switch-cost-price.probe.ts`.) Brute force over that day confirms the diagnosis: the `s = 5 min`
plan is itself feasible at `s = 0` and already achieves the exact `s = 0`
optimum, so the unclamped card told the user that making switching free would
_cost_ them 6.5%.

The magnitude is **not** bounded by §13.3's "worst 0.09% short". That figure is
the maximum of one draw, not an envelope (§13.3), so nothing here may rest on it.

**Why a clamp and not a floor.** Flooring the delta rewrites 284 of 596 fixture
alternatives (median −13.26%) to "0% plan value" and deletes the doubled arm's
entire message — that over-declaring is the expensive direction. The per-arm
clamp moves only the provably impossible sign, and only to 0: every informative
value passes through untouched. What it costs is exactness against the app rather
than against the model — on an inverting day the card now reads "0%" while
actually typing `s = 0` would show the allocator's lower value. That trade is
deliberate: a conservative reading in the provable direction misleads no one,
while "switching free costs you 6.5%" is indistinguishable from a real reading
and contradicts the model. Two tests pin both directions — a symmetric floor and
a clamp applied the wrong way round each go red.

Note the value is read through `calculateZenithGain` rather than by summing
`avgProductivity` over the returned plan: the two agree only to within float
noise, because the plan comes back priority-sorted and the same terms added in a
different order land a few ulps apart — 1–2 ulps on 80 of the 298 days.

**What the probe found** — the 298 worked days of `scripts/generate-fixture.mjs`
(seed 42, 365 days), each day's own budget, tasks and stored pools, run through
the real `calculateZenithGain`. Relative change in Σ P̄ from `s = 0.25`:

| days               | → `s = 0.5` median |   mean |    p90 | days moved | → `s = 0` median |
| ------------------ | -----------------: | -----: | -----: | ---------: | ---------------: |
| all (298)          |            −12.56% | 11.75% | 20.09% |     95.30% |           10.96% |
| 2–4 tasks (180)    |             −8.47% |  9.04% | 17.00% |       100% |            7.58% |
| 5+ tasks (104)     |            −18.77% | 18.02% | 20.91% |       100% |           20.15% |
| budget < 4 h (216) |            −15.23% | 13.36% | 20.52% |     96.76% |           14.12% |

The `→ s = 0.5` median is **negative** — doubling the declaration lowers plan
value, as §14.3's own monotonicity says it must. It was printed unsigned here,
which read as if raising `s` raised value; the mean and p90 columns are
magnitudes. Re-measured 2026-08-06,
`scripts/adv2-switch-cost-price.probe.ts` (every other cell reproduced to
≤ 0.1 pp).

- **It is not the constants.** Re-run under the fixture's own ground-truth
  `c₁ = 0.72, c₂ = −0.38, c₃ = 0.34` instead of the defaults, the 2–4-task median
  moves from 8.47% to **8.50%** and the all-days median from 12.56% to 12.54% —
  it falls, where this line used to report a rise to 12.60% (2026-08-06).
  The reading is a property of the budget arithmetic, not of the ϕ fit.
- **It survives on real days.** The author's four logged days (2–3 tasks, 2 h
  budgets) read a median **8.14%**, against the 1% kill threshold this item was
  gated on (ROADMAP item 17).
- **The reservation is large.** At `s = 0.25` with every task funded, the
  overhead is a median **23.08%** of the day's budget, p90 **46.67%** — a
  counterfactual over the task list, not the shipped reading, whose own p90 over
  funded tasks is 41.67%. On a 4-task day that is 45 minutes gone before the
  first block.
- **The day shape drives it.** Task-count distribution 1:14 2:47 3:58 4:75 5:63
  6:26 7:10 8:5 — the effect roughly doubles from 2–4 tasks to 5+, as `(m−1)`
  says it must.

**Cost.** Two `calculateZenithGain` solves, on top of the advisor's
`activeTasks + 3` and §14.2's one. It therefore lives in
`suggestPlanAdjustments` and inherits its on-demand contract — deliberately not
in `calculateDailyMetrics`, which runs inside a `$derived` on every keystroke and
every drag of the budget slider.

Both are **cheaper than the solve they are compared against**, and the pair costs
a measured **7.3% of the advisor at n = 8 and 2.9% at n = 12** — the share
_falls_ as the day grows, because the declared solve's 2ⁿ funded-subset
enumeration grows faster than either alternative's. `s = 0` is very nearly free
(under 1 ms against the declared solve's tens to hundreds): `switchCost <= 0`
short-circuits the enumeration entirely and allocates once. `s = 2s` runs at
roughly a third of the declared solve, because the larger reservation drives
`budgetBlocksFor` non-positive for most large subsets and they are skipped. The
absolute milliseconds are not quoted here; they were taken under coverage
instrumentation and are not comparable to §14/§14.2's figures.

**Not built: fitting `s` from the plan.** Estimating the user's switch cost from
their observed funded-task count died on three measurements (ROADMAP item 17):
`m(s)` is not monotone (195 violations on 115 of the 298 fixture days × 101 `s`
values; the original 609-over-400-days count named no day set), the
median one-day bracket is **0.50 h** wide against a [0,1] h range with **25%** of
days consistent with the entire range, and one mis-counted task shifts the
bracket edge by a median 0.34 h — all three worse than the 2026-08-04 figures,
so the conclusion stands harder (2026-08-06,
`scripts/adv2-switch-cost-price.probe.ts`). The diagnostic reports what the declaration does; it
does not infer the declaration.

## 15. Two objectives, two modes (2026-07-29)

**The question, settled.** The roadmap carried "promote the energy plan to the
main page", gated on §12's audit showing higher overlap with real logged days.
The gate is withdrawn: the two models are **peer modes**, and no evidence could
have decided between them, because "better" is not a property either objective
can report about the other.

**Cross-scoring probe** (`scripts/mode-cross-scoring.probe.ts`, rebuilt and
committed 2026-08-06, seed `0x290729`; 300 random days, 2–6 tasks, budget
3–11 h, default pools/switch cost/energy params; both plans scored under both
objectives — classic `Σ P̄` over per-task totals, energy `objective` from
`evaluateSchedule` with the classic plan converted the Lab's way, interleaved
order and switch costs as rest gaps). The 2026-07-29 run recorded no seed, so
its counts are a different draw, shown in brackets:

| plan    | under classic `Σ P̄`                             | under the energy objective                      |
| ------- | ----------------------------------------------- | ----------------------------------------------- |
| classic | **wins 283/300** [276], median +38.8%, p90 +97% | wins 2/300                                      |
| energy  | wins 17/300 [24]                                | **wins 298/300** [300], median +17.4%, p90 +48% |

Each model beats the other by tens of percent on its own scale. That is not a
close call awaiting better data; it is two definitions of a good day.

The energy column is **not** a clean sweep, and the earlier "loses 0/300" was
the same cell stated backwards. The classic plan wins the energy objective on
2 of 300 days because it is laid out in 15-minute blocks while `optimizeSchedule`
searches the 45-minute lattice (§8.8) — the energy plan is a maximum over that
lattice, not over all schedules, so "never" was never a property of it.

**The exceptions are not an allocator defect.** Controlled by re-solving the
classic allocator with a budget that hands it exactly the energy plan's work
hours (`(m−1)·switchCost` added back): 16 of the 17 still scored below the
energy plan under `Σ P̄` [2026-07-29: 20 of 24], and **every one of them is
infeasible for the classic allocator** — cognitive load 4.35–7.20 h against the
4 h pool, physical up to 7.20 h against 6 h. The load-bearing half of this
paragraph is the "every one", and it reproduces on both draws; the counts do
not, since the first draw recorded no seed. The energy model has no pool
constraint at all (§8 substitutes reservoir
dynamics), so it plans days the pooled allocator is forbidden to emit. On the
plans it is allowed to emit, the classic allocator never loses its own
objective.

**How they differ, quantified.** The disagreement is systematic, and it is
about concentration — the §0 spreading question, measured:

- Funded tasks per day: energy **1.97** vs classic **3.96** [2.05 / 3.88].
  Energy funds **more on 0 of 300 days** — not once, on either draw.
- Composition overlap `Σ min(share)`: mean 0.58, median 0.58, p10 0.33.
  Identical funded set on **30/300 days (10%)** [49/300, 16%].
- Work planned: energy **92%** of budget (median 94%) vs classic **81%**
  (median 83%), despite λ₀ pricing free time. Classic reserves
  `(m−1)·switchCost` as overhead and caps each task at `T*` (past `T*`, `Σ P̄`
  falls); the energy model pays no fixed switch cost and keeps going past `T*`
  because total output still rises.

**Consequences.**

- §12's audit is a **descriptive** signal — which composition the user's
  behaviour tracks — not a promotion gate. It cannot separate "the model is
  right" from "the user was right and it learned to imitate them".
- §13.6's two blockers (no peak-depletion term; `availableHours` meaning two
  things) stay **latent, not fixed**: the only reader outside `/energy` is
  §12's audit (`plan-audit.ts` runs `optimizeSchedule` per audited day, and
  `/analytics` renders the overlap), and what that scores is composition
  overlap — defined identically for both planners — while the Lab itself shows
  no metrics. They become live only if a metric
  defined against the classic allocation is ever pointed at the energy plan.
  The second one's _input_ was merged the same day — one budget, written from
  either page — which is peer symmetry applied to the day's hours, not a step
  toward promotion; see §13.6.
- The user-facing distinction is the one the probe measured: classic spreads
  the day across commitments, energy concentrates on one or two and protects
  the reservoir. Neither is the corrected version of the other.

## 16. Run order stays a heuristic (2026-07-29)

**The question, settled.** The roadmap carried "model-derived run order":
replace `calculateInterleavedOrder`'s nature alternation with the sequence the
energy solver would choose. Measured and **declined** — the heuristic captures
~94% of the available gain, and the swap would inject two-sided noise into
Burnout Risk.

**Why the classic model cannot answer this.** `averageProductivity(T, a, p0, k)`
takes no sequence, so `Σ P̄` is invariant to order: the classic objective has no
opinion at all. The heuristic's docstring argues from dual-pool recovery, but
nothing in §2–§4 scores that. Order is only scoreable under §8, where the
reservoir law refills `C` at `r'·g·(1−C)` whenever the current task's demand on
that reservoir is low — which is precisely the effect alternation gropes for.
The heuristic is a crude version of the same physics, not a rival to it.

**Order-only probe** (`scripts/mode-run-order.probe.ts`, rebuilt and committed
2026-08-06, seeds `0x290716` / `0x160729`; 300 random days, 3–8 tasks, budget
4–10 h, default pools/switch cost/energy params). The classic allocation is
held **fixed** — same funded set, same hours, same `stretch = 1 + overhang /
allocated` and switch-costs-as-rest that §11.6 applies — and only the sequence
varies, scored by `evaluateSchedule().objective`. Exhaustive over all
permutations up to 6 funded tasks; 720 sampled orderings on the 82/300 days
above that.

| comparison                     | median     | p90     | max     |
| ------------------------------ | ---------- | ------- | ------- |
| best ordering vs interleaved   | **+0.47%** | +1.50%  | +3.96%  |
| best vs worst (whole spread)   | +7.07%     | +11.25% | +17.74% |
| interleaved vs plain priority  | 0.00%      | +1.10%  | +3.58%  |
| — on the 123 days it re-orders | +0.32%     | +1.52%  | +3.58%  |

Order matters (7.07% median spread between best and worst), and interleaved
lands at the **5.83th percentile** of orderings (p90: 23rd), outright optimal on
**42/300** days (14%). Because the fixed allocation is an upper bound on what
any order-only change can win, a **median 0.47% bounds the solver's own order
too** — a median, not a ceiling: p90 1.50%, max 3.96%.

**Alternation earns its keep, on the days it fires.** It changes the sequence on
only **123/300 days (41%)** — 44% of integer slider pairs land `'balanced'`
under the ±3 threshold (47% of the probe's funded tasks), and balanced contrasts
with everything, so the greedy degenerates to
priority order. The 0.00% overall median is that no-op rate, not a null effect:
where it fires it gains a median 0.32% over plain priority.

**The decisive finding: the objective-optimal order is uncorrelated with
drain.** Burnout Risk (§11.6) under interleaved minus under the
objective-maximizing order, in points:

```text
min −23   p10 −7   median 0   mean −0.54   p90 +7   max +23
|Δ| > 5 points on 89/300 days (30%)
```

Whole points, because that is what the metric reports (`Math.round`, §11.6) —
the decimals this block once carried could not have come from Burnout Risk at
all. Two-sided noise with no systematic direction. This is expected, not
anomalous: the energy objective's only energy term is
`terminalBonus = terminalEnergyValue·(C_cog(T) + C_phys(T))/2`, the **mean** of
the two end reservoirs, while Burnout Risk reads the **min**. A sequence that
maximizes the objective is free to spend the reservoir the metric displays, so
the Δ has no reason to take a side. Adopting it would move a displayed health
metric by >5 points on a third of days in an arbitrary direction to buy a median
0.47% (p90 1.5%) on an objective the main page does not use.

**Consequences.**

- `calculateInterleavedOrder` stays as it is, and stays the single definition
  for both consumers — the `#N` badges (§11) and Burnout Risk's block sequence
  (§11.6). Same definition, **different scope**: the two consumers pass
  different task sets (§11.8) and the interleave is a greedy over the set it is
  handed, so the rendered `#N` order need not equal the simulated block order.
  One definition, not one output.
- The ontology mismatch is **acknowledged and accepted**: an order justified by
  dual-pool reasoning feeds an energy-model simulation. The probe is the
  justification — under §8's own scoring the heuristic is within 0.47% of
  optimal, so the mismatch costs nothing measurable.
- §12 and §15's classic baseline keep their current sequencing, so their figures
  stand unrevised.
- Caveat on generalization: uniform-random difficulties produce the 44% balanced
  rate, so a real task list may re-order more or less often than 41% of days.
  The bound on the _gain_ does not depend on that rate.

## 17. Per-task ϕ offsets stay unbuilt (2026-08-04)

**The question, settled.** The roadmap carried "per-task ϕ offsets":
hierarchical partial pooling on top of the §5 plane, so repeated ⚡ logs on one
task sharpen that task. Probed as the roadmap required, and **declined** — the
offsets fit works (it recovers per-task structure and cuts held-out ϕ error by
a third), but the plans it produces are worth well under a minute of the user's
own budget lever, because `Σ P̄` is second-order insensitive to per-task ϕ.

**The model probed.** `ϕᵢ = c·xᵢ + δ_{t(i)} + εᵢ` with `δ_t ~ N(0, σ²/λ_δ)` on
top of §5's `c ~ N(c₀, (σ²/λ)·I)`; the MAP is the joint ridge, δ shrunk toward
0, so `λ_δ = σ²/τ²` and the offset prior std is `τ = σ₀/√λ_δ` (λ_δ = 1 ≙ 15
min). Every §5.2 weight `wᵢ` applies unchanged. The probe solves the
`(3+G)×(3+G)` system densely rather than by block elimination, and pins
`λ_δ → ∞` against the shipped `fitUserConstants`: max |Δc| = 2.7·10⁻¹³,
|Δσ̂| = 7.6·10⁻¹³, |Δσ_ϕ| = 2.4·10⁻¹⁴. Per-task ϕ and σ_ϕ were injected into
the **real** allocator (subset enumeration, switch cost, §5.1 quadrature all
untouched); an injected offset of 0 reproduces the shipped allocation exactly.

Synthetic users, because the instrument has no log history to read yet: 8
recurring titles, 70% of logs on them, 120-day span, stopwatch noise at the
model's own σ₀ = 0.25 h floor, `τ_true` swept as the unknown under test.

**The fit works.** Held-out ϕ RMSE against true ϕ, 300 users/cell, λ_δ = 1,
relative to the shipped global fit:

| `τ_true` | n = 25   | n = 50   | n = 100  |
| -------- | -------- | -------- | -------- |
| 0.3 h    | −23%     | −31%     | −34%     |
| 0.6 h    | −28%     | −36%     | −37%     |
| **0**    | **+68%** | **+81%** | **+98%** |

The null row is the price of the parameters: **64–79% of logged titles carry
exactly one log**, and at λ_δ = 1 a single log passes 49% of its residual
straight into δ̂, so a user whose tasks have no per-task structure gets a
measurably worse ϕ — the number the "Your model" card prints and §8.10/§8.11
consume. λ_δ = 8 caps that at +7–32% but gives back 30–60% of the gain.

**The plans barely notice.** 200 days/cell, 6 tasks, true-ϕ-scored `Σ P̄`
against the shipped global plan, with both channels live (mean shift + per-task
σ_ϕ; the mean-only variant differs by ≤ 0.06 pp — see below). `eq. min`
converts the gain into the lever the user already owns (§14.2's +15 min of
budget, scored the same way):

| `τ_true` | budget | today's tasks      | Δvalue | oracle | moved | eq. min |
| -------- | ------ | ------------------ | ------ | ------ | ----- | ------- |
| 0.3      | 2 h    | 4 logged + 2 fresh | +0.27% | +0.41% | 24%   | 0.4     |
| 0.3      | 4 h    | 4 + 2              | +0.09% | +0.16% | 38%   | 0.4     |
| 0.3      | 10 h   | 4 + 2              | +0.15% | +0.29% | 56%   | 2.8     |
| 0.6      | 4 h    | 6 logged           | +0.84% | +0.90% | 75%   | 4.3     |
| 0.6      | 10 h   | 6 logged           | +1.84% | +2.18% | 89%   | 43.7    |
| 1.0      | 10 h   | 6 logged           | +6.67% | +9.20% | 97%   | 207     |
| 0        | 4 h    | 6 logged           | −0.01% | 0.00%  | 20%   | −0.1    |

`oracle` is the plan built from each task's TRUE ϕ — the ceiling on any
per-task-ϕ work. The offsets capture 84–93% of that ceiling at `τ_true = 0.6 h`
once data is plentiful (72% at 1.0 h), so the fit is not what limits this;
**the ceiling is**. Plans do
move — a different block vector on 38% of days at plausible `τ_true` — by a
mean 0.38 blocks (≈6 min), worth 0.4 equivalent budget-minutes. The funded set
changes only at a 2 h budget (18–28% of days), which is also the only cell
where the gain exceeds the movement.

**Why the ceiling is that low — and this part generalizes.** Value lost to a
per-task ϕ error of size `s` (400 days, `ΣT* = 19.4 h`, mean % below the oracle
plan):

| budget | s = 0.1 h | 0.2 h | 0.4 h | 0.8 h | 1.6 h |
| ------ | --------- | ----- | ----- | ----- | ----- |
| 1 h    | 0.08      | 0.43  | 1.21  | 4.35  | 11.61 |
| 2 h    | 0.04      | 0.15  | 0.59  | 1.63  | 3.97  |
| 4 h    | 0.02      | 0.07  | 0.29  | 0.79  | 2.01  |
| 6 h    | 0.01      | 0.08  | 0.27  | 0.98  | 3.58  |
| 10 h   | 0.05      | 0.16  | 0.59  | 2.23  | 7.25  |

**Half an hour of per-task ϕ error costs ~0.3% of the day.** `P̄` is flat at
`T*` (§3: `P̄′(T*) = 0`), so mis-timing is second-order — the loss is `O(ΔT²)`
— and the only first-order decision, which tasks get funded at all, moves only
when the budget is tight. The U-shape (for `s ≥ 0.2 h`; the `s = 0.1 h` column
is flat) is that trade: at 1 h the funded set
decides everything, at 10 h each task sits near its own `T*` where a wrong
`T*` wastes time no other task can use, and 4–6 h is the flat middle. **Price
any future per-task-ϕ proposal against this table before building it.**

**Rebuilt and confirmed** (`scripts/phi-error-price.probe.ts`, 2026-08-06). The
original sweep is gone and its seam with it — §17 says "per-task ϕ and σ_ϕ were
injected into the real allocator", but no such injection point exists on
`main`, so the rebuild takes the shipped allocator's own plan as the wrong one
and computes the oracle in-probe (max over funded subsets of greedy on the
true-ϕ menus — exact by §4, and now measured exact by
`allocator-exactness.probe.ts`). At `s = 0` the oracle reproduces the shipped
allocation to 5·10⁻¹⁵ on all 1000 (day, budget) pairs, which is what makes the
rest readable. Everything else in §17 dated 2026-08-04 — the held-out-RMSE
table, the plans table, the λ_δ→∞ pin and the σ_ϕ trio — rests on that same
deleted sweep and has NOT been re-derived. 400 days × 6 tasks, mean ΣT* = 18.6 h:

| budget | s = 0.1 h | 0.2 h | 0.4 h | 0.8 h | 1.6 h |
| ------ | --------- | ----- | ----- | ----- | ----- |
| 1 h    | 0.04      | 0.17  | 0.67  | 3.22  | 14.86 |
| 2 h    | 0.04      | 0.14  | 0.50  | 1.71  | 7.31  |
| 4 h    | 0.02      | 0.07  | 0.26  | 0.91  | 3.93  |
| 6 h    | 0.01      | 0.04  | 0.15  | 0.61  | 8.22  |
| 10 h   | 0.01      | 0.05  | 0.22  | 2.11  | 17.23 |

Same U, same headline: half an hour of error costs a few tenths of a percent.
Cell by cell the two grids agree to within **0.54 pp** everywhere at `s ≤ 0.4 h`
— but the worst RATIOS sit exactly where the values are smallest, so "the small-`s`
cells agree closely" was true in points and false in ratio: (10 h, 0.1 h) reads
0.01 against 0.05 (**5.0×**), (10 h, 0.2 h) 0.05 against 0.16 (3.2×), (10 h,
0.4 h) 0.22 against 0.59 (2.7×). At `s ≥ 0.8 h` the gaps are large in points too
and reach 2.4×: 17.23 against 7.25 at 10 h, 8.22 against 3.58 at 6 h, 14.86
against 11.61 at 1 h — while the `s = 0.8 h` column is the _best_-agreeing one in
ratio: its worst ratio, 1.61×, is the smallest of all five columns — so the
backed/unbacked split this section used to draw at `s = 0.8 h` is not where the
disagreement lives at all.

**Read either grid for the order of magnitude of a cell, never for its value.**
What survives both is the shape — U-shaped in the budget, `O(s²)` at small `s` —
and the headline. The likeliest cause of the spread is that the two synthetic
grids differ (this one draws 6 tasks to a
mean ΣT* of 18.6 h against the 2026-08-04 grid's stated 19.4 h, and a 1.6 h
displacement is a large fraction of a short ϕ, so the tail is sensitive to the
task mix). But that is a hypothesis, not a measurement, and the original grid
is gone — so it cannot be checked by re-running it. If a
future proposal ever turns on a specific cell, re-derive that cell first.

The
funded-set channel the paragraph credits for the U-shape is now measured
directly: at `s = 1.6 h` the funded set changes on **72% of days at a 1 h
budget and 68% at 2 h, against 0% at 6 h and 10 h**. That is exactly the stated
mechanism, and it is the first time it has been separated from the timing loss.

**The σ_ϕ channel is a behaviour change with no payoff.** A never-logged task's
δ is unknown at its prior scale, so honest per-task uncertainty is
`√(xᵀΣx + σ²/λ_δ)`. Measured at the card's reference task (difficulty 5,
enjoyment 5, 50 logs, λ_δ = 1): σ_ϕ = 0.058 h under the shipped fit, 0.125 h
for a logged task, **0.259 h for a never-logged one**. §5.1 makes uncertainty a
strict penalty, and this part is prior — it never shrinks — so every task the
user has never logged is permanently demoted against the ones they have. It
buys ≤ 0.06 pp of plan value over the mean-only channel.

**Consequences.**

- `fitUserConstants` keeps one plane for all tasks. ϕ personalization stays
  §5 + §5.2 (recency), which is a re-weighting of the same three constants,
  not new parameters.
- The identity a re-opening would need does not exist yet either: ⚡ logs carry
  `taskId`, but `nextTaskId` is `Date.now()`-based and never recycled
  (AGENTS.md §5), so each day's instance of a recurring task is a different id
  and `k = 1` always. The only usable key is the free-text `taskTitle` — a
  rename splits a task's history, and two tasks sharing a title merge.
- Two conditions would flip this, both measurable from real logs before any
  code: a habitually tight budget (≤ 2 h, where the funded set moves) **and**
  `τ_true ≥ 0.6 h`. The second is estimable by fitting δ once and comparing
  `Σδ̂²` against the 0.25 h noise floor — do that, not a rebuild.
- If it is ever built, λ_δ must be estimated from the data (empirical Bayes on
  τ), not fixed: the optimum is λ_δ ≈ 0.25–1 at `τ_true ≥ 0.3 h` and λ_δ ≈ 8 at
  `τ_true = 0`, and a fixed choice takes the null-case ϕ degradation above.
  Adaptivity removes that downside; it does not raise the ceiling.

## 18. Drain logs are one row per SESSION, not per task-day (2026-08-05)

A review of the §8.11 advisor found the defect in its input, not in its
arithmetic.

- **Before.** `$updateDrainObservation` upserted on `(taskId, date)`:
  re-rating a task the same day replaced the record, keeping the newest
  `hours`. Typo-correction semantics, mirroring the ⚡ flow log.
- **The defect.** `hours` is ONE session's `H` (§8.7 fits α from
  `d/10 = 1 − C(H)` off a full reservoir), but §8.10, §8.11 and §12 all read
  the day's hours per task as the SUM of that task's logs —
  `workedHoursByTask` and `readFinishedDays` both accumulate. The upsert key
  guaranteed those accumulators could never fire twice, so a task worked in
  two sessions kept only the last one. No value of the field served both
  readings: entering the running total would have fed §8.7 a multi-session
  `H` from a drained reservoir instead.
- **Why the advisor is where it bites.** The advisor is what produces the
  second session — it says "continue", and its tooltip says to log sessions as
  they finish. Window 8 h, one task (difficulty 7, enjoyment 6, w = (0.8, 0.2)),
  λ₀ = 0.5: work 3 h, log it → `continue`, 45 min, 0.667/h. Work another
  1.5 h, log it → the stored day goes 3 h → 1.5 h, and the card reads
  `continue` at **1.099/h** — a day that reads LESS worked, and a marginal
  HIGHER, than an hour earlier. The true 4.5 h day prices at 0.372/h, i.e.
  `stop`. That night's λ₀ bracket and §12's audit then score the same
  truncated day.
- **After.** The writer appends (`$addDrainObservation`); a task's hours for a
  day are its rows summed, which is what `workedHoursByTask` and
  `readFinishedDays` already computed. §8.7 is unchanged and gets cleaner
  data — each row is one session, so the fresh-start approximation applies per
  row as written. Correcting a rating is `$editDrainObservation` on that row
  (the ✎ beside it in the calibration card), which keeps its original
  `createdAt`; re-logging a correction would count the session twice, which is
  the same defect from the other side. One reader did NOT already sum:
  §11.9's `seedMorningReservoirs` passed one demand entry per log keyed by
  `taskId`, and `simulateReservoirs` looks demands up by id, so two rows for
  one task let the later row's demands re-rate the earlier session — newly
  reachable, now keyed per row.

- **What it costs.** A task worked twice a day now produces two rows where it
  produced one, so multi-log days get commoner — and §8.7's fresh-start
  assumption is measurably harder on those: α̂ is unbiased at one 🪫 log per
  day and drifts +17%/+15% (cog/phys) at two, +28%/+22% at three (measured
  2026-08-04 with an **uncommitted** variant of `scripts/generate-fixture.mjs` —
  the committed script hard-codes the 🪫 opt-in and cannot emit those cells, so
  read the direction, not the percentages; ROADMAP item 18). That bias is not new and the upsert did not
  avoid it: it hid the second session instead, paying the same α cost the
  moment two DIFFERENT tasks were rated in a day while also corrupting the
  hours §8.10/§8.11/§12 read. The honest fix for the α side is chaining the
  day's reservoir trajectory through every rating — §8.7's own approximation
  list calls for a complete work log, which these rows are a necessary but not
  a sufficient part of: they carry no session boundaries and no gaps between
  sessions.

**What the UI had to learn.** Per-session rows make two of its habits wrong.
The 🪫 editor no longer prefills the last rating and no longer re-saves it:
the row's button starts a session, and a ✎ on each stored rating corrects that
one in place — without it, the typo correction the old upsert served would
double-count the session, which is this defect from the other side. And the
completion prompt now passes `measured: false`, because finishing a task ends
a session that an earlier rating says nothing about; leaving it at "already
rated today" left the commonest second session — take the advice, then tick
the task off — unlogged.

**Also in this review.** Two things were checked and deliberately left alone:
the canonical-rank probe placement, now stated as a bound in §8.11 with the
measurement that justifies keeping it; and the store-level split between the
advisor's candidates and its reconstruction (§8.11), which was correct but
untested at the only layer that decides it — now pinned with a completed task
carrying today's hours beside an open one.

## 19. The gain's naive baseline paid for switches it never made (2026-08-06)

§13.2 fixed a handicap charged to ONE side of the Zenith Gain comparison — the
block lattice — and closed with the naive baseline still carrying a second one
of exactly the same shape. This section removes it, and retracts the §13.2
bullet that had endorsed its most visible symptom as a real scenario.

Measurements: `scripts/rv14-naive-switch-bill.probe.ts`, 400 days per task
count over §13.2's own generator (integer sliders, pool weights tied to them,
budget on the 0.25 h lattice), so every number below sits on the same draw as
§13.2's table.

### 19.1 Defect 1 — billed (n−1) switches, seated fewer than n tasks

`pooledProductivityGain` docked `(n−1)·switchCost` from the budget for every
LISTED task, then handed the surviving whole blocks out round-robin. When the
leftover could not reach every task, the tail of the list got **zero hours** —
so the baseline paid for n−1 switches and executed fewer. How often the plan
seated fewer tasks than it was billed for:

| tasks               | 2     | 3     | 4     | 5      | 6      | 8       |
| ------------------- | ----- | ----- | ----- | ------ | ------ | ------- |
| seated < n          | 3.3%  | 5.8%  | 16.8% | 20.3%  | 30.5%  | 39.3%   |
| gain overstated p90 | 0.9pp | 1.8pp | 6.5pp | 16.8pp | 44.9pp | 102.9pp |
| worst day           | 159pp | 297pp | 423pp | 558pp  | 422pp  | 627pp   |

The median day is untouched (0.0–0.3pp): this is a tail defect, and the tail is
precisely the small-budget/many-task regime §11.2 built the 999% cap for.

**The cap was the artifact, not the scenario.** `naive = 0` requires the block
target to reach 0, i.e. `budget < n·BLOCK_HOURS` — §13.2's own probe had already
noticed the rate "is fully determined by P(budget < n·0.25h)" without reading
what that implies. A planner billed for the switches it makes is never at 0
there: with one task it pays no switch cost and gets the whole budget. Measured,
the cap fires on **0.0% of days at every task count** after the fix, against
0.0 / 1.8 / 6.3 / 8.5 / 12.5 / 15.8% before. So:

- ~~**Unchanged:** the `naive = 0 → GAIN_PERCENT_CAP` case. That is a real
  scenario — the naive planner attempts all n tasks and its switch overhead eats
  the whole budget — and the cap is the honest display for it.~~
  **RETRACTED 2026-08-06 (§19).** It was not a scenario at all; it was the
  accounting. Every firing in a 2400-day sweep disappears once the bill matches
  the plan. `GAIN_PERCENT_CAP` stays in the code as a saturation guard on the
  ratio — `naive` can still be small — but its documented trigger was wrong.

The rule the fix adopts is the one the switch-cost lever already used
(`metric/plan-advice.ts`: "Funded, not listed: the allocator pays for the
switches it actually makes"). The bill is the largest k the plan genuinely
seats; the optimizer enumerates that subset size too, so neither side is
charged for work the other is spared.

**Affordable is not the same as seatable, and the first cut of this fix got
that wrong.** Choosing k from the time budget alone — the largest k whose bill
still leaves k whole blocks — over-charges whenever a capacity pool, not the
clock, is what keeps a task out: measured on 18.9% of pool-bound days, and on a
zeroed pool it withheld a full hour of the baseline's own budget (7.3% reported
against 0% honest). Worse, pairing that k with a round-robin restricted to a
WINDOW of k tasks let a window land entirely on pool-blocked tasks, produce the
all-zero plan, and drag the rotation average down — which brought the 999% cap
straight back through the pool door: 8 tasks on 0.25 h against a zeroed physical
pool read **700%**, 12 tasks read the full **999%**, where the honest answer is
0% (one task is seatable, and both planners give it the day). Both inputs are
UI-reachable: the physical-capacity field accepts 0, and `physicalDifficulty` 0
gives weight 0.

So the scan validates k against the PLAN, not the budget: walk the whole
rotation, cap the number of DISTINCT tasks opened at k, and accept the first k
the plan actually seats. Pool-blocked tasks are passed over in favour of the
next feasible one instead of costing a seat. Over 360 zeroed-pool cells the
baseline now equals the honest "the one seatable task gets the day" value to
within 1e-12 and the cap never fires (`arm H`, a regression test for exactly
this).

### 19.2 Defect 2 — the displayed number moved with the order of the task list

`target` blocks rarely divide evenly among k tasks, and round-robin gave the
remainder to whichever tasks sat earliest in the array. The array is the store's
task list, and `addTask` **prepends** — so adding a task changed the reported
gain of a plan that had not changed:

| tasks                         | 2      | 3      | 4      | 5      | 6      | 8      |
| ----------------------------- | ------ | ------ | ------ | ------ | ------ | ------ |
| gain moves on reorder, before | 44.8%  | 68.0%  | 75.0%  | 75.0%  | 77.3%  | 73.5%  |
| spread, before                | 84pp   | 355pp  | 483pp  | 439pp  | 554pp  | 603pp  |
| gain moves, after             | 0.0%   | 5.3%   | 6.3%   | 5.8%   | 4.0%   | 2.0%   |
| spread, after                 | 0.00pp | 1.40pp | 1.20pp | 3.40pp | 2.40pp | 1.00pp |

Attribution is near-clean: on the same days the OPTIMIZED side moves on 0.00%
(n = 3) to 0.25% (n = 8), worst spread 0.228% of the plan value — pooled greedy
tie-breaking, §13.3. Essentially all of it was the baseline (`arm C`, which now
prints both sides so the claim has a citation rather than an assumption).

**Fix: average over the n cyclic rotations.** Each rotation funds the first
`seated` tasks of that rotation, so every task receives the odd block equally
often. Because the objective is a sum of per-task terms, only the marginal
frequency matters and the average is **exactly** permutation-invariant — not
merely rotation-invariant — whenever no pool binds. The residue is entirely the
pool skips, which are not separable: permutation-exact on **96.13%** of 2400
days (7.4% of them pool-bound), worst baseline spread 1.61%, worst reported-gain
spread 3.4pp. Left as measured rather than chased: a pool-bound naive plan is
order-sensitive in the same way the pooled allocator is (§13.3), and 3.4pp of
residue against 603pp removed is not where the next fix belongs.

### 19.3 What this costs, and the one guarantee that weakened

**The ≥ 0 guarantee survives on the single-budget path.** Each rotation's plan
is a block distribution over a subset of size k under budget `blocksFor(k)` —
exactly a (subset, budget) pair `bestPlanWithSwitchCost` enumerates — so the
exact greedy's value dominates it (Fox 1966, §4). Dominating every rotation is
strictly stronger than dominating their average, so the average is covered too;
measured, the average is strictly below the best rotation on 81.7% of days.
0 negatives in 2400 days, asserted in the probe.

**It is a theorem about the TRUNCATED menu, not about E[P̄], and §13.2 overstated
it.** `buildBlockIncrements` cuts a task's menu at the first non-positive
increment and — when σ_ϕ > 0 — at the first non-DECREASING one (§5.1). Blocks
past the first cut lower the objective, so a naive plan that overshoots there
only hurts itself and the guarantee holds. The σ_ϕ cut is different: it can fire
while E[P̄] is still rising, leaving the naive plan free to place a value-adding
block the optimizer was never offered. Constructed witness: one task at
effective difficulty 1.3, ϕ̂ = 4.5 h, σ_ϕ/ϕ̂ = 0.35, budget 4 h → optimized
0.886678 against naive 0.891116, a reported **−0.5%**. This is not new (at n = 1
the §19 baseline is identical to the old one) and it is not reachable from the
product: 0 monotonicity cuts in 156,000 cells with integer sliders and ϕ ≤ 6 h,
against 8,806 of 919,968 with quarter-step sliders and ϕ up to 8 h, all at
ϕ̂ ≥ 4 h with σ/ϕ ≥ 0.35 — the corner §5.1's σ-cap already calls dubious. Worth
recording because "provably ≥ 0" was being read as unconditional.

**The pooled path lost its clean sweep, honestly.** §13.2 reported "no
counterexample" for the pooled gain; with the handicap removed the baseline is
strong enough to expose the pooled greedy's own suboptimality. It now reads
negative on **1 day in 2400 (−0.5%)**, and that day is pool-limited — i.e. it is
§13.3's documented greedy gap (five seeds × 2000 app-reachable days: exact on
93.55–94.50%, per-seed worsts 3.37–5.28%, and explicitly no envelope to quote)
surfacing in the metric instead of being masked. That is the correct trade: the
number is a measure of allocation quality, and the pooled allocator is not
exact, so the metric should be able to say so.

**Cost.** The baseline is now n rotations, each scanning down at most n
candidate k's, plus n productivity sums instead of one. Measured at n = 12 with
a posterior: the baseline goes from ~0.013 ms to 0.031 ms, against 41.7 ms for
the 2ⁿ funded-subset solve in the same call — 0.04% of it.

### 19.4 `GAIN_PERCENT_CAP` is not dead, but its documented trigger is

§11.2 introduced the cap for `naive = 0`, and §19.1 retires that trigger. Both
the constant's own doc comment and §11.2 then read as though the cap had no
reachable trigger left. It has one, in the opposite regime:

The baseline must spend its whole block target, so a long budget poured into few
tasks pushes each past its own T*, where P̄ decays like C/T. The optimizer stops
at T* and leaves the slack unused. The ratio therefore grows with budget and
shrinks with ϕ and n — and with a **fitted short-ϕ user** it clears 10×. Measured
on the single-budget path over the app's own budget slider (0.25–24 h, 0.25 h
steps), ϕ̂ held at the 0.1 h floor `fitUserConstants` explicitly permits ("a
fast-flow user logging 15–30m everywhere"): the gain first reads 999% at
**4.25 h (n = 1)**, 8.5 h (n = 2), 13 h (n = 3), 17.25 h (n = 4), and never
within 24 h at n = 6 (max 912%). At ϕ̂ = 0.17 h it needs 7 h (n = 1). At
**default constants it is unreachable** — the 24 h maximum is 569% at n = 1 and
41.6% on the pooled path.

So the honest statement is: the cap guards the RATIO, for a personalized
fast-flow user with few tasks and a budget far past their stopping time. Not the
`naive = 0` jump it was written for — that arm now requires `budget <
BLOCK_HOURS`, where the optimizer scores 0 too and `gainPercentOf` returns 0.

## 20. Human Capacity: the reading is the constraint, but it named the wrong pool (2026-08-06)

Every other dashboard metric has a section here; Human Capacity — one of the
four headline readings — had none. Its formula lived only in
`metric/calculation.ts`, so nothing said what it measures, what it can read, or
which of the two pools the row is allowed to blame. Written down and measured:

```
HC = round(100 · max(Σᵢ wcᵢ·tᵢ / poolcog, Σᵢ wpᵢ·tᵢ / poolphys)),   wᵢ = difficultyᵢ/10
```

over the **plan** (`suggestedTasks`, completed included — §11.8), with `tᵢ` the
allocated hours. Those are not metric-layer weights invented for a display: they
are the allocator's own, so the numerator is exactly the left-hand side of the
capacity constraints in §4's pooled program (`Σᵢ wcᵢ × tᵢ ≤ cognitive pool`,
`calculatePooledAllocations`). The reading is therefore not an estimate of how
hard the day is — it is the share of the constraint the plan consumed, and
`limitType` names which of the two is closer to binding.

Measurements: `scripts/mtr-human-capacity.probe.ts`, 3000 seeded days over the
UI-reachable space (integer sliders, 0.25 h budget lattice, 5-minute switch
cost, both pools drawn from 0–8 h in 0.5 h steps).

**The identity holds (2026-08-06).** Recomputing the formula from the returned
plan reproduces the displayed `percent` on **3000 of 3000** days.

**Over-100 and `Infinity` are unreachable from the app's own plan
(2026-08-06).** The greedy skips any block that would overdraw a pool
(`+1e-9`), the transfer pass keeps that invariant and the admission move is
feasibility-checked, so the plan satisfies the very constraint this metric
divides by: **0 days over 100%**, **0 non-finite readings**, maximum reading
100%. The wall is real, not far away — **44.1%** of days read ≥ 99%.

Both guards stay, and neither is decoration: `AXIS_BAND.humanCapacity`'s
critical arm above 100 (`presentation/utils/band.ts`) and the N/A gate on a
non-finite reading (§14.1 defect 2) fire on hours the allocator did not
produce — `calculateHumanCapacity` is exported and unit-tested with
hand-supplied hours, and a pool edited down after a plan was solved is the same
situation. AGENTS.md's "Human Capacity is unclamped" is a statement about the
metric, not a prediction about the dashboard.

### 20.1 The tie went to cognitive, so the row blamed the wrong pool

`saturation` rounded each pool's percentage and the limit was chosen by
comparing the **rounded** pair, `cogSaturation >= physSaturation`. Any two
saturations inside the same integer therefore tied, and the tie was awarded to
cognitive. Measured on the sweep: **39 of 3000** days round to a tie, and on
**17 of them (0.57%)** the physical pool was the one actually closer to binding
— the widest swallowed gap being **cog 52.500% vs phys 53.333%**, and **2** days
having a cognitive draw of exactly **0**, i.e. a purely physical day described
as cognitively limited.

The displayed number was never wrong: both members of a rounded tie print the
same integer, so `percent` equals $\mathrm{round}(\max(\cdot))$ either way. What
was wrong is the sentence beside it — `metric-descriptor.ts` names the pool from
`limitType` and prints **that pool's configured hours** ("Cognitive limit
(4h/day)"), so a mislabel misstates the constraint and its size at once.

The fix decides on the exact saturations and rounds for display only; on the
same 3000 days the fixed metric names the binding pool on every decidable day
(ties within 1e-9 are float noise and keep the cognitive default). Pinned in the
suite by one fixture — 60.00% cognitive against 60.25% physical, both rounding
to 60 (`calculation.test.ts`, "names the pool that binds").

## 21. What the gain has room to report (2026-08-07)

§19 made the Zenith Gain **honest** — it no longer bills the naive baseline for
switches the baseline never makes. This section answers the question that comes
next: honest and small, or honest and broken? It is the first. The reported
number is ~2–3% on an ordinary day because the quantity being measured is
genuinely that small, and this is written down so the next reader does not
"fix" a correct number.

**Nothing here changes a formula, a constant, or a bound.** It is a measurement
section plus one scope correction (§21.6).

Measurements: `scripts/rv15-gain-headroom.probe.ts`. Unlike §13.2/§19, whose
tables come from a generator, the reference day here is a REAL reported one —
piano (P1 M7 E7), Gym (P8 M1 E5), guitar (P0 M4 E9), network (P0 M5 E2) on a
4 h budget. Arm A reproduces that screen exactly (plan `1h15 / 1h15 / 30m /
15m`, stop-by `3h45 / 4h18 / 2h09 / 2h58`, gain **2.9%**), including the fit
posterior: the app runs `fitUserConstants([])`, which returns default constants
with the PRIOR as posterior (§13.1), and σ_ϕ > 0 shrinks every T*. Omitting the
posterior moves piano's stop-by to 3h56 and the gain to 3.1% — small, but it is
the difference between reproducing the product and reproducing a model of it.

### 21.1 The edge is SELECTION at tight budgets and SHAPE at loose ones

Decompose the optimizer's advantage over the equal split into two parts: which
tasks get funded at all (**selection**), and how the hours divide among the
funded ones (**shape**). Both baselines billed for their own switches, both on
the 15-minute lattice, as a percentage of the equal-split value:

| budget    | 0h30      | 1h00  | 1h30 | 2h00 | 3h00 | 4h00     | 6h00 | 8h00 | 12h00 |
| --------- | --------- | ----- | ---- | ---- | ---- | -------- | ---- | ---- | ----- |
| selection | **84.9%** | 13.6% | 8.5% | 0.0% | 0.0% | **0.0%** | 0.0% | 0.0% | 0.0%  |
| shape     | 0.0%      | 0.0%  | 0.0% | 0.0% | 1.7% | **1.9%** | 1.9% | 1.9% | 0.7%  |

The two are almost disjoint. Below ~2 h the optimizer wins by refusing to fund
everything and the split is irrelevant; above it, every planner funds every
task and only the split is left. The crossover is at `budget ≈ n·BLOCK_HOURS +
(n−1)·switchCost` — the point where the whole list first becomes affordable.

An ordinary day sits in the second regime, where the gain reports the smaller
of the two effects.

### 21.2 Why shape has a low ceiling: the activation bonus

The shape term is bounded by how much P̄ can move once every task is open, and
the v2 curve's discontinuity at t → 0⁺ (§0, `averageProductivity`) makes that
very little. P̄ as a percentage of each task's own P̄(T*), on the reference day:

| task    | ϕ    | T\*  | 15m | 30m | 1h  | 2h   |
| ------- | ---- | ---- | --- | --- | --- | ---- |
| guitar  | 1h21 | 2h09 | 64% | 76% | 90% | 100% |
| network | 1h47 | 2h58 | 51% | 62% | 79% | 96%  |
| piano   | 2h14 | 3h45 | 36% | 49% | 68% | 90%  |
| Gym     | 2h32 | 4h18 | 31% | 43% | 62% | 85%  |

The first block of guitar buys 64% of everything guitar will ever be worth.
That is the activation bonus, and it is the model's own central claim:
**starting** a task is most of its value. Any planner that opens all n tasks has
therefore already banked the large term on all of them, and is left trading
against the flat tops of n concave curves.

This is why the equal split is a strong baseline rather than a strawman — it
opens everything, so it collects every activation bonus. The gain is small
because the model says the split does not matter much, not because the
allocator is failing to exploit it. A metric that read larger here would be
measuring against a baseline the model itself does not believe in.

### 21.3 Population distribution

2000 random app-reachable days per cell (integer sliders, `pooledProductivityGain`,
default pools), reporting the gain in percent:

| n   | budget | median | p90  | p99  | > 5% | > 10% | > 25% |
| --- | ------ | ------ | ---- | ---- | ---- | ----- | ----- |
| 2   | 4h     | 1.1    | 7.6  | 15.3 | 17%  | 6%    | 0%    |
| 4   | 2h     | 3.4    | 8.2  | 12.6 | 31%  | 4%    | 0%    |
| 4   | 4h     | 4.5    | 10.0 | 15.1 | 45%  | 9%    | 0%    |
| 4   | 8h     | 2.4    | 6.8  | 10.3 | 19%  | 1%    | 0%    |
| 6   | 2h     | 16.0   | 22.3 | 27.1 | 100% | 92%   | 3%    |
| 8   | 2h     | 23.8   | 32.5 | 39.9 | 100% | 100%  | 42%   |
| 8   | 8h     | 5.2    | 8.9  | 12.5 | 53%  | 5%    | 0%    |

The large cells are exactly the ones where §21.1's selection term is live: many
tasks, few hours. The gain also scales with how UNALIKE the tasks are — four
identical tasks give exactly 0.0%, because there the equal split IS the
optimum; a 4.1× ϕ spread at n = 4 / 4 h gives 11.1% against the reference day's
2.9% at a 1.9× spread. The relationship is not monotone (a 5.3× spread gives
5.9%), so ϕ spread is a driver, not a predictor.

### 21.4 The number is a property of the comparison, not of the optimizer

The same optimizer on the same day reports wildly different "value" depending
on the reference set it is scored against. 20000 sampled plans, each spending
its whole billed budget on the 15-minute lattice, at 4 h:

| reference set                       | optimizer beats median by |
| ----------------------------------- | ------------------------- |
| random subset, random split         | **+62.6%**                |
| all 4 funded, random split          | +4.2%                     |
| all 4 funded, equal split (shipped) | **+1.9%**                 |

Most of the first row is not planning skill. Σ P̄ sums per-task averages, so
funding four tasks instead of two scores well almost regardless of the split —
the sampler is being rewarded for breadth the user already chose by writing four
tasks down. The third row is what the shipped metric reports, and it is the
most conservative of the three.

**A percentile does not rescue this.** The optimizer beat 100.00% of all 20000
plans at every budget in both samplings — 0 ever beat it. A statistic that
reads 100% every day is a constant, not a metric. Only the ratio-to-median
varies usefully (40.7% at 2 h → 98.5% at 8 h), and that ratio is a free
parameter of whichever sampling distribution one picks. Any replacement
baseline would need the same defence §13.2 and §19 give the current one, and
would be easier to attack. **Do not swap the equal-split baseline for a sampled
one without reading this paragraph.**

### 21.5 Under the total-output objective the ranking inverts

The same plans, rescored under `∫p dt` — the objective §0 explicitly rejects and
`zenith-energy.ts` keeps as a peer mode (§15):

| plan               | vs Σ P̄      | vs total output |
| ------------------ | ----------- | --------------- |
| equal split        | +1.9%       | +15.0%          |
| two tasks only     | +37.8%      | −32.8%          |
| all day on task #1 | **+129.8%** | **−48.6%**      |

A single-task grind is the worst plan on the shipped objective and the best on
the rejected one. This is not a defect on either side — it is the whole content
of §0's choice, restated as a number. It does mean a user whose intuition runs
on total output will read the planner's advice as wrong, and that the 2.9%
communicates none of the disagreement.

### 21.6 Correction: on an ordinary day it is FLOW that binds, not stopping

An earlier reading of these results held that per-task optimal stopping is the
planner's most valuable output at a 4 h budget. That is **wrong for this task
set**, and the probe's arm I says so directly — tasks at their T*, tasks
reaching flow, and pool use, across the budget sweep:

| budget             | 1h   | 2h   | 4h      | 6h   | 8h   | 10h  | 12h  |
| ------------------ | ---- | ---- | ------- | ---- | ---- | ---- | ---- |
| reach flow (≥ ϕ)   | 0/4  | 0/4  | **0/4** | 0/4  | 1/4  | 4/4  | 4/4  |
| at their T\*       | 0/4  | 0/4  | 0/4     | 0/4  | 0/4  | 0/4  | 0/4  |
| cognitive pool /4h | 0.45 | 0.60 | 1.32    | 2.17 | 2.95 | 3.82 | 4.00 |

**No task is ever at its stopping time**, at any budget the slider allows: the
cognitive pool saturates first (4.00/4 h at 12 h, §4's pooled path), so the
stop-by figures are never the binding constraint for this list. What is binding
is the row above — from 1 h through 6 h **not one task gets enough unbroken time
to reach flow**, and the reference day's plan gives guitar 30m against a ϕ of
1h21.

That reading is already computed and already displayed: `calculateFlowCoverage`
(plan-scoped, §11.8) renders **0/4** on this day. The gain is a headline metric
and flow coverage is not, so the dashboard leads with the smaller true statement
and buries the larger one. That is a presentation ordering question, not a model
one, and it is deliberately left as such here — but any future work on "the gain
looks too low" should start at this table, because the gain is not the metric
that is under-reporting.
