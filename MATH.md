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

Every derivation below is verified numerically in
`src/lib/business/model/zenith.test.ts` (integration vs. closed form,
derivatives vs. finite differences, root equations, allocator vs. brute
force).

---

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
correctly leaves slack. (The experimental `zenith-energy.ts` model explores
the total-output alternative; see §8.)

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

### Properties (all verified in tests)

- **Starts at p₀:** `p(0) = p₀`.
- **Peak exactly at ϕ:**
  `p'(t) = k·e^(−kt)·(a − p₀ − a·k·t) = 0  ⇔  t = (a−p₀)/(a·k) = ϕ`
  (this is why `k` changed from `1/ϕ` to `(1−r)/ϕ`).
- **Peak value:** `p(ϕ) = a·e^(r−1)`. First-order in `r` this is
  `(a/e)(1+r) ≈ (a+p₀)/e` — the v1 peak was the small-p₀ approximation of the
  v2 peak, so peak-productivity displays change only slightly.
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
  `x*(r) → 3(1−r)/(1+r)` as r → 1, hence `T*/ϕ → 3/(1+r) → 1.5`. So every
  task stops between **1.5ϕ and 1.7933ϕ**. Interpretation: tasks that start
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
  task. So whenever greedy was actually blocked by a pool, a
  **resource-aware transfer pass** runs: give back one donor block, greedily
  refill the freed time + pool capacity across the other tasks, keep the
  move only on strict improvement (strictness prevents cycles). Regression
  tests hold the result within 1–2% of brute-force block optima on the
  scenarios that broke earlier heuristics; the single-constraint path skips
  the pass entirely and keeps its exactness.

The allocator's verified exactness claim, precisely stated: **for the
single-budget problem with switch cost and n ≤ 12, the returned plan attains
the true maximum of the objective over all block-quantized plans.** (Test:
brute force over every block distribution × funded-subset overhead.)

## 5. Personalization — **v2 change: full Bayesian posterior**

The article prescribes measuring time-to-flow ("⚡ logs") and fitting
`ϕ = c₁E + c₂β + c₃` by least squares. v1 already used ridge regression
toward the defaults; v2 recognizes that ridge as the MAP of a Bayesian model
and exposes the whole posterior:

```
Model:      ϕᵢ = c·xᵢ + εᵢ,   εᵢ ~ N(0, σ²/wᵢ),   xᵢ = [Eᵢ, βᵢ, 1]
Prior:      c ~ N(c₀, (σ²/λ)·I),   c₀ = defaults,   λ = 4
Weights:    wᵢ = γ^(n−1−i)   (optional forgetting factor γ ≤ 1;
            γ = 1 → all equal, v1 behavior)

Posterior:  mean  ĉ = (XᵀWX + λI)⁻¹(XᵀWϕ + λc₀)     ← identical to v1's ridge
            cov   Σ = σ̂²·(XᵀWX + λI)⁻¹
Noise:      σ̂² = (ν₀σ₀² + Σwᵢ(ϕᵢ − ĉ·xᵢ)²)/(ν₀ + Σwᵢ),
            σ₀ = 0.25h (15-minute stopwatch noise floor), ν₀ = 4
Predictive: std of a new measurement at (E, β):  √(σ̂² + xᵀΣx)
```

Why: the MAP point estimate is unchanged (no behavior change from v1 fits),
but a 2-log fit and a 200-log fit are no longer indistinguishable —
`phiPredictionStd` quantifies it (parameter uncertainty shrinks with data and
grows with distance from the logged region). Intended uses: UI bands
("ϕ ≈ 1.4h ± 0.4h") and robust allocation — the latter is now implemented:
since 2026-07-18 the allocator consumes the posterior directly (§5.1). The
forgetting factor is for users whose flow behavior drifts (recursive-least-
squares style; γ ≈ 0.98 ≙ ~34-log half-life, since 0.98³⁴ ≈ 0.5 — the
"~50-log" figure in an earlier revision was the 1/e time constant,
0.98⁵⁰ ≈ 0.37; see §10).

Unchanged v1 safeguards: fallback to defaults on zero observations or when
the fitted plane predicts ϕ > 16h anywhere on the domain; negative
predictions at unobserved corners are allowed (fast-flow users legitimately
tilt the plane) and absorbed by the 0.1h floor.

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
through degree 9; moment checks to 4·10⁻¹⁶ in the probe). Structural facts
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
2. **Monotone-prefix menu truncation:** `buildBlockIncrements` stops at the
   first non-positive OR non-decreasing increment. Inside the cap the only
   residual violations are O(10⁻⁴) wiggles at one extreme corner (ϕ̂ ≈ 6h
   with σ at the cap, where the outer node still lands on the ϕ floor);
   cutting the menu there restores Fox's diminishing-increments premise BY
   CONSTRUCTION rather than by sweep, at the cost of a few low-value blocks
   in a corner where the fit is dubious anyway. At σ = 0 the cut can never
   trigger (increments are strictly decreasing — proved in §2).

**Expected optimal stopping.** `T*_E = argmax E[P̄]` has no closed form; it is
found by 60-step bisection of the mixture marginal `Σ wₙ·dP̄/dT(T; kₙ)` on
`[T*(ϕ_min), T*(ϕ_max)]` — below the bracket every component's marginal is
positive, above it every one is negative, and inside the cap regime the probe
shows a single crossing. `TaskAllocation.optimalHours` and
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

| #   | What                   | v1                                                                     | v2                                                                                          | Why                                                                                                                                    |
| --- | ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Curve                  | `(a+p₀)·k·t·e^(−kt)`, `p(0) = 0`                                       | `(a·kt+p₀)·e^(−kt)`, `p(0) = p₀`                                                            | Make "initial productivity" actually true; article's own story about p₀ wasn't in its math                                             |
| 2   | `k`                    | `1/ϕ`                                                                  | `(1−r)/ϕ`                                                                                   | Keep the peak exactly at t = ϕ under the new curve                                                                                     |
| 3   | Peak value             | `(a+p₀)/e`                                                             | `a·e^(r−1)`                                                                                 | Exact peak of new curve; v1 value is its small-r approximation                                                                         |
| 4   | Optimal stopping       | universal `1.7933·ϕ`                                                   | per-task `ϕ·x*(r)/(1−r) ∈ (1.5ϕ, 1.7933ϕ]`                                                  | Follows from the new curve; root of `eˣ = 1+x+x²/(1+r)`                                                                                |
| 5   | `OPTIMAL_AVG_FRACTION` | constant 0.2984                                                        | removed → per-task `optimalAvgProductivity`                                                 | Only valid when the multiplier was universal                                                                                           |
| 6   | Allocator              | continuous λ-bisection + dual descent + drop-search + rounding patches | 15-min blocks, greedy marginal analysis, exact subset enumeration, pool transfer pass       | Activation bonus breaks concavity (v1 guarantees void); discrete greedy is provably exact for the single budget; humans plan in blocks |
| 7   | Allocation output      | arbitrary 0.01h values                                                 | multiples of 0.25h; `optimalHours` + `optimalAvgProductivity` fields added                  | Executable plans; downstream metrics need per-task T*                                                                                  |
| 8   | Constants fit          | ridge point estimate                                                   | same MAP + posterior covariance, noise estimate, predictive std, optional forgetting factor | Quantify uncertainty; the ridge already _was_ the MAP of this Bayesian model                                                           |
| 9   | Switch-cost meaning    | unspecified                                                            | documented as attention residue (Leroy 2009), distinct from ramp-up (already in ϕ)          | Prevents future double-counting "fixes"; 0.25h grounded in Mark et al. 2008                                                            |

## 7. Known approximations and deliberate non-changes

- **Naive baselines stay continuous.** `productivityGain` /
  `pooledProductivityGain` compare against an equal split that is _not_
  block-quantized: quantization is part of what Zenith imposes, not part of
  what a naive planner does.
- **Pooled greedy + transfer pass is a heuristic** (multi-dimensional
  knapsack is NP-hard); tested to within 1–2% of brute force on the
  regression scenarios. Single-budget remains exact.
- **Forward selection for n > 12 funded-subset search** is a heuristic for a
  regime a daily planner rarely reaches.
- **Budgets below 0.25h are left unplanned** (v1 would allocate slivers).
- **`zenith-energy.ts` intentionally still uses the v1 curve.** It is an
  experimental, standalone, total-output model with its own fatigue
  dynamics (documented in §8); migrating it to the v2 curve is a separate
  decision.
- **`a = E·β` (peak monotone in effort) is kept from the article** even
  though flow research suggests an inverted-U in challenge (see references);
  changing it alters the meaning of the difficulty slider and deserves its
  own revision.

## 8. Energy model (`zenith-energy.ts`) — fatigue-recovery extensions

The experimental total-output model keeps the v1 curve (see §7) but got two
literature-grounded corrections on 2026-07-13 (§8.1–8.2), a per-task
satiety term on 2026-07-14 (§8.4), and a micro-recovery floor for
full-demand tasks plus optimizer-reliability fixes on 2026-07-14
(§8.5–8.6). The corrections were driven by an
empirical probe of the old behavior: on a 10-hour window with a demanding
task the optimizer scheduled **zero** interior rest, and micro-breaks always
_reduced_ output at equal work-hours — contradicting the well-replicated
finding that short interspersed breaks raise total output (Jaber & Neumann
2010; Bechtold, Janaro & Sumners 1984).

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

Post-fix probes (locked in as unit tests): the optimizer now inserts interior
rest on long demanding windows (6 breaks on the 10-hour probe, a Pomodoro-like
pattern), and a ~30-minute break placed mid-session _raises_ total output at
equal work-hours — the Jaber–Neumann result the old model could not produce.
Fragmentation still costs (contiguous ≈ 1.5× confetti on the standard probe),
just no longer catastrophically.

**Open:** making sustained work efficient made it attractive. At the default
`freeTimeValue = 0.5` the optimizer now recommends ≈ 9.9 h of work in a 12-hour
window (pre-fix ≈ 5.4 h), and because the leisure term is _linear_ in hours the
response to `freeTimeValue` is bang-bang: ≈ 1.0 still yields ≈ 9.5 h, ≈ 1.5
collapses to all-leisure. A humane default day needs a structural change — a
concave (diminishing-returns) leisure value or a soft work-hour cap — not a
retuned constant. Defaults were deliberately left alone pending that decision.

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

**Why this form and not the alternatives** (all probed 2026-07-14 against a
validated replica of this module, same multi-seed local search):

- **Chosen — concave value on cumulative output.** Lives entirely outside the
  dynamics: warm-up, reservoirs, and the Simpson quadrature are untouched, so
  ϕ keeps its exact meaning (time-to-peak) and §8.2's calibration story is
  unaffected. Probe: turns the 7h/1h winner-take-all plan into one session
  per task near each task's T*-scale; contiguous-vs-confetti ratio stays
  ≈ 1.4 (baseline 1.5), so fragmentation stays priced; the plan responds
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
it drains toward literally zero energy with no basal floor. Probe: lowering
the probe day's boxing demand from 1.0 to just 0.95 jumped its optimal
allocation from 2.65 h to 4.56 h — a plan cliff from a 5% demand change.

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

**Why this form and not the alternatives** (probed 2026-07-14,
`gate-floor-probe`):

- **Rejected — gate `(1−w^q)`.** Still exactly 0 at `w = 1` for every q: the
  within-session decay of a full-demand task is bit-identical to the current
  law. Its only effect is inflating mid-range equilibria — a side effect, not
  a fix. (This was the earlier roadmap suggestion; the probe killed it.)
- **Rejected — clamp `C_eq = max(C_eq, F)`.** Produces the right floor but is
  non-smooth in w (the clamp binds only above w ≈ 0.95 at F = 0.15), is
  purely phenomenological, and decouples C_eq from ρ.
- **Chosen — `1−(1−b)·w`.** Smooth and monotone in w, one parameter with a
  physical reading and a literature-anchored default, targeted where the
  problem is (eq at w = 0.5 moves ~1% at b = 0.05), exact opt-out at b = 0.
  Probe: the demand sweep wp 1.0 → 0.7 becomes smooth and monotone
  (3.0 → 4.5 → 5.2 h, objectives in even ~0.4 increments) instead of
  cliffed, and long full-demand sessions stabilize near the floor instead of
  grinding to zero.

### 8.6 Optimizer reliability — compound moves and drop-one seeds (added 2026-07-14)

While probing §8.5 the multi-seed steepest-ascent search was caught leaving
~0.5–1% of objective on the table, and worse, returning the wrong plan
_structure_ (dropping a task that the true optimum funds, and vice versa).
Root cause, both times, is that steepest ascent only takes single moves that
are uphill on their own:

- **Reallocation plateaus:** moving time from task A to task B requires a
  shrink and a grow, each downhill alone. Fix: a **transfer move** (shrink
  block i, grow block j, one candidate).
- **Cold-start slivers:** inserting an unfunded task at step size (0.25 h)
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
  a stranded idle sliver is pure loss).

All fixes are deterministic (the search stays reproducible; a test asserts
this). Verification: both previously-failed probe cases now beat their
hand-built witnesses, and the b = 0 legacy world's optimum improved too
(10.70 vs 10.65) — meaning even pre-§8.5 results had mild search slack.
Cost: ~60 ms for 3 tasks / 8 h (was ~40 ms), still interactive.

### 8.7 Drain-rate calibration from end-of-session ratings (added 2026-07-15)

**The data signal.** Every other energy parameter was hand-tuned; this adds
the first _measured_ personalization. After working a session on a task, the
user logs a 🪫 rating: session length `H` plus "how drained do you feel now"
for mind and body on a 0–10 scale (a Borg CR10-style category-ratio
instrument). The task's reservoir demands `wc, wp` are captured at logging
time, like E/β on ⚡ flow logs, so later slider edits don't rewrite past
measurements. Ratings are stored per task per day with upsert-on-re-log
(typo-correction semantics), in a new IndexedDB store (`drainObservations`,
DB v3).

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
  λ = 4, the effective "design" here is the sensitivity dD/dα (≈ 0.3–0.9 for
  typical 1–3 h full-demand sessions, vanishing as w → 0), so λ was tuned by
  probe in those units (λ sweep, 2026-07-15): one consistent full-demand log
  moves α ~50% of the way to what it implies, three ~70%, ten ~85%; λ = 0.5
  left three logs at only 57% while buying almost no extra outlier
  resistance (a wild outlier among 4 on-default logs lands within 0.01 of
  the λ = 0.25 result — robustness comes from the other logs, not the
  prior).
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
  erased the noise floors at small n and made the reported ±stds 2–10×
  tighter than a floor-honest posterior (probe: 6 clean rest pairs reported
  r ± 0.036 — 4% precision on recovery rate from six fuzzy self-ratings; now
  ± 0.249). The adversarial-pairs case (§8.9) widened too: ± 0.615, and the
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

**Probe results (2026-07-18).** (a) _Quantization loss is small:_ objective
ratio coarse/fine (0.75 vs 0.25 step) was 0.9865 / 0.9979 / 0.9936 / 0.9886
across the standard probe days — bounded ≥ 0.97 in a test. (b) _Structure
survives:_ the funded-task set matched the fine-step optimum in all four
cases. (c) _No new search slack:_ exhaustive enumeration of all 45-min
plans on the 2026-07-14 probe day (all task orders × allocations × interior
rests, ~10⁴ evaluations) equals the search's 10.7331 exactly — locked in as
a probe-time check, not a unit test (too slow). (d) _Faster:_ ~55 ms vs
~330 ms on the 3-task/8 h day (fewer lattice points, fewer neighbors).
(e) A side benefit: fine-step optima at long windows degenerate into 15-min
rest confetti (e.g. five 0.25 h rests across 12 h); the coarse lattice
returns one 45-min break — closer to what a human would actually do, at
~1% objective cost.

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
Stored in a new IndexedDB store (`restObservations`, DB v4). Unlike drain
ratings there is no task and no per-day upsert key — several breaks a day are
normal, so records append; corrections happen by deleting a pair from the
calibration list.

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
α fit's calibration profile: one consistent logged rest moves r **51%** of
the way to what it implies, three **72%**, ten **88%** (λ = 0.1 sat at 37%
for the first log — too anchored; λ = 0.25, the §8.7 value, would be worse
still because dD/dr ≈ 0.2–0.4 here, roughly half the drain fit's lever arm).

**Probe evidence (2026-07-18).** Noiseless 8-log recovery across the range:
true 0.3 → 0.307, 0.7 → 0.700, 1.0 → 0.976, 1.5 → 1.365; under 0–10 notch
quantization plus ±1-notch jitter the fit stays within ~0.05 of truth with
honest stds. Known shrinkage at high true r mirrors §8.7's α saturation: from
36-min breaks, true 2.5 fits to ~1.81, because any r ≥ 2 leaves less than one
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
2. **Only λ₀ is identifiable.** Sweeping V_T over [0, 6] (12×) moved the
   optimal stop across just two 45-min lattice levels, and the joint
   (λ₀, V_T) response surface is almost constant in V_T. So the fit targets
   λ₀ alone and **conditions on** the user-owned V_T — completing the
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
  canonical. Probe: brackets contain the true λ₀ across the whole grid
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
- **Noise/posterior:** σ₀ = `STOP_NOISE_PRIOR_STD` = 0.25 in λ₀ units
  (lattice-bracket half-width ≈ 0.15 on the probe day, plus day-to-day mood
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
  instrument's resolution.
- **Inverted brackets beyond a margin are censored; small inversions keep
  their midpoint** (probed and revised 2026-07-19). The two revealed
  inequalities can contradict: `lo > hi` means extending some task was worth
  MORE per step than the most valuable step actually worked — no λ₀
  rationalizes such a day (typical cases: a session cut short mid-warm-up,
  or a long grind on a weak, satiating task while a high-amplitude task sat
  unstarted). On arbitrary random compositions about HALF of days invert
  (89/185) — but on the estimator's intended regime they don't:
  optimizer-generated days, and those same days perturbed by ±1 lattice step
  of "mood", produced zero inversions on the probe grid. That makes
  inversion a reliable DETECTOR of a stop that was not a leisure choice
  (interruption, sickness, deadline elsewhere) — and such a day's midpoint
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
  before it is discarded, and genuinely near-rational days sit nowhere near
  the boundary (zero inversions under ±1-step mood). Probe on the standard
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
formula, constant, or runtime behavior — recorded so future readers can tell
a corrected explanation apart from a model change. If an entry here seems to
contradict older commit messages or comments, this log is the current truth.

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

## 11. Metric-layer corrections (2026-07-18)

### 11.1 Scope and principle

The dashboard metrics (`metric/calculation.ts`) are derived DISPLAYS, not
allocator inputs — none of the fixes below change which plan gets suggested.
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
- **Noted, unchanged:** negative gains remain possible and honest. The
  continuous naive split (deliberately unquantized, §7) collects the ≈ p₀
  activation bonus on every sliver, so with many tasks and little time it can
  beat the block-quantized plan under the sum-of-averages objective — a
  consequence of the §0 objective choice, not a bug in the comparison.

### 11.3 Burnout Risk: overhang counts funded tasks' T* only (formula since superseded by §11.6; the `availableHours` = intended-work reading survives)

- **Before:** `overhang = max(0, effectiveBudget − Σ T*ᵢ)` with the sum over
  ALL active tasks, funded or not.
- **After:** the sum runs over tasks with `suggestedHours > 0`.
- **Why:** a task the allocator dropped (zeroed pool, switch not worth
  paying) is one the user won't work — its `T*` was absorbing budget hours
  that actually land on the funded tasks' diminishing-returns zones. Probe
  (injured user: `physicalHours: 0`, 10h budget): the dropped gym task's
  `T* = 4.38h` suppressed the overhang from 6.16h to 1.78h, silencing the
  overwork warning. Property now locked in a test: adding a dropped task to
  the list leaves the risk unchanged.
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
  - _Properties preserved:_ dropped tasks (0h) leave the risk unchanged
    (§11.3, now by construction — they contribute no block); a declared
    budget with nothing funded still warns (simulated at the task list's
    average demands); no tasks or no intended hours → 0.
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
