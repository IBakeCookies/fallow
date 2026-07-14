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

Series `f ≈ x²/2 − x³/3`, `g ≈ x − x²/2` are used below `x < 10⁻⁴` to avoid
catastrophic cancellation.

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

Why: **the point estimate the allocator consumes is unchanged** (no behavior
change from v1 fits), but a 2-log fit and a 200-log fit are no longer
indistinguishable — `phiPredictionStd` quantifies it (parameter uncertainty
shrinks with data and grows with distance from the logged region). Intended
uses: UI bands ("ϕ ≈ 1.4h ± 0.4h") and future robust allocation. The
forgetting factor is for users whose flow behavior drifts (recursive-least-
squares style; γ ≈ 0.98 ≙ ~34-log half-life, since 0.98³⁴ ≈ 0.5 — the
"~50-log" figure in an earlier revision was the 1/e time constant,
0.98⁵⁰ ≈ 0.37; see §10).

Unchanged v1 safeguards: fallback to defaults on zero observations or when
the fitted plane predicts ϕ > 16h anywhere on the domain; negative
predictions at unobserved corners are allowed (fast-flow users legitimately
tilt the plane) and absorbed by the 0.1h floor.

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
