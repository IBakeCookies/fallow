# Fallow — Mathematical Model, Derivations, and Change Log

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
tests. A claim that is a sweep rather than a fixture is answered by a probe
under `scripts/` — see [scripts/PROBES.md](scripts/PROBES.md) for which probe
covers what.

**This document holds derivations, not measurements** (R7). The formula, why it
has that shape, and why the alternative was rejected. A figure read off a run
lives in the probe that produced it, where it can be re-derived; quoted into
prose it cannot re-run, it only rots — which is what grew this file to 9,431
lines before it was cut back to its math.

---

<!-- section-index:start -->

## Section index

Read a section, not the file: `Read MATH.md offset=<first line> limit=<span>`.
The whole document is ~25k tokens at 4 chars/token; the largest
single section is §8 at ~15k (§5 is ~3k), and most of the 25 rows below are
under 2k. Every figure in this paragraph is regenerated with the table — none is
retyped, and a re-wrap that splits one across lines fails the build rather than
freezing it. Ranges shift whenever a section is inserted, and the table has
alignment and truncation rules that are not evident from reading it — so never
retype a row, regenerate:

    node scripts/math-index.mjs

`npm run lint` runs it with `--check`, so a stale index fails the build.

```text
§0           81-100  Objective
§1          102-127  Inputs and parameter mappings (unchanged from the articl…
§2          129-230  Productivity curve — v2 change
§3          232-317  Optimal stopping — v2 change: per-task, no longer a univ…
§4          319-390  Allocation — v2 change: discrete blocks, exact greedy, e…
§5          392-629  Personalization — v2 change: full Bayesian posterior
  §5.2      440-518  Recency weighting of the ϕ fit
  §5.1      520-629  Posterior-aware allocation
§6          631-643  Summary of v1 → v2 changes
§7          645-669  Known approximations and deliberate non-changes
§8         671-1695  Energy model (zenith-energy.ts) — fatigue-recovery exten…
  §8.1      683-705  Intermittent-rest recovery correction
  §8.2      707-726  Warm-up carryover instead of binary reset
  §8.3      728-746  Verified consequences and a calibration question, closed
  §8.4      748-818  Per-task satiety — concave daily value
  §8.5      820-860  Micro-recovery gate — a positive floor for full-demand t…
  §8.6      862-908  Optimizer reliability — compound moves and drop-one seeds
  §8.7     910-1007  Drain-rate calibration from end-of-session ratings
  §8.8    1009-1044  45-minute plan granularity
  §8.9    1046-1093  Recovery-rate calibration from pre/post-rest pairs
  §8.10   1095-1340  Stopping-value calibration from observed stop times
  §8.11   1342-1473  Live stop advisor — §8.10 run forward mid-day
  §8.12   1475-1629  The budget curve — what the day's LENGTH is worth
  §8.13   1631-1695  Capacity from the fitted drain rate
§9        1697-1744  References
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
alternative; see §8.)

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

- **Starts at p₀:** `p(0) = p₀`.
- **Peak exactly at ϕ:**
  `p'(t) = k·e^(−kt)·(a − p₀ − a·k·t) = 0  ⇔  t = (a−p₀)/(a·k) = ϕ`
  (this is why `k` changed from `1/ϕ` to `(1−r)/ϕ`).
- **Peak value:** `p(ϕ) = a·e^(r−1)`. First-order in `r` this is
  `(a/e)(1+r) ≈ (a+p₀)/e` — the v1 peak was the small-p₀ approximation of the
  v2 peak. The gap is `1 − (1+r)·e^(−r)`, which is only small at high
  difficulty; enjoyment cannot move the gap at all, since `r = p₀/a = 1/E²`
  depends on the difficulty slider alone. Nothing displays it either way:
  `peakProductivity` is carried on `TaskAllocation` and `SuggestedTask` and
  rendered by no component.
- **Concave on the working range:** `p'' = a·k²·e^(−kt)·(kt − (2 − r))`, so
  the only inflection sits at `x = kt = 2 − r` — and `x* < 2 − r` holds for
  every r (fact 3 under "Marginal of the average" below), so the curve has
  no convex kink before you'd stop anyway.
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
exactness does not hang on a numeric sweep:

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
  forbids — §1). Interpretation: tasks that start productive (high p₀
  relative to peak) stop _earlier_ — their early hours were already good, so
  the declining tail drags the average down sooner.
- Solved by 60-step bisection of `q(x) = eˣ − 1 − x − x²/(1+r)` on
  `(0, 1.80]`; `q < 0` before the root and `> 0` after, and the root is
  ≤ 1.7933 for all r ≥ 0. `findOptimalSingleTaskTime` is now closed-form via
  this root — the v1 Newton-Raphson iteration is gone.
- **The band belongs to this closed form and to nothing else.** It is a σ_ϕ = 0
  statement. `TaskAllocation.optimalHours` — the field the task row renders as
  "stop by" — is the ϕ-uncertainty-hedged optimum of §5.1, and every user
  carries a posterior from their first day, so nothing HOLDS the hedged value
  inside the band, which is what bars it from copy. That is correct — hedging
  moves the optimum earlier, and a task already productive at t = 0 has little
  to gain by waiting — but it means no code comment or UI string may quote the
  band for that field.

The best achievable average `P̄(T*)` is computed per task and exposed as
`TaskAllocation.optimalAvgProductivity`; it replaced the v1 constant
`OPTIMAL_AVG_FRACTION = x/(x²+x+1) ≈ 0.2984` (removed — only valid when the
multiplier was universal). The metric layer's _priority score_ is this value —
a task's intrinsic worth independent of what the current plan gives it — and it
is reported on two scales, only one of them printed.
`SuggestedTask.priorityScore` (`metric/calculation.ts`) is
`Number((P̄(T*)·10).toFixed(1))`: the figure a task row prints in its `Prio`
column, the weight in `completionRate` and `yieldIndex`, and the key
`calculateSuggestedTasks` sorts by. `metric/remaining-day.ts` passes P̄(T*)
un-rescaled, deliberately — the rescale is a display convention, not part of the
model, so it is applied at the one call site that prints. The ×10 is
order-preserving; **the 1 dp rounding is not**, which makes the un-rescaled
reading the strictly finer sort key: rounding ties tasks this section separates,
and a stable sort then settles the tie by the order they arrived in. It does
**not** reach the Yield Index, which sums the same rounded key it sorts by, so a
swap cannot move its top-N sum.

That independence holds at **every** budget, zero included. `ϕ`, `T*`, the peak
height `a·e^(r−1)` and `P̄(T*)` are functions of the task's own (E, β) and the
user constants alone, so the empty plan reports them unchanged and only the two
allocation-dependent fields — `allocatedHours` and `avgProductivity` — go to 0
(`P̄(0) := 0`, §2). Previously the `budget ≤ 0` short-circuit zeroed all of
them, which made a task's intrinsic priority read 0 at exactly the boundary
where it is the only thing left to rank by, and made a stored day with
completions but no recorded hours read 0% complete (the priority-weighted
completion rate divided by a zero total). Under a fit posterior the empty plan
is hedged like any other — it carries the expected values, not the certainty
ones.

The tie above is also where the one consequence of the two scales lands.
`calculateInterleavedOrder` is fed the **rounded** key from the plan path
(`metric/daily-metrics.ts:136`) and the **raw** `optimalAvgProductivity` from
`metric/remaining-day.ts:154` — each site's choice is argued above, but one
function is thus ordered at two precisions, so next-up and the `#N` sequence can
disagree on a tie. Neither site moves: the raw key is strictly finer, and the
plan path must print the rounded one.

**P̄(T\*) is not monotone in difficulty, and the cap is not why.** Write the
closed form as `P̄(T*)/β = E·h(r(E))` with `r = 1/E²` (§1). The dip is the
closed form's: `h` is a function of `r` alone, constant while `a = Eβ` keeps
growing — which is the whole of the rise into the local max — and falling with
difficulty above the cap. The trough sits outside the capped band. The depth is
β-free.

**Lowering or removing the cap DEEPENS it.** Uncapped, difficulty 1 has r = 1
and h → 1 (this section's r → 1 asymptote), so `P̄/β` would read 1.000000 and
the same trough would be a deeper drop. The cap **shrinks** the dip.

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
(≈ p₀ᵢ), and subsequent increments decrease.

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
  without special cases. For n > 12 the same enumeration runs **bounded to
  subsets no larger than the day can fund** — exact while that fits, which is
  the tight-budget region where the subset choice is worth most (up to a 3 h
  day at n = 13). Longer days fall through to greedy forward selection.
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
  only on strict improvement (strictness prevents cycles). The
  single-constraint path skips the pass entirely and keeps its exactness.

The allocator's exactness claim, precisely stated: **with σ_ϕ = 0, for the
single-budget problem with switch cost and n ≤ 12 — or n > 12 on any day
whose size bound fits `SUBSET_SEARCH_BUDGET` — the returned plan attains the
true maximum of the objective over all block-quantized plans.** Under a fit
posterior it does **not** hold: §5.1's monotone-prefix truncation takes
blocks off the menu before the search sees them.

One methodological note worth keeping. The first cut charged feasibility in
HOURS (`used·BLOCK_HOURS + overhead ≤ budget + 1e-9`) and reported
non-exactness that was pure admissibility: the hour rule flags a lattice±ε
budget whose optimum the allocator is not allowed to place.
`budgetBlocksFor`'s epsilon is 1e-9 of a BLOCK, four times tighter, so the
two sides disagreed about which plans were _admissible_ rather than which was
_best_. A reference that admits plans the allocator may not place measures
the tie-break convention, not the search.

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
("ϕ ≈ 1.4h ± 0.4h") and robust allocation — the latter is now implemented with
the xᵀΣx half alone (`phiParameterStd`).

Unchanged v1 safeguards: fallback to defaults on zero observations or when
the fitted plane predicts ϕ > 16h anywhere on the domain; negative
predictions at unobserved corners are allowed (fast-flow users legitimately
tilt the plane) and absorbed by the 0.1h floor. **Every return carries a
posterior, including those fallbacks** — falling back means "the prior is all
we know", and at n = 0 the formulas above give exactly Σ = (σ₀²/λ)·I and
σ̂² = σ₀². `fitted` still reports whether the DATA moved the constants; that
is what the UI keys on.

**Removed — the optional forgetting factor.** Observation weights
wᵢ = γ^(n−1−i) let a user whose flow behavior drifts shed stale logs
(recursive-least-squares style; γ ≈ 0.98 ≙ ~34-log half-life). It was never
passed by any caller, never reached the UI, and was not on the roadmap, while
carrying a paragraph of doc and a silent ordering contract (observations had
to arrive oldest-first, which nothing enforced). With it gone `Σwᵢ` collapses
to `n` everywhere, and `FitPosterior.nEff` — which existed only to report the
weighted count — went with it; callers that wanted a count had
`observations.length` (which `readUserFit` returned as `usedCount`, until §5.2
made it a weighted sum). If drift-forgetting is ever
wanted again, the right instrument is probably a timestamp on each ⚡ log,
not a decay over arrival index. **That is what §5.2 now does** — the weights
are back, keyed on the log's date rather than its position.

### 5.2 Recency weighting of the ϕ fit

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

`ageDays` omitted ⇒ wᵢ = 1 ⇒ every formula collapses **exactly** to §5. The
`max(0, …)` floor exists for one reachable case: a backup restored from a
device with a fast clock carries a log dated ahead of today, and an unfloored
2^(−age/H) would exceed 1 and let that single log outvote the rest.

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
years of logs). Shrinkage compresses the effect: the ridge denominator is
λ-dominated at small Σw, so the weights bite less than their ratio suggests.
Directionally right, deliberately gentle.

**Σw is the number the UI prints, and the usual n_eff is the wrong statistic.**
The "Your model" card's ϕ row says "N ⚡ logs"; with weighting, N raw logs no
longer describes what moved the fit, so the row reports Σw — "what this history
is worth in fresh logs" — fractional, one decimal, labelled recency-weighted.

The textbook effective sample size (Σwᵢ)²/Σwᵢ² was tried first and is wrong
here: it measures how EVENLY weight is spread, not how much of it there is. A
user who logged 20 times ten years ago and stopped has equal weights, so it
scores a full 20.0 — printed beside a fit that has essentially returned to the
prior.

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

Consequence to keep in mind when reading the card: its five rows — the
recency-weighted ϕ row against four unweighted fits (r, α_cog, α_phys, λ₀) — do
not all answer "over what period?" the same way.

### 5.1 Posterior-aware allocation

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
not a separate code path. Before this change the allocator consumed only the
posterior mean: a plan built from 2 logs and one built from 200 logs were
identically confident (flagged as future work in §5; now done).

**The expectation.** Only `k = (1−r)/ϕ` depends on ϕ — `a`, `p₀`, `r` do not
— so the mixture is over curves of identical shape and different time scale:

```
E[P̄](T) = Σₙ wₙ · P̄(T; kₙ),   kₙ = (1−r)/ϕₙ,   ϕₙ = max(0.1, ϕ̂ + √2·σ_eff·ξₙ)
```

with (ξₙ, wₙ) the 5-node Gauss–Hermite rule (exact for polynomial integrands
through degree 9, so its own leading error rides on the 10th ϕ-derivative of
P̄ and is negligible). **The accuracy floor is not the rule's order** — it is
the ϕ-floor clamping of the outer nodes (weight 0.0113 each), which narrows
the effective mixture below N(ϕ̂, σ²) once `ϕ̂ − √2·σ·2.0202 < 0.1h`, and the
INNER nodes (weight 0.2221 each) join it below ϕ̂ ≈ 0.31h. That is the same
graceful degradation the cap exists to bound.
Structural facts that survive the mixture untouched:

- **Activation bonus unchanged:** `lim T→0⁺ P̄(T; kₙ) = p₀` for every node, so
  the first-block jump (§2) is exactly p₀ regardless of σ.
- **Peak height unchanged:** `p(ϕ) = a·e^(r−1)` is ϕ-free, so
  `peakProductivity` needs no expectation — uncertainty moves WHEN your best
  hours happen, not how good they are.
- **Uncertainty is a strict penalty:** every component attains the same
  maximum value `F(x*)` at its own T*, so no single T reaches it for all
  components at once ⇒ `max_T E[P̄] < P̄(T*; ϕ̂)` whenever σ > 0. A task's
  `optimalAvgProductivity` (= the dashboard priority score before the ×10 of
  §3) now decreases with uncertainty — hedging emerges from the math, no
  ad-hoc discount.
- **Expectation is linear across tasks:** `E[Σᵢ P̄ᵢ] = Σᵢ E[P̄ᵢ]`, so the
  cross-task correlation of the ϕᵢ (they share the fitted c) is irrelevant
  to the objective. It would matter only for risk measures beyond the mean
  (CVaR-style robust allocation), which is out of scope.

**Why parameter std and not the predictive std.** `phiPredictionStd` adds the
observation noise σ̂², which describes the user's own day-to-day scatter about
the plane rather than how well we have measured them — it converges to that
scatter instead of to zero, so using it would make the allocator hedge against
tomorrow's realization forever, even for a user with hundreds of logs.
`phiParameterStd = √(xᵀΣx)` is the part the data can actually remove: it
shrinks to 0 as logs accumulate (and grows with distance from the logged
region), so a well-measured user recovers the classic plan exactly. That
matches the §5 motivation — distinguishing the 2-log fit from the 200-log fit
— rather than modeling day-to-day ϕ drift, which the rating instrument cannot
separate from stopwatch error.

**Keeping the allocator exact — two guards.** The §4 greedy needs per-task
increment menus that are positive and non-increasing. The mixture can break
this: past a component's inflection (x = 2−r, §2) its marginal rises back
toward 0⁻, so a wide mixture of a "spike" component (ϕ floor) with slow
components turns bimodal in T. The guards:

1. **Relative σ cap** `σ_eff = min(σ_ϕ, 0.5·ϕ̂)`
   (`PHI_UNCERTAINTY_RELATIVE_CAP`). Beyond it a Gaussian is a poor
   posterior for a positive quantity anyway (significant mass below 0), so
   the cap is graceful degradation, not information loss.

   The cap's actual warrant is that the fit cannot reach the region the cap
   fails to exclude. The reason is structural: the ridge anchors ĉ to the
   default with λ = 4 pseudo-observations, so few logs (large σ) pull ϕ̂ back
   into the clean region while many logs (ϕ̂ free to move past 3h) shrink σ.
   The two requirements are in opposition.

   **Lowering the cap to 0.35 would cost more than it buys, which is why it
   was rejected.** It is the obvious repair and it is the wrong one: it
   changes the hedging of habit-shaped cells — every cell past σ/ϕ̂ = 0.35,
   newly clamping those up to 0.5 and clamping the rest harder — and clamping
   means hedging LESS. Those are precisely the few-log users §5.1 exists
   to hedge for. The two fixes that would address the root cause —
   renormalizing the floor-clamped quadrature node, or a lognormal ϕ posterior
   — remain available if the fit ever changes, and both are unmotivated today.

2. **Monotone-prefix menu truncation:** `buildBlockIncrements` stops at the
   first non-positive OR non-decreasing increment. Cutting the menu there
   restores Fox's diminishing-increments premise BY CONSTRUCTION rather than
   by sweep, at a cost that is a few low-value blocks. Guard 1's reachability
   argument is what keeps that off a real user's plan. At σ = 0 the cut can
   never trigger (increments are strictly decreasing — proved in §2).

**Expected optimal stopping.** `T*_E = argmax E[P̄]` has no closed form; it is
found by 60-step bisection of the mixture marginal `Σ wₙ·dP̄/dT(T; kₙ)` on
`[T*(ϕ_min), T*(ϕ_max)]` — below the bracket every component's marginal is
positive, above it every one is negative, and inside the cap the bracket holds
exactly one crossing for every ϕ̂ a default-constants user can reach.
`TaskAllocation.optimalHours` and `optimalAvgProductivity` are now these
expected quantities (σ = 0: the §3 closed form, unchanged).

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
| 8   | Constants fit          | ridge point estimate                                                   | same MAP + posterior covariance, noise estimate, predictive std                       | Quantify uncertainty; the ridge already _was_ the MAP of this Bayesian model (§5)                                                      |
| 9   | Switch-cost meaning    | unspecified                                                            | documented as attention residue (Leroy 2009), distinct from ramp-up (already in ϕ)    | Prevents future double-counting "fixes"; 0.25h grounded in Mark et al. 2008                                                            |

## 7. Known approximations and deliberate non-changes

- ~~**Naive baselines stay continuous.**~~ **REVERSED:** the naive split is now
  block-quantized like the optimized plan. The old reading ("quantization is
  part of what Zenith imposes") charged the lattice to one side of the
  comparison and made the reported gain negative.
- **The naive baseline is rotation-averaged, not order-free.** The gain's
  dependence on task-list order is removed by averaging over the n cyclic
  rotations. That is EXACTLY permutation-invariant only while no pool binds —
  the objective is a sum of per-task terms, so only each task's marginal
  frequency matters. When a pool binds, the skips are not separable and a
  residue survives.
- **Pooled greedy + ratio candidate + improvement pass + admission move is a
  heuristic** (multi-dimensional knapsack is NP-hard). There is no envelope to
  quote. Single-budget remains exact (σ_ϕ = 0, §4).
- **Forward selection for the n > 12 funded-subset search** now runs only where
  the size-bounded enumeration does not fit, and is exact everywhere else past 12.
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
literature-grounded corrections (§8.1–8.2), a per-task
satiety term (§8.4), and a micro-recovery floor for
full-demand tasks plus optimizer-reliability fixes
(§8.5–8.6). The corrections were driven by an
empirical probe of the old behavior: micro-breaks always
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

Composite Simpson takes 16 nodes per fastest timescale (min of ϕ, 1/ρ) but is
**capped at 1024 nodes**, so at the 0.1 h ϕ floor the node density thins once a
block passes 6.4 h. Under the default constants the smallest ϕ is 0.58 h, where
the cap never binds.

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

`blockOutput` integrates `p(s_resume + u)` over block-local time
`u`; the reservoirs stay indexed by `u` since they carry their own level.
`resumptionTimeConstant ≤ 0` reproduces the old hard reset. Because `p(s)` is
hump-shaped, one decay does double duty: below the peak it prices lost warm-up
(breaks hurt), above it prices boredom relief (a break moves you back toward
the peak).

### 8.3 Verified consequences and a calibration question, closed

The optimizer inserts interior rest on long demanding windows, and a break
placed mid-session _raises_ total output at equal work-hours — the
Jaber–Neumann result the old model could not produce. Fragmentation still
costs, just no longer catastrophically.

Making sustained work efficient made it attractive. At the default
`freeTimeValue = 0.5`, because the leisure term is _linear_ in hours, the
response to `freeTimeValue` is bang-bang. A humane default day needs a
structural change — a concave (diminishing-returns) leisure value or a soft
work-hour cap — not a retuned constant.

**Resolved by §8.4.** The structural change arrived, just on the other side of
the margin: satiety's concave V(O) makes the marginal value of late work hours
_decline_, which is equivalent at the stopping margin to a concave leisure
value. Under the current model (satiety on, §8.5 gate, §8.8 lattice), W\*(λ₀) on
the 12-hour probe day is monotone and **graded** — no longer bang-bang. That
well-posedness is what §8.10's calibration is built on.

### 8.4 Per-task satiety — concave daily value

**The pathology.** The pure total-output objective is winner-take-all:
the optimal plan put 7 h in **two sessions** on one task plus a 1-hour token
block, because a second session on the best task restarts its hump-shaped
`p(s)` near the peak at zero cost — re-running the winner always beats
switching to a weaker task. Two mechanisms were identified; this section
fixes the missing-satiety one. (The other — a full-demand task has reservoir
equilibrium `r′·(1−w)/ρ = 0` because the recovery gate `(1−w)` vanishes at
`w = 1` — is fixed in §8.5; a sublinear _drain_ mapping `w^q` does **not**
fix it, since the zero floor comes from the recovery gate, not the drain.)

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

**Why this form and not the alternatives:**

- **Chosen — concave value on cumulative output.** Lives entirely outside the
  dynamics: warm-up, reservoirs, and the Simpson quadrature are untouched, so
  ϕ keeps its exact meaning (time-to-peak) and §8.2's calibration story is
  unaffected. It turns the winner-take-all plan into one session
  per task; fragmentation stays priced — the same 4 h chopped into 0.5 h slices
  with 0.5 h gaps yields less raw output (a ratio satiety cannot
  move, since it lives outside the dynamics), and the objective still prefers
  contiguous; the plan responds
  _smoothly_ to a demand sweep that flips the unsatiated plan violently
  between opposite winner-take-all corners; introduces no new
  break-then-resume gaming incentive.
- **Rejected — multiplicative decay on cumulative task time,
  `p·e^(−S/κ)`.** Also breaks winner-take-all, and is analytically tidy (for
  contiguous work it stays in the curve family with `k′ = k + 1/κ`), but that
  is exactly the problem: the effective peak moves to `ϕκ/(ϕ+κ)`, so a fitted
  ϕ would no longer mean "time to peak", silently corrupting the shared
  semantics with the classic model. κ is also knife-edgy (2ϕ strong, 4ϕ
  nearly inert).
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

### 8.5 Micro-recovery gate — a positive floor for full-demand tasks

**The residual pathology.** Satiety (§8.4) fixed the winner-take-all task
mix, but a knife-edge remained **exactly at w = 1**: under the pure `(1−w)`
recovery gate a full-demand task has equilibrium `C_eq = r′·(1−w)/ρ = 0`, so
it drains toward literally zero energy with no basal floor.

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

**Why this form and not the alternatives:**

- **Rejected — gate `(1−w^q)`.** Still exactly 0 at `w = 1` for every q: the
  within-session decay of a full-demand task is bit-identical to the pure
  `(1−w)` law it was meant to replace (ρ = α, eq = 0) — not to the shipped one,
  where b = 0.05 gives ρ = α + b·r′. Its only effect is _moving_ mid-range
  equilibria — up for q > 1, down for the sublinear q < 1 — a side effect, not
  a fix.
- **Rejected — clamp `C_eq = max(C_eq, F)`.** Produces the right floor but is
  non-smooth in w, is purely phenomenological, and decouples C_eq from ρ.
- **Chosen — `1−(1−b)·w`.** Smooth and monotone in w, one parameter with a
  physical reading and a literature-anchored default, targeted where the
  problem is, exact opt-out at b = 0. Long full-demand sessions do decay
  _toward_ the floor instead of grinding to zero.

### 8.6 Optimizer reliability — compound moves and drop-one seeds

Steepest ascent only takes single moves that are uphill on their own:

- **Reallocation plateaus:** moving time from task A to task B requires a
  shrink and a grow, each downhill alone. Fix: a **transfer move** (shrink
  block i, grow block j, one candidate).
- **Cold-start slivers:** inserting an unfunded task at step size (0.75 h
  today; 0.25 h when this was written) never pays because of warm-up, even when
  a full session would. Fixes: a **half-block reassign** (hand the second half
  of a block to another task) and a **T\*-session insert** (insert a new task at
  its full single-task optimum length).
- **Unreachable "fund all but X" optima:** dropping a funded task is downhill
  until its hours are redistributed, so those basins need their own starting
  points. Fix: **drop-one classic seeds** (classic seed built without task X,
  for each X).
- The T\*-insert puts totals off the step lattice, so the grow move also
  learned to grow by the sub-step window remainder (with worthless leisure,
  a stranded idle sliver is pure loss). Both were retired by §8.8: the
  T\*-insert is now snapped to the lattice and the remainder-grow is gone.
- **Optima that fund only two tasks:** the seeds above reach funded sets of
  size n (classic, all-in, round-robin) and n − 1 (drop-one), and two
  enumerated frontier days have an optimum funding **two** of their 4 and 5
  tasks — reachable from no seed, because dropping the rest is downhill the
  whole way. Fix: one seed per **pair** among the four highest-amplitude
  tasks, round-robin over the two and searched **within the pair**, i.e. that
  seed's local search may only reach those two tasks.
- **Rest breaks only at the midpoint:** the split-around-rest move offered one
  split point, the rounded midpoint, so a break the optimum takes was
  unreachable, splitting and re-growing being downhill in between. Fix: the
  move yields **every interior lattice split** of the block, one step handed to
  rest at unchanged worked hours.

All fixes are deterministic (the search stays reproducible).

A pair seed starts fragmented and climbs long, so it costs about two ordinary
seeds rather than the fraction of one a 2-task neighbourhood suggests. Cost
does not grow monotonically in n (a wide task list makes the window bind and
the classic seed truncate), so the cap is stated in seeds, not in a task
threshold: at most C(4,2) = 6 seeds, so the family's cost is flat in n
where C(n,2)'s is quadratic. `energy-search-gap.probe.ts` prices the cap
against its neighbours and against both ends — no pair seeds, and unbounded
C(n,2) — and measures what each forfeits. Three call sites pay it —
`EnergyLabStore`'s `$derived` behind the parameter sliders, `plan-audit.ts`
once per audited day under a 30-day cap, and `suggestBudgetCurve`, whose 16
solves per sweep make it the largest single multiplier (on demand, never a
`$derived`).

### 8.7 Drain-rate calibration from end-of-session ratings

**The data signal.** Every other energy parameter was hand-tuned; this adds
the first _measured_ personalization. After working a session on a task, the
user logs a 🪫 rating: session length `H` plus "how drained do you feel now"
for mind and body on a 0–10 scale (a Borg CR10-style category-ratio
instrument). The task's reservoir demands `wc, wp` are captured at logging
time, like E/β on ⚡ flow logs, so later slider edits don't rewrite past
measurements. Ratings are stored **one row per session** in a new IndexedDB
store (`drainObservations`, DB v3): `hours` is that session's `H`, and a
task's hours for a day are the SUM of its rows. Corrections edit the row in
place and keep its log moment, its day and its captured demands — they
rewrite the three numbers the user rated and nothing else; a new log is
always a new session.

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
  λ = 4, the effective "design" here is the sensitivity dD/dα (vanishing as
  w → 0), so λ was tuned in those units.
- **Solver.** D has no closed-form minimizer, so: deterministic 128-point
  grid to bracket the global minimum, then golden-section refinement. The
  bounds equal the Energy Lab's α input range, so a fitted value is always
  representable in the UI; they also play the role of the ϕ fit's absurdity
  guard — wildly inconsistent ratings can at worst pin α to an
  extreme-but-valid drain rate.
- **Posterior.** Noise σ̂² = (ν₀σ₀² + SSR)/(ν₀ + n) with σ₀ = 0.15 (1.5
  notches — self-reported drain is fuzzier than a stopwatch) and
  ν₀ = `CALIBRATION_NOISE_PRIOR_WEIGHT` = 4, shared by all three calibration
  fits (§8.7/§8.9/§8.10); posterior std via the Gauss–Newton/Laplace
  curvature √(σ̂²/(Σ(dD/dα)² + λ)).

  _ν₀ ≠ λ (changes reported stds only, never the MAP)._ The roles are
  unrelated: λ prices how far data moves the MAP, while ν₀ says how much
  prior evidence backs "ratings are at least this noisy". **But ν₀ is a
  blend toward σ₀, not a floor under the ±**, so it cuts both ways: the
  adversarial-pairs case (§8.9), whose residuals are far noisier than σ₀,
  _tightened_.

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
  prior then wins and the fit under-reports extreme drain rates.

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

### 8.8 45-minute plan granularity

**What changed.** The optimizer's plans are now quantized to a 45-minute
lattice: every block is a whole number of 0.75 h units (`DEFAULT_STEP_HOURS`;
`stepHours` still overrides for probes). Before this the search _moved_ in
0.25 h steps but two moves deliberately left the grid — the T\*-session
insert (1.79ϕ, an arbitrary real) and the sub-step remainder-grow — so plans
came out as "Guitar 3.19 h": mathematically optimal, humanly unschedulable,
and more precise than 0–10 slider inputs can justify.

**How the invariant holds.** Inductively: seeds are built on the lattice
(the all-in and classic seeds use the lattice-floor of the window), T\*
sessions are snapped to the nearest whole step (floored at one step), a block
is cut only at a whole-step point (the half-reassign rounds an odd step count
to larger/smaller whole-step shares; the split-around-rest takes any interior
step and adds one), insert room is the lattice-floor of the remaining window,
and every other move adds or removes exactly one step. `normalizeSchedule`'s
window clip therefore never fires (lattice totals never exceed the
lattice-floored window), and merging preserves multiples.

**Deliberately different from the classic model's 15-min blocks.** The
classic allocator (§4) keeps `BLOCK_HOURS = 0.25`: its blocks are an
_accounting_ unit for an exact greedy over a single number per task, where
finer quantization only helps. The energy optimizer's step is a _scheduling_
unit — its output is an ordered day a human executes, where 45 min is the
plausible granularity of real sessions and breaks. Do not unify them:
shrinking this lattice re-opens the rest-confetti degeneracy, and
coarsening the classic blocks would throw away exactness for nothing.

**The window tail.** A window that is not a multiple of 45 min (e.g. 8 h =
10 units + 30 min) leaves its sub-step remainder as free time — it is not
schedulable at this granularity by definition, and the objective already
values it at λ₀ per hour plus terminal energy. The old remainder-grow move
(which existed only because T\*-inserts broke the lattice) is gone; with
`freeTimeValue = 0` up to one step minus ε can now idle, which is the honest
price of quantization rather than a regression.

### 8.9 Recovery-rate calibration from pre/post-rest pairs

**Why this closes §8.7's open loop.** The α fit conditions on the current
`recoveryRate`; if the hand-set 0.7 is wrong, α silently bends to compensate,
and every plan's rest lengths inherit the error. §8.7 already named the missing
instrument: pre/post-REST rating pairs. This section builds it.

**The data signal.** Around a break, the user logs a ☕ pair: break length
`g` plus mind and body drain ratings (0–10) going **in** and coming **out**.
Stored in a new IndexedDB store (`restObservations`, DB v4). Like drain
ratings these append one row per logged event; unlike them there is no
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
`m` and r absorbs the data. Pairs with `d_before = 0` (nothing to recover) or
`g = 0` (no time to recover in) are dropped — the prediction is constant in r,
and keeping them would only pollute σ̂². A pair that reports MORE drain after
resting fits no r ≥ 0; it pushes the estimate toward the lower bound and
honestly widens the posterior std.

**The fit.** Identical machinery to §8.7 (the 1-D minimizer is now shared
code): ridge MAP toward the DEFAULT r with
`RECOVERY_PRIOR_STRENGTH = 0.05`, bounds = the UI input range [0.1, 3],
noise prior `RECOVERY_NOISE_PRIOR_STD = 0.21` (a residual compares TWO fuzzy
ratings, so the single-rating floor 0.15 is widened by √2), Laplace posterior
std from the Gauss–Newton curvature.

**UI.** A second calibration card ("Recovery Calibration") mirrors the drain
card: ☕ inline pair editor (minutes + before/after Mind/Body), fitted
r ± std with rating count, explicit "Apply fitted rate" button (lab params
stay user-owned — same deliberate UX as §8.7), collapsible pair list with
per-pair delete and two-step reset.

### 8.10 Stopping-value calibration from observed stop times

**The last hand-set stopping knob gets a fit path.** `freeTimeValue` (λ₀) and
`terminalEnergyValue` (V_T) are the entire stopping mechanism of the energy
model, and until now both were pure priors. Observable data exists: the 🪫
drain logs already record worked minutes per task per day, so a finished day
reveals _when the user actually stopped_ versus their declared window — a
revealed-preference measurement of what an hour of leisure is worth to them.
No new logging instrument is needed.

**Feasibility.** Three findings gate the design:

1. **The inversion is well-posed** — but only since satiety. §8.3's
   bang-bang warning predates §8.4; today W\*(λ₀) is monotone and graded
   (see the §8.3 update note), so distinct stop times map back to distinct
   λ₀ ranges.
2. **λ₀ dominates, but V_T is not free.** The fit targets λ₀ alone and
   **conditions on** the user-owned V_T — a slider left far from the truth is a
   real unfitted error source, not a negligible one — completing the
   conditioning chain: r is fitted α-free (§8.9), α conditions on r (§8.7),
   λ₀ conditions on everything (α, r, m, b, satietyScale, V_T). Calibrate
   recovery and drain first; this fit inherits their quality.
3. **Naive inverse optimization is too slow.** Fitting by re-running the
   optimizer over a λ₀ grid costs ~60 ms per run — seconds per fit, and the fit
   must re-derive on every conditioning-slider change. Rejected.

**The estimator: discrete stationarity of the user's own day.** The work-side
value `V(schedule) = satiatedOutput + terminalBonus` never contains λ₀
(leisure enters the objective only through `freeTimeBonus`), so marginals of
V are λ₀-free — no circularity with the current slider. A rational stop at
worked hours W on the 45-min lattice means, per task t:

```text
stopped  ⇒  λ₀ ≥ max_t Δ(one more step on t)/step     =: lo
worked   ⇒  λ₀ ≤ max_t Δ(last step of t)/step         =: hi
```

The first max runs over the day's still-OPEN tasks — declining to extend a
logged task and declining to _start_ an unlogged one are both part of the
stop decision, but a task already **checked off** is not: there was no more
of it to do, so it is no forgone step. Completed tasks keep their hours in the
reconstruction on both sides — they drained the reservoirs the open ones would
have worked with. The second max runs over tasks with ≥ 1 whole step logged,
completed or not — that work WAS done, so it was worth ≥ λ₀: the work order is
unobserved, so "some worked step was worth ≥ λ₀" gives the loose max as the
honest bound. The day's **indifference point** is the bracket midpoint
`(max(0, lo) + hi)/2`; each bound costs one `evaluateSchedule` call, ~2n+1 per
day, no optimizer runs. `lo` is a max over the open set and `hi` never reads
it, so narrowing the set can only lower the point, and — since the censor
fires on `max(0, lo) > hi + margin` — can only **un**-censor.

**Why the reference schedule is the observed per-task hours.** The bracket
needs a schedule representing the user's day; by the envelope theorem the
marginal should be taken along the best-arrangement-at-W, which we cannot
know. Candidates:

- **Chosen — the day as its own 🪫 rows record it.** One session per ROW, in
  the order the rows were logged, with the space between one row's start and
  the previous row's end as rest: `startedAt = endedAt − hours`,
  `gap = max(0, startedAt − previous endedAt)`. Composition, order AND breaks
  are all read rather than invented. An UNLOGGED task probed on the `lo` side
  is inserted at its own canonical rank among the work blocks, not appended
  last.
  - **The fallback, on one predicate per DAY:** does every row carry a usable
    finite moment, and do the deltas recover any gap at all? If not — a row from
    a hand-edited or restored backup, or a day whose sessions were all written
    down at once — the day reads as **one contiguous session per logged task in
    canonical amplitude order, breaks omitted**.
  - **Rejected as the source — re-solving the day's plan at fit time.**
    `plan-audit.ts` already does it per finished day, and it works. It is
    disqualified by this section's own feasibility finding 3:
    `EnergyLabStore.#stoppingFit` is a `$derived` over ALL finished days with
    no day cap. It is also sparse — a `fitSnapshot` exists only for days the
    user opened Analytics on — and the plan is a proxy for the worked day, not
    the worked day.
- **Rejected — classic seed truncated to W** (each task at snapped T\*,
  best-first): invents the composition; over-weights the high-amplitude
  full-demand task.
- **Rejected — λ₀ = 0 max-work plan truncated to W:** erratic; truncating a
  max-work day leaves a composition no λ₀-rational user would have chosen at
  W, exactly the envelope error predicted.

**Two gaps deliberately left open.** The reconstruction still ENDS at the last
logged session, so the live advisor prices "now" as that moment and misses the
recovery since; closing it needs a `now` the model does not take, which would
make `adviseStop` clock-dependent. And the day's START is still unrepresented —
`evaluateSchedule` begins at t = 0, so a day that began three hours into its
window reads as starting at the edge.

**Censoring.** A day worked to the window edge has no forgone step — it
reveals only `λ₀ ≤ hi`, not an indifference. Symmetrically a zero-work day
reveals only `λ₀ ≥ lo`, and sub-step sessions give no shrink side. A fourth
category: a bracket inverted beyond `STOP_INVERSION_MARGIN` — the day's own
data contradicts a rational stop, so only the one-sided `λ₀ ≤ hi` reading
survives. A fifth: a day that ends with every task checked off has no forgone
step either — the `lo` side has nothing to maximize over, so it reveals
`λ₀ ≤ hi` and nothing more, the same shape as working to the window edge. All
five are dropped, like demand-0 drain logs (§8.7): keeping a one-sided reading
as a point estimate would bias the mean. `stopBracket` returns the two sides
and `stopIndifferencePoint` is its midpoint, so which side a censored day
revealed is readable without rebuilding the bracket.

**The censored likelihood was built and refused.** A Tobit-style one-sided
term — `−log Φ((hiᵢ − λ)/σ₀)` for an upper bound, `−log Φ((λ − loᵢ)/σ₀)` for a
lower, σ fixed at σ₀, bisected on `J′`, scaled so a history with nothing
censored reproduces the closed form bit for bit — was implemented and scored
against the shipped drop-censored fit. The censored likelihood is a settled no
and all five categories stay dropped. The bounds these days reveal are either
loose (window edge, everything ticked) or false (sliver), and no estimator
consuming them fixes that.

**The fit** (`fitStoppingValue`): treat each day's indifference point mᵢ as
`λ₀ + noise`. The prediction is the _identity_, so the §8.7/§8.9 ridge
machinery collapses to an exact closed form — no numeric minimizer:

```text
λ̂₀ = (Σ mᵢ + λ·λ₀_default)/(n + λ),   λ = STOP_PRIOR_STRENGTH = 1
```

- **Prior strength is exact arithmetic here** (sensitivity ≡ 1 per day):
  one day moves λ₀ 50% of the way to its point, three 75%, ten 91%.
- **Noise/posterior:** σ₀ = `STOP_NOISE_PRIOR_STD` = 0.25 in λ₀ units (the
  lattice bracket's half-width plus day-to-day mood in the stop decision,
  which no instrument separates); σ̂² blends σ₀ with residual scatter as in
  §8.7; posterior std = √(σ̂²/(n + λ)).
- **That posterior std is WITHIN-MODEL, and cannot see the conditioning it was
  read under.** It prices how the day points scatter around the fit — and every
  point was read under the same (α, r, ϕ-plane, V_T), so a mis-set slider is
  COMMON-MODE: it slides the whole history one way and the i.i.d.-days
  arithmetic never widens for it. The ± is not wrong; it is answering a
  narrower question than it looks like it is answering.
- **Bounds** = the Energy Lab's freeTimeValue input range [0, 3], same
  representability/absurdity-guard role as the α and r bounds.

**Known approximations (deliberate).**

- **The reconstruction reads the LOG moment, not the session end.** A user who
  finishes at 15:00 and writes the rating down at 15:40 hands the estimator a
  40-minute-shorter break than they took, which understates recovery.
  Over-estimating a break saturates harmlessly; under-estimating costs roughly
  linearly.
- **Wall-clock moments cross DST changes and device clock adjustments.** A
  negative delta floors at 0, so the two sessions read as adjacent — today's
  behaviour. An absurd positive one consumes the whole rest budget and flattens
  the day's real breaks to nothing through the proportional scale.
- **A day that ran out of wall clock is CENSORED.** The class is the day whose
  own **span** — worked hours plus the breaks recovered from its own log
  moments, before the cap below — leaves no room for another step. Such a day
  did not stop because leisure got cheap; it stopped because the clock ended,
  so it reveals no indifference and `stopBracket` returns null on it.
- **Recovered rest is still capped to leave one step of room, and that cap
  only bites on days the fit has already censored.** `scale < 1` means
  `worked + rest > W − step`, which is exactly the class above, so every day
  that reaches the fit is read with its breaks UNSCALED. The cap survives for
  §8.11, which applies no censor and must still hand `normalizeSchedule` a
  schedule that fits. On the fallback path (a batch-logged day, or one whose
  moments are unusable) there is no span to read, so no day is censored for the
  clock.
- **Partial logging under-counts W.** A user who rates only some tasks
  looks like they stopped earlier than they did, biasing λ₀ up. Accepted:
  the calibration is for users who log consistently, and σ₀ is wide.
- **The hours the day was COMPELLED to work read as a leisure choice, and the
  bias that buys is DOWNWARD.** The estimator's
  whole premise is that the stop was chosen; a deadline day breaks it, and the
  model has no term for obligation (`mustDoToday` promises the day, not the
  hours, and never reaches `toEnergyTask`). A forced grind past the rational
  stop depletes the reservoirs, so the next step and the last worked step are
  both worth almost nothing, and "still working when work was nearly worthless"
  reads as leisure being nearly worthless — a λ₀ biased low, which then plans
  MORE work. Stopping early because the duty got finished is the mirror case and
  costs variance rather than bias. No censor is AIMED at it: a compelled day that
  drops, drops on the clock because the extra work overran the window, almost
  never on inversion and never on the fifth category — so censoring costs the
  fit days without protecting it (measured, same probe).
  **Both available repairs were measured and lose to shipping nothing**
  (`scripts/stop-obligation-bias.probe.ts`): pricing neither bracket side
  against the pinned task recovers part of the grind's bias but damages the
  honest day, which is the majority, and censoring a day that worked a pinned
  task whole leaves consistent users with no fit at all. So the reading stays
  as-is, `mustDoToday` stays out of the model, and the contamination is stated
  rather than filtered — it scales with the share of days that are compelled,
  and the Stopping Calibration card names the premise so a user who grinds on
  deadlines can see why their leisure reads cheap. Do not re-open without a
  repair that leaves the honest day intact.
- **The 🪫 RATING never enters this fit directly — only α does.** λ₀ reads worked
  minutes, log moments, the checkbox and the window; the ratings reach it as the
  α they fit (§8.7), so a rating inflated by deadline stress moves λ₀ through
  the conditioning chain, down, at the same order as the grind above (same
  probe). This is the concrete cost of feasibility 2's "this fit inherits their
  quality", and `valueStd` cannot see it: every day is read under the same α.
- **The checkbox is the only scope the model has.** Tasks carry effort, not
  an amount of work: an open task is bottomless, satiety being the only
  thing that flattens it. So the `lo` side still asks "was another 45 min of
  this worth it?" of a task with 20 minutes of real work left, and a
  finished-but-unticked task reads as forgone work. The rest stays noise, in
  the same upward direction as partial logging.
- **The loose max on the `hi` side** biases midpoints up. "The work order
  is unobserved" is false on a timestamped day, so the loose max is a
  deliberate looseness rather than a forced one — the honest `hi` (the last
  row's own last step) is available.
- **Block ORDER is OBSERVED on a timestamped day, and a modeling choice only on
  the fallback path.** The marginals genuinely depend on order through the
  reservoirs, and canonical placement is what made the estimator a function of
  the day rather than of an implementation convention. It is still the rule for
  the day's fallback reading and for where an UNLOGGED task's probe block
  lands.
- **Inverted brackets beyond a margin are censored; small inversions keep
  their midpoint.** The two revealed inequalities can contradict: `lo > hi`
  means extending some task was worth MORE per step than the most valuable step
  actually worked — no λ₀ rationalizes such a day (typical cases: a session cut
  short mid-warm-up, or a long grind on a weak, satiating task while a
  high-amplitude task sat unstarted). Inversion remains a useful DETECTOR but
  it is a noisy one, not a clean partition. A day past the margin is therefore
  treated as a stop that was not a leisure choice (interruption, sickness,
  deadline elsewhere), and such a day's midpoint is NOT centered on the user's
  λ₀: it lands at the task curves' characteristic marginal regardless of the
  true value — systematic shrinkage toward curve scale, which the symmetric
  σ₀ = 0.25 residual model cannot absorb. The day therefore degrades to its
  one-sided reading `λ₀ ≤ hi` and is dropped by the same principle as the other
  censored categories. The margin (`STOP_INVERSION_MARGIN = 0.25`) answers the
  over-censoring concern: a day has to contradict itself by more than the
  instrument's own slack before it is discarded.

**UI.** A third calibration card ("Stopping Calibration") follows §8.7/§8.9's
pattern — fitted λ₀ ± std with used-day count and an explicit **Apply**
button — but needs no editor of its own: its observations are derived from
already-logged 🪫 drain ratings joined with each day's stored session
(tasks + window), excluding today (an unfinished day has not revealed its
stop yet). The card also carries a line naming how many days the clock censor
dropped (`clockCensoredCount`) — "3 days ran out of clock, so their stops are
not counted" — so a used-day count that fell has a stated reason on screen. Its
hint states the PREMISE too — that a day's hours are read as chosen, so hours
you had to work read as cheap leisure — because that error is unfiltered by
design (the obligation bullet above) and the card is the only place a user can
be told.

**Visibility.** All fitted values also surface read-only on the Analytics page
("Your model" card): each parameter next to its default and the fit's own
used-observation count — ϕ for a mid-scale reference task (difficulty 5,
enjoyment 5, so the fitted c-plane reads as one number), r ± std,
α_cog/α_phys ± std, λ₀ ± std. The snapshot runs the full conditioning chain on
the logs dated before today (ϕ from ⚡, r from ☕, α given r from 🪫; λ₀ given
everything from finished days, which excludes today for the reason the UI
paragraph above gives) — the same fits the planners and Burnout Risk consume;
the card changes no state, calibration stays in the Energy Lab (α, r, λ₀) and ⚡
logging (ϕ).

### 8.11 Live stop advisor — §8.10 run forward mid-day

**The question inverted.** §8.10 reads a _finished_ day's stop to learn λ₀;
the advisor takes the fitted (or hand-set) λ₀ and answers the in-day
question: _given the work logged so far, is more work still worth it — and on
what?_ Same instrument both ways: today's 🪫 drain logs are the day so far,
reconstructed exactly as §8.10 will reconstruct them once the day is
finished — one block per logged SESSION, in the order the rows were logged, with
the space between them as rest, read off the rows' own `createdAt` (§8.10;
a day whose rows carry no usable moment falls back to one contiguous block per
task in canonical order) — and priced by the same λ₀-free work value
`V = satiatedOutput + terminalBonus`. No new parameters, no new logging
instrument.

**This is the more exposed of the two readings, and it still censors
nothing.** §8.10 drops a day whose bracket inverts past
`STOP_INVERSION_MARGIN`; the advisor reads the same reconstruction and refuses
no day at all. That asymmetry is deliberate, and it follows from what an
inversion MEANS on each side of the day.

Retrospectively, `lo > hi` is a contradiction: the user declined a step worth
more than the best step they actually worked, so no λ₀ rationalizes the stop
and the day's indifference point is contaminated evidence about a parameter.
Run forward, the same inequality carries no contradiction, because there is no
stop yet to rationalize. It says only that the best available next step beats
the best step already logged — the ordinary state of a day with good work left
in it, and precisely the condition under which `continue` is the right verdict.
The censor's premise does not survive the change of direction.

The two readings also differ in what refusal costs. §8.10 censors to keep a
contaminated point out of a MEAN, and a mean over the remaining days is still
an estimate; the advisor produces a verdict for a person, and has no mean to
protect. Withholding is not abstention there — it is silence at the moment the
card exists for. So the censor would have to buy a measured reduction in wrong
verdicts to be worth carrying, which is an empirical question rather than a
derivable one: `stop-advisor.probe.ts` prices it.

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
when λ₀ is high.

The duration axis is the optimizer's own move shape (grow, T\*-session
insert), which is why at-stop agreement survives the stronger test: at a
rational stop no session of any length clears λ₀, so maxing over durations
does not push the user past it.

**Candidates vs reconstruction.** The max runs over the OPEN tasks only
(`openTaskIds` on the observation, the unchecked ones): "one more session
of a task you already checked off" is no advice. Every logged task stays in
the reconstruction regardless — a completed task's hours drained the
reservoirs the open ones must work with. §8.10's `lo` bound reads the same
field, for the same reason.

**Bounds of validity, stated on the card's tooltip:** the reading trusts
today's 🪫 logs, so unlogged work reads as free time (the advisor will say
"continue" too eagerly) and batch-logged sessions blur it — same
partial-logging caveat as §8.10, now visible in-day. Rows written down at one
moment recover no gap, so the day reconstructs as the summed reading and the
break correction does not apply to it. The advice is no worse than it was; it
is just not better, and the card cannot tell the user which kind of day it
read.

**One bound is specific to the forward reading:** `growBy` places the probed
session at the candidate's CANONICAL rank among the work blocks — before any
rest that followed the last lower-ranked one — so a candidate that outranks the
logged work is priced AHEAD of it, on fresher reservoirs with an intact warm-up,
which can only over-price `continue`. Appending does not measurably help.
A logged task's session is a separate matter
and always grows at the LAST of its blocks — the day continues from where it
stopped. Verdicts: `continue` / `stop` (strictly: continue iff best session > λ₀,
so exact indifference reads as stop, matching §8.10's `stopped ⇒ λ₀ ≥ lo`), plus
`window-full` when no whole 45-min step fits in what remains of the window —
logged hours filled it, or the window is smaller than one step — and no verdict
at all when there is no window, no tasks, or nothing left unchecked.

**Implementation sharing (R3).** `reconstructStopDay` + `growBy` are one
definition used by both readings; `stopBracket`'s `lo` is `bestNextStep`, the
m = 1 slice of the advisor's search (and `stopIndifferencePoint` is that
bracket's midpoint). The fit itself is untouched — its bracket stays one-step,
because discrete stationarity of an observed stop is a statement about the
marginal step, not about hypothetical sessions.

Three things the shared definition needed once a day could hold more than one
block per task:

- **`growBy` and the `hi`-side shrink each targeted EVERY block of the task.**
  Growing added a step to each and shrinking removed a step from each, so a task
  logged in two sessions would have been priced two steps for one step's money.
  Both now work from the END of that task's work — grow extends its last block,
  shrink walks back across its blocks, which also handles a final session shorter
  than one step (two half-hour rows are an ordinary day).
- **`growBy`'s insertion index counted blocks that have no rank.** `rank` holds
  work tasks only, `rank.get(null)` is `undefined`, and `undefined < n` is
  silently `false` — so rest blocks escaped the count while the index sliced a
  schedule that contained them, and an unlogged candidate landed at the wrong
  place. It now counts WORK blocks of lower rank and then walks to that work
  block's index.
- **A grown schedule used to pay its overhang out of the day's last rest
  (`trimRest`).** While `adviseStop` probed m = 1 … room with
  `room = floor((W − worked)/step)`, the grown extent worked + breaks + m·step
  could exceed W for m ≥ 2, and `normalizeSchedule`'s
  `Math.min(b.hours, windowHours − used)` would silently CLIP the probed session
  — pricing a long session on less work than it asked for, which biases toward
  `stop` exactly where the session lookahead is the whole point. The session cap
  below removes the case: a session that fits the clock the day has left cannot
  overhang the window, so the trim became unreachable and went with it. If the
  cap is ever loosened, this defect comes back and the trim has to come back
  with it.

**The two window questions are answered differently, and that is the ruling.**
The `window-full` GATE reads WORKED hours: a verdict must not be decided by
recovered structure — moving the room test to the day's full extent would say
`window-full` to a user with hours left. The session LENGTHS priced past that
gate read the day's **span** (worked hours plus its UNCAPPED recovered breaks):

```text
longest = max(1, min(room, floor((W − span)/step)))
```

floored at one step, so a day already past its window is still advised on — the
last checkpoint of the day is the one a user reads to decide whether to keep
going, and blanking it is worse than naming the smallest session there is.

### 8.12 The budget curve — what the day's LENGTH is worth

**The question.** Every other model input is a measurement of the user. The day
window is not: it is the one number that is a choice about _today_, and
`/energy` had no instrument for it at all — the Lab prices when to stop within a
given window (§8.11) and never how long the window should be.

**Two obvious objectives, both ill-posed.**

- **Maximizing `valueVsClassic` picks a median 2.25 h day.** The argmax is a
  property of the **rival**, not of the day: the classic allocator reserves
  `(m−1)·switchCost` out of the budget and spreads across tasks, so a tiny
  window is where it is worst and the ratio peaks there.
- **Maximizing `objective` picks the top of the range.** It pays λ₀ for every
  free hour _inside_ the window, so it rises with the window whatever the day
  contains. This is the same monotonicity that keeps the `budget + 1` lever
  deliberately **unpriced** (`isPriced` in `plan-advice.ts`); the Lab differs
  only in having a λ₀ to charge against.

**The definition that shipped.** One `optimizeSchedule` per budget on the §8.8
lattice, each plan re-scored on a **common horizon** `W = maxBudgetHours`:

```text
lattice     = {0, step, 2·step, …}, up to the largest multiple of step ≤ W
dayValue(0) = evaluateSchedule([], tasks, W, params).objective        -- the do-nothing day
dayValue(b) = runningMax over 0 ≤ b' ≤ b of
              evaluateSchedule(plan(b').blocks, tasks, W, params).objective
valuePerHour(b) = slope at b of the concave majorant of dayValue over the lattice
recommendedHours = smallest b > 0 maximizing dayValue, or null when that is the
                   TOP OF THE LATTICE, or null when no b beats dayValue(0)
```

The common horizon is the whole trick, and it changes no formula: on one
horizon the free-time term is `λ₀·(W − work)` — a constant, minus λ₀ per hour of
**work** — so an hour left free inside the window and the same hour outside it
are worth the same and cancel, leaving only committed work charged. The
terminal term is likewise read at the same clock time for every budget. It is
`objective` throughout: nothing is scored on a field the optimizer was not
aiming at.

**Everything is read against the do-nothing day,** `dayValue(0)`: the same score
on the same horizon with an empty schedule. It costs no solve — at budget 0 the
plan is empty by definition — and it buys the two things the sweep cannot state
without it. The shortest window swept gets a real marginal instead of a zero
standing in for a missing predecessor; and "no budget is worth working" becomes
expressible, where a sweep seeded from `-Infinity` at `step` has to invent an
answer — its first budget always improves on nothing, so it recommends one step
of window with no work on it.

**`valuePerHour` is therefore NET of λ₀, and its break-even is zero.** The
free-time term above is already inside `dayValue`, so the free time an extra hour
of window costs is charged before the difference is taken. Break-even is `0` — the
card plots it against a **zero** baseline and reports λ₀ as a price in words.
Reading this curve against a λ₀ **line** would charge λ₀ twice.

**Why the marginal is a hull slope and not a step difference.** `plan(b)` books
whole §8.8 steps, so `dayValue` is a **staircase**: a 45-minute step of window
either does or does not seat another block, and between the two it is flat. Its
raw difference is therefore a spike train, not a marginal — it returns to zero
wherever a step failed to seat work and then climbs back out.

`valuePerHour` is instead the slope of the **concave majorant** of `dayValue` —
the least concave function lying above it at every lattice point, computed as a
monotone-chain upper hull in `concaveMajorantSlopes`. The raw difference answers
"did _this_ 45 minutes happen to seat a block", which is a question about the
lattice; the hull slope answers the one the card asks — over the stretch of
window the lattice needed in order to seat more work, what did an hour buy on
average. Formally it is the standard concavification: the majorant is the value
of the best **mixture** of day lengths averaging `b`, which is the right object
when the reader is choosing a habitual window rather than a single day.

Three properties follow, and the card's copy rests on all three:

- **Non-increasing** by construction, so "it never rises as the window grows" is
  a true sentence.
- **The last budget still above zero is exactly `recommendedHours`**, and the
  first zero is `recommendedHours + step`. Note it is _not_ zero **at** the
  knee: `knee` is set only where the running max rose, so
  `valuePerHour(recommendedHours) > 0` always. This is where the do-nothing
  baseline earns itself a second time — hulled from `step` instead, the first
  swept budget has no predecessor and its slope is a forced 0, so a knee landing
  there would break the invariant on a day that is otherwise perfectly
  well-posed. The copy therefore names the last positive step, never "where it
  reaches zero".
- **It invents nothing.** The slopes telescope to
  `dayValue(last) − dayValue(0)` — the hull only redistributes gain across the
  steps the block lattice lumped it into.

**Why not `objective − λ₀·budget`,** the same idea applied to each point's own
window: the terminal term is valued after the trailing implicit rest, so a
longer window recovers more reservoir before it is priced and the reading climbs
on days that got no better. Pricing the terminal term at `workEnd*` instead
removes it but scores a field the optimizer never saw. The common horizon gets
the same behaviour honestly.

**Why the running max.** The true optimum is monotone in the budget — every plan
feasible at `b` is feasible at `b + ε` — but `plan(b)` maximizes `objective` at
its OWN window rather than this score, so the sweep is not a sup over a nested
family and can dip. The two criteria differ only by the trailing-recovery term,
which bounds the disagreement in practice.

**The recommendation is usually absent, and that is the reading.** Satiety is
per-task (§8.4), so there is always another fresh task to move to; a
**one-task** day satiates and does reach break-even. Both branches
are reachable at the default; the multi-task one is simply the common one. A
null is not a failure to report: it says the model would use every hour offered,
because free time is priced at a default the user has not corrected. The card
says so and names the §8.10 stopping calibration, which fits λ₀ from how the
user's own days actually end — so the one parameter that sets day length is also
the one the Lab already knows how to learn.

**Two nulls, opposite readings.** `recommendedHours === null` is either "the sweep
ran out before the model did" or "no window was worth working at this λ₀", and the
copy for one is the exact inverse of the truth for the other — "it would use every
hour you give it" is precisely wrong on a day the model declines to work at all.
The curve tells them apart without a second field: the second books **zero work at
every budget**, so its whole `valuePerHour` series sits at 0. The card branches on
that and the chart drops the "the last window above zero is the suggested one"
clause from its `aria-label` on both nulls, since on neither is there a suggested
window to find. The second branch is not a corner case: it is the λ₀ ≥ 1.5 end of
§8.3's ladder (12 h → 12 → 9.75 → 6 → 4.5 → **0**), reachable from the slider
and from §8.10's fit, and "don't work today" is a real answer at that price.

**Does it contradict the stop advisor (§8.11)?** They sit on the same page and
price different marginals — the advisor asks what WORKING the next session is
worth with the window held fixed, the curve asks what LENGTHENING the window is
worth with the optimizer free to re-solve — so the two could disagree in
principle. The agreement is not forced by construction — it is what §8.11's
λ₀ break-even and §8.12's zero break-even both being net of the same λ₀ buys.

**`BUDGET_CURVE_MAX_HOURS = 12`** caps the sweep. A knee beyond it is reported
as no recommendation rather than as 12 h — the sweep ran out before the model
did, which is a different statement — and the copy names the cap, so the bound
is never silent (AGENTS.md §4). The same rule covers the reader's own
window when it sits _above_ the cap: the chart cannot draw its locator there, and
clamping it to the right edge would claim it stands at 12 h, so the legend names
the window and the cap in words instead of quietly dropping the marker.

The cap tops the sweep; the LATTICE tops out at the last multiple of the step at
or below it, so the two coincide at the default (12 h is 16 steps) and part
whenever the cap is not a whole number of steps. The knee is compared against the
lattice: compared against the cap, a day still climbing when the sweep ran out
gets its last swept budget recommended instead, which is the one statement that
null exists to prevent.

**Cost.** 16 solves at the default cap — the do-nothing point makes 17 budgets,
not 17 solves. Each is one `optimizeSchedule`, priced by
`energy-search-gap.probe.ts` rather than a second copy of one cell here. It therefore lives behind an explicit click
in `EnergyLabStore.computeBudgetCurve`, on `suggestPlanAdjustments`' on-demand
contract, and is deliberately **not** a `$derived`. Its staleness fingerprint
omits the budget on purpose: the curve is a statement about _every_ budget, so
dragging the window must not grey out the card that exists to inform that drag.
It omits the task **titles** for the narrower reason that the sweep never reads
them and no field of `BudgetCurve` carries one, so a rename would otherwise grey
out a bit-identical curve.

### 8.13 Capacity from the fitted drain rate

**The question.** A day's capacity pools are two declared numbers — how many
demand-weighted hours of mind and of body work the day can hold (§0's
`Σ wᵢ·tᵢ ≤ pool`). They were invented: `DEFAULT_CAPACITY_POOLS` = 4 h / 6 h.
But §8.7 already fits a per-user drain rate α from the 🪫 logs, and the same
reservoir law that reads a rating can be read backwards: a pool is the length
of a full-demand day, so it is the H at which the reservoir arrives at a
stated floor.

**The map.** Take §8.7's law at full demand `w = 1`. The recovery gate
collapses to the micro-recovery fraction, `g = 1 − (1−b)·1 = b`, so with
`r′ = r·m`

```text
ρ = α + r′·b,   C_eq = r′·b/ρ,   C(H) = C_eq + (1 − C_eq)·e^(−ρH)
```

Setting `C(H) = C*` and solving for H:

```text
H = −ln((C* − C_eq)/(1 − C_eq)) / ρ
```

That is `capacityFromDrainRate`. One floor plus one **fitted** parameter
replaces two invented constants, and the floor is stated once here rather than
fitted per user: choosing C* to maximize plan adherence would train the map
on the only instrument that can audit it.

**Why C\* = 0.28.** It sits between the two readings the old constants imply at
default α — the cognitive reservoir at 4 h and the physical one at 6 h — so at
defaults the map reproduces roughly the pools the app already had. It is a
statement about where a day ends, not a measurement, and it applies to both
reservoirs because nothing in the law distinguishes them but α.

**The domain is a gate, not a clamp.** `C_eq` rises as α falls, and where it
reaches C* the logarithm's argument reaches zero and H diverges. Solving
`r′·b/(α + r′·b) = C*` puts that pole at

```text
α_pole = r′·b·(1 − C*)/C*
```

which is **not a fixed drain rate**: it moves with the recovery parameters the
map conditions on, so a constant α floor would bound H at one r and let it
diverge at another. The gate is therefore a MULTIPLE of the params' own pole —
`CAPACITY_MAP_POLE_MARGIN` = 1.5 — which bounds the largest pool the map can
return at **every** r rather than only at the default one. The bound is not the
same number at each r, since the pole it is measured from moves. The
neighbourhood above the pole is
what the margin exists for: H grows without bound as the pole is approached, so
a small fit error there moves the pool by hours, and `ALPHA_FIT_MIN` = 0.05 is
inside that region at the default parameters, where a real fit can land.

Out of domain the map returns nothing: clamping α to the gate would return a
finite, plausible-looking pool that is not this user's, and a wrong pool is
spent silently by the planner while a missing one is visibly missing. One gate
covers both sides of the pole — the recovery sliders alone can put `C_eq` at or
above C*, where the day's equilibrium never falls to the floor and no H solves
the equation at all, and that α is below the margin by construction.

**Monotone.** H is decreasing in α over the valid domain: a larger drain rate
empties the reservoir sooner, so it buys a smaller pool. The map therefore
inherits whatever bias §8.7's α̂ carries, with the sign flipped;
`capacity-from-drain.probe.ts` is where that is measured.

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
