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
tests. Not all of them: a claim that is a sweep rather than a fixture is backed
by a probe under `scripts/` instead, cited and dated beside the claim (see
`AGENTS.md` §4). A number with neither is unbacked — that is the list to work
down.

---

<!-- section-index:start -->

## Section index

Read a section, not the file: `Read MATH.md offset=<first line> limit=<span>`.
The whole document is ~64k tokens; the largest single section is §8 at ~13k
(§14 is ~10k), and most of the 88 rows below are under 2k. Ranges shift
whenever a section is inserted, and the table has alignment and truncation rules
that are not evident from reading it — so never retype a row, regenerate:

    node scripts/math-index.mjs

`npm run lint` runs it with `--check`, so a stale index fails the build.

```text
§0          136-155  Objective
§1          157-186  Inputs and parameter mappings (unchanged from the articl…
§2          188-305  Productivity curve — v2 change
§3          307-379  Optimal stopping — v2 change: per-task, no longer a univ…
§4          381-482  Allocation — v2 change: discrete blocks, exact greedy, e…
§5          484-817  Personalization — v2 change: full Bayesian posterior
  §5.2      534-620  Recency weighting of the ϕ fit (added 2026-08-04)
  §5.1      622-817  Posterior-aware allocation (added 2026-07-18)
§6          819-831  Summary of v1 → v2 changes
§7          833-884  Known approximations and deliberate non-changes
§8         886-2854  Energy model (zenith-energy.ts) — fatigue-recovery exten…
  §8.1      904-929  Intermittent-rest recovery correction
  §8.2      931-953  Warm-up carryover instead of binary reset
  §8.3     955-1038  Verified consequences and a calibration question, closed
  §8.4    1040-1143  Per-task satiety — concave daily value (added 2026-07-14)
  §8.5    1145-1212  Micro-recovery gate — a positive floor for full-demand t…
  §8.6    1214-1403  Optimizer reliability — compound moves and drop-one seed…
  §8.7    1405-1537  Drain-rate calibration from end-of-session ratings (adde…
  §8.8    1539-1616  45-minute plan granularity (added 2026-07-18)
  §8.9    1618-1692  Recovery-rate calibration from pre/post-rest pairs (adde…
  §8.10   1694-2372  Stopping-value calibration from observed stop times (add…
  §8.11   2374-2645  Live stop advisor — §8.10 run forward mid-day (added 202…
  §8.12   2647-2854  The budget curve — what the day's LENGTH is worth (added…
§9        2856-2903  References
§10       2905-3622  Revision log (doc-only corrections)
§11       3624-4232  Metric-layer corrections (2026-07-18)
  §11.1   3626-3640  Scope and principle
  §11.2   3642-3666  Zenith Gain: cap instead of a silent 0% when the naive p…
  §11.3   3668-3695  Burnout Risk: overhang counts funded tasks' T* only (for…
  §11.4   3697-3754  Friction Index: raw scales instead of the asymmetric map…
  §11.5   3756-3774  Schedule Integrity: overhead share instead of the small-…
  §11.6   3776-3886  Burnout Risk v2: re-derived from the energy model (2026-…
  §11.7   3888-3912  Momentum: burnout claim removed, fed active tasks (2026-…
  §11.8   3914-3980  Metric scope families: plan / progress / next-up (2026-0…
  §11.9   3982-4091  Overnight reservoir carry-over (2026-07-28)
  §11.10  4093-4163  Grind Density: the share of the work the day actually fu…
  §11.11  4165-4232  Grind Density is a row, not an objective (2026-08-08)
§12       4234-4371  Plan-adherence audit (2026-07-23)
  §12.1   4275-4371  Per-day fit snapshots (2026-08-03)
§13       4373-4835  Math review, 2026-07-26
  §13.1   4390-4428  Zero ⚡ logs was treated as perfect certainty (§5, §5.1)
  §13.2   4430-4502  Zenith Gain measured the block lattice, not allocation q…
  §13.3   4504-4569  The pooled allocator's "within 1–2%" was a curated-scena…
  §13.4   4571-4624  The stopping fit probed unlogged tasks at an arbitrary p…
  §13.5   4626-4663  Also in this change
  §13.6   4665-4835  The two end-of-day energy readings: a timing difference,…
§14       4837-5737  Plan advice — priced counterfactuals over the day's leve…
  §14.1   5068-5214  Five corrections to the first cut (2026-07-28)
  §14.2   5216-5365  The marginal of the budget (added 2026-08-03)
  §14.3   5367-5573  The price of the switch cost (added 2026-08-04)
  §14.4   5575-5636  An empty frontier is a reading (2026-08-08)
  §14.5   5638-5737  Flow Coverage becomes the ninth axis (2026-08-24)
§15       5739-5897  Two objectives, two modes (2026-07-29)
  §15.1   5825-5897  The copy named the wrong objective for both modes (2026-…
§16       5899-5987  Run order stays a heuristic (2026-07-29)
§17       5989-6147  Per-task ϕ offsets stay unbuilt (2026-08-04)
§18       6149-6254  Drain logs are one row per SESSION, not per task-day (20…
§19       6256-6527  The gain's naive baseline paid for switches it never mad…
  §19.1   6274-6333  Defect 1 — billed (n−1) switches, seated fewer than n ta…
  §19.2   6335-6363  Defect 2 — the displayed number moved with the order of …
  §19.3   6365-6454  What this costs, and the one guarantee that weakened
  §19.4   6456-6527  GAIN_PERCENT_CAP is not dead, but its documented trigger…
§20       6529-6591  Human Capacity: the reading is the constraint, but it na…
  §20.1   6570-6591  The tie went to cognitive, so the row blamed the wrong p…
§21       6593-6761  What the gain has room to report (2026-08-07)
  §21.1   6615-6635  The edge is SELECTION at tight budgets and SHAPE at loos…
  §21.2   6637-6660  Why shape has a low ceiling: the activation bonus
  §21.3   6662-6682  Population distribution
  §21.4   6684-6715  The number is a property of the comparison, not of the o…
  §21.5   6717-6732  Under the total-output objective the ranking inverts
  §21.6   6734-6761  Correction: on an ordinary day it is FLOW that binds, no…
§22       6763-6831  Task nature: an absolute gap could not carry a range tha…
§23       6833-6975  Primary Bottleneck named the model's best task (2026-08-…
  §23.1   6874-6941  Primary Bottleneck: the largest draw on the binding pool
  §23.2   6943-6975  Longest Warm-Up: what E/β was actually tracking
§24       6977-7040  Task Variety counted labels, and its repair was Energy B…
§25       7042-7191  Cognitive and Physical Load: the definition, and what ro…
§26       7193-7299  Deep Work: a step that swung whole blocks, under a band …
§27       7301-7418  Sustainable Work billed unbooked time as grind (2026-08-…
§28       7420-7472  Which four readings are headlines (2026-08-07)
§29       7474-7647  Day Profile: one cut for two different scales, on a day …
§30       7649-7741  The Lab's comparison tile scored the plan on the one thi…
§31       7743-7924  What history can plot, and what it cannot (2026-08-07)
§32       7926-7992  Two gates that read a sentinel as a verdict (2026-08-08)
§33       7994-8119  A plan reads only the logs that precede it (2026-08-08)
§34       8121-8351  The subset search gave up one task too early (2026-08-08)
§35       8353-8707  The plan cannot see the hours you already spent (2026-08…
§36       8709-8780  What a correction may touch (2026-08-10)
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
fitted plane can extrapolate to ≤ 0 far from the measured tasks. Both maps and
the ϕ plane are pinned in `zenith.test.ts` ("Parameter Mappings", "Flow State
Time").

**v2 amplitude cap.** The v2 curve (§2) requires `p₀ < a`. With the mappings
above, `p₀/a = 1/E²`, which reaches exactly 1 at `E = 1` (user difficulty 1) —
a degenerate flat curve. We therefore cap the effective ratio:

```
r = p₀/a  clamped to  r ≤ 0.9        (AMPLITUDE_RATIO_CAP)
```

The cap only binds for `E < 1/√0.9 ≈ 1.054`, i.e. user difficulty below
≈ 1.12 — one sliver of the slider — and keeps `k` (below) strictly positive
(`scripts/curve-marginal-facts.probe.ts`, re-run 2026-08-19: 1/√0.9 = 1.054093 →
user difficulty 1.121708, 1.35% of the 1–10 range).

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
marginal are asserted in `zenith.test.ts`, and so are concavity on the working
range (`p″ < 0` over `DOMAIN_GRID` up to `T*`) and the decaying tail (`p(200h)`
plus the marginal at 1.5/2/4/10 × `T*`). The margins those fixtures leave are
measured over the slider grid by `scripts/curve-marginal-facts.probe.ts`
(2026-08-06: max `p″` on `(0, T*]` = −1.21e−2, min `(2−r) − kT*` margin 0.256,
max `p(200h)` = 6.5e−10).

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
- **The band belongs to this closed form and to nothing else.** It is a σ_ϕ = 0
  statement. `TaskAllocation.optimalHours` — the field the task row renders as
  "stop by" — is the ϕ-uncertainty-hedged optimum of §5.1, and every user
  carries a posterior from their first day, so it sits **below** 1.5194ϕ on 23
  of the 100 integer slider pairs and below ϕ itself on 6 of them, bottoming at
  0.7219ϕ (difficulty 1 / enjoyment 10, default constants, zero ⚡ logs;
  `scripts/hedged-stop-band.probe.ts`, 2026-08-09). The remaining 77 land
  inside the band, and the closed form stays inside on all 100 (1.5194–1.7750)
  — but nothing HOLDS the hedged value there, which is what bars it from copy.
  That
  is correct — hedging moves the optimum earlier, and a task already productive
  at t = 0 has little to gain by waiting — but it means no code comment or UI
  string may quote the band for that field. Two did until 2026-08-08 (§10).

The best achievable average `P̄(T*)` is computed per task and exposed as
`TaskAllocation.optimalAvgProductivity`; it replaced the v1 constant
`OPTIMAL_AVG_FRACTION = x/(x²+x+1) ≈ 0.2984` (removed — only valid when the
multiplier was universal). The metric layer's _priority score_ is this value —
a task's intrinsic worth independent of what the current plan gives it — and it
is reported on two scales, only one of them printed.
`SuggestedTask.priorityScore` (`metric/calculation.ts`) is
`Number((P̄(T*)·10).toFixed(1))`: the figure a task row prints in its `Prio`
column,
the weight in `completionRate` and `yieldIndex`, and the key
`calculateSuggestedTasks` sorts by. `metric/remaining-day.ts` passes P̄(T*)
un-rescaled, deliberately — the rescale is a display convention, not part of the
model, so it is applied at the one call site that prints. The ×10 is
order-preserving; **the 1 dp rounding is not**, which makes the un-rescaled
reading the strictly finer sort key: rounding ties tasks this section separates,
and a stable sort then settles the tie by the order they arrived in. How often
that shows is unmeasured — the day's list is not this array (its funded group is
re-sorted by `#N`, §16) and no probe reaches the printed order.

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
  without special cases. For n > 12 the same enumeration runs **bounded to
  subsets no larger than the day can fund** — exact while that fits, which is
  the tight-budget region where the subset choice is worth most (up to a 3 h
  day at n = 13). Longer days fall through to greedy forward selection — §34.
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
for the single-budget problem with switch cost and n ≤ 12 — or n > 12 on any
day whose size bound fits `SUBSET_SEARCH_BUDGET` (§34) — the returned plan
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
("ϕ ≈ 1.4h ± 0.4h") and robust allocation — the latter is now implemented with
the xᵀΣx half alone (`phiParameterStd`): since 2026-07-18 the allocator consumes
the posterior directly (§5.1).

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

Consequence to keep in mind when reading the card: its five rows — the
recency-weighted ϕ row against four unweighted fits (r, α_cog, α_phys, λ₀) — do
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
(σ̂ is **not** floored at σ₀ = 0.25h; §5's estimator is a weighted average that
the prior anchors only while n is small — corrected 2026-08-08, §10.)
`phiParameterStd = √(xᵀΣx)` is the part the
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
   `scripts/post-monotone-prefix-cost.probe.ts`). Swept again in SLIDER space —
   (a, p₀) from the form's two difficulty sliders rather than (r, ϕ̂) on a grid —
   the cut cells start at **ϕ̂ 4.25h** at the same σ/ϕ̂ ≥ 0.35 (§19.3, 2026-08-17,
   `naive-menu-cut-corner.probe.ts`); the σ/ϕ̂ bound is what the two agree on.
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
- **Forward selection for the n > 12 funded-subset search** now runs only where
  the size-bounded enumeration does not fit, and is exact everywhere else past
  12 (§34). Where the boundary falls depends on BOTH the list and the switch
  cost, so it is not simply "long days": at `switchCost` 0.25 it is a 3 h day
  at n = 13 (`maxFunded` 6, 4095 plans), and at `switchCost` 0.1 it is 1.75 h at
  n = 14 (5, 3472) and 1.25 h at n = 20 (3, 1350) — the same Σⱼ C(n, j) ≤ 4095
  arithmetic §34 derives, walked over the whole quarter-hour ladder to 24 h
  (2026-08-19, `scripts/subset-search-bound.probe.ts`, which also shows the
  bounded region is an interval, so its last budget IS the crossover — and now
  asserts that interval, both monotonicities and the ≤ 2 h claim below, so the
  shapes these figures carry go red while the digits stay free to move). It takes
  n = 30 at `switchCost` 0.1, and n = 91 at 0.25 and above, before the list
  alone sends a ONE-HOUR day to the fallback — so that is not what §34's
  after-table's ≤ 2 h shortfalls are. From `switchCost` 0.25 up the whole ≤ 2 h
  band is bounded at n = 13, 14 and 15, so every shortfall it shows there has to
  be a `switchCost` 0.1 day: at n = 13 the crossover is 2.25 h and no budget in
  the band falls through at all, at n = 14 it is 1.75 h and only the 2 h day
  does, at n = 15 it is 1.5 h and both 1.75 h and 2 h do. That deduction names
  WHICH budgets and prices none of them: §34's ≤ 2 h worsts (0.00%, 1.89%,
  3.31%) are maxima over the whole band and all four switch costs, and its
  counts there are 0/20, 2/28 and 1/29 short — no measurement attributes a
  forfeit to a single fall-through budget.
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

With τ = 0.5 h, **84.648%** of task state survives a 5-minute break and
**1.832%** a 2-hour gap — recovered through the evaluator rather than from the
closed form (`zenith-energy.test.ts`'s "§8.2 survival" fixture, not a probe;
2026-08-18). `blockOutput` integrates `p(s_resume + u)` over block-local time
`u`; the reservoirs stay indexed by `u` since they carry their own level.
`resumptionTimeConstant ≤ 0` reproduces the old hard reset. Because `p(s)` is
hump-shaped, one decay does double duty: below the peak it prices lost warm-up
(breaks hurt), above it prices boredom relief (a break moves you back toward
the peak).

### 8.3 Verified consequences and a calibration question, closed

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
optimizer gives 12 h at every λ₀ from 0.2 through 1.2 and 9 h at 1.5 — a
two-step response, and no collapse to all-leisure anywhere in [0.2, 1.5]
(`scripts/enb-break-economics.probe.ts`, re-read 2026-08-21 on the
slider-reachable probe day; 12 h at λ₀ ≤ 0.5 and 10.5 h from 0.8 through 1.5 on
the unreachable one, 2026-08-06 — same two-step shape, same conclusion). So the bang-bang
diagnosis was right about the _kind_ of response and wrong about where it
lands: the pre-fix model never stopped working within the swept range.)

**Resolved by §8.4 (noted 2026-07-19).** The structural change arrived, just
on the other side of the margin: satiety's concave V(O) makes the marginal
value of late work hours _decline_, which is equivalent at the stopping
margin to a concave leisure value. Re-probing the sweep above under the
current model (satiety on, §8.5 gate, §8.8 lattice): W\*(λ₀) on the 12-hour
probe day is monotone and **graded** — 12 h → 12 → 9.75 → 6 → 4.5 → 0
across λ₀ ∈ {0.2, 0.4, 0.8, 1.0, 1.2, 1.5} — no longer bang-bang (locked in as
a unit test; re-read 2026-08-21, where the 0.4 and 0.8 cells moved off
11.25/10.5 with the day's realignment and the shape did not).
That well-posedness is what §8.10's calibration is built on.

**What was resolved, and what §15 answered instead (2026-08-20).** §8.4 fixed
the response's SHAPE. The "Open" paragraph's other half — "a humane default
day" — is not a defaults question at all, and this section left it looking like
one. Two facts close it.

First, the shipped default had never been measured. The ladder above samples
λ₀ ∈ {0.2, 0.4, 0.8, 1.0, 1.2, 1.5} and the suite fixture {0.4, 0.8, 1.2, 1.5},
so 0.5 — the value the app runs on — was in neither. It is now in both, and it
reads **11.25 h of the 12-hour window** (`scripts/enb-break-economics.probe.ts`,
2026-08-20, and unmoved on re-read 2026-08-21). Both declarations of this day
agreed on that figure — the probe held the older demands, the fixture the
slider-derived ones — which is why M44's realignment of the probe on 2026-08-21
left it alone; the day is now declared one way, and 0.5 still plans 11.25 h. The
flat step around it narrowed: it spanned λ₀ 0.4 through 0.6 on the old demands
and spans **0.5 through 0.6** now, because λ₀ 0.4 plans the full 12 h on the
reachable day. Nothing else in this paragraph or the next moved — the whole
portfolio spread and the λ₀ = 1 reprice below re-read identically. Four tests were
already incidentally sensitive to the default — a §8.6 funding optimum, §8.10's
posterior-std pin, and two §14.2 budget-curve properties — but none said what it
plans.

Second, what that default means is a property of the DAY, not of λ₀. At the same
0.5 the optimizer plans 0.94 of the window on this demanding three-task day
(7.5 h of 8, 9.75 of 10, 11.25 of 12, 12 of 14), 0.69 on a cognitive desk pair
at 12 h, and 0.38 on a pair of low-difficulty errands — where it stops at 4.5 h
whether the window is 8 hours or 14. So "the plan fills most of the window" is
not a fact about the constant; it is a fact about a day whose three tasks are
rated 10/10, 6/9 and 4/7.

And raising the default is not a free tuning move. The Lab's slider reaches 3 in
steps of 0.1, and one notch to λ₀ = 1 **empties the plan** on both light
portfolios — desk pair at 12 h scores 13.5000 doing nothing against 11.3880 for
the 8.25 h the default plans, so the empty day is the true optimum there and not
a search failure. A default humane on the errand day is a default that
prescribes idleness on the desk day.

The level question therefore belongs to §15, which settled it: the two planners
are peer modes, the energy objective plans a larger share of the budget than the
classic allocator by construction, and the energy model carries no capacity-pool
constraint at all. Filling most of a declared window is what this objective is,
not a constant to retune. Nothing here is open.

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
  with 0.5 h gaps yields 1.40× less raw output (a ratio satiety cannot move,
  since it lives outside the dynamics), and the objective still prefers
  contiguous by 1.15×, against 1.24× before satiety (re-read 2026-08-21 at
  1.3971× / 1.1475× / 1.2402× on the slider-reachable guitar,
  `scripts/enb-break-economics.probe.ts`; 1.4511× / 1.1687× / 1.2750× on the
  unreachable one, 2026-08-06); the
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
re-measured 2026-08-19, `scripts/sat-gate-floor.probe.ts`; 350a0c3's seed fix
moved this paragraph's jump figure and the "Chosen" bullet's sweep endpoint, and
nothing else in the section): the pathology is the algebra, not a measured
cliff. With today's search, at the default 0.75 h lattice, the b = 0 world's
demand sweep on the probe day is already monotone (3.00 h at both wp 1.0 and
0.95 — the "Chosen" bullet below sweeps the same day at the finer 0.25 h step,
where those two points do differ), and over 20 seeded days the
demand→allocation response is indistinguishable at b = 0 and b = 0.05 (mean
biggest jump 0.863 h, 0 of 20 non-monotone, both) [2026-08-06: 0.825 h]. The
original "2.65 h → 4.56 h cliff from a 5% demand change" was measured with the
search §8.6 then found unreliable **on this same day**, so it is not separable
from search slack and does not reproduce.

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
2026-08-06 and again 2026-08-19, `scripts/sat-gate-floor.probe.ts`):

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
  Probe: the demand sweep wp 1.0 → 0.7 runs 3.25 → 4.50 → 5.25 → 5.50 h at the
  0.25 h step, monotone throughout, in ~0.4–0.5 objective increments (re-read
  2026-08-21 on the slider-reachable probe day, ROADMAP M44; the same sweep read
  3.75 → 4.50 → 5.25 with a 0.50 h largest step on the unreachable demands, and
  3.00 h at wp = 1.0 on 2026-08-06 — the ladder is coarser on the reachable day,
  largest single step 1.25 h) — but
  the b = 0 sweep is monotone as well under today's search, so the gate's
  justification is the `w = 1` algebra and the floor below, not a smoothing
  effect. Long full-demand sessions do decay _toward_ the floor instead of
  grinding to zero (8 h at w = 1 ends at 0.1997 physical against 0.0907 without
  the gate) — but 8 h is not yet near it: that is 34% above the 0.1489 floor,
  which the decay reaches only after ~16 h (0.1520 at 16 h, 0.1491 at 24 h).

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
- **Optima that fund only two tasks** (found and fixed 2026-08-13): the seeds
  above reach funded sets of size n (classic, all-in, round-robin) and n − 1
  (drop-one), and two enumerated frontier days have an optimum funding **two**
  of their 4 and 5 tasks — reachable from no seed, because dropping the rest is
  downhill the whole way. Fix: one seed per **pair** among the three
  highest-amplitude tasks, round-robin over the two and searched **within the
  pair**, i.e. that seed's local search may only reach those two tasks. All
  three parts are load-bearing and each was measured on a witness below: with
  the whole task list still on offer the steepest first move re-funds a dropped
  task and the climb leaves the pair's basin (adding the seed alone changes
  neither witness); a _classic_ pair seed converges to a single task on the
  5-task witness, where the round-robin seed reaches the interleaved optimum;
  and the pair cannot be chosen by amplitude order.
- **Rest breaks only at the midpoint** (found 2026-08-06, fixed 2026-08-13):
  the split-around-rest move offered one split point, the rounded midpoint, and
  on the witness day below that split is downhill while two others are uphill —
  so a break the optimum takes was unreachable, splitting and re-growing being
  downhill in between. Fix: the move yields **every interior lattice split** of
  the block, one step handed to rest at unchanged worked hours.

All fixes are deterministic (the search stays reproducible; a test asserts
this). Verification: both previously-failed probe cases now beat their
hand-built witnesses, and the b = 0 legacy world's optimum improved too
(10.70 vs 10.65) — meaning even pre-§8.5 results had mild search slack.
Cost, and what the pair seeds add. Measured twice on 2026-08-13, both times one
warm-up call then the mean of 3 in a fresh process, on two machines and two task
compositions: **the pair seeds cost ~1.3×–2.3×, and the ratio itself depends on
the day**, so neither a millisecond figure nor any single ratio here is the
number — quote the range. Run A is seeded `randomDays` days (`8600 + n`, plus
8606 and the §8.6 witness at 8 h); run B is a synthetic ladder
(`difficulty = 1 + (i % 10)`, `enjoyment = 1 + (i * 3) % 10`, both demands 0.5)
at one composition per size, which is why its 3-task ratio is the worst cell and
run A's is not:

| Day (12 h unless stated)      |   Before | With pair seeds | Ratio |
| ----------------------------- | -------: | --------------: | ----: |
| A: §8.6 witness, 3 tasks, 8 h |  16.3 ms |         30.0 ms | 1.84× |
| A: 3 tasks                    | 118.3 ms |        220.0 ms | 1.86× |
| A: 6 tasks                    | 231.7 ms |        351.8 ms | 1.52× |
| A: 6 tasks (seed 8606)        | 237.9 ms |        350.5 ms | 1.47× |
| A: 10 tasks                   | 120.2 ms |        181.5 ms | 1.51× |
| A: 15 tasks                   | 307.1 ms |        412.4 ms | 1.34× |
| B: 3 tasks                    |  38.0 ms |         88.5 ms | 2.33× |
| B: 4 tasks                    |  54.7 ms |        116.8 ms | 2.14× |
| B: 5 tasks                    |  61.7 ms |        114.4 ms | 1.85× |
| B: 6 tasks                    |  71.1 ms |        125.3 ms | 1.76× |
| B: 8 tasks                    |  42.1 ms |         86.6 ms | 2.06× |
| B: 10 tasks                   |  41.8 ms |         78.1 ms | 1.87× |
| B: 12 tasks                   |  56.1 ms |         90.6 ms | 1.62× |
| B: 15 tasks                   |  65.8 ms |        103.8 ms | 1.58× |

The two runs share no absolute figure — the same class of day reads 71 ms fresh
and 172 ms in a loaded process, and machine A is ~2× machine B — so the ratios
are what carry across, and even they move by a factor of 1.5 with composition
alone.

That is what forced the three-task cap: the **unbounded** C(n,2) pair family
measured 219.2 / 812.4 / 1499.9 / 4019.5 ms on run A's four 12 h days —
**1.85× / 3.51× / 12.5× / 13.1×**, the first cell being the capped family
itself (at 3 tasks every pair is a top-three pair) — because a pair seed starts
fragmented and climbs long, so it costs about two ordinary seeds rather than
the fraction of one a 2-task neighbourhood suggests. Cost does not grow
monotonically in n (a wide task list makes the window bind and the classic seed
truncate), so the cap is stated in seeds, not in a task threshold: C(3,2) = 3
seeds at every size. The three highest-amplitude tasks are enough for both
witnesses below, whose winning pairs are the amplitude ranks {0,2} in each case.
Three call sites pay it — `EnergyLabStore`'s `$derived` behind the parameter
sliders, `plan-audit.ts` once per audited day under a 30-day cap, and
`suggestBudgetCurve`, whose 16 solves per sweep make it the largest single
multiplier (on demand, never a `$derived`). (Earlier figures for the 3-task
day, each on its own hardware: ~13 ms on 2026-08-06,
8.9 ms on 2026-08-13's first machine — where the interior-split move cost
nothing measurable, 9.0 ms before it and 94.2 → 94.4 ms on a 6-task/12 h day —
and ~60 ms when written, at the 0.25 h step and before the 2026-08-01
`buildCurves` hoist.)

**Residual gap, measured** (Probe 2026-08-13,
`scripts/energy-search-gap.probe.ts`; the same probe read 58 of 60 and worst
0.5951% on 2026-08-06, before the interior-split fix above). Scored against the
exhaustive optimum on the same 45-min lattice — every lattice plan enumerated,
so a shortfall is a proven search defect — 60 seeded random days of 2–3 tasks ×
3–6 h now give **60 exact** (within 1e-9), median, p99 and worst shortfall all
0.0000%. The day that drove the fix funds a single task over a 6 h window: the
search returned one 5.25 h block (7.6521) where the optimum works the same
5.25 h split 3.75 + 1.5 around an interior 45-min rest (7.6979), and the
midpoint 3 + rest + 2.25 scored 7.6297 — downhill by 0.0224, so steepest ascent
stopped. Two of the six interior splits were uphill (3.75 + 1.5, and
4.5 + 0.75 = 7.6946); the move now offers both. **What was not built:** a
variant that takes the rest step out of the block instead of out of spare
`room`, which would keep the move available on a fully-spent window. No day of
the 60 asks for it — the enumeration covers fully-spent plans, so such a defect
would have shown as a shortfall — and it costs worked hours. Swept directly on
2026-08-13, from the plan the search returns: the carve-from-block variant is
uphill on **none** of the 12 harder-tier days below, including the fully-spent
one (day 6 books 9.75 h of a 10 h window, so `room` is false and the shipped
move is unavailable there), and on none of the 9 frontier days. No measured day
asks for it. The failure mode §8.6 calls the worse one is clean too:
**0 funded-set mismatches of 60**, and the §8.6 witness day is exactly optimal at
all six windows 3–8 h.

**The exhaustive frontier** (Probe 2026-08-13, same file). Enumeration was
pushed to the largest task counts it reaches, one window per count so the
lattice stays runnable: 4 tasks × 6.75 h (5⁹ = 1.95·10⁶ plans), 5 × 6 h
(6⁸ = 1.68·10⁶), 6 × 5.25 h (7⁷ = 8.24·10⁵). `FRONTIER_DAYS_PER_SIZE` is the
committed 3 days per size, ~7 min; the frequency sweep below raised that one
line to 20 days at 4 tasks and 8 at 5 (~28 min), and the seeds (8700 + tasks)
are a prefix, so the wide sweep contains the committed one.

**A deep-funded optimum is the common case, not a corner** (2026-08-13, seeds
8704 / 8705). Of 20 days at 4 tasks × 6.75 h, **14** have an exhaustive optimum
funding ≤ n − 2 tasks; of 8 days at 5 × 6 h, **8 of 8** do. Those 28 days held
**two proven defects** — the first funded-set defects since this section was
written, and both are now suite fixtures:

- **4 tasks × 6.75 h, day 1.** Tasks (difficulty, enjoyment, cognitive,
  physical): (6, 3, 0.5, 0.2), (5, 8, 0.9, 0.9), (5, 5, 0.4, 1),
  (2, 7, 0.4, 0.6). The search returned `t3 1.5h + t1 3h + t4 1.5h` funding
  {1,3,4} at 6.140624; the optimum funds {1,2} at 6.159566 — **0.3075%** short,
  with the wrong structure. The uphill audit finds 0 uphill candidates on it
  across both families `neighbors` never generates, so no single move reaches it
  either: a seed-depth problem, not a missing move.
- **5 tasks × 6 h, day 7.** Tasks (9, 3, 0.6, 0.9), (8, 7, 0.1, 0),
  (6, 2, 0.2, 0.5), (2, 2, 0.6, 0), (7, 5, 0.8, 0.8). The search returned one
  6 h block on t2, funding {2} at 9.344081, against the optimum's
  `t2 3h + t5 0.75h + t2 2.25h` funding {2,5} at 9.392388 — **0.5143%** short.

**What was measured and rejected on the way to the pair seeds**, each on these
two witnesses: seeding the **amplitude-prefix pair** (drop the two lowest
amplitudes) reaches 5.399815 on the 4-task witness against the optimum's
6.159566, because its winning pair is amplitude ranks {0,2} — as is the 5-task
witness's, which is why three tasks feed the family and two do not. Seeding a
**pair-dropped classic seed searched over the whole task list** leaves both
witnesses exactly where they were (6.140624 / 9.344081): the seed is visited,
and the climb walks straight out of the basin it was built for. A **classic**
pair seed searched within the pair fixes the 4-task witness and not the 5-task
one, where it converges to the single-task 9.344081 that the round-robin pair
seed beats.

**After the fix**, the same wide sweep is clean: all **31** frontier days — 20
at 4 tasks, 8 at 5, 3 at 6 — are exact against the enumerated optimum (median,
p99 and worst shortfall 0.0000%) with **0 funded-set mismatches**.

On the harder tier the reference is only a 200-restart hill climb, a LOWER
bound, so its numbers are evidence and not proof: 12 days of 4–6 tasks × 8–12 h,
8 exact, worst 0.1104% below that reference (day 11, 4 tasks × 11 h, which has
no mismatch), 2 funded-set mismatches (3 before the interior-split fix, and
unchanged by the pair seeds). Each mismatch's sign
attributes half of it, and both halves are proven: **day 6** (5 tasks × 10 h) is
0.0540% BEHIND the reference and funds {3,4} against {2,3,4}, a proven
product-search shortfall; **day 4** (6 tasks × 11.25 h) is 0.0840% AHEAD of it
and funds {1,2,3,4,6} against {1,2,3,6}, a proven shortfall of the REFERENCE.
What stays unattributable is only WHICH funded set the true optimum has, and it
stays that way: enumerating those two days is 6¹³ = 1.31·10¹⁰ and
7¹⁵ = 4.75·10¹² lattice plans at 35.5 / 39.8 µs per `evaluateSchedule` —
**129 h** and **5.2·10⁴ h ≈ 6.0 years** (the probe measures both µs/eval and
the implied wall clock on the day itself, so this is re-derivable and not a
machine-specific constant here). That arithmetic is calibrated, not
extrapolated: it also fires on the frontier tier, where it predicts
5⁹ × 26.5 µs = 51.7 s for the 4-task day against the ~51 s that tier's
enumeration actually takes — agreement within 1% on a lattice that really was
enumerated. Raising this tier to an exhaustive reference is therefore not work
that is waiting; it is unreachable, and the frontier tier above is what
replaced it. (The probe printed that worst with a flipped sign until 2026-08-13,
so the same day read "p99 0.1104%, worst −0.1104%"; every statistic now carries
the shortfall's own sign, positive meaning the product search is behind.)

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
its log moment, its day and its captured demands — they rewrite the three
numbers the user rated and nothing else (2026-08-10); a new log is always a new
session.

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
sessions are snapped to the nearest whole step (floored at one step), a block
is cut only at a whole-step point (the half-reassign rounds an odd step count
to larger/smaller whole-step shares; the split-around-rest takes any interior
step and adds one), insert room is the lattice-floor of the remaining window,
and every other move adds or removes exactly one step. `normalizeSchedule`'s window clip therefore
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

**Probe results** (2026-07-18, re-measured 2026-08-13 with
`scripts/stp-lattice.probe.ts`, after §8.6's pair seeds; the probe day re-read
2026-08-21 on the demands the sliders reach, ROADMAP M44). (a) _Quantization
loss is small:_ objective ratio coarse/fine (0.75 vs 0.25 step) is 0.9843 (probe
day, 8 h) / 0.9952 (mixed day, 8 h) / 0.9810 (probe day, 12 h) / 0.9759 (mixed
day, 12 h) — the fourth cell was once quoted as 0.9886 and no cell in a 12-point
sweep produces that. Over windows 4–14 h the worst is **0.9693** (probe day,
4 h), unmoved by the realignment: a
short window has too few lattice points to hide the remainder in. The suite's
≥ 0.97 bound is asserted at the 8 h window, which is where it was measured — it
is not a lattice property. (b) _Structure survives:_ the funded-task set matches the
fine-step optimum in **all 12** of the sweep cells (2026-08-21). Until this day
was put on the sliders it matched in 11: the probe day at 8 h funded three tasks
coarse and two fine, and §8.8 carried that as a documented exception. It was a
property of the unreachable demands — the same cell now reads {1,2,3} both ways
with no rest either side — so the exception is withdrawn rather than
re-explained, and the suite's funded-set assertion, which skipped the probe day
because of it, now covers both days. (The history is still worth keeping: the
mismatch appeared when §8.6's pair seeds improved the FINE-step search, 10.8794
→ 10.9175, funded {1,2,3} → {1,2}, with the coarse side unmoved. Those two
objectives belong to the old declaration of the day and are archaeology, not
current readings.) (c) _No new
search slack:_ exhaustive enumeration of all 45-min plans on the 2026-07-14
probe day (every assignment of the 10 lattice slots to a task or to rest —
1 048 576 evaluations, not the ~10⁴ once claimed) equals the search's 10.6274
exactly (2026-08-21; 10.7331 on the old demands) — locked in as a probe-time check, not a unit test (too slow).
(d) _Faster:_ 26.9 ms vs 500.7 ms on the 3-task/8 h day (2026-08-21, one
machine; 28.5 ms vs 593.1 ms on 2026-08-13's declaration of it; ~13 ms vs ~210 ms on 2026-08-06's, and the ~55/~330 ms pair predates
`buildCurves` caching). The gap widened with the pair seeds because the fine
step gives every seed a longer climb — the ratio is a lattice figure, not a
constant. (e) A side benefit: fine-step optima at long
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
   across **300 seeded slider-reachable days** leaves the optimal stop on one or
   two 45-min lattice levels on 236 of them — but the span is a median of 1 step,
   **2 at p90 and 5 at worst** (a 4-task, 11-hour day at λ₀ 0.8, walking
   10.5 → 6.75 h), and **25 of the 300 move non-monotonically** in V_T. V_T moves
   the stop at all on 150 of the 300, so this is not a zero read off an
   unreachable region (2026-08-21,
   `scripts/stp-stopping-identifiability.probe.ts`). Until that date the claim
   rested on ONE day — "one or two levels in 7 of 8 (window, λ₀) cells, but 3
   steps at 8 h / λ₀ 1.3 (2.25 h → 4.5 h) and three levels non-monotonically at
   12 h / λ₀ 0.9", 2026-08-06 — and both of those witnesses turned out to be
   properties of demands no slider can produce: on the reachable declaration of
   that same day every one of the 8 cells moves **at most one step** (ROADMAP
   M44). The conclusion is unchanged and now rests on a distribution instead of a
   witness. So the fit targets
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

The first max runs over the day's still-OPEN tasks — declining to extend a
logged task and declining to _start_ an unlogged one are both part of the
stop decision, but a task already **checked off** is not: there was no more
of it to do, so it is no forgone step. **Corrected 2026-08-12**; the max used
to run over every task on the day, which read "I finished my work" as "an
hour of leisure was worth more than another hour of that work" and biased λ₀
up by the whole marginal of work that no longer existed — on the §8.10
fixture day, checking the strongest task off moves the day's point
**1.321 → 1.190** (measured 2026-08-19,
`scripts/stop-inversion-margin.probe.ts`, and test-pinned as a pair rather than
as a direction), a 0.132 shift, 1.055× the 0.125 bracket half-width the
instrument's slack is worth (re-read 2026-08-21 past the clock censor, which
moved the half-width the ratio divides by and not the shift). What that is worth beyond this one day is measured
below, and it is less than the argument implies. The scope is §11.8's
next-up family, the same set §8.11's advisor already
recommended from; the two now read one `openTaskIds` (R3). Completed tasks
keep their hours in the reconstruction on both sides — they drained the
reservoirs the open ones would have worked with. The second max runs over
tasks with ≥ 1 whole step logged, completed or not — that work WAS done, so
it was worth ≥ λ₀: the
work order is unobserved, so "some worked step was worth ≥ λ₀" gives the
loose max as the honest bound. The day's **indifference point** is the
bracket midpoint `(max(0, lo) + hi)/2`; each bound costs one
`evaluateSchedule` call, ~2n+1 per day, no optimizer runs.

**What the open-task scope is worth** (Probe 2026-08-17, re-read 2026-08-19,
`scripts/stop-inversion-margin.probe.ts` and
`scripts/stop-margin-fit-error.probe.ts`). Until this run **no probe ever set
`openTaskIds`**: both bracket replicas took `lo` over every task, so both still
modelled the pre-correction scope and the witness above was the whole evidence.
Both replicas now read the field and both are validated on days that carry
completions — 0 verdict mismatches over 1576 such observations, and worst
|replica fit − shipped fit| = 0 over 90 users × 12 days at q = 0.5. Re-read
2026-08-19 with every task drawn from integer sliders through `toEnergyTask`, so
the population below is one the app can hold: of **30381** logged rows across
the composition, optimizer and ±1-step days, **0** carry an hour count, a window
or a log moment the app could not produce (whole minutes in [1, 960], a window
in (0, 24]).

- **Size, on a population.** 120 seeded days × 4 λ₀ = 480 cells, the 394 the
  optimizer funds, each re-read with each of its tasks independently ticked at
  probability q. (q is an **axis, not a frequency**: the model has no task size,
  so "checked off" has no model correlate, and no real history exists on this
  machine to calibrate it — §8.10's own partial-logging caveat.) The filter's
  shift is **median 0.000 at q = 0.25 and 0.50, 0.022 at 0.75**, over the
  184 / 156 / 104 days that stay
  two-sided under **both** scopes at q = 0.25 / 0.50 / 0.75: on
  81.0% / 57.7% / 43.3% of those the ticked task was not the `lo` maximizer and
  the correction changes nothing (re-read 2026-08-21 past the clock censor, which
  is what took the day counts down from 281 / 246 / 151; the 2026-08-19 reading
  gave 79.7% / 61.4% / 46.4%). Where
  it bites, it bites hard — p90 0.049 / 0.244 / 0.280, max
  0.396 / 0.452 / 0.452, past the 0.125 half-width on
  7.6% / 19.9% / 26.0% of them. The
  larger effect is ticking a task **with hours logged** (median 0.029 at
  q = 0.5), not one that was never worked (median 0.000 wherever that bucket has
  a day in it) — the opposite of the expectation that removing a never-started
  candidate would dominate, and it follows from `lo`: an unworked task's first
  step is mostly warm-up ramp, so it rarely is the max.
- **It does not measurably improve λ₀ recovery, and "biased λ₀ up" is a
  one-day witness rather than a measured bias.** 90 simulated users at a known
  λ₀ × 12 days, completions drawn **causally** — only tasks the day's own plan
  funded, declared finished at exactly the hours the plan gave them, a cap that
  binds nowhere the plan reached, so the generated day is still the true
  rational day. Scored against the pre-2026-08-12 all-tasks scope over 12
  completion-carrying arms, the corrected scope **gains in 3** — best
  **+0.0131 λ₀** (30%-interrupted, q = 0.25, n = 12), then +0.0035 and +0.0009 —
  and **loses the other 9**, by up to 0.0723 at q = 0.75 — everything inside or near the 0.134
  half-width `stop-margin-fit-error` still prices against (re-read 2026-08-21 past
  the clock censor; the 2026-08-19 reading gave gains in 2, best +0.0084, worst
  −0.0796, and the break-free reading before that +0.0054 and
  −0.0859). The signed error does move in the asserted direction where the old
  scope is biased up (+0.0680 → +0.0316 at q = 0.25, n = 12) and then
  overshoots down (−0.0017 at q = 0.5, −0.0545 at q = 0.75). The used-day counts
  differ by construction, both ways: the corrected scope drops all-completed
  days and un-censors inverted ones (833 against 845 at q = 0.25, 752 against
  845 at q = 0.75).

  The scope rule does **not** move on that, and this is not a re-opening: it is
  settled behaviour (§11.8's next-up family, AGENTS.md §4). The correction is
  right on an argument a simulation cannot make — a checked-off task's remaining
  work does not exist, while the generator's does, so the instrument can only
  price removing a candidate the model still values. What the measurement kills
  is the _stated reason_'s size, not the rule.

- **The bound the sizes rest on** (`zenith-energy.test.ts`, not a probe): `lo`
  is a max over the open set and `hi` never reads it, so narrowing the set can
  only lower the point, and — since the censor fires on `max(0, lo) > hi + margin`
  — can only **un**-censor. That is what makes the one-sided reporting above
  honest.

**Why the reference schedule is the observed per-task hours** (probed against
two alternatives). The bracket needs a schedule representing the user's day;
by the envelope theorem the marginal should be taken along the
best-arrangement-at-W, which we cannot know. Candidates probed with the
optimizer's own plan at the true λ₀ as gold standard:

- **Chosen — the day as its own 🪫 rows record it** (corrected 2026-08-19; see
  "What the log moments are worth" below). One session per ROW, in the order the
  rows were logged, with the space between one row's start and the previous
  row's end as rest: `startedAt = endedAt − hours`, `gap = max(0, startedAt −
previous endedAt)`. Composition, order AND breaks are all read rather than
  invented. An UNLOGGED task probed on the `lo` side is inserted at its own
  canonical rank among the work blocks, not appended last (§13.4).
  - **The fallback, on one predicate per DAY:** does every row carry a usable
    finite moment, and do the deltas recover any gap at all? If not — a row from
    a hand-edited or restored backup, or a day whose sessions were all written
    down at once — the day reads as **one contiguous session per logged task in
    canonical amplitude order, breaks omitted**, which is what every day got
    before this correction. That path is bit-identical to the old reading, so a
    batch-logged day is no worse off and no better.
  - **Rejected as the source — re-solving the day's plan at fit time.**
    `plan-audit.ts` already does it per finished day, and it works (templating
    the observed hours onto the plan re-solved at the default λ₀ read the
    witness below at 0.717). It is disqualified by this section's own
    feasibility finding 3: `EnergyLabStore.#stoppingFit` is a `$derived` over
    ALL finished days with no day cap, and one re-solve costs ~191 ms against
    0.185 ms for the whole bracket. It is also sparse — a `fitSnapshot` exists
    only for days the user opened Analytics on — and the plan is a proxy for the
    worked day, not the worked day.
- **Rejected — classic seed truncated to W** (each task at snapped T\*,
  best-first): invents the composition; biased +0.2 to +0.4 at mid λ₀
  because it over-weights the high-amplitude full-demand task.
- **Rejected — λ₀ = 0 max-work plan truncated to W:** erratic (probe
  midpoints 0.7–1.5 for true 0.9); truncating a max-work day leaves a
  composition no λ₀-rational user would have chosen at W, exactly the
  envelope error predicted.

**What the log moments are worth** (Probe 2026-08-19,
`scripts/stop-block-structure.probe.ts` — the first committed instrument that
draws its days the way the app does, through `toEnergyTask` from integer
sliders. That absence is why the paragraph below was wrong for a year: neither
`stop-inversion-margin` (until 2026-08-19 — it now draws every task from
integer sliders through that mapping and gives every row a log moment) nor
`stop-margin-fit-error` built its tasks through the app's own mapping, and
`stop-margin-fit-error` flattened each plan to a
work-step sequence that DROPPED rest, so no day either probe could generate
carried a break.)

120 slider-drawn days × λ₀ {0.1, 0.3, 0.5, 0.7, 0.9, 1.1} = 676 optimizer-funded
cells, **49.9% of the plans carrying an interior rest break**, every arm read
through the shipped `stopIndifferencePoint`. The grid spans the Energy Lab's own
`freeTimeValue` range at its low end (slider [0, 3], step 0.1) — **widened from
{0.5 … 1.1} on 2026-08-19, because the residual lives at the low end and the
first grid sampled none of it**; the wider sweep costs the probe 68 s → 98 s:

| Reading of the same day               | n   | mean \|err\| | p90   | max   | past 0.134 | signed |
| ------------------------------------- | --- | ------------ | ----- | ----- | ---------- | ------ |
| **logged** (rows with their moments)  | 441 | **0.086**    | 0.171 | 0.642 | **16.3%**  | +0.056 |
| summed (the pre-2026-08-19 reading)   | 439 | 0.123        | 0.271 | 0.581 | 35.1%      | +0.027 |
| order-only (real order, no breaks)    | 440 | 0.126        | 0.285 | 0.621 | 36.4%      | +0.030 |
| jitter (±15 min on every log moment)  | 441 | 0.087        | 0.180 | 0.642 | 16.3%      | +0.053 |
| batch (every row logged at day's end) | 439 | 0.123        | 0.271 | 0.581 | 35.1%      | +0.027 |

**This table is the PRE-censor reading of the logged arm.** The same grid re-read
after M42's clock censor (2026-08-21, same probe) prices **307** cells at mean
**0.060**, p90 0.116, max 0.206, **3.9%** past the half-width, signed +0.023 —
the class it drops is the censor bullet under "Known approximations" below. The
comparison this table exists for is unaffected: summed and batch are read
identically (no span to run out of), and order-only prices **410** of the same
cells at mean **0.124** where it priced 440 at 0.126 — the same censor, and it
does not move that arm's mean.

**Every pooled figure above is quoted with its λ₀ scope, because the error is
strongly λ₀-dependent** — the omission this section fixed was hidden by an
instrument, and its residual was hidden by a grid:

| λ₀ (120 days each)   | 0.1    | 0.3    | 0.5    | 0.7    | 0.9    | 1.1    |
| -------------------- | ------ | ------ | ------ | ------ | ------ | ------ |
| priced days, logged  | 14     | 47     | 72     | 111    | 111    | 86     |
| mean \|err\|, logged | 0.300  | 0.186  | 0.080  | 0.063  | 0.053  | 0.072  |
| past 0.134, logged   | 78.6%  | 66.0%  | 19.4%  | 8.1%   | 1.8%   | 5.8%   |
| signed, logged       | +0.300 | +0.180 | +0.065 | +0.037 | +0.017 | +0.016 |
| mean \|err\|, summed | 0.310  | 0.201  | 0.114  | 0.118  | 0.105  | 0.086  |
| past 0.134, summed   | 92.9%  | 72.3%  | 34.7%  | 40.4%  | 25.2%  | 11.6%  |

- **ORDER buys nothing.** The order-only arm — the real sessions in the real
  order, logged back to back so no gap survives — scores like the summed
  reading, slightly worse. So "keep the breaks" is the fix and "read the order"
  is not; the canonical order §13.4 settled was never the problem.
- **The batch arm is bit-identical to the summed one** (0 days differ),
  which is the fallback predicate holding: a day whose rows share one moment
  recovers no gap and reads exactly as it did.
- **Logging promptness is a real dependency and a bounded one.** ±15 min of
  jitter on every moment costs 0.001 in mean |err|. `createdAt` is the LOG
  moment, not the session end, so a user who logs late reads a shorter break
  than they took — which biases LOW, the same direction as the old omission and
  far smaller. Recovering 2 days the summed reading censored, the logged arm
  never costs a day.
- **The low end is where the residual is, and it is one-signed HIGH.** At
  λ₀ = 0.1 the logged reading is mean 0.300 with 78.6% past the half-width, and
  the arm is thin because the window-edge censor takes most of it (106 of 120
  days at 0.1, 73 at 0.3): a low-λ₀ user works to the edge. Of the days that do
  price, the mid-range scope this section published before the widening —
  {0.5 … 1.1}, n 380, mean **0.065**, 7.9% past the half-width, signed +0.032 —
  is a real reading of mid-range users and no longer the section's headline. Since
  2026-08-21 the class carrying that residual is censored, which is why the low
  end is now thin rather than wrong: **1 of 120 days survives at λ₀ = 0.1** and 5
  at 0.3, reading 0.061 and 0.108 (the censor bullet below).

**The witness, and what it does to a fit.** Sliders 8/3/8 beside 0/3/2 through
`toEnergyTask`, a 14 h window, true λ₀ 0.7, and the app's own plan for that day:
`t1 3.75 / rest 0.75 / t1 2.25 / rest 0.75 / t1 1.5`. Summed, the day reads
**0.407** — error −0.293 — and its bracket INVERTS (lo 0.469 > hi 0.345), kept
rather than censored because the 0.124 gap is well inside
`STOP_INVERSION_MARGIN`. Read with its two breaks it is **0.730**, error +0.030,
no inversion. A user repeating that day fits λ̂₀ 0.453 → 0.430 → **0.415** at
n = 1/3/10 summed, against 0.615 → 0.673 → **0.709** logged: the old reading
converged confidently on a value 0.29 away from the truth, and the posterior std
beside it never knew.

**The accuracy reference** (same probe, oracle arm). A bracket cannot judge its
own accuracy, so both readings are scored against the λ set on which the
optimizer's plan for the day's own inputs works exactly the observed hours — the
envelope-theorem object this section says it "cannot know", recovered by
bisecting `optimizeSchedule`'s worked hours over [0, 3]. Over 28 priced cells
the midpoint lands INSIDE that set on **20** days read session-by-session
against **13** summed, and its distance to the set's middle is mean 0.067 / p90
0.145 against 0.120 / 0.318 (re-read 2026-08-19 on the widened λ₀ grid, where the
{0.5 … 1.1} scope gave 26 cells, 18 against 11, and 0.064 / 0.145 against
0.125 / 0.318). It stays an ORACLE and never the estimator: ~16
optimizer solves per day is free offline and fatal in a `$derived`, which is
feasibility finding 3 again.

**Where the accuracy claim does NOT hold, and it is silent** (maintainer
decision, 2026-08-19). A batch-logged day degrades to exactly the old numbers,
and nothing on the reading says which kind of day it was — `usedCount` cannot
tell a structure-recovered day from a collapsed one. §8.11's card tooltip
already warns that batch-logged sessions blur the advice; §8.10's card has no
equivalent surface, and the honest cheap version is to count
structure-recovered days and show that count beside the fit. **Not built here**
— it is a UI decision with copy in five locales — and it is recorded as the one
open obligation this correction leaves (ROADMAP, beside item 4's censored
likelihood).

**Two gaps deliberately left open.** The reconstruction still ENDS at the last
logged session, so the live advisor prices "now" as that moment and misses the
recovery since; closing it needs a `now` the model does not take, which would
make `adviseStop` clock-dependent. And the day's START is still unrepresented —
`evaluateSchedule` begins at t = 0, so a day that began three hours into its
window reads as starting at the edge. Both are unchanged from before this
correction, and neither is an oversight of it.

**Censoring.** A day worked to the window edge has no forgone step — it
reveals only `λ₀ ≤ hi`, not an indifference. Symmetrically a zero-work day
reveals only `λ₀ ≥ lo`, and sub-step sessions give no shrink side. A fourth
category (added 2026-07-19, below): a bracket inverted beyond
`STOP_INVERSION_MARGIN` — the day's own data contradicts a rational stop, so
only the one-sided `λ₀ ≤ hi` reading survives. A fifth (2026-08-12): a day
that ends with every task checked off has no forgone step either — the `lo`
side has nothing to maximize over, so it reveals `λ₀ ≤ hi` and nothing more,
the same shape as working to the window edge. All five are dropped, like
demand-0 drain logs (§8.7): keeping a one-sided reading as a point estimate
would bias the mean. `stopBracket` returns the two sides and
`stopIndifferencePoint` is its midpoint, so which side a censored day revealed is
readable without rebuilding the bracket — which the probes below had to.

**The censored likelihood was built, measured and refused** (2026-08-21,
`scripts/censored-stopping-fit.probe.ts`, spec
[`censored-stopping-fit`](docs/features/censored-stopping-fit.md)). Until that
date this paragraph called it open work rather than a settled no, on the grounds
that the fifth category is an ordinary day rather than an edge case. A
Tobit-style one-sided term — `−log Φ((hiᵢ − λ)/σ₀)` for an upper bound,
`−log Φ((λ − loᵢ)/σ₀)` for a lower, σ fixed at σ₀, bisected on `J′`, scaled so a
history with nothing censored reproduces the closed form bit for bit — was
implemented and scored against the shipped drop-censored fit over 90 seeded users
× 12 days at true λ₀ ∈ {0.3 … 1.3}, the five day kinds of
`stop-margin-fit-error.probe.ts` plus the three reachable censored ones. The
gate, fixed before the run, was an improvement past the **0.110** bracket
half-width against σ₀ = 0.25.

- **λ₀ recovery RMSE, mixed cell:** 0.2350 → 0.2055 at n = 3 and
  0.1950 → 0.1458 at n = 12 — a gain of 0.0295 / **0.0492**, 26.9% / 44.8% of the
  gate. The censored fit does use far more of the calendar (54.8% → 80.0% of days,
  91.1% → 100% of users at n = 3), and it is still not worth the 0.110 the
  instrument already concedes. **Kill criterion fired.** (Re-read 2026-08-21 after
  M42's clock censor, which took days out of both arms and raised every RMSE here;
  the pre-censor reading of the same cells was 0.2299 → 0.2015 and
  0.1713 → 0.1277, gains 0.0283 / 0.0437, and the verdict is the same on both.)
- **The fifth category ALONE makes the fit worse:** 0.0962 → 0.1250 RMSE at
  n = 12, bias −0.0144 → −0.1072. Its bound is almost never wrong — the truth
  breaks `λ₀ ≤ hi` on 0.2% of 931 all-completed days — but it is LOOSE, `hi`
  sitting far above λ₀, so the term contributes bias without information. This
  paragraph argued the item from that category being ordinary; ordinary is not
  the same as informative, and that was the gap.
- **A sub-step day's lower bound is wrong essentially always:** the truth breaks
  `λ₀ ≥ lo` on **100%** of 1075 sliver days. A day carrying less than one step on
  everything is an interruption, not a leisure choice — the same reading the
  inversion censor already makes. The window-edge bound is the sound one, violated
  on 1.7% of 286 days — and that count is the third finding: generated honestly,
  by re-planning against a window one step shorter than λ₀ wanted, a
  worked-to-the-edge day is one-sided only 286 times in 1075, because the re-plan
  is still free to rest. The category is rarer than its name suggests.
- **No cell clears the gate, and one loses.** Re-read 2026-08-21, the gains are
  +0.0170 / **+0.0571** honest, +0.0295 / +0.0492 mixed, +0.0540 / +0.0356
  all-censored (n = 3 / n = 12), against −0.0061 / **−0.0288** on the
  all-completed-only cell. The largest of them is under half the 0.110 gate, and
  the all-censored cell is not a like-for-like contrast at all: there the shipped
  arm has no fit, returning the prior for every user, so it is scored against the
  prior's own error.

So the censored likelihood is a settled no and all five categories stay dropped.
What the run leaves behind is the reason, which the sizing never had: the bounds
these days reveal are either loose (window edge, everything ticked) or false
(sliver), and no estimator consuming them fixes that.

**How many days the fifth category costs** (re-measured 2026-08-21,
`scripts/stop-inversion-margin.probe.ts`, the same 394-day population and
completion axis as above; the categorisation's kept count is cross-checked
against `stopIndifferencePoint`'s own at every q). At
q = 0 / 0.25 / 0.50 / 0.75 it takes **0.0% / 4.3% / 23.5% / 60.3% of all dropped
days** — 0.0% / 2.3% / 14.2% / 44.4% of the calendar — and it is the only censor
that grows with completion. Two others fire on this population: the worked-hours
window edge (105 / 104 / 92 / 68 days of 394) and, since M42, the clock (102 / 97
/ 90 / 47 — days whose recovered BREAKS ran the span out, counted after the edge
so the two do not double-count). The window censor itself still reads WORKED
hours, so recovered rest cannot reach it, and no day on this population inverts
past the margin. It fires
**only when every one
of a day's tasks is ticked**: one left open, funded or not, keeps the day alive,
and these days carry 2–4 tasks (mean 2.98). So "an ordinary good day" is right
from q ≈ 0.5 up and rare below it, and that share is the size of what a censored
likelihood would recover — measured 2026-08-21 and refused, because the size was
never the binding constraint (below, ROADMAP item 4).

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
  lattice bracket's half-width — a median **0.125** over 175 non-inverted days
  (`scripts/stop-inversion-margin.probe.ts`, 2026-08-21 past the clock censor: the
  bracket got WIDER once the day's breaks entered the reconstruction — 0.129 over
  274 days on 2026-08-19 — where the break-free reading gave 0.110 over 279 days
  on 2026-08-06 and 0.109 over 281 on 2026-08-17 — see §10 for the drift across
  this section's earlier figures), not the 0.15 this
  line asserted from one probe day —
  plus day-to-day mood
  in the stop decision, which no instrument separates); σ̂² blends σ₀ with
  residual scatter as in §8.7; posterior std = √(σ̂²/(n + λ)).
- **Bounds** = the Energy Lab's freeTimeValue input range [0, 3], same
  representability/absurdity-guard role as the α and r bounds.

**Known approximations (deliberate).**

- **Breaks WERE omitted from the reconstruction, and calling that noise was the
  defect this section carried longest** (deleted 2026-08-19, not amended). The
  bullet read "reservoirs run slightly hotter than reality, understating late
  marginals; absorbed as noise". Measured, it was
  one-signed — the fit read LOW — on roughly a third of the days the app itself
  plans, with no censor flagging any of them, and some of those days inverted
  their bracket inside the margin and entered the fit as biased point estimates
  anyway. What replaced it is the reading above; what remains of it is the
  fallback path, where the same understatement still applies and is now named
  rather than assumed away.
- **The reconstruction reads the LOG moment, not the session end.** A user who
  finishes at 15:00 and writes the rating down at 15:40 hands the estimator a
  40-minute-shorter break than they took, which understates recovery in the same
  direction the omission did. Measured cost of ±15 min of that: 0.002 in mean
  |err| (above). Over-estimating a break saturates harmlessly; under-estimating
  costs roughly linearly.
- **Wall-clock moments cross DST changes and device clock adjustments.** A
  negative delta floors at 0, so the two sessions read as adjacent — today's
  behaviour. An absurd positive one consumes the whole rest budget and flattens
  the day's real breaks to nothing through the proportional scale.
- **A day that ran out of wall clock is CENSORED** (M42, built 2026-08-21). The
  class is the day whose own **span** — worked hours plus the breaks recovered
  from its own log moments, before the cap below — leaves no room for another
  step. Such a day did not stop because leisure got cheap; it stopped because the
  clock ended, so it reveals no indifference and `stopBracket` returns null on it.
  Measured on the same grid as above, before and after, by
  `scripts/stop-block-structure.probe.ts`'s clock-censor arm (2026-08-21; class
  membership is the probe's own span test, so it is the same cells in both runs,
  and the BEFORE half is that arm run against the pre-censor reader at the parent
  commit — not a reconstruction of it):
  the class holds **134 of the 676 cells**, and every one of them was priced
  before — **134 of 441 (30.4%)**, entering the fit as voluntary stops at a signed
  error of **+0.131**, one-signed by λ₀: **+0.319** at λ₀ = 0.1, +0.196 at 0.3,
  +0.080 at 0.5, +0.060 at 0.7, +0.005 at 0.9. Those signed figures are the BEFORE
  half; past the censor the arm has no class cell left to price and prints n/a,
  which is the check that the class is fully gone. Censoring them takes the
  bracket's containment failure — how often it excludes the λ₀ the day was
  planned at — from **61 of 441 (13.8%) to 1 of 307 (0.3%)**, and the error over
  what still prices from |err| mean 0.086 / p90 0.171 to **0.060 / 0.116**.
  **What it costs is days, unevenly:** the fit prices 307 cells where it priced
  441, and the loss is concentrated where λ₀ is small — at λ₀ = 0.1 exactly **1 of
  120** days survives, where 14 did before. Most of that low end was never this
  censor's: the worked-hours window edge already took 106 of those 120 days
  (2026-08-19 table above). A low-λ₀ user therefore calibrates from far fewer days
  than a mid-range one, which is the price of not calibrating from days the clock
  ended.
- **Recovered rest is still capped to leave one step of room, and that cap now
  only bites on days the fit has already censored.** `scale < 1` means
  `worked + rest > W − step`, which is exactly the class above, so every day that
  reaches the fit is read with its breaks UNSCALED. The cap survives for §8.11,
  which applies no censor and must still hand `normalizeSchedule` a schedule that
  fits. On the fallback path (a batch-logged day, or one whose moments are
  unusable) there is no span to read, so no day is censored for the clock and the
  break omission named at the top of this list applies unchanged.
- **Partial logging under-counts W.** A user who rates only some tasks
  looks like they stopped earlier than they did, biasing λ₀ up. Accepted:
  the calibration is for users who log consistently, and σ₀ is wide.
- **The checkbox is the only scope the model has.** Tasks carry effort, not
  an amount of work: an open task is bottomless, satiety being the only
  thing that flattens it. So the `lo` side still asks "was another 45 min of
  this worth it?" of a task with 20 minutes of real work left, and a
  finished-but-unticked task reads as forgone work exactly as before the
  2026-08-12 correction. The correction buys the case the user did record;
  the rest stays noise, in the same upward direction as partial logging.
- **The loose max on the `hi` side** biases midpoints up by ~+0.1 on the
  probe grid — inside one lattice bracket's half-width, i.e. below the
  instrument's resolution. **Re-measured 2026-08-06 and smaller than that;
  re-read again 2026-08-19 with each day's breaks in the reconstruction**
  (`scripts/stop-inversion-margin.probe.ts`): against the honest `hi` (the
  marginal of the step actually worked last) the bias over 274 days is **mean
  0.027, median 0.000, p90 0.111**, where the break-free reconstruction read
  mean 0.045 / p90 0.164 over 282. It is zero on most days and only occasionally
  reaches the quoted 0.1. The conclusion is unchanged and the direction is right;
  the magnitude was overstated twice. Note the justification has also weakened:
  "the work order is unobserved" is false on a timestamped day, so the loose max
  is now a deliberate looseness rather than a forced one — the honest `hi` (the
  last row's own last step) is available and reads |err| 0.048 against 0.052 on
  a 2026-08-19 side arm, too small to bundle into this change.
- **Block ORDER is OBSERVED on a timestamped day, and a modeling choice only on
  the fallback path** (2026-08-19). The marginals genuinely depend on order
  through the reservoirs — the same probe step scored 0.65 appended last vs 0.37
  inserted first — and canonical placement (§13.4) is what made the estimator a
  function of the day rather than of an implementation convention. It is still
  the rule for the day's fallback reading and for where an UNLOGGED task's probe
  block lands. What the measurement adds is that order was never the error term:
  the real order with the breaks squeezed out scores like the canonical one
  (0.126 against 0.123 mean |err|, above), so §13.4's fix was right and small,
  and the thing worth having was the breaks.
- **Inverted brackets beyond a margin are censored; small inversions keep
  their midpoint** (probed and revised 2026-07-19). The two revealed
  inequalities can contradict: `lo > hi` means extending some task was worth
  MORE per step than the most valuable step actually worked — no λ₀
  rationalizes such a day (typical cases: a session cut short mid-warm-up,
  or a long grind on a weak, satiating task while a high-amplitude task sat
  unstarted). On arbitrary random compositions about HALF of days invert
  (89/185; **re-measured 2026-08-06: 144/368 = 39%**, re-read 148/368 = 40.2% on
  2026-08-19, `scripts/stop-inversion-margin.probe.ts`) — but on the estimator's
  intended regime they mostly don't. **"Zero" was too strong on the break-free
  reconstruction — optimizer days inverted on 4 of 315 — and it is TRUE again now
  that a day carries its own breaks** (2026-08-19): the optimizer's own plans
  invert **0 of 191** (0 of 299 before the 2026-08-21 clock censor took the days
  that ran out of wall clock out of the population). Their ±1-step "mood" variants
  still do, on **47 of 926**,
  of which **14 land past the margin and are censored** — worst gap **0.399**. So
  a small number of genuinely near-rational days ARE discarded, and the inversion
  gap does not cleanly separate the two populations: inverted random compositions
  gap a median 0.303 (p90 0.622, max 0.906) while honest mood days reach 0.399.
  Inversion remains a useful DETECTOR — 148 of 368 against 47 of 926 is a
  strong signal, and the contamination
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
  re-measurement** (2026-08-06, re-read 2026-08-19,
  `scripts/stop-inversion-margin.probe.ts`): the loose-max bias is median
  0.000 / mean 0.019, and the bracket half-width on non-inverted days is
  median **0.125** (mean 0.123, p90 0.167) rather than 0.15 (re-read 2026-08-21
  past the clock censor, over 175 days; it was 0.129 / 0.129 / 0.176 over 274
  before it). The two medians sum to **0.125**, not 0.25 — so 0.25 is roughly twice the instrument slack
  it is described as, and the arithmetic in the parenthesis above should be
  read as a rationalization rather than a derivation. It is nonetheless not
  obviously mis-set: widening slack is what keeps mild inversions, and even at
  0.25 fourteen near-rational mood days out of 926 are still censored, so tighten
  it and that number grows. An earlier revision kept ALL inverted
  midpoints, reasoning σ₀ would absorb the contradiction — the
  contamination probe above superseded that. Locked in as unit tests: a
  strongly inverted day is censored and a mildly inverted day still enters
  the fit.
- **Re-derived 2026-08-13, and it is not derivable**
  (`scripts/stop-margin-fit-error.probe.ts`): the margin was swept against the
  thing this section actually cares about — λ₀ fit RMSE over 90 simulated
  users (true λ₀ on {0.3 … 1.3}, 12 days each) built from five day kinds (the
  optimizer's own plan, a ±1-step mood variant, two interruption shapes — a
  tail cut and an interior run dropped mid-warm-up — and a grind on the
  weakest task). **The RMSE is FLAT across [0.1, 0.5].** Re-run 2026-08-19 on days that carry
  their own breaks (the sweep's day generator could not express one before — it
  flattened each plan to a work-step sequence that dropped rest, which is how
  the break-omission bias stayed invisible to the probe built to price this
  constant): re-read 2026-08-21 past the clock censor, at n = 12 days per user it
  moves 0.1200–0.1202 on honest days
  (spread 0.0002) and 0.1581–0.1657 on a 30%-interrupted mix (0.0076); at n = 3,
  where the prior gives ONE day half the fit and the constant has whatever
  leverage it has, 0.1380–0.1383 (0.0003) and 0.1748–0.1836 (0.0089). Every level
  is worse than the 2026-08-19 reading of the same sweep (0.0908–0.0910,
  0.1349–0.1399, 0.1263–0.1265, 0.1619–0.1710) for the reason M42 predicts: the
  censor takes days out of every arm, and a fit reads fewer of them. The
  break-free reading before that gave 0.0872–0.0885, 0.1230–0.1308,
  0.1355–0.1401 and 0.1583–0.1632. **Flat here is a claim about MAGNITUDE, in λ₀
  units, not about error bars overlapping**: the largest movement anywhere in the
  range is **0.0089**, which is 6.6% of the 0.134 bracket half-width that probe
  still prices against and 3.6% of σ₀ = 0.25 — an order of magnitude below the
  instrument's own resolution. (Comparing that spread against the RMSE's
  sampling uncertainty would prove nothing: one user sample is scored at every
  margin, so that uncertainty is common to all of them.) The mechanism is that
  the range barely changes any verdict: the kept-day share — of ALL simulated
  days, structurally censored ones included — moves 75.9% → 76.7% (honest, n = 3)
  and 74.1% → 78.6% (contaminated, n = 12) from m = 0.1 to m = 0.5. The drift
  that does exist is **detectable but negligible, and no longer consistent in
  sign on the honest arms**: the a-priori endpoint contrast RMSE(0.5) − RMSE(0.1)
  reads −0.0003, +0.0002, −0.0089, −0.0076 (paired-bootstrap 95% CI over users,
  400 resamples: [−0.0008, +0.0000], [−0.0000, +0.0005], [−0.0178, −0.0022],
  [−0.0172, +0.0001]) — the two honest arms are now indistinguishable from zero
  in both directions, and only the contaminated arms still say wider censors less
  and fits very slightly better. On the break-free reading all four were negative
  (−0.0046, −0.0011, −0.0049, −0.0078). So the constant does not matter over
  that range; **0.25 stands as an arbitrary point inside a flat region, and
  the arithmetic above does not derive it.** The constant is NOT changed: a
  movement this far below the instrument's resolution is no evidence to move
  it, and moving it would touch shipped behaviour and two pinned tests.
- **The margin cannot price the contamination it exists for** (same probe,
  2026-08-13) — the result that changes how the bullet above should be read.
  Both halves of the motivation reproduce (figures re-read 2026-08-19 with each
  day's breaks in the reconstruction): interrupted days DO land at the curves'
  characteristic marginal regardless of the truth (indifference point p50
  **1.018** tail-cut and **1.044** mid-cut, against **0.969** on rational days
  whose own true λ₀ averages 0.8; |point − truth| p50 0.236 / 0.214 against
  **0.053**), and contamination DOES cost real fit error (RMSE **0.1202** honest
  against **0.1619** contaminated at n = 12, m = 0.25). But the large majority of
  interrupted days never invert at all — 28.6% and 26.6% invert, and only
  17.3% / 20.5% pass 0.25 — so censoring at any margin in range leaves that error
  essentially untouched. **Censoring NOTHING (the m = ∞ control) is the best arm
  in all four cells** (0.1380 / 0.1202 / 0.1720 / 0.1460): against the shipped
  0.25 it gains 0.0000 / 0.0000 / 0.0077 / **0.0159**, and that 0.0159 at
  contaminated n = 12 is the largest single movement anywhere in the sweep. Small in absolute terms — still under a
  tenth of σ₀ — but CONSISTENT in sign on the two contaminated arms and an exact
  tie on the honest ones (2026-08-21), which points at
  something the margin bullet above does not: the probe's own suggestion is
  that inversion censoring buys the λ₀ fit nothing at all, which is a stronger
  claim than "the constant does not matter". It rests on one arm's margin and
  sits inside that arm's noise, so it is recorded, not acted on — the
  censoring rule is unchanged. The margin is a dead end, and so, since
  2026-08-21, is the censored-likelihood fit this section once pointed to as
  where the remaining value was (above).

**What reading the breaks costs the contamination DETECTOR** (measured
2026-08-19, `scripts/stop-margin-fit-error.probe.ts`, the same days read both
ways). This is the risk of the correction: recovering a day's breaks makes it
look more RATIONAL, so an interrupted or grind day could stop tripping the
inversion censor and enter the fit as a biased point estimate instead. Measured,
almost nothing moves and what moves goes the right way:

| Day kind                  | inverted (summed → logged) | past 0.25 (summed → logged) |
| ------------------------- | -------------------------- | --------------------------- |
| rational                  | 1.8% → **0.0%**            | 0.0% → 0.0%                 |
| ±1-step mood              | 5.5% → 3.0%                | 0.3% → 0.0%                 |
| interrupted tail          | 30.3% → 28.6%              | 18.0% → 17.3%               |
| interrupted mid           | 25.4% → 26.6%              | 21.1% → 20.5%               |
| grind on the weakest task | 80.6% → **80.6%**          | 63.9% → **63.9%**           |

The grind row is identical because a grind day is one contiguous run on one task
— it has no break to recover — and the interrupted rows move by less than two
points in either direction. The detector's input population is therefore
untouched; what the correction removes is the detector firing on HONEST days,
which is the 1.8% → 0.0% row. (This is the arm that would have disqualified an
alternative design that INFERRED the breaks instead of reading them: inferring
partly repairs an irrational day, and grind-day censoring measured 80.0% → 50.2%
under it.)

**Probe results (2026-07-19, locked in as unit tests, re-read 2026-08-19):**
synthetic user at λ₀ = 0.9 over three windows fits to within [0.75, 1.05]
against the 0.5 prior — 0.8387 reading the sessions as logged against 0.8449
summed, and the suite pins that the two readings DIFFER, not which of them lands
closer: closeness is a population property, and on these three days the summed
reading happens to land nearer. Over 441 cells
`scripts/stop-block-structure.probe.ts` puts logged at |err| mean 0.086 against
summed 0.123, past the half-width on 16.3% against 35.1%, and ahead at every one
of the five λ₀ levels; extraction bit-identical under
freeTimeValue 0 vs 3, on both readings (log moments are wall-clock numbers and no
slider reaches them, so λ₀-freeness is structural); earlier stops yield higher
indifference points; censored/empty/sliver days drop to `fitted: false`; std
shrinks with data; W\*(λ₀) graded (the §8.3 update); deterministic. (Those pooled
figures are the pre-censor reading — the table above carries both.) The
break-omission correction added four pins, and two of them were rewritten by
M42 on 2026-08-21: the witness pair (0.730 logged / 0.407 summed) and the
fallback (rows sharing one moment, and a row with no usable moment, both read
exactly as summed) stand; the 9 h logged span inside an 8 h window is now
CENSORED by the fit while `adviseStop` still refuses `window-full` on it, and the
probed session is priced at the clock the day has left rather than at its full
length out of the recovered break — a session inside that clock never overhangs,
which is why the trim that paid for the overhang is gone.

**UI.** A third calibration card ("Stopping Calibration") follows §8.7/§8.9's
pattern — fitted λ₀ ± std with used-day count and an explicit **Apply**
button — but needs no editor of its own: its observations are derived from
already-logged 🪫 drain ratings joined with each day's stored session
(tasks + window), excluding today (an unfinished day has not revealed its
stop yet). Since M42 the card also carries a line naming how many days the clock
censor dropped (`clockCensoredCount`) — "3 days ran out of clock, so their stops
are not counted" — so a used-day count that fell has a stated reason on screen
rather than looking like lost data.

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
finished — one block per logged SESSION, in the order the rows were logged, with
the space between them as rest, read off the rows' own `createdAt` (§8.10,
corrected 2026-08-19; a day whose rows carry no usable moment falls back to one
contiguous block per task in canonical order) — and priced by the same λ₀-free
work value `V = satiatedOutput + terminalBonus`. No new parameters, no new
logging instrument.

**This is the more exposed of the two readings, and it moved most.** §8.10
censors a day whose bracket contradicts itself; the advisor censors nothing, so
before the correction it simply priced today against a day hotter than the one
the user had. Measured on the witness §8.10 states — sliders 8/3/8 beside 0/3/2,
a 14 h window, true λ₀ 0.7, the app's own plan for it stopping at 9.0 h — the
summed reading says **stop at t = 5.25 h**, the first checkpoint after the first
planned break, at 0.674 against λ₀ 0.700, and holds `stop` for the rest of the
day while naming the WRONG task (t2 for 1.5 h at 0.567, with t1 worth 0.862).
Reading the breaks it continues there at 0.979, continues through 8.25 h, and
reads `stop` at exactly 9.0 h (0.697) — agreeing with the plan's own stop. Over
the day's 10 checkpoints the verdict differs on 4 and the task named on 4
(`scripts/stop-block-structure.probe.ts`).

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

The direction holds and the ≥ 0.9 gap is real. **Re-run 2026-08-19**, with the
walk carrying a wall clock so each checkpoint's rows hold the moment they were
logged and the advisor reconstructs the day's real breaks — the probe could only
express a break-free day before, which is why §8.10's break-omission bias was
invisible here too. Mid-day false stops, λ₀ 0.3 / 0.5 / 0.9 / 1.3: one-step
0.5% / 1.2% / 11.0% / 19.1% versus session **0.5% / 0.7% / 0.7% / 0.6%**, over
759 / 681 / 410 / 162 mid-day checkpoints. At-stop agreement is IDENTICAL between
the arms at every level (27/31, 40/52, 67/69, 72/72) and neither arm is ever more
than 1 step late, so pricing sessions costs nothing at a rational stop.

**What the correction itself moved, measured on the same walk** (the probe now
scores the session arm twice — once on the day as logged, once on the summed
reading it used to get):

| λ₀ (72 seeded random days)       | 0.3   | 0.5   | 0.9   | 1.3   |
| -------------------------------- | ----- | ----- | ----- | ----- |
| mid-day false stops, summed      | 0.9%  | 4.1%  | 7.3%  | 6.2%  |
| mid-day false stops, as logged   | 0.5%  | 0.7%  | 0.7%  | 0.6%  |
| at-stop agreement, summed        | 22/31 | 40/52 | 67/69 | 71/72 |
| at-stop agreement, as logged     | 27/31 | 40/52 | 67/69 | 72/72 |
| max lateness, summed → as logged | 1 → 1 | 2 → 1 | 1 → 1 | 1 → 0 |

That is the breaks-omitted bound being REMOVED rather than sized, and it is the
whole of it: the session arm's mid-day false stops fall to under 1% at every
level, at-stop agreement never worsens and improves at two levels, and the "never
more than 1 step late" reading — which stopped holding at HEAD on 2026-08-17, at
2 steps at λ₀ = 0.5 — holds again, because that lateness was the summed reading's.

Three corrections to the table's own reading. The agreement denominator is not
the day count: at λ₀ = 0.3 only 31 of 72 days stop INSIDE the window, the rest
fill it and read `window-full` (§8.10's censored category), so "33–39/40" was
counting days that revealed no stop decision. Agreement is λ₀-dependent, not
flat — 71% at λ₀ = 0.3 against 99% at λ₀ = 1.3. And the residual session false
stops were rest-adjacent 2 of 27 at λ₀ = 0.9, not "roughly a third" (6 of 27 at
λ₀ = 0.5) — so the breaks-omitted approximation explained less of the residue
than claimed, even though removing it is what took the residue away. Re-read
2026-08-19 on the day as logged there are 4 / 5 / 3 / 1 residual false stops at
the four levels, of which 0 / 2 / 3 / 1 are rest-adjacent, against 7 / 28 / 30 /
10 residuals (1 / 7 / 3 / 4 rest-adjacent) on the summed reading: the residue is
an order of magnitude smaller and what is left of it sits mostly beside a rest.

Where it did bend (curated fixture, 13 windows of 6–18h over four
high-amplitude, high-demand tasks — a day the plan spends on planned rest): on
the summed reading BOTH arms run 2–4 steps late and at-stop agreement collapses
to 0/4, 0/9, **1/13** at λ₀ ≤ 0.9. **That was the breaks-omitted bound, and
2026-08-19 pays it off**: read as logged, the same fixture's at-stop agreement at
λ₀ = 0.9 is **11/13** and its max lateness falls from 4 steps to 1. The two
λ₀ ≤ 0.5 cells stay at 0/4 and 0/9, and at λ₀ = 0.5 the correction makes lateness
one step WORSE (2 → 3): those are the fixture's windows the plan works nearly to
the edge, where a recovered break leaves the reservoirs cooler than the advisor's
own tail assumption and it keeps recommending one more session. It is the one
cell in the run where reading the breaks costs something. Mid-day the fixture still separates the two lookaheads most: at
λ₀ = 1.3 the one-step arm false-stops on **14.9%** of checkpoints against the
session arm's **1.0%** (the summed reading gave 31.7% against 9.9%).

**Candidates vs reconstruction.** The max runs over the OPEN tasks only
(`openTaskIds` on the observation, the unchecked ones): "one more session
of a task you already checked off" is no advice. Every logged task stays in
the reconstruction regardless — a completed task's hours drained the
reservoirs the open ones must work with (test-pinned: the same open task
prices strictly lower after 4.5 logged hours on a completed one). This makes
the advisor a **next-up-family** reading under §11.8 — it responds to
completion, unlike the plan. §8.10's `lo` bound reads the same field, for the
same reason, since 2026-08-12; the asymmetry recorded here until then was a
defect, not a design.

**What the filter is worth** (Probe 2026-08-17,
`scripts/stop-advisor.probe.ts`, the same two day sets as the table above, with
completion **derived from the plan rather than drawn**: a task is checked off
exactly when the remaining plan holds no more blocks for it, and a task the plan
never funded stays open all day.) The **verdict** rarely moves — it differs on
0.4–2.1% of comparable checkpoints over the 72 random days and 0.0–7.9% on the
warm-up fixture — and in all eight cells the difference is **always
continue→stop, never stop→continue**, which is §8.10's monotonicity bound
holding on the forward reading too. What moves is the **recommendation**: where
the verdict agrees, the advisor names a different task on 5.5–10.3% (random) and
4.1–15.8% (fixture) of checkpoints, and naming a task the user already ticked is
the defect the filter exists to remove. At the plan's own stop the filter is
strictly better and never worse: at-stop agreement 10/10 against the unfiltered
8/10 at λ₀ = 0.9 on the fixture (4/4 against 0/4 at 0.5, 67/67 against 65/67 on
the random days at 0.9, 18/18 against 15/18 at 0.3), and max lateness never above
it (0 against 1 step at λ₀ = 0.9 on the fixture). The advisor's own version of
§8.10's fifth category — nothing left open, no verdict at all — costs
0–25 checkpoints per λ₀, **every one of them at the plan's stop**, which is where
it is harmless. (Re-read 2026-08-19 on the day as logged; the verdict-difference
shares are 0.9 / 2.4 / 0.6 / 0.0% on the random days and 0.0 / 2.1 / 1.2 / 9.6%
on the fixture, still always continue→stop and never the reverse, and the
different-task shares 5.0–11.1% and 3.1–10.7%.) The one-step replica
takes the same filter and still reproduces `adviseStop`'s price exactly (0
mismatches). The one-step-vs-session table above is unmoved by this: that arm
sets no completions. (Re-run at HEAD its rates read 20.2% / 24.7% against
7.3% / 6.2%, where 2026-08-06 measured 19.7% / 24.7% against 6.6% / 6.2% — model
drift since that date, not a re-measurement; the gap and every reading of it
stand. The 2026-08-19 re-run's summed column reproduces that 7.3% / 6.2%
exactly, which is what validates it as the before-column of the table above; its
at-stop 40/52 against the 42/52 recorded on 2026-08-17 is more of the same
drift.)

**Bounds of validity, stated on the card's tooltip:** the reading trusts
today's 🪫 logs, so unlogged work reads as free time (the advisor will say
"continue" too eagerly) and batch-logged sessions blur it — same
partial-logging caveat as §8.10, now visible in-day. Since 2026-08-19 the
batch-logging half has a precise mechanism rather than a vague one: rows written
down at one moment recover no gap, so the day reconstructs as the summed reading
and the whole break correction above simply does not apply to it. The advice is
no worse than it was; it is just not better, and the card cannot tell the user
which kind of day it read (§8.10 records that as this correction's one open
obligation).

**One bound is specific to the forward reading** (added 2026-08-05, its reason
restated 2026-08-19): `growBy` places the probed session at the candidate's
CANONICAL rank among the work blocks — before any rest that followed the last
lower-ranked one — so a candidate that outranks the logged work is priced AHEAD
of it, on fresher reservoirs with an intact warm-up, which can only over-price
`continue`. The convention is unchanged; **one of its two stated reasons is
now false and must not be quoted.** It used to read "`StopObservation` carries
no order, so the reconstructed past is itself canonical, not chronological —
appending places the future after a fiction, not after the real day". On a
timestamped day the reconstructed past IS the real day in its real order, so
appending would place the future after the truth. What still holds is the second
reason, and it is the one doing the work: appending does not measurably help.
Re-running the probe design above put the two conventions within one checkpoint
of each other with canonical taking fewer mid-day false stops, and on §13.4's own
fixture days read with their breaks the two agree to four decimals
(`scripts/rv13-stop-insertion.probe.ts`, 2026-08-19, and again on 2026-08-20
after that day was moved onto the sliders — identical on all seven uncensored
cells). A logged task's session is
a separate matter and always grows at the LAST of its blocks — the day continues
from where it stopped. (The 2026-08-05 counts once quoted here — 104 vs 103 wrong, 79 vs 84
false stops, a 2.4× gap on the days §8.10 calls non-rational — came from a sweep
that was not committed; `scripts/stop-advisor.probe.ts` has no append-last arm
and prints none of them.) Verdicts: `continue` /
`stop` (strictly: continue iff best session > λ₀, so exact indifference reads
as stop, matching §8.10's `stopped ⇒ λ₀ ≥ lo`), plus `window-full` when no
whole 45-min step fits in what remains of the window — logged hours filled
it, or the window is smaller than one step — and no verdict at all when
there is no window, no tasks, or nothing left unchecked.

**Implementation sharing (R3).** `reconstructStopDay` + `growBy` are one
definition used by both readings; `stopBracket`'s `lo` is `bestNextStep`, the
m = 1 slice of the advisor's search (and `stopIndifferencePoint` is that
bracket's midpoint). The fit itself is
untouched — its bracket stays one-step, because discrete stationarity of an
observed stop is a statement about the marginal step, not about hypothetical
sessions.

Three things the shared definition needed once a day could hold more than one
block per task (2026-08-19, all three unreachable before and silently wrong the
moment a rest block existed):

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
  (`trimRest`, deleted 2026-08-21).** While `adviseStop` probed m = 1 … room with
  `room = floor((W − worked)/step)`, the grown extent worked + breaks + m·step
  could exceed W for m ≥ 2, and `normalizeSchedule`'s
  `Math.min(b.hours, windowHours − used)` would silently CLIP the probed session
  — pricing a long session on less work than it asked for, which biases toward
  `stop` exactly where the session lookahead is the whole point. The session cap
  below removes the case: a session that fits the clock the day has left cannot
  overhang the window, so the trim became unreachable and went with it. If the
  cap is ever loosened, this defect comes back and the trim has to come back
  with it.

**The two window questions are answered differently, and that is the ruling**
(M42, 2026-08-21). The `window-full` GATE reads WORKED hours: a verdict must not
be decided by recovered structure — moving the room test to the day's full extent
would say `window-full` to a user with hours left; the retrospective side of the
same test is what censors **134 of the 441 cells (30.4%)** §8.10's fit used to
price (2026-08-21, above). The session LENGTHS priced past that gate read the day's **span**
(worked hours plus its UNCAPPED recovered breaks):

```text
longest = max(1, min(room, floor((W − span)/step)))
```

floored at one step, so a day already past its window is still advised on — the
last checkpoint of the day is the one a user reads to decide whether to keep
going, and blanking it is worse than naming the smallest session there is.

**What the worked-hours rule cost, and what the cap recovers** (measured
2026-08-21 before and after, by `stop-advisor.probe.ts`'s over-clock arm — the
same walk it already ran, so the count is committed rather than scratch. The
`142 of 445` / `143` / `61` figures this paragraph carried from a 2026-08-19
scratch run are withdrawn, not confirmed: the committed instrument reads its own
population). Before, on the 72-random-day arm: the advisor priced a session
longer than the day's remaining wall clock at **51 of 2236 priced checkpoints**,
2 of them mid-day, 20 under a `continue` — and **5 of them past the one-step
floor**, i.e. genuinely longer than a day with clock left could hold. After:
**46 of 2236**, none mid-day, 18 under a `continue`, and **0 past the floor** —
every remaining case is the deliberate floor on a day with less than a step
left. The warm-up-heavy arm reads 20 of 686 both times, 0 past the floor both
times. So the cost is now paid only where the floor states it, and the copy no
longer invites a session the day cannot hold.

### 8.12 The budget curve — what the day's LENGTH is worth (added 2026-08-08)

**The question.** Every other model input is a measurement of the user (§14
rules `switchCost` and the pools out of the lever set for exactly this reason).
The day window is not: it is the one number that is a choice about _today_, and
`/energy` had no instrument for it at all — the Lab prices when to stop within a
given window (§8.11) and never how long the window should be.

**Two obvious objectives, both ill-posed.** Measured before building anything
(`scripts/budget-advisor.probe.ts`, 120 seeded days, 2–6 tasks, budget
0.75–14 h at 0.25 h):

- **Maximizing `valueVsClassic` (§30) picks a median 2.25 h day** (p10 1.5, p90
  3.25, max 5.25) — and taking it costs a **median 59%** of the day's own net
  value (p10 46%, p90 68%). The argmax is a property of the **rival**, not of
  the day: the classic allocator reserves `(m−1)·switchCost` out of the budget
  and spreads across tasks, so a tiny window is where it is worst and the ratio
  peaks there. This is §21.4's warning arriving on the other mode.
- **Maximizing `objective` picks the top of the range on 100% of days** —
  exactly 120/120, the argmax reading 14.00 h at min, median and max alike
  (re-measured 2026-08-19, in the run that reproduces the bullet above
  unchanged; [2026-08-08: **99%**] — the distribution is a point mass, which is
  why the count is now stated rather than a percentage). It pays
  λ₀ for every free hour _inside_ the window, so it rises with the window
  whatever the day contains. This is the same monotonicity that keeps §14's
  `budget + 1` lever deliberately **unpriced** (`isPriced` in `plan-advice.ts`);
  the Lab differs only in having a λ₀ to charge against.

**The definition that shipped.** One `optimizeSchedule` per budget on the §8.8
lattice, each plan re-scored on a **common horizon** `W = maxBudgetHours`:

```text
dayValue(0) = evaluateSchedule([], tasks, W, params).objective        -- the do-nothing day
dayValue(b) = runningMax over 0 ≤ b' ≤ b of
              evaluateSchedule(plan(b').blocks, tasks, W, params).objective
valuePerHour(b) = slope at b of the concave majorant of dayValue over {0, step, …, W}
recommendedHours = smallest b > 0 maximizing dayValue, or null when that is W,
                   or null when no b beats dayValue(0)
```

The common horizon is the whole trick, and it changes no formula: on one
horizon the free-time term is `λ₀·(W − work)` — a constant, minus λ₀ per hour of
**work** — so an hour left free inside the window and the same hour outside it
are worth the same and cancel, leaving only committed work charged. The
terminal term is likewise read at the same clock time for every budget. It is
`objective` throughout, which is what keeps this clear of §30's mistake:
nothing is scored on a field the optimizer was not aiming at.

**Everything is read against the do-nothing day,** `dayValue(0)`: the same score
on the same horizon with an empty schedule. It costs no solve — at budget 0 the
plan is empty by definition — and it buys the two things the sweep cannot state
without it. The shortest window swept gets a real marginal instead of a zero
standing in for a missing predecessor; and "no budget is worth working" becomes
expressible, where a sweep starting at `step` has to invent an answer. The first
cut seeded the running max at `−∞`, so the first budget always "rose" and the
knee fell back to `step` whenever nothing later did: on a day the model declines
to work at any length — reachable from λ₀ ≈ 1 up, inside the 0–3 slider and
inside §8.10's fit range — the card recommended a **45-minute day booking 0 h of
work**, under copy saying an hour past it adds nothing. Those days are counted at
each λ₀ in `scripts/curve-shape.probe.ts`: **0/60** at λ₀ ≤ 0.75, **9/60** at 1,
**29/60** at 1.25, **57/60** at 1.5, **60/60** at 2 and 3 — every one of them a
bogus recommendation before the fix. Caught in review; the baseline is the fix,
and the second null below is what it makes sayable.

**`valuePerHour` is therefore NET of λ₀, and its break-even is zero.** The
free-time term above is already inside `dayValue`, so the free time an extra hour
of window costs is charged before the difference is taken. Break-even is `0` — the
card plots it against a **zero** baseline and reports λ₀ as a price in words.
Reading this curve against a λ₀ **line** would charge λ₀ twice, and the error is
not cosmetic: on the shipped e2e day (one task at the form defaults, λ₀ = 0.5,
12 h cap) the curve passes 0.5 at **3 h** while the day's value goes on rising to
**8.25 h** — a λ₀ line would have marked a window 5¼ hours short of the one the
model recommends, and on a default two-task day it would have drawn the curve
below the line at 13 of 16 points beside copy saying it never got there. The
first cut of this card did exactly that; caught in review before it shipped.

**Why the marginal is a hull slope and not a step difference.** `plan(b)` books
whole §8.8 steps, so `dayValue` is a **staircase**: a 45-minute step of window
either does or does not seat another block, and between the two it is flat. Its
raw difference is therefore a spike train, not a marginal — it returns to zero
wherever a step failed to seat work and then climbs back out. Measured on the
raw definition over 60 seeded days at the defaults and the shipped 12 h cap
(`scripts/curve-shape.probe.ts`, which reconstructs the raw difference from
`dayValue` so both arms stay re-runnable): **0 of 60 days fell monotonically**,
**32 of 60 returned above zero after touching it**, up to **11 zero-touches on
one day**, and on **8 of the 8** days with a recommendation the first zero landed
1–13 steps **before** it — as much as 9¾ h early. (Re-measured 2026-08-19; the
two counts moved with the 2026-08-13 §8.6 solver fixes, which change which
45-minute steps seat a block. [2026-08-08: **34 of 60**, and **7 of the 8** — the
one exception that sentence carved out is gone.] `fce8eb9`, the break-placement
fix, owns the first: 34 at `cbfff71`, already 32 at `eb9012e`. The second moved
at both — 7 of 8 at `cbfff71`, 8 of 9 at `eb9012e`. Every figure the majorant arm
backs held across the same change, which is this paragraph's own argument
arriving from the other side: the hull slope is invariant to which step the
lattice happens to seat work on.) The first cut plotted that spike train under
copy promising a falling curve whose zero is the answer.

`valuePerHour` is instead the slope of the **concave majorant** of `dayValue` —
the least concave function lying above it at every lattice point, computed as a
monotone-chain upper hull in `concaveMajorantSlopes`. The raw difference answers
"did _this_ 45 minutes happen to seat a block", which is a question about the
lattice; the hull slope answers the one the card asks — over the stretch of
window the lattice needed in order to seat more work, what did an hour buy on
average. Formally it is the standard concavification: the majorant is the value
of the best **mixture** of day lengths averaging `b`, which is the right object
when the reader is choosing a habitual window rather than a single day.

Three properties follow, and the card's copy rests on all three (pinned in
`zenith-energy.test.ts`, re-measured over the same 60 days):

- **Non-increasing** by construction — 60/60 days, so "it never rises as the
  window grows" is now a true sentence.
- **The last budget still above zero is exactly `recommendedHours`** — 8/8 days
  with a recommendation, and the first zero is `recommendedHours + step` on all
  of them. Note it is _not_ zero **at** the knee: `knee` is set only where the
  running max rose, so `valuePerHour(recommendedHours) > 0` always. This is where
  the do-nothing baseline earns itself a second time — hulled from `step` instead,
  the first swept budget has no predecessor and its slope is a forced 0, so a knee
  landing there would break the invariant on a day that is otherwise perfectly
  well-posed. The copy therefore names the last positive step, never "where it
  reaches zero".
- **It invents nothing.** The slopes telescope to `dayValue(last) − dayValue(0)`
  to 1.8e-15 — the hull only redistributes gain across the steps the block
  lattice lumped it into.

**Why not `objective − λ₀·budget`,** the same idea applied to each point's own
window: the terminal term is valued after the trailing implicit rest, so a
longer window recovers more reservoir before it is priced and the reading climbs
on days that got no better (§13.6). Measured, that artifact pins the knee at the
top of the range on **every one of 40 days until λ₀ = 1.25**
(`scripts/budget-knee.probe.ts`, `kneeA`). Pricing the terminal term at
`workEnd*` instead (`kneeB`) removes it but _is_ the §30 mistake — the optimizer
never saw that field. The common horizon gets the same behaviour honestly:
`kneeC` is interior on 3/40 days at λ₀ 0.5, 11/40 at 0.75, 24/40 at 1.0, 37/40
at 1.25, 40/40 at 1.5 (same probe, 2026-08-18).

**Why the running max.** The true optimum is monotone in the budget — every plan
feasible at `b` is feasible at `b + ε` — but `plan(b)` maximizes `objective` at
its OWN window rather than this score, so the sweep is not a sup over a nested
family and can dip. The two criteria differ only by the trailing-recovery term
(§13.6: 0.034/h against λ₀'s 0.5/h), which bounds the disagreement in practice:
**17 of 5040 swept steps dip (0.3%), worst 0.12 absolute / 0.97% relative**
(`budget-knee.probe.ts`, 2026-08-18). Same argument and same direction as
§14.2's floor — it only ever hides a value the model rules out.

**The recommendation is usually absent, and that is the reading.** The model's
gross value of one more hour of day is **1.23 / 1.01 / 0.76** output-per-hour at
a 3 h / 6 h / 9 h day (λ₀ = 0, so this is the work side alone). It declines
slowly, and the whole flip from "work all day" to "barely work" happens between
λ₀ **0.75 and 1.0**. At the **default λ₀ = 0.5** the knee sits at the top of the
range on **37 of those 40 days** — but that is a property of the draw, not of the
default, and in two ways. Those days carry 2–6 tasks, and satiety is per-task
(§8.4), so there is always another fresh task to move to; a **one-task** day
satiates and does reach break-even, at 8 h 15 m on the shipped e2e fixture. The
probe also swept to 14.25 h, above the shipped 12 h cap, so 37/40 understates how
often the product returns null (a lower cap can only produce more of them) — the
direction is conservative but the two numbers are not the same measurement. Both
branches are reachable at the default; the multi-task one is simply the common
one. A null is not a failure to report: it says the model would use every hour
offered, because free time is priced at a default the user has not corrected.
The card says so and names the §8.10 stopping calibration, which fits λ₀ from
how the user's own days actually end — so the one parameter that sets day length
is also the one the Lab already knows how to learn.

**Two nulls, opposite readings.** `recommendedHours === null` is either "the sweep
ran out before the model did" or "no window was worth working at this λ₀", and the
copy for one is the exact inverse of the truth for the other — "it would use every
hour you give it" is precisely wrong on a day the model declines to work at all.
The curve tells them apart without a second field: the second books **zero work at
every budget**, so its whole `valuePerHour` series sits at 0. The card branches on
that and the chart drops the "the last window above zero is the suggested one"
clause from its `aria-label` on both nulls, since on neither is there a suggested
window to find. The second branch is not a corner case: it is the λ₀ ≥ 1.5 end of
§8.3's ladder (12 h → 11.25 → 10.5 → 6 → 4.5 → **0**), reachable from the slider
and from §8.10's fit, and "don't work today" is a real answer at that price.

**Does it contradict the stop advisor (§8.11)?** They sit on the same page and
price different marginals — the advisor asks what WORKING the next session is
worth with the window held fixed, the curve asks what LENGTHENING the window is
worth with the optimizer free to re-solve — so the two could disagree in
principle. Measured on the day that raised the question (one task P0/M8/E9, 6 h
window, λ₀ = 1.2, `scripts/advisor-curve-agreement.probe.ts`) they land on the
same hour: the curve recommends **3 h**, and the advisor flips from continue to
stop at exactly **3 h logged** (2.25 h at 1.4495/h against λ₀ = 1.2, then 0.75 h
at 1.1615/h). The agreement is not forced by construction — it is what §8.11's
λ₀ break-even and §8.12's zero break-even both being net of the same λ₀ buys.

**`BUDGET_CURVE_MAX_HOURS = 12`** caps the sweep. A knee beyond it is reported
as no recommendation rather than as 12 h — the sweep ran out before the model
did, which is a different statement — and the copy names the cap it checked, so
the bound is never silent (AGENTS.md §4). The same rule covers the reader's own
window when it sits _above_ the cap: the chart cannot draw its locator there, and
clamping it to the right edge would claim it stands at 12 h, so the legend names
the window and the cap in words instead of quietly dropping the marker.

**Cost.** 16 solves at the default cap — the do-nothing point makes 17 budgets,
not 17 solves. Each is one `optimizeSchedule`, and §8.6's table prices it rather
than a second copy of one cell here: on that table's run A, **30.0 ms** on the
3-task 8 h witness up to **412.4 ms** at 15 tasks over 12 h. Quote the range and
not a figure — §8.6's two runs share no absolute number, machine A being ~2×
machine B. It therefore lives behind an explicit click in
`EnergyLabStore.computeBudgetCurve`, on `suggestPlanAdjustments`' on-demand
contract, and is deliberately **not** a `$derived` — a per-solve cost at the top
of that range only strengthens that. Its staleness fingerprint omits the budget on purpose: the curve is
a statement about _every_ budget, so dragging the window must not grey out the
card that exists to inform that drag. It omits the task **titles** for the
narrower reason that the sweep never reads them and no field of `BudgetCurve`
carries one, so a rename would otherwise grey out a bit-identical curve.

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

### 2026-08-08 — three claims about ϕ that the numbers do not support

1. **σ̂ is not "floored at 15 minutes by construction".** §5.1's justification
   for feeding the allocator `phiParameterStd` rather than `phiPredictionStd`
   rested on that floor, and the `phiParameterStd` comment in `zenith.ts`
   repeated it. §5's own estimator is a weighted average,
   `σ̂² = (ν₀σ₀² + Σwᵢrᵢ²)/(ν₀ + Σwᵢ)`, in which the σ₀ = 0.25h prior holds only
   ν₀/(ν₀+Σw) of the weight and which carries no clamp — so σ̂ decays toward the
   residual RMS and past σ₀ without bound. Measured: 200 fresh identical logs
   give σ̂ = **2.10 min** = √(0.25/204) h, and 200 logs scattered ±3 min about
   the plane give σ̂ = **3.58 min**, against the ≥ 15 min asserted. 15 minutes is
   the n = 0 prior value, not a floor. The CHOICE is unaffected and stays:
   σ̂ describes the user's own day-to-day scatter and converges to it rather
   than to zero, so the predictive std would hedge against tomorrow's
   realization forever, while parameter uncertainty is the part data removes.
   Only the stated reason was wrong. Pinned in `zenith.test.ts`
   ("σ̂ is no floor"); numbers from `scripts/hedged-stop-band.probe.ts`
   (2026-08-09).
2. **`TaskAllocation.optimalHours` was pointed at as the in-band value.**
   `AGENTS.md` and the `OPTIMAL_PHI_MULTIPLIER` comment both said to use it
   "for real values" of a multiplier documented as [1.5194, 1.7933]. It is the
   hedged §5.1 optimum and is free to leave that band — 23 of 100 slider pairs
   fall below it, 6 below ϕ itself, minimum 0.7219ϕ on the default zero-log
   posterior. The other 77 do land inside, so the first correction here
   overshot in turn ("outside the band whenever σ_ϕ > 0"); what is true is that
   nothing holds them there, which is enough to bar the band from copy. Both
   now point at `findOptimalSingleTaskTime` — which does stay in the band on
   all 100 pairs, 1.5194–1.7750 — and name the field as hedged (§3). No formula
   moved: `expectedOptimalTime` was already the argmax of E[P̄] and still is
   (grid argmax 0.4187 h at a 0.36 s step vs bisection 0.41871 h).
   `scripts/hedged-stop-band.probe.ts` (2026-08-09).
3. **The UI quoted the band for the hedged number.** `task_derived_tooltip`,
   `about_how_body_2` and `budget_unplanned_title` (en + de) all described the
   rendered "stop by" as 1.52–1.79×ϕ, so a fresh user with a difficulty-1 /
   enjoyment-10 task read `flow @ 35m · stop by 25m` under a tooltip promising
   the opposite ordering. The copy now scopes the band to a measured ϕ and says
   the model stops earlier while it is still unsure. `README.md` likewise.
   Display-only; no plan changed. Pinned in `zenith.test.ts` ("the hedged
   stop-by leaves the band, and can precede ϕ itself").

### 2026-08-14 — §34's size bound lagged §35's union rule

1. **The bound and its proof variable described a pre-§35 allocator.** §34 gave
   the size bound as `max { m : budgetBlocksFor(m) ≥ m }` and proved it out of
   `b = budgetBlocksFor(|S|)`, both billing the switches of the subset in hand
   instead of the day's funded set — the accounting §35 introduced two days
   later and that §34 never absorbed. The bound now reads
   `budgetBlocksFor(max(startedCount, m))`, the proof carries
   `b = budgetBlocksFor(dayFundedCount(S))`, the crossover figures are marked as
   the cold-day numbers they always were, and `subset-search-bound.probe.ts`
   says which case its re-derivation covers. The same lag had reached a code
   comment: `zenith.ts:1090` justified the scan with the monotonicity of
   `budgetBlocksFor(m) − m`, which is not the function that scan computes, and
   now names `budgetBlocksFor(max(startedCount, m)) − m`. No formula, constant,
   bound or fit in the CODE moved: `bestPlanWithSwitchCost` has scanned
   `max(startedCount, m)` since 2026-08-10 (`d2fbe9e`, §35) and the shipped
   bound was correct throughout — only this document's account of it was wrong.
   Pinned in `zenith.test.ts` ("funds the exactly-optimal subset past the limit
   on a day already worked").

### 2026-08-14 — three explanations the code outgrew

1. **§2 called two curve properties untested when the suite asserts both.**
   The Properties preamble said concavity on the working range and the decaying
   tail were backed by no fixture, and §0's preamble cited that as its example
   of an unbacked number. `zenith.test.ts` has asserted both since 2026-08-06
   (`p″ < 0` over `DOMAIN_GRID` up to `T*`; `p(200h) < 1e-6` and a negative
   marginal at 1.5/2/4/10 × `T*`), and `curve-marginal-facts.probe.ts`'s
   docblock repeated the stale framing while contradicting its own closing
   paragraph. §2 now names what the two fixtures cover and scopes the probe to
   the margins it measures; §0's clause and the probe's false clause are gone.
   The five properties, their derivations and the three marginal facts are
   unchanged.
2. **`RECOVERY_PRIOR_STRENGTH`'s docblock quoted a lever arm §8.9 retracted.**
   It read "≈ 0.2–0.4 … roughly half the drain fit's lever arm"; §8.9
   re-measured that on 2026-08-06 as 0.22–0.26 against dD/dα ≈ 0.6–0.9, a third.
   The docblock now defers to §8.9 for the range rather than keeping a second
   copy of it, and states the closed-form ceiling that makes 0.4 unreachable:
   with `x = r·m·g`, `dD/dr = (d_pre/r)·x·e^(−x) ≤ d_pre/(r·e)` = 0.263 at half
   drain and the default `r`. λ = 0.05 and its 53%/71%/88% profile are
   unchanged.
3. **The enjoyment slider's `min: 1` was justified by a division that does not
   exist.** `task-form-fields.svelte` and §22 both said ϕ divides by enjoyment
   (citing §2). `ϕ = c₁E + c₂β + c₃` is linear in β and nothing in `zenith.ts`
   divides by it; at `βᵤ = 0`, `β = 8/9` is finite and `r = 1/E²` does not move.
   The constraint is §1's declared domain `βᵤ ∈ [1,10]`, which both now cite.
   `min: 1` is unchanged.

### 2026-08-17 — §19.4's gain ladder was measured, not re-quoted

1. **The 999% ladder now has a probe, and one of its figures was wrong.**
   `gain-cap-trigger.probe.ts` swept the app's own budget slider at ϕ̂ on the
   0.1 h floor. The rungs reproduce exactly (4.25 / 8.5 / 13 / 17.25 h at
   n = 1–4, never within 24 h at n = 6, and 7 h at ϕ̂ = 0.17 h), as does the
   pooled 41.6%; the n = 5 rung §19.4 skipped is 21.75 h and is now stated. The
   **569%** default-constants maximum does not reproduce — the measured figure
   is **291.7%** at n = 1 — and §19.4 now carries the measured one.
   The cell is difficulty 5 / enjoyment 5, which the section now says: it is
   **not** "the default sliders", whose 5/5 draft maps through
   `getEffectiveDifficulty` to an effective difficulty of 6.5.
2. **§19.4 said "fitted" and never said σ, and the silence hid a real effect.**
   The ladder is a σ_ϕ = 0 statement. At the σ_ϕ a 15–30 min history actually
   fits (0.0184 h), §5.1's monotone-prefix cut costs the optimizer more than the
   baseline, so every rung arrives **one to four budget steps later** —
   4.5 / 9 / 13.5 / 18.25 / 22.75 h at n = 1–5, n = 6 max 912.4% → 862.4%. No
   rung is lost. The first draft of this entry recorded "no rung moves", which
   was the fitted user's own ϕ̂ = 0.3599 h, not the ladder's 0.1 h; the review
   caught it and the section now measures both.
3. **The user §19.4 asserted is reachable, and that half had never been fit.**
   97.3% of 14,400 seeded fast-flow histories, all `fitted: true`, put ϕ̂ on the
   floor somewhere on the slider grid; of the 255,172 floored **grid cells**,
   62.7% reach 999% at n = 1 within 24 h. The `naive = 0, optimized > 0` arm
   found no witness in 6,576 swept days and is recorded as open — its
   reachability does not follow from the ratio arm's, and removing the branch
   would be a behaviour change. `GAIN_PERCENT_CAP`, `gainPercentOf` and every
   formula are unchanged; the constant's docblock mirrors the corrected ladder.

### 2026-08-17 — §19.3's four unbacked groups, measured

1. **§19's header claimed one draw for numbers that cannot be on it.** "Every
   number below sits on the same draw as §13.2's table" was false for four of
   §19.3's figure groups, two of them structurally: rv14's generator passes no
   posterior (σ_ϕ = 0) and times nothing. The header now says which group comes
   from which draw. Wording only.
2. **The rotation gap was re-measured and moved.** The average sits strictly
   below the best rotation on **75.9%** of 2400 days, not 81.7% — `rv14` arm J,
   which computes the per-rotation values the shipped function never returns
   (its average is asserted equal to the shipped baseline to 12 decimals).
3. **The −0.5% witness reproduces exactly** (0.886678 against 0.891116) and is
   now pinned in `zenith.test.ts` rather than only quoted.
4. **"0 monotonicity cuts with integer sliders" is retracted.** 220 of 100,320
   integer-slider cells are cut by the non-decreasing rule, all of them strictly
   before the menu's own best block count; the witness cell is on that regime's
   own axes, so the zero could not have been right. The new grid is stated with
   its counts. What keeps the weakened guarantee unreachable is the other half,
   which §5.1's 576,000-cell sweep already held: re-asked at ϕ̂ ≥ 4 h, **0 of
   4,320** fitted histories reach σ_ϕ/ϕ̂ ≥ 0.35, largest 0.232.
5. **The three millisecond figures are timed**, with the machine, the day and
   the repetition count stated — 0.001–0.003 ms, 0.022–0.027 ms and 1.6–7.1 ms,
   the baseline 0.4–1.4% of the solve. No formula, constant, bound or fit
   changed; `buildBlockIncrements`' cut is untouched (its reachability is a §5.1
   model question, deliberately not opened here).

### 2026-08-17 — what the open-task scope is worth, measured

1. **The 2026-08-12 correction's only evidence was one day, and no probe could
   reach it.** All three stop probes omitted `openTaskIds`, so both bracket
   replicas and the advisor's one-step replica modelled the **superseded**
   all-tasks scope while validating clean against the shipped function — which is
   why it went unnoticed for two months. All three now read the field, and both
   bracket replicas are validated on days that carry completions (0 mismatches).
   The witness reproduces to three decimals — 1.321 → 1.156, a 0.165 shift, 1.5×
   the bracket half-width — and is now pinned in `zenith-energy.test.ts` as a
   **pair**, where the suite previously asserted only that one was smaller than
   the other and so could not catch a change moving both.
2. **§8.10's "biased λ₀ up by the whole marginal of work that no longer existed"
   is restated as a one-day witness.** Over 90 simulated users at a known λ₀ with
   causally-drawn completions, the corrected scope beats the pre-correction scope
   in 1 of 12 arms by +0.0054 λ₀ and loses the other 11 by up to 0.0859 — inside
   or near the instrument's own 0.110 half-width. `openTaskIds` and every formula
   are **unchanged**: the rule is settled (§11.8's next-up family) and rests on an
   argument a synthetic day cannot make, since a checked-off task's remaining work
   does not exist while the generator's does. The measurement kills the stated
   reason's size, not the rule.
3. **Three assertions now carry numbers.** The filter's population shift (median
   0.000 at every completion rate; past the half-width on 6.8–22.8% of days; the
   **logged** side the larger effect, against expectation), the fifth censoring
   category's share of the losses (0 / 7.7 / 40.5 / 73.1%, and it fires only when
   every task on the day is ticked) — which is the size of what ROADMAP item 4
   would recover — and §8.11's filter (verdict differs on 0.4–7.9% of
   checkpoints, always continue→stop; a different task named on 4.1–15.8%;
   strictly better at-stop agreement).
4. **§8.10's and §8.11's 2026-08-06 figures no longer reproduce at HEAD**, and
   the drift is broad rather than confined to a line or two — the model moved
   under them (this change moves nothing: the same drift is on HEAD without it).
   Re-run 2026-08-17, §8.10: inversions 4/315 → **4/317** and 44/1179 → **49/1176**
   with 6 → **7** past the margin, the loose-max bias over 282 → **286** days with
   p90 0.164 → **0.191**, the half-width median 0.110 over 279 → **0.109** over
   **281**. §8.11: one-step vs session 19.7% / 6.6% → **20.2% / 7.3%** at λ₀ = 0.9
   and 5.4% / 4.0% → **5.6% / 4.1%** at 0.5, at-stop agreement 42/52 → **40/52**,
   rest-adjacent 2 of 27 → **3 of 30** at λ₀ = 0.9 and 6 of 27 → **7 of 28** at
   0.5. One **assertion** did stop holding and is annotated where it sits:
   "neither arm is ever more than 1 step late" is 2 steps at λ₀ = 0.5, equal
   between the arms. **No reading built on them flips**: the arms' at-stop
   agreement is still identical at every level, the mood-day censoring still fires
   (7 days, so "some honest days really are dropped" holds), the decomposition
   still sums to 0.109 against the shipped 0.25, and the one-step penalty at
   λ₀ = 0.9 is 2.8× the session arm's where §8.11 calls it 3×. They are
   deliberately NOT re-dated in place here: re-measuring a
   section's whole backed set is how a change of this shape grows without adding
   evidence (the feature file's own out-of-scope list), and the figures above are
   what a future re-run should expect to see instead of the 2026-08-06 pairs.

### 2026-08-17 — four baselines, steps and citations the code had moved past

Item 31's M2, M3, M22 and M13, and each one is a comparison or a citation
describing something the code no longer does. No formula, constant, bound or fit
moves, and no executable line outside two probe arms.

1. **§21.4's "(shipped)" row was a different baseline** (M2). The +1.9% came
   from ONE largest-remainder equal split, whose odd block always lands on the
   list's first task, while the shipped `naiveBaselineValue` averages the n
   cyclic rotations (§19) — a lower reference, so a **larger** reported gain. The
   row is relabelled, the shipped comparison added as its own row at **+2.9%**
   (which is what §21's header and arm A already printed, so the section
   contradicted itself), and `rv15` gains **arm J**, which prices the two side by
   side: 4.575 against 4.621, optimizer 4.710, at 4 h. §21.1's selection/shape
   decomposition is measured against the single split too, and now says so.
2. **A defer moves Grind Density by `100·(m−g)/(m(m−1))`, not by `100/m`** (M3).
   The metric rounds `grinds/funded·100` (`metric/calculation.ts:1033`), so
   deferring a funded grind drops the task from **both** sides of the ratio — and
   moves nothing at all on an all-grind plan. The probe's lever arm asserted the
   full `100/m`, which is why §11.11's prose read **20pp** on the very day its own
   table two paragraphs below printed **−15pp**. Re-measured
   (`scripts/mtr-grind-density.probe.ts:458`): **10/545** days, not 107/545, move
   the count more than twice as far as the booked hours. The section's conclusion
   is untouched — it rests on the 153/600 band split, the `100 − RewardDensity`
   duplication and the advisor's own 332/132 offers, none of which read the step.
3. **§8.12 kept a per-solve cost §8.6 had superseded** (M22). "~40 ms each on a
   small day" for `suggestBudgetCurve`'s 16 solves, where §8.6 prices that same
   call site by name and instructs the reader to quote its range, because its two
   runs share no absolute figure. §8.12 now defers to that table. The 16-solve
   count, the 17-budget arithmetic and the never-a-`$derived` conclusion all
   stand — a higher true per-solve cost only strengthens the last of them. Raised
   by one lens as unbacked and **refuted in that framing**: the defect was
   staleness, and the docblock over the same function had already been fixed on
   2026-08-13.
4. **The warm-up-carryover mechanism shipped with no §8.2 citation** (M13).
   `MATH.md §8.2` appeared nowhere in `src/` and §8.1 was uncited too, though the
   sibling bullets and sibling parameters in the same file all name their section.
   §8.1 now sits on `restRecoveryMultiplier`, §8.2 on the header's warm-up
   bullet, on `resumptionTimeConstant` and on `resumePhase` — whose docblock cited
   only Monk/Trafton. Both sections' text was already correct (R7 citations only).
   Two of the five sites the audit named are deliberately **not** cited: the
   defaults-block comments, because this file's idiom puts the section on the
   interface docblock and never on the default.

### 2026-08-17 — what the advisor actually costs

Item 31's M9 and M10. Both named the same gap: `suggestPlanAdjustments` was
called by a probe (`plan-advice.probe.ts`) but **timed** by none, so every
millisecond figure in §14 and §14.4 and the one percentage in §14.3 rested on
sweeps that were never committed. Two probe arms now reach them through the
shipped call site. No formula, constant or bound moves; five numbers do.

1. **The advisor's ladder was ~10× high** (M9). §14 quoted 1.6/3.9/12.5/**95** ms
   per solve at n = 3/6/9/12 and **946 ms** for the 12-task advice run
   (2026-07-27, unnamed machine, pre-solve-once). Measured now: 0.02/0.11/~2.4/
   **~9.3** ms per solve and **109–124 ms** for the run. The shape — super-linear
   in the 2ⁿ enumeration — reproduces exactly, as does `candidatesEvaluated`
   (14 on a 12-task day, `activeTasks + 3` less the dedup's one). **The
   never-a-`$derived` rule is unaffected**: a tenth of a second per keystroke is
   still a frozen main thread. What changed is that the number justifying it in
   four places was 3.5× the truth.
2. **The 421 ms was history quoted as current** (M9). It was the 2026-07-28
   re-measurement, and it was cited as settled at `metric/plan-advice.ts`,
   `store/daily-plan-store.svelte.ts` and `business/AGENTS.md`. Its "before" half
   (103.6 ms) is the one figure in this batch that **cannot be re-run at all** —
   the solve-once change it measures is shipped — so the ratio and the conclusion
   are kept and the absolute is dated.
3. **Advisor cost is non-monotone in n, which nothing had noticed.** At an 8 h
   budget the §34 affordability test lets `maxFunded` reach n, so a 15-task day
   exceeds `SUBSET_SEARCH_BUDGET` and takes the forward-selection fallback:
   ~45 ms against the 12-task day's 109–124. **n = 12 is the worst case, not a
   floor**, and "a longer backlog is worse" is wrong past it.
4. **§14.4's "roughly a third" was the one claim measured false** (M9). The
   doubled-`s` solve runs at **0.7–0.9×** the declared one, not a third; the pair's
   share of the advisor is 9–11% at n = 8 and ~6% at n = 12, against 7.3% / 2.9%.
   The direction the section argues — the share falls as the day grows, `s = 0` is
   very nearly free — reproduces.
5. **§14.3's +41.8% is +41.9%, and its day is the generic day** (M10). The only
   executing copy of 41.8 was a hand-written fixture literal in a display test.
   Read off the shipped `switchCostPrice`, the suppressed-reservation-with-bracket
   state holds on **58 of 58** fixture 3-task days and **4560 of 4560** grid
   triples at that budget and `s` — so the independent suppression guards the
   whole configuration rather than a rare defect, which is a **stronger**
   justification than the section claimed. The quoted 41.8 is reached by none of
   the 4618 cases; the day is now named by value.

Two figures moved that neither finding named: §14's frontier denominator (4450 →
**4112** non-empty priced frontiers on the same seeded 600, the 0-positive claim
intact), and the recognition that a wall clock re-run six times on one idle box
spans 109.00–123.86 ms — which is why every timing figure above is a range and
carries its machine, per §8.6.

### 2026-08-18 — what the Lab tile was measured with

Item 31's M11, the last of the fourteen upheld findings, and the smallest: §13.6
cited `scratchpad/rv-energy-readouts.probe.ts` for two number-sets, and that file
is in neither the tree nor the history. `rv13-terminal-timing.probe.ts` gains a
third arm. The two sets did not survive equally, and the asymmetry is the point.

1. **The worked-hours ladder reproduces on all twelve cited cells** — 0.5192 /
   0.3043 / 0.2081 / 0.1652 / 0.1460 / 0.1374 at 2–12 h, printing 100 / 100 / 100
   / 99 / 90 / 14%. **The lost file cost it nothing**, because the fixture is
   pinned by the section's own words: `simulateReservoirs` takes the two demands
   and the params and reads neither `difficulty` nor `enjoyment`, so "forced,
   pure-cognitive, 12 h window" determines every row. A claim whose fixture its
   own prose fully specifies is re-derivable without its probe; that is the
   exception, not the rule.
2. **The shipped-optimum pair is withdrawn, not corrected.** 0.890/0.469 is
   reproduced by none of the three plausible task sets, and it is unreachable
   from the ladder's shape — `endCog` 0.890 puts the end of work near 10 h, where
   full cognitive demand leaves 0.146, not 0.469. The optimizer reads
   difficulty and enjoyment through the objective, so this half needed a fixture
   the sentence never named. §13.6 now quotes the ladder's own task, optimized:
   **0.9995 against 0.4542**. The nearest miss found (three identical cognitive
   tasks, 0.8883/0.4606) is recorded as a lead, and deliberately not adopted — a
   fixture tuned until the target appears backs nothing.
3. **The tile's two formulas were read, not assumed.** `git show 8f01ca8^` has
   the summary passing `plan.evaluation.endCog` into `Math.round(endCog * 100)`;
   HEAD passes `workEndCog` into `Math.floor`. So the pre-fix column is arithmetic
   over a field the evaluation still returns, not a resurrected code path — which
   is why it is re-derivable where §14's pre-solve-once 103.6 ms was not.
4. **The lost probe carried the R3 hazard, and that is the likely asymmetry.**
   8f01ca8 introduced `workEndCog` and the tile fix that reads it in one commit,
   so the 2026-08-07 figures cannot have come from that field: something computed
   end-of-work depletion privately. A second implementation agrees with the
   shipped one on a forced single-task day and has every opportunity to diverge
   once an optimizer and an unnamed task set are involved.
5. **§13.6's two pre-existing arms are unmoved** — the four-plan avg/min table
   to four decimals, worst |Δ| 0.0767 with the ranking preserved, C_cog 0.2081 at
   6 h (risk 79%), and V_T's 0.0339 per hour against `freeTimeValue`'s 0.5.

One reported defect did **not** survive checking, and is recorded so a later
audit does not re-raise it: 8f01ca8 was authored 2026-08-08 01:03 +0200 and
committed 2026-08-07 23:03 UTC. §13.6's "fixed 2026-08-07" sits on the far side
of a date boundary from the repo's local-time convention, not on the wrong side
of a fact, and it stays.

### 2026-08-18 — the four registry holes and item 31's cheapest leads

Item 31's M27, M28, M31, M32 and M36 — the leads filed as citation-only or
cheap, plus the four sections `scripts/PROBES.md` carried no row for (§8.2,
§11.5, §18, §22). Every figure was re-run. Four of the five were mis-scoped, in
both directions, and the tail filed as cheap is where the drift was.

1. **§8.12's dip rate was cited to nothing, and had drifted (M36).**
   `budget-knee.probe.ts` prints that sentence verbatim, so only the
   back-reference was missing — but re-running it gives **17 of 5040 (0.3%)**
   against the quoted 22 (0.4%), and `kneeC`'s interior count at λ₀ = 1.0 is
   **24/40**, not 25, which no finding had named. The worst dip is unmoved at
   0.12 absolute / 0.97% relative. The probe is untouched since 28e2e16
   (2026-08-08); the allocator moved on 2026-08-13 (rest-break placement, the
   two-task seed), which is what an uncited probe number does. The argument is
   unaffected and the drift runs its way: fewer dips, none larger.
2. **§22's "22 of 121" was its own leftover (M27).** The four moved pairs, both
   balanced rates and the 44/100 over 1–10 reproduce exactly. The demand-share
   rule disagrees on 22 pairs against the ±3 gap **alone** and on **18** against
   the rule as shipped, since it reaches the zero gate's verdict on all four
   pairs the gate moved — a count measured against the rule §22 deletes, quoted
   in the paragraph defending the rule §22 installs. Both named witnesses hold.
3. **§18's three marginals hold to every digit, and its witness is not
   app-reachable (M28).** 0.6669 / 1.0986 / 0.3716 through the shipped
   `adviseStop` at the shipped defaults, verdict flip included, and the two-row
   day prices identically to one 4.5 h row. Two things the finding did not name:
   every split of that day flips, not just 3 + 1.5 (1.35× to 3.28×; 66.5% of 200
   seeded slider-drawn tasks), and `toEnergyTask` cannot pair difficulty 7 with
   w = (0.8, 0.2) — those demands are sliders 8/2, effective difficulty 8.6,
   where the day does not flip at all. The section now says so, and the suite
   pins the flip at the reachable neighbour instead.
4. **§8.2 had no backer, and the probe that claimed it was wrong (M31).** No
   committed probe reaches its two figures. `~85%` / `~2%` measure **84.648%**
   / **1.832%**, recovered through the evaluator and agreeing with `e^(−g/τ)` to
   4e-8. `enb-break-economics.probe.ts`'s header claimed §8.1–8.2 scope its arms
   never had — it only _disables_ both to build its pre-fix arm — so the header
   was corrected to match its registry row, which was right all along. The
   sweep's usual failure runs the other way; this is the inverse.
5. **§11.5's fixture already existed (M32).** All three cells and all three
   guards hold; what was missing was the citation, not the test. Two gaps
   underneath were real: every assertion passed `0.25` as a literal, so
   `DEFAULT_SWITCH_COST` could move without going red — and rounding hides a
   move inside sc ∈ [0.233, 0.278], so the constant is now asserted rather than
   inferred from the reading. The no-budget guard was pinned on a 0-hour task,
   where the nothing-funded guard answers first.

Closed form cites a suite fixture and gets no `PROBES.md` row — §8.2 and §11.5
both needed that, and the registry's header now says it. No formula, constant,
bound or fit changed.

### 2026-08-19 — what the priority score actually prints

Item 31's M14, M15, M16, M25 and M26. R7 clause 3 throughout: no formula,
constant, bound or fit changed and no executable line moved — every defect was
a citation, a count, or a scale this document named once where the code ships
two.

1. **§3 defined the priority score on the model's scale only (M14).** The metric
   layer ships two: `SuggestedTask.priorityScore` is P̄(T\*) rescaled and
   rounded at one call site, `metric/remaining-day.ts` passes P̄(T\*) as it
   stands. §3 now states both, and which of the two is printed. The consequence
   figures the lead offered stay out: no committed probe reaches them, and the
   ones measured on the way in describe `calculateSuggestedTasks`'s array and
   not the rendered list, which `task-list.svelte` re-sorts by `#N`.
2. **§5 and §5.1 were true of the allocator; one docblock was not (M15).** The
   allocator has consumed the posterior covariance since 2026-07-18 — via
   `phiParameterStd`, never `phiPredictionStd`, whose docblock still called that
   pending work. §5's sentence now names which of the two shipped, so a reader
   cannot carry the `phiPredictionStd` two lines above it into the allocator.
   `phiPredictionStd` has no production caller at all; that is recorded in
   ROADMAP, not repaired here.
3. **"(four fits)" against five rows, at three sites (M16).** §5.2 had the row
   count right and the fit count wrong, and both source comments beneath it were
   undercounts. Five fits reach the card (ϕ, r, α_cog, α_phys, λ₀); §5.2 now
   states the split it was reaching for — the recency-weighted ϕ row against
   four unweighted fits — rather than a tally.
4. **§1's parameter map was cited from nowhere in `zenith.ts` (M25).** Nine
   definition sites now carry it, and §1 carries back-references to the probe
   and the fixture that measure it, which the registry's policy asks of every
   claim. Two scope corrections the lead had backwards: §1 was already cited six
   times elsewhere in the repo, so the map was uncited at its definitions rather
   than un-findable, and no rule was broken — R7's citation clause fires on a
   change to a formula, constant, bound or fit, it entered the rulebook on
   2026-07-26, and every one of these sites predates it.
5. **The 🪫 form cited the plan lattice for the α fit (M26).** `drain-log-form`
   and its story both said §8.8, which is the 45-minute lattice and fits
   nothing; §8.7 is the section that fits α from a session's hours. The rest of
   that chain — store, repository, `energy-calibration`, `fitDrainRate` —
   already cited §8.7.

One figure moved, and it was a rounding of a rounding: §13.1's σ_ϕ at n = 200
read 0.003 because the probe printed 0.0025 at 4 dp. That print is now 6 dp and
the cell reads 0.002473. The same double-rounding was in `zenith.ts`'s
`priorPosterior` comment.

**Every re-measurement stamp this round carries is 2026-08-19**, including the
ones in §13.4, §13.6, §14.1, §14.2 and §15 that first landed reading 2026-08-18,
and ROADMAP's copy of §15's cross-scoring counts with them. There was one draw
against one tree; the commits straddled midnight, and five of them stamped the
wall clock they were written at rather than the date the probes ran, which would
read as two draws a day apart. **A land date is not a draw date and keeps what it
had**: the round's first two commits landed before midnight, so M18–M21's
closures and those two feature files still read 2026-08-18. **Nor is a stamp this
round did not draw**: §13.6's pure-cognitive-day pair (`re-measured 2026-08-18`
and the `same probe` line under it) is e5cfa36's draw from before this round and
is untouched here, so that section carries this round's 2026-08-19 beside an older
one's 2026-08-18. Six ROADMAP and feature-file stamps read 2026-08-18 for commits
that landed after it, and those are now 2026-08-19 — which is what makes the
sentence above checkable by grep rather than contradicted by its own siblings.

**The citation sweep recorded beside that entry missed one.** The gate-figures
feature file cited `ROADMAP.md:917` for a row that sits at `:919`, and described
two of ROADMAP's own citations by what stood at those line numbers on the day it
landed — true then, rotted three commits later. All three now name the text they
mean, which is the address a later insertion cannot move. **No branch-wide count
of citations stands here.** Three passes each published a different total and each
still missed some; a fourth would take the same sweep this entry is the argument
against. Whether prose should carry line numbers at all is the open question, and
it is the maintainer's to settle.

### 2026-08-19 — break omission

**This entry is NOT doc-only.** It records a model change and belongs here
because §8.10 and §8.11 both carried a measured claim that was false, and the
false claim is what hid the change for a year.

1. **§8.10 listed "breaks are omitted from the reconstruction … absorbed as
   noise" among its deliberate approximations.** Measured, it was the DOMINANT
   error term and one-signed: on 436 optimizer-funded days drawn through
   `toEnergyTask` at λ₀ {0.5, 0.7, 0.9, 1.1}, 63.5% of them carrying an interior
   break, the summed reconstruction read |midpoint − true λ₀| mean 0.106 and past
   the bracket half-width on 28.3% of days, against 0.065 and 7.9% once each day's
   own breaks are in it. **Every figure in this entry is that grid's**, which is
   the narrow half of the Lab's λ₀ range — widened the same day, see the entry
   below. On the §8.10 witness the summed reading is 0.293 LOW and its bracket
   inverts inside `STOP_INVERSION_MARGIN`, so the day entered the fit as a biased
   point estimate with no censor flagging it; a user repeating that day converged
   on 0.415 against a truth of 0.7. The bullet is deleted rather than amended.
2. **The cause was one `+=`, and the data was already there.** `readFinishedDays`
   summed the 🪫 rows by `(date, taskId)` before the estimator could see them, and
   every row has carried a `createdAt` since the store existed. Reading it back
   makes the day's order and breaks observed rather than invented. No persisted
   shape changed, `DB_VERSION` did not move, and no backfill was needed — the
   history was already instrumented.
3. **No committed probe could have caught it.** Neither §8.10 sweep built its
   tasks through `toEnergyTask`, and `stop-margin-fit-error` flattened each plan
   to a work-step sequence that DROPPED rest, so a break-carrying day was not
   expressible by the instrument built to price this section's own censoring
   constant. `scripts/stop-block-structure.probe.ts` is the closure: it draws days
   from integer sliders through the app's own mapping and carries the finding as
   assertions, so the bias going red is a red probe.
4. **Order was never the error term.** The real session order with the breaks
   squeezed out reads 0.109 mean |err| against the summed 0.106 (0.126 against
   0.123 on the widened grid, same conclusion) — so §13.4's
   canonical-rank fix was right and small, and what mattered was the breaks. The
   canonical order remains the rule for the fallback reading and for where an
   unlogged candidate's probe block lands; §8.11's stated reason for it ("the
   reconstructed past is itself canonical, not chronological") is false on a
   timestamped day and has been restated.
5. **Figures re-measured across seven probes, and one confirmed unmoved.** §8.10's
   σ₀ derivation (bracket half-width median 0.110 → **0.134**), its inversion
   populations (optimizer days 4/317 → **0/317**; mood days 44/1179 → 58/1603 with
   12 past the margin), the whole 2026-08-13 margin sweep, the interrupted- and
   grind-day contamination readings, the open-task scope sizes, §8.11's
   one-step-vs-session table and warm-up fixture, §13.4's round trip, and §18's
   two-row identity. §8.12's four-decimal advisor/curve agreement is confirmed
   BIT-IDENTICAL (its day is one task in one session, with no interior gap to
   recover), which is why it is stated rather than assumed.
6. **What the correction costs, stated where it applies.** The fit's quality now
   couples to logging promptness, silently: a batch-logged day degrades to exactly
   the old numbers and nothing on the reading says so. The cheapest honest surface
   — counting structure-recovered days beside the fit — is NOT built here and is
   this correction's one open obligation. Three latent defects the change made
   reachable were fixed with it (§8.11's implementation-sharing note): grow and
   shrink each targeted every block of a task, `growBy`'s insertion index counted
   rest blocks that carry no rank, and a probed session at m ≥ 2 was clipped by
   `normalizeSchedule` instead of paying its overhang out of the day's last rest.

### 2026-08-19 — the rest cap's residual, and the grid that could not see it

**Doc-only, plus one probe grid.** The break-omission fix landed earlier the same
day (entry above); an adversarial pass over the documentation it wrote found three
measured claims wrong in it. The reconstruction, the censoring policy,
`STOP_INVERSION_MARGIN` and the worked-hours `room` rule are all untouched — what
changed is what the document says about them, and how far the probe sweeps.

1. **§8.10's rest-trim-cap bullet had the residual's direction backwards.** It
   said that capping recovered rest to leave one step of room "reintroduc[es] the
   old understatement exactly where it was worst". Measured on exactly those days
   — the ones whose extent leaves no room for another step — the residual is an
   **OVERSTATEMENT**: signed **+0.124**, and 47 of the 48 containment failures they
   carry read HIGH. The stated mechanism was wrong too. It is not the squeezed
   break: the same days read with no breaks at all read +0.115, so nothing is
   reintroduced. It is the pinned worked-hours window censor — the day ran out of
   wall clock, `total` reads WORKED hours, so no censor fires and the day is priced
   as a voluntary stop, with `lo` at the truth (−0.016) and `hi` **+0.264** above
   it. The bullet now states direction, mechanism and size.
2. **The probe never sampled where the residual is worst, and the headline said
   nothing about scope.** `scripts/stop-block-structure.probe.ts` swept λ₀
   {0.5, 0.7, 0.9, 1.1} while the Lab's own `freeTimeValue` slider runs [0, 3] in
   steps of 0.1. Widened to {0.1 … 1.1}: mean |err| 0.065 → **0.086**, past the
   bracket half-width 7.9% → **16.3%**, max 0.301 → **0.642**, and at λ₀ = 0.1 the
   logged reading is mean 0.300 with 78.6% past the half-width against 0.053 and
   1.8% at λ₀ = 0.9. The published mid-range numbers were not wrong, they were
   unscoped — they are now labelled as the {0.5 … 1.1} reading, the probe reports
   every arm per λ₀ as well as pooled, and §8.10 carries the λ₀ table. The wider
   sweep costs the probe 68 s → 98 s.
3. **§8.11 pinned `room` = WORKED hours without its cost.** Both sections argue
   why the rule is right and neither said what it buys the user. Measured at the
   checkpoint that reads it: on **142 of the 445 at the plan's own stop that get a
   verdict** the advisor prices a session longer than the wall clock the
   day has left — **143 over the whole walk**, 61 of them under a `continue`
   verdict. Stated beside the decision, which stands.
4. **What was filed rather than fixed.** Censoring the class in item 1 takes the
   bracket's containment failure **13.8% → 4.0%** at the cost of **25.4% of the
   fit's priced days**. That is a data-versus-accuracy trade for the maintainer, so
   it is ROADMAP **M42** with the class definition and both numbers, not a decision
   taken here. The sign is the part worth keeping: the bias the morning's fix
   removed read LOW and the residual reads HIGH, so a mean over both cancels —
   which is exactly how "absorbed as noise" survived a year.

Items 1 and 3 are scratch measurements; the two sections carry their populations
and say so, under ROADMAP item 29's rule. **Items 1, 3 and 4's figures are
withdrawn as of 2026-08-21** — the entry below replaces every one of them with a
committed instrument's reading, and the ruling item 4 filed is taken there.

### 2026-08-21 — the two readings the ledger's columns renamed

**Display-only.** No formula, constant, bound or fit moved; two sentences
described a row layout that no longer exists
([docs/features/the-row-that-became-a-table.md](docs/features/the-row-that-became-a-table.md)).

1. **§3's "prints as `prio 12.4`"** is now a `Prio` column printing the bare
   figure. The quantity is unchanged — `Number((P̄(T*)·10).toFixed(1))` — and the
   row prints it at 1 dp even when it lands on `.0`, which is the printed scale
   §3 already specified and what makes the column comparable down its length.
2. **§35's "plan 1h 45m · prio 12.4"** is now `plan 1h 45m` alone: the two
   readings still stack, in the row's one `Planned` cell, and the priority moved
   to a column of its own. The rule the sentence exists for — re-plan leading,
   plan beneath, never a strikethrough — is untouched.

### 2026-08-21 — the day that ran out of clock (M42 taken)

**This entry is NOT doc-only.** It records the ruling the entry above filed, the
code that took it, and the retirement of six scratch figures the two sections
quoted. Both readings of the day's window question moved, in opposite directions.

1. **§8.10's fit now CENSORS a day whose own span leaves no room for another
   step.** The class is unchanged from M42's definition; what changed is that the
   day is dropped instead of priced. Measured before and after by
   `stop-block-structure.probe.ts`'s new clock-censor arm — the first committed
   instrument to print any of this: the class holds 134 of the grid's 676 cells,
   134 of the 441 priced cells (30.4%) were entering the fit as voluntary stops at
   signed **+0.131**, and censoring them takes the bracket's containment failure
   from **61 of 441 (13.8%) to 1 of 307 (0.3%)**. The scratch figures this
   replaces — 112 of 441, 25.4%, +0.124, `lo` −0.016, `hi` +0.264, and the
   13.8% → 4.0% projection — are gone rather than confirmed: the scratch run
   rebuilt the bracket from exported parts, this arm reads the shipped
   `stopBracket`, and the two do not agree on the size of anything.
2. **What the censor costs is DAYS, and unevenly.** 307 cells price where 441 did,
   and at λ₀ = 0.1 exactly 1 of 120 days survives. §8.10 states it: a low-λ₀ user
   now calibrates from far fewer days, which is the price of not calibrating from
   days the clock ended.
3. **§8.11's `window-full` gate did NOT move, and its session lengths did.** The
   verdict still reads WORKED hours — a user with hours left must not be told the
   window is full because of an inferred gap — while the session priced is capped
   by the day's span, floored at one step. `stop-advisor.probe.ts` now prints the
   count that rule cost: before, 51 of 2236 priced checkpoints named a session
   longer than the day's remaining clock, **5 of them past the one-step floor**;
   after, 46 of 2236 and **0 past the floor**. The `142 of 445` / `143` / `61`
   scratch figures are withdrawn the same way — the committed arm walks its own
   population and reads its own numbers.
4. **`trimRest` is deleted, and the entry above's third latent defect with it.**
   A session capped to the clock the day has left cannot overhang the window, so
   the trim that paid for the overhang out of the day's last rest had no reachable
   input. §8.11 says what comes back if the cap is ever loosened. The cap's own
   day-level pin moved with it: the fixture that priced a 2.25 h session out of a
   4.5 h break now prices the 1.5 h the day had room for.
5. **Four probe replicas had to take the censor, and two of them said so out
   loud.** `stop-inversion-margin` and `stop-margin-fit-error` rebuild §8.10's
   bracket from exported parts and validate the rebuild against the shipped
   reader before believing a number; with the censor shipped and not replicated
   they printed **INVALID** (336 of 1576 verdict mismatches on the first) — which
   is the gate doing its job. Both now carry `isClockCensored`, both read 0
   mismatches again, and `rv13-stop-insertion`'s replica took it too.
   Consequences, all re-read 2026-08-21: the instrument's own resolution moved —
   bracket half-width median **0.129 over 274 non-inverted days → 0.125 over
   175** — so every figure thresholded on it was re-read with it; the optimizer's
   own plans now number 191 rather than 299 and their mood variants 926 rather
   than 1532 (the plans that fill their window ARE the censored class); and every
   RMSE level in the margin sweep rose, because each arm fits from fewer days.
   None of the rulings moved: the margin is still flat over [0.1, 0.5], censoring
   nothing still wins the contaminated arms, and the scope correction is still
   not measurably better.
6. **The cause, for the record.** Neither reading had a bug. `total` was made to
   mean worked hours on purpose and both readings were pinned to it in the same
   breath; what was never separated is that one of them is an estimator and the
   other is a sentence shown to a user. The sign is the tell — M38's fix moved the
   bias LOW, this one read HIGH, so a mean over both cancelled, which is the same
   failure mode that let "absorbed as noise" survive a year.

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
  every allocated hour is Eᵤ-10/enjoyment-1 work — Eᵤ **effective**, so
  spillover reaches it from 8/8 as well as from a single 10; the loved-hard
  task reads 0.
- **Probe 2026-08-07** (`scripts/mtr-friction-index.probe.ts`; 600 seeded days
  — 1–7 tasks, difficulties 0–10, enjoyment 1–10, budgets 0.25–16 h, switch
  costs 5–30 m — planned by `calculateSuggestedTasks`, so the hours are the
  allocator's own).
  - _The reading is the formula:_ recomputed independently from the returned
    plan, max |reading − formula| = **0** over all 600 days.
  - _The band ladder is occupied:_ min 0, p50 25, p90 48, p99 77, max 100;
    310 success / 237 neutral / 45 warning / 8 critical. Unlike the retired
    burnout heuristic (§11.6), the scale discriminates across its whole range
    on days the app itself builds — the 100 comes from `m/p/e 8/8/1 | 8.25h`,
    which is why the Eᵤ wording above matters.
  - _It is its own reading:_ Spearman(friction, `grindDensity`) =
    ~~0.5561~~ **0.6336** (amended 2026-08-07: §11.10 restricted that count to
    the tasks the plan funds — the ones whose hours this index averages over),
    Spearman(friction, `rewardDensity`) = ~~−0.6046~~ **−0.6537** (amended
    2026-08-07: §27 moved Sustainable Work's denominator from the budget to
    Σh — the same denominator this index uses, which is why the two came
    closer). Same two inputs, three different questions (intensity, task
    share, time share).
  - _Monotone in the formula, not in the dashboard._ Holding the allocation
    fixed, over 4491 single-slider perturbations, +1 enjoyment never raised
    the index and +1 mental difficulty never lowered it (0 violations each).
    Re-planning after the edit, +1 enjoyment RAISED it 87× (worst +24 pts)
    and +1 difficulty LOWERED it 393× (worst −15). That is the allocator
    responding, not the metric: enjoyment lifts a task's priority, so a
    high-gap task that was starved gets funded and takes a larger share of
    the allocated hours the index averages over. Any normalization has this —
    dividing by the budget instead of by allocated hours funds the same task
    the same way.
  - _The zero boundary compares a composite against a slider._ "Difficulty
    you love is not friction" is stated per-task, but the left side is
    EFFECTIVE difficulty (`max + 0.3·min`) and the right is the raw enjoyment
    slider. Over the reachable 0–10 cube, **26/1210 cells (2.1%)** read
    friction > 0 although enjoyment beats BOTH difficulty dimensions; the
    worst is `m7/p7/e8` → gap 1.1 = 12%. Deliberate and consistent —
    `grindDensity` and `rewardDensity` compare the same two quantities — and
    the reading is right on its own terms: a task that is 7 in both dimensions
    demands more than either number says (§ the spillover rationale in
    `calculation.ts`). Pinned by fixture (`calculation.test.ts`, "measures
    EFFECTIVE difficulty"): it is the only assertion on the INTERIOR of the
    scale, since both endpoint fixtures sit where `getEffectiveDifficulty`
    clamps and so cannot see `DIFFICULTY_SPILLOVER` move.

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
  eight. Closed form, so there is no sweep and no probe: the three cells and
  the three guards are pinned in `calculation.test.ts`, which also reads the 94
  cell at default arity and asserts the constant, since rounding alone holds 94
  across sc ∈ [0.233, 0.278] (re-read 2026-08-18).

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
  checked off. Task Variety is retired outright in §24 — the scope rule below
  outlived it.) **The suggested run order joined them on 2026-08-18** — the
  amendment below.
- **Progress** ("how well am I executing the plan?") — all tasks by
  construction; completed tasks are the numerator, so these MUST move on
  completion. Completion Rate, Yield Index.
- **Next-up** ("what should I grab / watch out for next?") — active
  (uncompleted) tasks; these SHOULD deplete as the day progresses. Momentum
  (§11.7 reading kept; over all tasks it would duplicate Day Profile, which
  classified the same two averages — §29 has since hour-weighted Day Profile
  over funded tasks, so the two now differ in weighting as well as in scope),
  Quick Wins, Bottleneck, Longest Warm-Up. (Bottleneck's parenthetical here — "tooltip now states
  it may name an unfunded task" — is retired with the `E/β` formula: the
  binding-pool draw weighs allocated hours, so an unfunded task draws nothing
  and cannot be named. Its binding AXIS is next-up as well — it is solved on the
  active list, not the plan's, §23.1.)

Also in this change: `flowCoverage.optimal` dropped (computed, never
displayed), and the Energy Lab's classic-plan comparison no longer strips
completed tasks from the classic side only — both plans simulate the full
intended day, so `outputVsClassic` is no longer biased toward the energy
plan once anything is checked off. (That field is now `valueVsClassic`: §30
renamed it and repointed it from raw `totalOutput` to the `objective` on
2026-08-07. The rename does not touch the reading here — both sides still carry
completed tasks, and §30 back-cites this section for exactly that.)

**The `#N` run order is plan-scoped, not next-up (2026-08-18).** It sat under
next-up on the reading that "what to grab next" is a question about what is left,
and one thing settled that: the badges do not merely number the rows, the list
**orders** rows by them, in `/`'s two-group reading
(`presentation/AGENTS.md`). Interleaved over the ACTIVE tasks, the sequence
re-greedied on every completion — so ticking a task off renumbered its
neighbours and dropped its own row to the foot of the group, out from under the
🪫 editor the completion had just opened on it. Over the funded PLAN
(`calculateInterleavedOrder(suggestedTasks)`, completed included, since a
completed task keeps its hours) the set is completion-invariant, so both the
numbers and the row order hold for the whole day — which is what
`next_up_tooltip` already promised the user ("stays the answer it was this
morning"). A completed row's position is spent and its badge hidden, so the
visible numbers can carry gaps; that is the honest reading, since the number
names a slot in the day's sequence and not a rank.

The remainder still has its own answer and it is a separate reading: §35's
`RemainingDay.nextTask`, interleaved over the funded remainder, which is next-up
by construction and depletes as it should. Nothing else consumed the map.

**The display gate belongs to the same family (2026-07-30).** Scoping the
calculation is only half of it: `buildMetrics` withholds a reading whose
inputs are missing, and gating a plan-scoped row on _active_ tasks blanks it
to N/A the moment the last task is checked done — the red-0 defect above in a
different colour. Flow Coverage, Task Variety (retired, §24) and Grind Density
were gated that way and now gate on the plan (tasks, plus a budget where a budget-0 plan
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
  order, so recursing over history would model noise. That bound is the GAP's,
  not the day's: two 19 h days at the fit floor keep e^(−1.5) ≈ 22 %, the same
  long-day corner the order bullet below scopes.
- **Defaults heal completely.** ρ_rest = 0.7·1.5 = 1.05/h leaves
  e^(−16.8) ≈ 5·10⁻⁸ of an 8 h day's deficit by morning — under default
  recovery the metric behaves exactly as before. Carry-over becomes visible
  when the user's own ☕ fit (§8.9) says recovery is slow: at the fit floor, a
  fully-drained 8 h day starts the next morning near 92 %, and a 16 h day
  (8 h gap) near 71 % (`scripts/mtr2-carry-over.probe.ts`, 2026-08-06:
  91.6 % and 70.6 % cognitive). Morning-awareness appears exactly where calibration
  evidence supports it — deliberate, not a shortfall.
- **Inherited approximations** (same class as §8.10's reconstruction, all
  documented there or in §12): partial logging under-counts the previous day's
  work, biasing the morning level **up** (risk reads low, the conservative
  direction for a metric that warns); the ☕-calibrated awake rest law stands in
  for sleep — no instrument identifies a separate sleep rate (the §8.3
  circadian boundary: rejected until there is an instrument).
- **As-logged order and omitted intraday breaks are ONE approximation, and it
  is bounded, not small.** "As logged" is the order the 🪫 presses arrived
  (`$readAllDrainObservations` is a keyed `getAll()`, and a corrected row keeps
  its id), which is the order the work happened only if the user logged as they
  went. `reservoirAt` is affine in the incoming level (L ↦ eq + (L − eq)·e^(−ρh)),
  so a cycle is a composition of affine maps: permuting its blocks leaves the
  total contraction e^(−Σρᵢhᵢ) untouched and moves only the offset. Walking a
  break out of the trailing gap into the day permutes exactly that multiset —
  putting it back at the end is bit-identical (0 on every cell, worst 1·10⁻¹⁶)
  — so breaks are not a second mechanism, and both cost the one quantity the
  trailing rest bounds: any end-of-work difference reaches the morning
  multiplied by e^(−ρ_rest·gap), and levels live in [0,1], so the **morning
  spread over all orders is ≤ e^(−ρ_rest·gap)**. The DISPLAYED risk attenuates
  a second time through today's own (also affine) simulation, then through
  min(C_cog, C_phys) and integer rounding — and an integer percent needs ~0.005
  of level to move, so any of this is visible only while
  ρ_rest·gap ≲ ln 200 ≈ 5.3. At defaults (ρ_rest = 1.05/h) that is a gap under
  ~5 h: a logged day past 19 h. Measured over every permutation of 3- and 4-row
  asymmetric days at 8/12/16/19 h worked, r ∈ {0.7, 0.3, 0.1}
  (`scripts/mtr2-carry-over.probe.ts`, 2026-08-13): **at defaults the morning
  moves ≤ 0.04 pt through a 16 h day and ≤ 0.94 pt at 19 h, and the display
  moves 0 risk pt** everywhere but the 19 h break arm, which moves 1 (its
  trailing gap is 2 h shorter); at r = 0.3, 2.1 pt / 2 risk pt at 16 h. **At
  the r fit floor — the only regime carry-over is visible in at all — a 16 h
  day moves 15.8 pt and 11 risk pt, a 19 h day 27.7 pt and 17 risk pt** (34 %
  vs 51 % on a 1 h today-budget, the worst displayed case: a short today
  attenuates least). The break arm at the floor is 7.4 pt / 4 risk pt over a
  16 h day. The bound was never crossed in either arm: 0 breaches over 2 × 48
  (arm × r × hours × mix) cells, worst 81 % of it reordering and 29 % walking
  the break (whose bound is the shortened gap's, e^(−ρ_rest·(gap − 2 h)), so it
  is the looser of the two). So "washes out exponentially through the
  trailing rest" names the right mechanism and draws the wrong conclusion: the
  exponential IS the bound, and it is only small where carry-over itself is.
  The uncommitted 2026-08-06 scratch figures (8.4 pt reordering, 2.4 pt break)
  understated it — the same cell measures 13.3 pt and 7.4 pt over three rows.
  Ordered, timed logs are the only real fix and they belong to the shelved
  multi-day work below, so this is scoped, not scheduled. **The open
  alternative, undecided as of 2026-08-13:** the reading could be made
  order-INDEPENDENT without any new instrument by seeding from the worst order
  rather than the logged one — no order information exists, and for a metric
  that warns, the low morning is the conservative end (the same argument the
  partial-logging bullet above makes). That is a decision about what the number
  MEANS, not a measurement, so no probe settles it: it would move a displayed
  reading by up to the spreads above, and it costs n! simulations unless the
  worst order is characterized (permuting affine maps, so plausibly just
  descending ρ). Left as-is until someone decides; what is NOT acceptable is
  leaving it undecided and undocumented, which was the state this paragraph
  replaced.
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
over-logged day must read exactly its own pure-work simulation. The order
scope above is pinned at its two ends (2026-08-13): two permutations of one
16 h log agree to 3 decimals at defaults and differ by 9 points at the fit
floor, inside e^(−ρ_rest·gap).
`daily-plan-store.svelte.spec.ts` pins the wiring — the same heavy log moves
Burnout Risk only when dated the viewed day's predecessor (the α fit sees it
identically from any date, so the difference is carry-over alone).

### 11.10 Grind Density: the share of the work the day actually funds (2026-08-07)

The metric had no section here, no unit test and one line of code — a dashboard
row and one of §14's nine advice axes with nothing pinning it. Reviewed with
`scripts/mtr-grind-density.probe.ts` (the same 600 seeded days as §11.4, planned
by `calculateSuggestedTasks`).

- **Before:** `|{t ∈ plan : Eᵤ(t) > βᵤ(t)}| / |plan|`, over every task in the
  plan.
- **After:** the same predicate over the tasks the plan **funds**, returned as
  `{grinds, funded, percent}`.
- **Why.** A task allocated 0 h is work the day does not do, so it drains no
  willpower — and Friction (§11.4) and Sustainable Work weigh it 0 already,
  because both are hour-weighted; only this count gave it a full vote. Measured:
  91/600 days carry an unfunded task, and on **80** of them the old rule
  disagreed with the funded-only reading, **68 of those in a different band**;
  worst case it read **75%** where the work the user would actually do reads
  **0%** (`m/p/e 8/1/4 5/2/3 4/3/7 2/9/2 | 0.75h`). The advisor made that
  concrete, measured once against the pre-retirement advisor and not re-runnable
  now that §11.11 has retired the axis: over the same days it offered **79**
  grind-density options whose lever was "defer a task the plan funds 0 h" — the
  identical day's work at a better number, priced at Σ P̄ cost **0.00%**. After
  the fix: **0**. The probe's question 3 still measures the reading arm (the
  91/600, 80 and 68 above), which is what remains reproducible. (§14 keeps
  unfunded tasks as defer candidates on purpose — they move Time Scarcity, whose
  Σϕ runs over the whole list, and the Day Profile averages. This axis simply
  should not have been one of them.)
- **The empty-plan arm.** With nothing funded the metric returns 0, which is this
  axis's global optimum, so "defer the last funded task" would win its frontier
  the way it would have won Schedule Integrity's. Same treatment as §14.1
  defect 5: the advisor reads `NaN` when `funded === 0`, failing the improvement
  test in both directions, and the dashboard row gates on `funded > 0` rather
  than on the task list — 0% would otherwise render as a clean day.

**The row shows the fraction, because the percent cannot carry it alone.** The
reading is quantized to 100/`funded` while `AXIS_BAND.grindDensity` cuts at
25/50/75. Over the sweep: **251/600** days sit where one task crossing the
threshold moves the reading across **≥2 band boundaries**, and on the **64**
single-task days the only readings that exist are 0 (success) and 100
(critical) — neutral and warning are unreachable. So the row renders
`50% (1/2)`: the same number the advice card prices, plus the resolution behind
it. The band policy is unchanged — the honest fix is to stop implying a
precision a count of ≤7 items does not have, not to re-cut thresholds shared
with eight other axes.

**Kept deliberately, and worth knowing.**

- _The threshold compares a composite against a slider._ `Eᵤ` is
  `max + 0.3·min` and `βᵤ` is the raw enjoyment slider, so **26/1210** cells of
  the reachable cube (2.1% — the same cells §11.4 documents) count as a grind
  although enjoyment beats BOTH difficulty dimensions; on seeded days **53/1467**
  counted grinds (3.6%) are of that kind. Consistent with Friction and
  Sustainable Work, which compare the same two quantities, and right on its own
  terms: a task that is 7 in both dimensions demands more than either number
  says. Here it is binary rather than a magnitude — a cell does not read "a
  little grind", it counts — which is why the fixture pinning it (`m7/p7/e9`
  grinds, `m7/p0/e9` does not) is the one that would catch a change to
  `DIFFICULTY_SPILLOVER`.
- _Strict `>` partitions with Sustainable Work._ The **54/1210** cells where
  `Eᵤ = βᵤ` exactly are not grinds and ARE sustainable time; every funded task
  belongs to exactly one of the two readings.
- _It is the least independent of the three affect metrics._
  Spearman(grind, friction) = **0.6336**, Spearman(grind, reward) =
  **−0.9480** (600 days; §11.4's 0.5561 was the pre-fix figure). Grind Density
  and Sustainable Work are the two sides of one partition, counted per task and
  per hour respectively — "how many of today's jobs are chores" against "how
  much of today's time gives back". At −0.95 that is close to one reading shown
  twice, and the honest open question is whether the count earns its row at all
  (Task Variety did not, §24). Kept for now because the unit is the part users
  act on — you defer a task, not an hour — and because the fix above was to the
  formula, not to the dashboard's inventory.

### 11.11 Grind Density is a row, not an objective (2026-08-08)

§11.10 left one question open — does the count earn its place beside the
hour-weighted reading of the same predicate — and answered only the half about
the formula. The other half is that the count was also one of §14's nine advice
axes, and that is where being unweighted has a price. Measured over the same 600
seeded days (`scripts/mtr-grind-density.probe.ts`, question 6).

**The reading and its hour-weighted twin disagree more than §11.10's −0.9480
suggests.** That is a rank correlation: the two orderings agree, the levels do
not. Writing `H` for the same predicate weighted by allocated hours,
`Σ_{grind} h / Σ h`:

- `|count − H|` runs p50 **3pp**, p90 **16pp**, max **43pp**; exact agreement on
  **250/600** days, count over-stating on 155 and under-stating on 195.
- **153/600** days fall in a different `AXIS_BAND` band under the two.
- Worst: `m/p/e 0/0/2 1/9/1 | 4h` reads **50% (1/2), neutral** on the count and
  **93%, critical** on hours — one trivial task tied 1–1 against a physical slog
  that eats the day.

**`H` is not a metric worth adding, because it is already a row.**
`100 − RewardDensity` **is** `H`, to within **0.5pp** of rounding over all 600
days (§27 measures the sustainable side of the same partition over the same
hours). So "weight Grind Density by hours" is not a repair, it is a duplicate:
it would collapse the row onto Sustainable Work and the honest follow-up would be
a deletion, not a weighting.

**What the unweighted count did as an axis.** Every lever the advisor can pull —
defer a task, move the budget — is priced in hours through Σ P̄, so an axis
denominated in task count buys reading with the wrong currency. A defer drops
the task from the count AND from its denominator, so with `g` grinds among `m`
funded tasks it moves the reading by `100·(m−g)/(m(m−1))` — whatever the task
weighs, and by 0 on an all-grind plan: on **10/545** days that step is more than
**twice** the share of booked hours it gives up, worst case **15pp for 0.25 h =
2.9%** of the day's time (`m/p/e 5/7/9 4/1/8 3/8/10 10/4/1 8/0/4 | 14.25h`,
`m` = 5, `g` = 2). That ratio is question 6, is reproducible, and its worst case
is the second row of the table below — the same **−15pp**, recorded there by the
pre-retirement advisor itself.

What the axis then did with it was measured once, against the pre-retirement
advisor, and cannot be re-run now that the axis is gone: over the same 600 days
it offered **332** defer options on funded tasks, **132** of them on a task
holding under 15% of the booked hours, including

```
−33pp  for 0.25h = 11.1% of booked time  at Σ P̄ −2.40%   m/p/e 5/10/2 4/2/9 6/7/10 | 3h
−15pp  for 0.25h =  2.9% of booked time  at Σ P̄ −3.00%   m/p/e 5/7/9 4/1/8 3/8/10 10/4/1 8/0/4 | 14.25h
```

Not free — §11.10 closed the 0.00% arm — but mispriced: three percent of the
day's value for a headline move of 15 to 33 points, bought by dropping three
percent of the work. On an hour-weighted axis the same defer moves the reading
~3pp, in proportion to what was given up. The axis was rewarding cardinality,
and cardinality is the one thing the allocator does not optimize.

**The change.** `grindDensity` leaves `ADVICE_AXES` — nine axes become eight —
and its `read`/`badness` entry goes with it, including the `funded === 0` → `NaN`
guard §11.10 added, which existed only to keep the empty plan from winning this
frontier. `frictionIndex` already reads the same two inputs (`Eᵤ`, `βᵤ`)
hour-weighted _and_ by magnitude, so the affect dimension keeps an axis; note
`rewardDensity` never was one, so the advisor's coverage here goes from
friction + grind to friction alone, which is the better half of the pair.

The dashboard row is unchanged, `% (X/Y)` render and all. "Two of your three
jobs are chores" is a fair description of a day, and the unit is still the one
users act on. It is just not a thing to optimize: `AXIS_BAND` now bands one
reading the advisor does not search on, which is why its `satisfies` widened
from `AdviceAxis` to `AdviceAxis | 'grindDensity'`.

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
users who log consistently.

~~A day's snapshot is stamped whenever the user opened analytics that day, so it
is the fit as of that moment rather than as of the morning they planned; and it
necessarily includes that day's own logs, so the fit is not strictly prior to the
behaviour being scored.~~ **Closed 2026-08-08 by §33**: `fitFrom` reads only logs
dated strictly before the day it is asked for, so a snapshot for day D is a pure
function of the logs preceding D. Both halves go together — the fit no longer
depends on _when_ the user opened analytics (the same logs produce the same
snapshot at any hour), and it is now strictly prior to the behaviour it scores.
The energy fits behind the snapshot are filtered on the same rule, so the card's
α and r agree with the dashboard's rather than running a day ahead of them.

The remaining approximation is the **fallback**, not the snapshot: a finished day
with no stored fit — before the store existed, or a day the user never opened
analytics on — is still read through the live fit. Refitting it instead is the
per-day cost rejected above, which is the whole reason snapshots are stored.

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

  | ⚡ logs         | 0         | 1     | 5     | 20    | 200      |
  | --------------- | --------- | ----- | ----- | ----- | -------- |
  | σ_ϕ (h), before | **0.000** | 0.191 | 0.072 | 0.023 | 0.002473 |
  | σ_ϕ (h), after  | **0.411** | 0.191 | 0.072 | 0.023 | 0.002473 |

  (the same mid-scale task logged n times; the n = 0 entry is generator-free.
  Re-measured 2026-08-06, `scripts/rv13-prior-posterior.probe.ts` — the n = 1
  cell was quoted as 0.194. Re-measured 2026-08-19 with that probe's σ_ϕ print
  widened to 6 dp: the n = 200 cell read 0.003 until then, which is its own 4 dp
  display 0.0025 rounded a second time. The rest of the ladder is 0.410839 /
  0.191020 / 0.071920 / 0.022613 and reproduces at the 3 dp quoted)

  So logging your FIRST flow time made the model less confident than logging
  nothing — the priority score visibly dropped (17.9 → 17.8 on the probe
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
  apart at all — where inserting reads _higher_, midpoint **0.9135 against
  0.9112**. But the gap there is **0.0023**, against the 0.14 midpoint shift the
  retracted pair would imply — 0.65 − 0.37 = 0.28 on one bracket endpoint, half
  that on the midpoint (`scripts/rv13-stop-insertion.probe.ts`, re-read
  2026-08-20; the sign survives and the gap halves). The 0.8894/0.8840 pair
  quoted here until 2026-08-20 was read on the unreachable demands this day
  carried before the suite moved it onto the sliders on 2026-08-19 — the probe
  went on declaring the old triple, so the sentence named a fixture the repo no
  longer had (ROADMAP M44). Both readings make the same point, and the smaller
  gap makes it harder.
  The bare "0.067" this sentence compared against until 2026-08-19 is
  retracted too: it appears in no probe, fixture or test, and entered the file
  in c5f4ef1 — a commit titled "Fix/unbacked math claims".) And since `lo` was
  then a max over every task, appending moved it **either way** — deflating it
  on 734 of the 939 affected days and inflating it on 205, mean signed
  midpoint shift −0.002 — so λ̂₀ picked up a convention-dependent error with
  no reliable sign, not a systematic upward bias. None of this was in §8.10's
  approximation list — the estimator depended on an implementation convention.
- **After:** the canonical amplitude order is computed over ALL of the day's
  tasks and the candidate is inserted at its own rank. The estimator is now a
  function of the day, not of insertion convention. λ₀-invariance of the
  extraction and the synthetic round-trip recovery are both unchanged — both
  conventions give bit-identical midpoints on every day of the §8.10 fixture
  grid. The recovery trio once printed here (0.3 → 0.297, 0.5 → 0.407,
  0.9 → 0.966) does not reproduce on the only committed synthetic generator:
  **true 0.9 → 0.8387** over windows 8/10/12, while true 0.5 and true 0.3 yield
  **no** usable day at all — every one censored, at the window edge and, since
  2026-08-21, by the clock: a plan that fills its window is the clock-censored
  class by construction, which is why true 0.5's one usable day (→ 0.5883) now
  survives only in the SUMMED reading, where there is no span to run out of
  (re-read 2026-08-21; the 2026-08-20 reading had that day on both sides). The 0.892 quoted here from 2026-08-06 had already stopped
  reproducing before that day was aligned: on the triple the probe still
  declared it printed 0.7995, so this figure had been drifting since the
  timestamped-day rework of 2026-08-19 and nothing in the suite could see it.
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
  is exact on 60 of 60 (§8.6, since 2026-08-13). The calibration fits do recover
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
identifiable from stop times**. What that finding is _not_ is a claim that the
stop barely moves, which is what this paragraph said until now ("a 12× V_T
sweep moved the optimal stop by only two lattice levels"). Re-measured over 300
seeded days on 2026-08-21, `scripts/stp-stopping-identifiability.probe.ts`: the
sweep moves the stop by a median 1 step, **2 at p90 and 5 at worst**, and walks
it non-monotonically on 25 of the 300. §8.10's own sibling reading — one or two
45-min lattice levels on 236 of those days — counts how many days barely move;
it is not the size of the move in the ones that do, and this paragraph was
quoting the earlier 8-cell version of it as if it were. (The two single-day
witnesses this cited until 2026-08-21 — three levels at 12 h / λ₀ 0.9 and three
steps at 8 h / λ₀ 1.3 — were artifacts of that day's unreachable demands and are
withdrawn; see §8.10 feasibility 2.) The ~7% conclusion above is unaffected: the sweep is 12× wide, so a
weak per-unit pressure still walks the stop several steps. Two facts recorded
separately are the same fact.

**Where that near-saturation DID become a defect: the Lab's tile (fixed
2026-08-07).** The objective may read after recovery; a readout labelled
"End-of-day energy" may not. The `/energy` summary printed `endCog/endPhys`
— the terminal term's own post-tail reading — so the tile answered "how
rested will I be by bedtime", not the question its label asks. Forced
pure-cognitive day, 12 h window (re-measured 2026-08-18 by
`scripts/rv13-terminal-timing.probe.ts`, every cited cell reproducing; the
`scratchpad/rv-energy-readouts.probe.ts` this table cited until then exists in
neither the tree nor the history, which is the §14.1-2 failure again):

| worked h | C_cog at end of work | pre-fix tile | today's tile |
| -------- | -------------------- | ------------ | ------------ |
| 2        | 0.5192               | 100%         | 51%          |
| 4        | 0.3043               | 100%         | 30%          |
| 6        | 0.2081               | 100%         | 20%          |
| 8        | 0.1652               | 99%          | 16%          |
| 10       | 0.1460               | 90%          | 14%          |
| 12       | 0.1374               | 14%          | 13%          |

The lost file cost this table nothing, because the fixture is pinned by the
words above it rather than by the file: `simulateReservoirs` reads the two
demands and the params and **nothing else** — not `difficulty`, not
`enjoyment` — so no unstated field can move the middle column, and "forced,
pure-cognitive, 12 h window" determines all six rows exactly. Both tile columns
are arithmetic on fields `evaluateSchedule` still returns, `round(100·endCog)`
before the fix and `floor(100·workEndCog)` after, each read off the code at
`8f01ca8^` and at HEAD rather than assumed. What the missing file does tell us
is that it could not have taken the middle column from `workEndCog`: 8f01ca8
introduced that field and the fix that reads it in one commit, so the
2026-08-07 numbers came from a second, private implementation of end-of-work
depletion — the R3 hazard, and the likeliest reason this half survived
re-measurement while the next paragraph's did not.

Six hours of full-demand deep work displayed as 100% while the same day is
79% Burnout Risk on the main page — this is the §13.6 gap surfacing as a
number a user reads, not as a latent inconsistency between two engines. Not
confined to forced plans either: on the shipped optimum over that same task in
a 12 h window the tile read **0.9995 against 0.4542** at the end of work
(2026-08-18, same probe).

**The 0.890/0.469 this paragraph carried until that measurement is withdrawn,
not corrected.** Unlike the ladder, an optimized plan depends on `difficulty`
and `enjoyment` through the objective, so this pair needs a task set the
sentence never named — and none of the three read out reproduces it: the
ladder's own task (0.9995/0.4542), §13.6's own cognitive/physical pair
(0.9998/0.9979, whose optimum ends on the physical blocks, so the cognitive
reservoir has recovered by the time work stops), §8.10's fixture day
(0.8408/0.8408 on the slider-reachable declaration of it, re-read 2026-08-21 —
0.8391/0.8391 on the unreachable one; its optimum still runs to the end of the
window, so the two readings coincide either way). The pair is not even reachable from the ladder's shape: an `endCog`
of 0.890 means work ended near the 10 h mark, where full cognitive demand
leaves `workEndCog` at 0.146, not 0.469 — so the lost fixture was several
milder tasks rather than one. Three identical full-cognitive tasks come nearest
(0.8883/0.4606) and are recorded as a **lead, not a reading**: a fixture tuned
until the target appears would prove nothing. The claim the paragraph makes
survives the withdrawal by a wider margin than it had — a tile reading all but
full on a day that ends at 45%.

**The fix is a second reading, not a moved term.** `ScheduleEvaluation` now
also carries `workEndCog/workEndPhys` — the reservoirs as the last WORKED
block leaves them (initial levels when nothing is worked; rest after the
final work block, explicit or tail, cannot launder them). The tile reads
those. `terminalBonus` is untouched and still prices the end of the window,
because moving it would break the stopping mechanism above and de-calibrate
λ₀ (§8.10) for a readout's sake. The label moved with the number: "End-of-day
energy" → "Energy when you stop". The tile also floors instead of rounding
the percentage — rounding printed 100% from 0.995 up, and on a depletion
reading 100% has to mean untouched.

The app therefore carries three related readings, each right for its own
question: `terminalBonus` (end of window, prices stopping),
`workEndCog/workEndPhys` (end of work, what the Lab shows), and Burnout Risk
(end of the intended workday, `min` of the two, on the classic plan).

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
   yet has in the Lab exactly what it has on the main page (the old `|| 8`
   fallback is gone): 0 until ROADMAP item 16, that weekday's usual hours
   since, and either way the one value both screens read. What stays forbidden
   is a window the main page does not have, which is the same divergence in
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

Not everything the card shows is priced here. The destination preview beside
these readings — what the day a defer sends to already holds (ROADMAP item 21) —
is a read of ANOTHER day's record, no part of this objective and a price on
nothing: a defer is still valued as "off today", and the hours it reports are
frequently a weekday median rather than a declared budget, which is exactly why
it makes no per-task claim.

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

**Axes and badness.** Eight readings are searchable, each with a _badness_
function so that lower is always better (nine until §11.11 retired Grind
Density — a count of tasks under levers priced in hours):

| Axis                                                                                       | badness     |
| ------------------------------------------------------------------------------------------ | ----------- |
| Burnout Risk, Human Capacity, Cognitive Load, Physical Load, Friction Index, Time Scarcity | `v`         |
| Energy Balance                                                                             | `abs(v−50)` |
| Schedule Integrity                                                                         | `−v`        |

Energy Balance is a **target** between the two pools, not a maximum — both
80% cognitive and 80% physical are worse than 50/50, which `v` alone cannot
express. On a zero-load plan the advisor reads it as `NaN`, not the 50 that
`calculateEnergyBalance` displays — an empty plan has no balance, and the
sentinel is also the target (§14.1 defect 5). **Schedule Integrity reads `NaN`
on the same kind of plan** (2026-08-07): §11.5's guards return the sentinels
100 (no tasks) and 0 (nothing funded), and that 100 is this axis's global
optimum, so "defer the last task" is its best move on a day with no work left
to measure. The frontier's Σ P̄ gate did reject the empty plan — but by
circumstance, not by construction, and the gate is not this axis's to rely on.
`NaN` excludes such candidates AND baselines the same way Energy Balance's
does. Human Capacity may read `Infinity` (a pool of 0 with demand on it, §11
`calculateHumanCapacity`); the improvement test is `<`, so `Infinity` never
beats `Infinity` and such a candidate is silently excluded rather than
producing `NaN`.

Badness only **orders** candidates. It never decides that a reading is bad:
whether 82% burnout deserves advice at all is a band, and bands are
presentation policy (AGENTS.md §5) — `presentation/utils/band.ts` owns them
(`AXIS_BAND` + `isOutOfBand`) and both the card and the metric rows consult
them. The model is threshold-free on purpose, and answers the
same question for every axis unconditionally: what would help this, and what
would it cost. Including when the answer is _nothing does_ — that finding is
returned too, empty menu and all, because "no lever helps" and "nothing is
wrong" are the same absence to a caller and only the bands tell them apart
(§14.4).

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

The first is size. Measured (`scripts/plan-advice.probe.ts`, 2026-08-17): **0
positive deltas over 4112** non-empty priced frontiers on 600 seeded days — the
2026-08-06 reading of the same seeded set counted 4450 of them, so the
denominator drifted while the claim it carries did not. Two
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
Measured 2026-08-17 (`scripts/plan-advice.probe.ts`; default constants,
`DEFAULT_CAPACITY_POOLS` 4/6 h, `switchCost` 0.25 h, 8 h budget; median of 11
reps after a discarded warm-up, six runs on an idle AMD Ryzen 7 7800X3D under
WSL2, node v22.14.0 — a wall clock is quotable only with its machine, §8.6):
**0.02 ms** per solve at 3 tasks, **0.11** at 6, **~2.4** at 9, **~9.3 at 12**
— the 2ⁿ funded-subset enumeration of §4, which the linear candidate count
amplifies into 1.0 ms for a 6-task day but **109–124 ms for a 12-task one**.
`candidatesEvaluated` is 5/8/11/14/17 at n = 3/6/9/12/15, so the dedup drops
exactly one candidate on every day tested — §4's own trim lever, whose slack is
0 at an 8 h budget on these mixes. Advice is therefore computed **on demand and
never in a `$derived`**: a 12-task day would otherwise freeze the main thread
for a tenth of a second on every keystroke in the budget field.

The range is the reading, not sloppiness: the same measurement on the same box
spans 109.00–123.86 ms across six runs, so a two-decimal figure here would be
false precision of the kind §8.6 already warns about. The 2026-07-27 reading of
this ladder was 1.6/3.9/12.5/**95** ms per solve and **946 ms** for the 12-task
run, on an unnamed machine and before the solve-once change below; it is kept
only as the order of magnitude the on-demand rule was adopted against, and it
is not comparable with the numbers above.

**Past n = 12 the cost falls, so n = 12 is the worst case and not a floor.** At
an 8 h budget with s = 0.25 h the affordability test of §34 (`33 − m ≥ m`) lets
`maxFunded` reach n, so at n = 15 the enumeration would be 32,767 subsets
against `SUBSET_SEARCH_BUDGET = 4095` and the solve takes the greedy
forward-selection fallback instead: **~2.4 ms per solve and ~45 ms for the whole
advice run**, a third of the 12-task day's. Any "a longer backlog is worse"
reading of this rule is therefore wrong past 12 (2026-08-17, same probe).

Since 2026-07-28 each of those solves costs half what it did: a
`calculateDailyMetrics` used to run the pooled allocator **twice** on identical
inputs, once for the plan and once for Zenith Gain's optimized side, and the
gain is now handed the plan's own allocation (`calculateTaskPlan`). Re-measured
on one 12-task day, one solve went 103.6 ms → 51.2 ms and the whole advice run
421 ms — the ratio is exactly 2. Those absolute numbers are comparable with
neither the ladder above (different task mix, different machine) nor today's
code: the same 12-task measurement now reads **109–124 ms** (2026-08-17,
`scripts/plan-advice.probe.ts`), and the halving's "before" half is the one
figure here that cannot be re-run at all, since the change it measures is
shipped. What survives is the ratio and the conclusion; **421 ms is history, and
was cited as current in three places until this measurement**. Nothing the gain reports changed: §13.2's
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
evicted real alternatives.** Σ P̄ is monotone non-decreasing in the budget at
the true optimum (the n > 12 fallback can invert it — §34) —
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
`weightedHours / budget` (§25). So the two are not comparable on one axis and
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
slack under 0.25 h ceils back to the budget. The descriptor rounds the **label**
to two decimals and the lever stays exact. The card's Apply does write the exact
hours to `availableHours` (added 2026-07-28, after this was first written as "no
Apply, so nothing to align to") — so it is the CONTROLS that align to the budget
and not the reverse: the day bar's slider carries `step="any"` and snaps only what
a drag produces, because a range input otherwise sanitizes an applied 1.35 h to
1.25 h in its own display. Distinctness is now the one-minute tolerance above,
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
is monotone in plan value by construction — 0 of 4112 priced frontiers violate
it (re-measured 2026-08-19, `scripts/adv1-plan-advice-frontier.probe.ts`;
[2026-08-06: the same 0, over 4450]) —
which makes the **last** row the cheapest option, the "most of the relief for a
fraction of the cost" one. `slice(0, maxOptions)` therefore cut exactly that.
Rare but exactly backwards when it fired: **27 of 4112** frontiers exceed 3
options — 0.66%, against 0.34% on the 2026-08-06 draw — longest **5** (2468
hold a single option). [2026-08-06: 15 of 4450, longest 4, 2961 single-option,
and that last count was already one off when written: at `8f01ca8^` the probe
prints 2960.] Fix: keep both ends — `maxOptions − 1` from the front plus the
last — and drop from the middle. The longest frontier growing from 4 to 5 does
not touch that fix: `cap()` (`plan-advice-descriptor.ts:296`) keeps both ends at
any length.

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
path is a near-exact heuristic (§13.3: exact on 99.5% of the cited draw), and so
is the n > 12 fallback (§34: 4 inversions in 6400 steps), so two
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
- **On every one of those days (216/216) the card was still offering "work an
  extra hour."** Re-measured 2026-08-19; [2026-08-06: 215/216, with one
  exception — a day funding 3 tasks for 1 h inside a 7.75 h budget with pools
  5/0.5, where both Load axes were still rounded to whole percent in the model,
  so on a pool-starved day the wider budget moved no axis at all and no lever
  was offered. That mechanism is still the right explanation of the day it
  described; the day is what no longer exists, because `8f01ca8` (2026-08-08)
  made the Loads exact and left the whole-percent rounding to display, §25.]
  Not a defect in §14.1-1's split, which was about domination, not about
  suppression: Cognitive and Physical Load are `weightedHours / budget` (§25),
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
days where another block buys no Σ P̄, **every one** still offered the extra
hour somewhere on the menu (216/400 and 216/216, as measured above — the
2026-08-06 draw read 215/216, and `8f01ca8` retired that one exception when it
made both Load axes exact).
That is not a contradiction, because the two readings
measure different things. The marginal is Σ P̄ — output. The lever appears on any
axis it improves, and Cognitive and Physical Load are `weightedHours / budget`
(§25), so on precisely these days the numerator is frozen and the whole
improvement is denominator mechanics — the effect §14.1-1 named when it refused
to _price_ the lever, while keeping it as advice. Keeping it is right: §25 defines
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
carried **+41.9%**. The bracket is dropped only when both arms would read 0 or
null, which is what a single-task list looks like and what a starved plan does
not.

**That day, finally stated by value, and it is the generic day rather than a
corner** (2026-08-17, `scripts/adv2-switch-cost-price.probe.ts`, reading the
shipped `switchCostPrice` through `suggestPlanAdjustments` rather than
re-deriving it). At a 0.5 h budget with s = 0.25 h, `budgetBlocksFor(2)` is one
block, so no plan can fund two tasks: `funded` = 1, `reservedHours` = 0, and both
bracket arms survive the one-minute test. **Every 3-task case swept lands in that
state — 58 of 58 fixture-year days and 4560 of 4560 grid triples, none of them
unpriceable** — so the independent suppression is not guarding a rare defect, it
is guarding the whole configuration. The s = 0 arm reads a median **+41.9%** over
the fixture days (max +63.4%) and **+42.0%** over the grid (max +99.8%, three
zero-difficulty tasks at pools 0.5/0.5 where one funded task at 2 blocks becomes
two at 1 block each, both collecting the activation bonus). The witness nearest
the figure this section has quoted since 2026-08-04 is
`mentalDifficulty/physicalDifficulty/enjoyment` **5/0/2, 4/1/8, 9/0/7 at pools
4/6**, Σ P̄ 1.1477 → 1.6286 = **+41.9%**. The **+41.8%** the section carried until
today is reached by none of the 4618 cases; on this rounding lattice it is a
0.1 pp miss, not a different phenomenon.

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
a measured **9–11% of the advisor at n = 8 and ~6% at n = 12** — the share
_falls_ as the day grows, because the declared solve's 2ⁿ funded-subset
enumeration grows faster than either alternative's. `s = 0` is very nearly free
(0.05–0.08 ms against a declared solve of 4.0–4.5 ms at n = 8 and 9.0–10.0 at
n = 12): `switchCost <= 0` short-circuits the enumeration entirely and allocates
once. `s = 2s` runs at **0.7–0.9× the declared solve** (0.84–0.94× at n = 8,
0.68–0.78× at n = 12), because the larger reservation drives `budgetBlocksFor`
non-positive for most large subsets and they are skipped — **cheaper, but by a
quarter and not by two thirds**, which is what "roughly a third of the declared
solve" claimed here until 2026-08-17. These figures share §14's machine and
method (`scripts/plan-advice.probe.ts`, six runs, median of 11 reps) and are
comparable with its Cost paragraph; the 2026-08-04 pair of 7.3% / 2.9% was taken
under coverage instrumentation and is not.

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

### 14.4 An empty frontier is a reading (2026-08-08)

**The day.** Every task cognitive. The dashboard reads **Energy Balance
Cognitive Heavy 100%**, banded Caution. The advice card, on the same day, says
_"Nothing reads badly enough to act on. This day is fine."_ Adding a single
physical task makes the Energy Balance row appear with four options — same
code, different day, which is what made it look intermittent.

**Why the axis has nothing to offer, provably.** Energy Balance is the
cognitive **share**, `cog / (cog + phy)` (§25), and both loads are
`weightedHours / budget` (§11). With no physical work on the list:

- **every defer ties.** `phy = 0` for every subset of a cognitive-only list, so
  the share reads 100 whatever is dropped — until the last task goes and the
  plan is empty, which is §14.1-5's `NaN`.
- **every budget lever cancels.** Both loads carry the same `1 / budget`, so
  the ratio is invariant under the budget. (The `Math.min(100, ·)` clamp on each
  load can break that invariance in general — not here, where one side is 0.)

The improvement test is `> 0` (a candidate that merely ties is not an option,
§14.1-5), so the frontier is empty, `unpriced` is null, and the search was
right: nothing on today's levers moves this.

**The defect was the deletion.** `suggestPlanAdjustments` ended with a
`.filter(finding => finding.options.length > 0 || finding.unpriced !== null)`,
so an axis nothing improves left no trace in `PlanAdvice`. The card then read
`rows.length === 0` as _every axis is in band_ and printed the clear message —
a claim the model never made, over a warning it had reported. The card already
guards the mirror image of this (`unfunded` is a read, not a band, so
"this day is fine" is suppressed under it); this was the same conflation one
case short.

That filter also contradicted §14's own division of labour: the model prices
every axis unconditionally and **the bands decide what is worth saying**
(`presentation/utils/band.ts`, AGENTS.md §5). A model-side drop is a
presentation decision taken where the bands are not visible — and it cannot be
taken correctly there, because "no lever helps" and "no problem" differ only by
a threshold the model deliberately does not have. So the filter is gone:
`findings` now carries one entry per axis in `ADVICE_AXES` order, always, and an
empty menu is a reading the card states in words ("No task move and no budget
change improves this") rather than an absence it has to interpret.

**What that costs: nothing.** The candidates were already solved and every
`before` was already read; only the array got shorter. The card renders at most
the axes `isOutOfBand` selects, exactly as before.

**The one exclusion the card keeps.** A `before` that is not a finite number
judges nothing — `readingOf` prints N/A and bands it neutral — so it earns a row
only when there is a lever under it. Human Capacity's `Infinity` (a pool of 0
with demand on it) qualifies: real options bring it down to a number, and that
row is worth showing. The two `NaN` sentinels are the case this excludes, and
`AXIS_BAND` alone would not: `getBandBiggerBetter(NaN)` is `critical`, since
`NaN >= 25` is false, so an unfiltered Schedule Integrity would put
"N/A · nothing improves this" on every day with no budget declared — precisely
the alarm-about-nothing §14.1-5 and its 2026-08-07 extension introduced those
sentinels to prevent.

**Reachability.** Energy Balance is the systematic case, because it is the one
axis invariant in the budget: every other axis has `budget + 1` as an all but
guaranteed improver, which keeps `unpriced` non-null and the finding alive under
the old filter too. The rest of the reachable set is days where the levers run
out — a single-task day, or one where every task is flagged `mustDoToday`.

### 14.5 Flow Coverage becomes the ninth axis (2026-08-24)

**The question.** §28 made Flow Coverage a headline on the test that _the remedy
is in the reading_ — "2/5 means drop tasks or add hours". The advisor has never
searched it. So the dashboard could print `3/5` beside an advice card reading
"No task move and no budget change improves this", on a day where moving one task
off today takes the plan to `4/4`. The lever was already there: `buildLevers`
constructs a `defer-task` candidate for every unpinned active task and re-solves
the whole day for each. Only the question was missing.

**Why it was not simply added as a ratio.** §11.11 retired Grind Density from
this list because a task-count reading under hour-priced levers is gamed by the
defer itself — the task leaves the numerator and the denominator together, so the
reading improves for free. `reached / total` has exactly that shape. Measured on
the same 600 seeded days (`scripts/plan-advice.probe.ts`, 2026-08-24): of the
defers that raise the SHARE, **259 raise no count at all**, against **405** that
do. A share-ranked axis would have spent 39% of its menu offering the user credit
for starving a task.

**The axis therefore ranks on the count and displays the share.**

|           |                                                     |
| --------- | --------------------------------------------------- |
| `read`    | `100 · reached / total`, and `NaN` when `total = 0` |
| `badness` | `−reached`                                          |

A defer can only lower or hold `reached`; it rises only when the freed hours
carry some task past ϕ, which is the thing the reading is about. A budget lever
holds the denominator, so it moves both numbers together.

**This is the first axis whose badness is not a function of its own reading**,
and the `AXIS` record changed shape for it: `badness` now takes the `DailyMetrics`
rather than the value `read` returned. Nothing else moved — §14 already rules
that badness only ORDERS candidates and never decides anything, so what it
consumes is free to differ from what the card prints. The eight existing axes
compose the two out of the same expression and are behaviourally unchanged.

**It needs no empty-plan sentinel, unlike the two axes beside it.** Energy
Balance and Schedule Integrity each read their global optimum on a plan that
funds nothing, so "defer the last task" wins their frontier unless a `NaN`
excludes it (§14.1-5). An empty plan reaches flow zero times, which is the worst
reading this axis has, so the frontier rejects it by construction. The `NaN` at
`total = 0` is for the DISPLAY — a band on 0/0 is a judgement about a number that
does not exist — and the card's existing non-finite filter drops the row.

**Cost: no extra solves.** The candidates are already computed; a ninth axis is
one more pass of `paretoOptions` over the same `activeTasks + 3` re-solves. §14's
cost paragraph is unchanged.

**The band, measured — and the rule that was refuted.** The plan for this change
said: sweep the seeded days and adopt the largest threshold whose warning share
stays under half. No threshold qualifies.

| threshold                            | days banded warning |
| ------------------------------------ | ------------------- |
| `< 50` (the rule before this change) | **89.0%**           |
| `< 75`                               | 95.2%               |
| `< 80`                               | 96.2%               |
| `< 100`                              | **96.3%**           |

The guard assumed a mostly-green tile that a widening might spoil. There is no
such tile: `flowCoverage.total` counts every task in the plan, funded or not
(§11.8), so a backlog longer than the day reads low permanently and this row is
already amber on nine days in ten. Applying the rule literally would have kept
`< 50`, under which a 3/5 day is in band and the axis cannot fire on the case it
was built for.

**Adopted: `value >= 100 ? 'success' : 'warning'`** (`presentation/utils/band.ts`).
It costs 7.3pp more amber days than the rule it replaces, paints nothing red —
`< 50` already banded warning, so no day gets louder than it was — and the band
now states exactly the condition the axis searches on: some task in this plan
never reaches ϕ. Flow Coverage's thresholds move out of `metric-descriptor.ts`
and into `AXIS_BAND` in the same change, because the card filters on
`isOutOfBand` and two spellings of one threshold is the R3 failure that module
exists to prevent. The tile's `X/Y` render is untouched; the card prints the
share, since one number cannot carry a fraction back.

**What the axis is worth: a lever raises the flow count on 30.8% of days.** On
the rest the row says "no lever helps" out loud, which is §14.4's reading and not
an omission.

**The one thing this did not fix, and deliberately.** That 89% floor is a
property of the denominator, not of the band: a task the plan funds zero hours
can never reach ϕ, and counting it makes the reading structurally pessimistic on
any day with a backlog. Rescoping it is a change to a headline metric with its
own consequences — §11.8 set the plan scope on purpose, to stop the reading
dropping when a flow-reaching task is checked off — and it is not this one.
Recorded here so the next reader of that 89% knows what it measures.

### Pinned in the suite

`plan-advice.test.ts` carries the axis as its own describe block, on the five-task
day this feature was reported from: three of five reach ϕ at a 10 h budget, one
defer takes it to 4/4, and the other four take it to 3/4 without a single task
reaching flow. That last one is §11.11's defect written as a test — it goes green
under a badness of `−share`, which is what it is there to catch.
`metric-descriptor.test.ts` pins the tile's band against `AXIS_BAND.flowCoverage`
and its fraction render;
[the-headline-the-advisor-never-searched.md](docs/features/the-headline-the-advisor-never-searched.md)
holds the decisions.

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
| classic | **wins 284/300** [276], median +39.5%, p90 +99% | wins 2/300                                      |
| energy  | wins 16/300 [24]                                | **wins 298/300** [300], median +17.4%, p90 +48% |

Re-measured 2026-08-19 at the same seed: the classic column read 283/300,
+38.8%, +97% and the energy column 17/300 when the probe was committed
2026-08-06, and the two 2026-08-13 solver commits moved them — 282/300 at the
tree between them, so that cell moved twice, in opposite directions. The
composition overlap below moved 0.58 → 0.57 → 0.58 over the same two commits
and so matches what is written here while never having stood still: a cell
that reproduces is evidence about today's tree, not about its stability.

Each model beats the other by tens of percent on its own scale. That is not a
close call awaiting better data; it is two definitions of a good day.

The energy column is **not** a clean sweep, and the earlier "loses 0/300" was
the same cell stated backwards. The classic plan wins the energy objective on
2 of 300 days because it is laid out in 15-minute blocks while `optimizeSchedule`
searches the 45-minute lattice (§8.8) — the energy plan is a maximum over that
lattice, not over all schedules, so "never" was never a property of it.

**The exceptions are not an allocator defect.** Controlled by re-solving the
classic allocator with a budget that hands it exactly the energy plan's work
hours (`(m−1)·switchCost` added back): 15 of the 16 still scored below the
energy plan under `Σ P̄` [2026-08-06: 16 of 17; 2026-07-29: 20 of 24], and
**every one of them is infeasible for the classic allocator** — 15 of 15 —
cognitive load 4.35–7.20 h against the 4 h pool, physical up to 6.68 h
[2026-08-06: 7.20 h] against 6 h. The load-bearing half of this paragraph is
the "every one", and it reproduces on all three draws; the counts do not — the
first draw recorded no seed, and the 2026-08-13 solver commits moved the
seeded ones. The energy model has no pool constraint at all (§8 substitutes
reservoir dynamics), so it plans days the pooled allocator is forbidden to
emit. On the plans it is allowed to emit, the classic allocator never loses
its own objective.

**How they differ, quantified.** The disagreement is systematic, and it is
about concentration — the §0 spreading question, measured:

- Funded tasks per day: energy **1.95** vs classic **3.96**
  [2026-08-06: 1.97 / 3.96; 2026-07-29: 2.05 / 3.88]. Energy funds **more on
  0 of 300 days** — not once, on any of the three draws.
- Composition overlap `Σ min(share)`: mean 0.58, median 0.58, p10 0.33.
  Identical funded set on **29/300 days (10%)** [2026-08-06: 30/300;
  2026-07-29: 49/300, 16%].
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

### 15.1 The copy named the wrong objective for both modes (2026-08-07)

Found alongside §13.6's tile fix. Two peer modes and two objectives, and the
user-facing copy attributed the same wrong one to each.

- **The Lab** said "this scheduler maximizes **total output** across your
  day", directly above a tile printing `totalOutput`. It does not: it
  maximizes `satiatedOutput + freeTimeBonus + terminalBonus` (§8.4), and the
  raw sum is the one field of `ScheduleEvaluation` the optimizer never sees.
  Not a hair-splitting distinction — over 988 enumerated plans in a 10 h
  window, **42.2% of ordered pairs rank differently** under raw output than
  under the objective. **That figure is unbacked**: its probe was left in a
  scratchpad and never committed (2026-08-07), which is the §14.1-2 failure
  AGENTS.md §4 exists to prevent, and 988/42.2% cannot be re-checked from this
  repo. Its substance reproduces on a different construction — 3 tasks, 10 h,
  the 45-min lattice, 560 enumerated plans → 21.4% of pairs discordant, and the
  two argmaxes disagree materially (raw output `[5.25, 0, 4.5]`, dropping a task
  to work 9.75 h; the objective `[3.75, 3, 3]`) — but that rebuild is not
  committed either, so this bullet's numbers are the list to work down, not
  citations. The order-of-magnitude claim that survives both is §30's, which is
  probed: median +61% under raw output against +17% under the objective.
  The sentence also made the stopping behaviour look arbitrary: a bare
  total-output maximizer works the whole window (§0), so the copy described an
  engine that could not have produced the plan below it.
- **The About page** said the main page "solves for the time allocation that
  maximizes your total output" — the objective §0 explicitly rejects, and for
  the same reason. The classic planner maximizes `Σ P̄ᵢ`; total output is what
  it is defined _against_.

**The first repair of the About sentence replaced it with a second wrong
objective** (caught same day): "the time allocation with the highest average
productivity across your day". `Σᵢ P̄ᵢ(tᵢ)` is a **sum of per-task averages**,
not the day's average productivity — the sum rises with every task funded, the
day average `Σ output / Σ hours` falls when a weaker task joins. They prefer
opposite days. On a 4-task 8 h fixture the shipped plan books
`[2.5, 2, 2, 0.75]` h at `Σ P̄ = 6.791`, day average **1.770**; the best single
task run alone at its own `T*` (4.5 h) has day average **2.358** — the
allocation with the highest average productivity across the day is "do one task
and stop", which the allocator correctly refuses. §0's own shorthand ("the
average-productivity objective") is safe beside the formula and misleads as a
standalone definition; the copy now says "the highest average productivity **per
task, summed across your day**", and the Lab's contrast clause names the same
thing ("instead of maximizing each task's average productivity").

Copy now names each objective: the Lab maximizes "the day's total value — your
total output, worth less on each task the longer you stay on it, priced against
what your free time and the energy you have left at the end of the day are worth
to you" (that last clause pins the term to `endCog/endPhys`, after the trailing
rest — the End-energy tile beside it reports `workEnd*`, §13.6, and one phrase
for both was ambiguous); About, the summed per-task average above. The
`totalOutput` tile keeps its label and its number — it reports a quantity
honestly, and §8.4 keeps raw output as what the UI charts; what was wrong was the
sentence above it claiming that quantity was the target (and, until §30, the
comparison tile scoring against it).

**Four more strings, swept the same day.** The two objective sentences were not
alone in overstating the model:

- The `/energy` **meta description** still announced a "Total-output scheduler"
  (de: "Gesamtleistungs-Planer") in the head of the page whose visible copy had
  just been corrected → day-value scheduler.
- The site **meta description** ended "to maximize output" — the objective §0
  rejects, in the string search engines quote → "across the hours you actually
  have".
- **About** said Fallow "solves the allocation **exactly**". §4's exactness claim
  is narrower than the shipped path: single budget, `σ_ϕ = 0`, `n ≤ 12`. The app
  always runs the pooled path, which §13.3 measures at 93.55–94.50% exact with
  per-seed worsts 3.37–5.28%. Copy now splits the two cases and gives the ~94%.
- **About** credited the dual pools with alternating hard thinking and physical
  work. The pools cap each system's total and score no sequence at all
  (§16: `Σ P̄` is order-invariant); the alternation is
  `calculateInterleavedOrder`'s heuristic. Copy now attributes each to the
  mechanism that produces it.

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
only **123/300 days (41%)** — 44% of the integer difficulty pairs this probe
draws land `'balanced'` under the ±3 threshold (47% of the probe's funded
tasks), and balanced contrasts with everything, so the greedy degenerates to
priority order. The 0.00% overall median is that no-op rate, not a null effect:
where it fires it gains a median 0.32% over plain priority.

The 44% is over **1–10**, which is what `drawDays` samples — not over the slider
range, which starts at 0. §22 gives the rate over the reachable 0–10 square
(40.5% under this probe's rule, 37.2% after §22's zero gate) and shows why no
cell of the table above moves: the four pairs §22 reclassifies all carry a zero,
and this probe never draws one.

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
  for every consumer — the `#N` badges (§11), Burnout Risk's block sequence
  (§11.6), the Lab's schedule and §35's remainder. It is a greedy over the set
  it is handed, so **one definition, not one output**: the badges and the
  simulated blocks read the same funded plan since the 2026-08-18 rescope
  (§11.8) and therefore agree, while §35's runs over the remainder and is free
  to open with a different task.
- The ontology mismatch is **acknowledged and accepted**: an order justified by
  dual-pool reasoning feeds an energy-model simulation. The probe is the
  justification — under §8's own scoring the heuristic is within 0.47% of
  optimal, so the mismatch costs nothing measurable.
- §12 and §15's classic baseline keep their current sequencing, so their figures
  stand unrevised.
- Caveat on generalization: uniform-random difficulties over 1–10 produce the
  44% balanced rate, so a real task list may re-order more or less often than
  41% of days. The bound on the _gain_ does not depend on that rate.

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

- **Before.** The 🪫 writer upserted on `(taskId, date)`: re-rating a task the
  same day replaced the record, keeping the newest `hours`. Typo-correction
  semantics, mirroring the ⚡ flow log.
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

  All three re-measured 2026-08-18 through the shipped `adviseStop`
  (`session-row-truncation.probe.ts`): **0.6669 / 1.0986 / 0.3716**, 45 min
  each, and the two-row day prices identically to one 4.5 h row **when the two
  rows were logged at the same moment** — see the closing note, which 2026-08-19
  had to qualify. The example
  understates the defect — every split of that day flips the verdict, 1.35× to
  3.28× the true price, and over 200 seeded slider-drawn tasks the truncated
  reading is higher on all 200 and flips 66.5%, worst gap 1.07/h. The witness is
  model-level and not app-reachable: `toEnergyTask` reads w = (0.8, 0.2) off
  sliders 8/2, whose effective difficulty is 8.6, where the 4.5 h day still reads
  `continue` at 0.562/h. Difficulty 7 at w = (0.7, 0) (sliders 7/0) does flip —
  0.793 → 1.239 → `stop` at 0.461 — and is what
  `energy-lab-store.svelte.spec.ts` pins.

- **After.** The writer appends (`$createDrainObservation`); a task's hours for a
  day are its rows summed, which is what `workedHoursByTask` and
  `readFinishedDays` already computed. §8.7 is unchanged and gets cleaner
  data — each row is one session, so the fresh-start approximation applies per
  row as written. Correcting a rating is `$updateDrainObservation` on that row
  (its own chip on the task's row, on either screen, or the ✎ in the analytics
  history), which keeps its original `createdAt`; re-logging a correction would
  count the session twice, which is the same defect from the other side. One
  reader did NOT already sum:
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
  a sufficient part of.

- **Corrected 2026-08-19: "they carry no session boundaries and no gaps between
  sessions" was half wrong, and the wrong half was load-bearing.** Each row IS a
  session — this section argues that itself — so the boundaries were there all
  along. The gaps are not RECORDED, but they are INFERABLE: `createdAt` is the
  log moment, so `endedAt − hours` starts the session and the space before it is
  a break. §8.10's reconstruction reads them that way now, and the sentence above
  is what let it discard them for a year. The weaker true statement: the rows
  carry session boundaries exactly, and gaps only as well as the user logs
  promptly.

  **The identity in the advisor bullet above therefore ends where the gaps
  begin.** Two rows still price identically to one row of their sum when they
  share a log moment (a batch-logged day, and `drainRecord`'s fixture default),
  which is why the three pinned marginals are unmoved. Once the moments are
  apart the day is not the same day: rows 45 / 90 / 180 min apart read **0.5902 /
  0.6086 / 0.4342** against the contiguous **0.3716**, and the first two flip the
  verdict back to `continue` — the reservoirs recovered across the break, so the
  next session really is worth more (`session-row-truncation.probe.ts`,
  re-read 2026-08-21; the 180-min reading was 0.4875 until M42 capped the priced
  session by the day's remaining clock — 3 h apart leaves that day half an hour of
  window, so the advisor now prices one step there instead of a longer session). Higher, not lower: a day with breaks in it leaves you fresher.

**What the UI had to learn.** Per-session rows make two of its habits wrong.
The 🪫 editor no longer prefills the last rating and no longer re-saves it:
the row's button starts a session, and a chip per stored rating corrects that
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
budget on the 0.25 h lattice) — so §19.1's and §19.2's tables, and §19.3's
rotation-gap and ≥ 0 figures, sit on the same draw as §13.2's table. **§19.3's
other three groups cannot and do not**: that generator passes no posterior, so
it draws σ_ϕ = 0 everywhere and never times anything. Its σ_ϕ witness and cut
grid are `scripts/naive-menu-cut-corner.probe.ts`, and its wall-clock figures
are one stated day on one stated machine (arm K). Each group below names its
own draw; the sentence that once claimed one draw for all of them was written
before four of these numbers had a probe at all (2026-08-17, §10).

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
strictly stronger than dominating their average, so the average is covered too —
and that is not a vacuous gap: measured on the same draw, the average is
strictly below the best rotation on **75.9%** of 2400 days, from 48.0% at n = 2
to 90.5% at n = 8, worst gap 30.5–57.4% of the average (arm J, 2026-08-17; the
81.7% quoted here before had no probe and does not reproduce). 0 negatives in
2400 days, asserted in the probe (arm D).

**It is a theorem about the TRUNCATED menu, not about E[P̄], and §13.2 overstated
it.** `buildBlockIncrements` cuts a task's menu at the first non-positive
increment and — when σ_ϕ > 0 — at the first non-DECREASING one (§5.1). Blocks
past the first cut lower the objective, so a naive plan that overshoots there
only hurts itself and the guarantee holds. The σ_ϕ cut is different: it can fire
while E[P̄] is still rising, leaving the naive plan free to place a value-adding
block the optimizer was never offered. Constructed witness: one task at
effective difficulty 1.3, ϕ̂ = 4.5 h, σ_ϕ/ϕ̂ = 0.35, budget 4 h → optimized
0.886678 against naive 0.891116, a reported **−0.5%** — reproduced exactly
(`naive-menu-cut-corner.probe.ts` arm 1, 2026-08-17; the same −0.5% at every
enjoyment 1–10, and the menu is cut at 5 blocks where its own best is 21), and
pinned in `zenith.test.ts`. This is not new: at n = 1 the §19 baseline is
identical to the old one.

**What "not reachable from the product" is worth, measured.** It is two
assertions, and the one this section swept is now **false**; the corner rests
entirely on the other, which §5.1 had already measured:

- The **slider** half. Over a grid whose difficulty axis is what the form's two
  difficulty sliders reach through `getEffectiveDifficulty` — which is how
  effective difficulty 1.3 is integer-reachable at all — 220 of 100,320 integer
  cells are cut by the non-decreasing rule (38 difficulties × 10 enjoyments ×
  ϕ 0.25–6 h × 11 σ/ϕ steps to the cap), against 6,327 of 1,921,040 quarter-step
  ones (ϕ 0.5–8 h at 0.5 h). So the old "0 monotonicity cuts in 156,000 cells
  with integer sliders" is **retracted**: the witness cell is itself on that
  regime's axes, and a zero count over a grid containing it could not have been
  right. The ϕ̂ ≥ 4 h with σ/ϕ ≥ 0.35 range holds — cut cells occupy ϕ 4.25–6 h
  and σ/ϕ 0.35–0.50 (integer), ϕ 4.5–8 h and the same σ/ϕ (quarter-step) — and
  every one of them fires strictly before the menu's own best block count, so
  none of these cuts is free: worst 0.71% of the cell's best value at integer
  sliders, 28.00% at quarter-step. The grid is the probe's own and stated with
  the counts; §19.3's original one is not recoverable from this text and
  919,968 = 1369 × 672 is a factorization, not evidence (arm 2, 2026-08-17).
- The **fit** half, and the one that holds. σ_ϕ is not a slider: it comes from
  `phiParameterStd` on a fitted posterior, and §5.1 already reports **0 of
  576,000** fitted (user × slider) cells in this corner one threshold lower
  (ϕ̂ > 3.06 h), with the structural reason — the ridge's λ = 4 anchor shrinks ϕ̂
  exactly when σ is large, so the two requirements are in opposition. Re-asked at
  §19.3's own ϕ̂ ≥ 4 h it comes back the same: over 4,320 seeded histories drawn
  toward the SLOW end (`phi-cap-reachability`'s `drawUser` ranges, three coverage
  patterns × σ_log ∈ {0.05, 0.25, 0.5} × 8 log counts, every one `fitted: true`),
  **0** reach σ_ϕ/ϕ̂ ≥ 0.35 at any slider cell with ϕ̂ ≥ 4 h. It is a bound, not a
  bare zero: the largest ratio reached at ϕ̂ ≥ 4 h is **0.232**, while ratios
  above 0.35 are common (74–96 histories per log count) only where ϕ̂ is small. A
  fit that falls back to the defaults cannot reach it either — the default plane
  tops out at ϕ(E = 5, β = 1) = 3.06 h (arm 3, 2026-08-17; §5.1's sweep is the
  larger one and stays the bound to cite).

So the weakened guarantee stays unreachable end-to-end, but for the second
reason, not the first: the cut does fire at UI-reachable slider cells and it
does cost value there; what no user has been shown to reach is the σ_ϕ/ϕ̂ the
cut needs. Worth recording because "provably ≥ 0" was being read as
unconditional — and because the margin between 0.232 and 0.35 is a measurement
on one generator, not a proof.

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
candidate k's, plus n productivity sums instead of one. Timed at n = 12 with a
σ_ϕ = 0.2 h posterior on one drawn day at three budgets (arm K, 2026-08-17;
2000 calls after 500 warm-up, 20 for the solve, node 22.14 on an AMD Ryzen 7
7800X3D): the baseline goes from **0.001–0.003 ms** — a microsecond-scale figure
at the edge of what this harness resolves — to **0.022–0.027 ms**, against
**1.6 / 3.5 / 7.1 ms** for the 2ⁿ funded-subset solve in the same call
at 2 / 4 / 8.25 h — **1.4% / 0.7% / 0.4%** of it, quoted at the precision a
second run of the same probe reproduces. A timing is a machine and a
day, so the ratio is what transfers, not the milliseconds: the earlier
"~0.013 ms to 0.031 ms against 41.7 ms, 0.04%" named neither, and its solve
figure is out of reach of this generator, whose budget draw stops at 8.25 h.

### 19.4 `GAIN_PERCENT_CAP` is not dead, but its documented trigger is

§11.2 introduced the cap for `naive = 0`, and §19.1 retires that trigger. Both
the constant's own doc comment and §11.2 then read as though the cap had no
reachable trigger left. It has one, in the opposite regime:

The baseline must spend its whole block target, so a long budget poured into few
tasks pushes each past its own T*, where P̄ decays like C/T. The optimizer stops
at T* and leaves the slack unused. The ratio therefore grows with budget and
shrinks with ϕ and n — and with a **fitted short-ϕ user** it clears 10×.

Probe `gain-cap-trigger.probe.ts`, measured 2026-08-17 on the single-budget path
over the app's own budget slider (0.25–24 h, 0.25 h steps), one task cell at
**difficulty 5, enjoyment 5**, ϕ̂ held at the 0.1 h floor `fitUserConstants`
explicitly permits ("a fast-flow user logging 15–30m everywhere"), **σ_ϕ = 0**:
the gain first reads 999% at **4.25 h (n = 1)**, 8.5 h (n = 2), 13 h (n = 3),
17.25 h (n = 4), 21.75 h (n = 5), and never within 24 h at n = 6 (max 912.4%).
At ϕ̂ = 0.17 h it needs 7 h (n = 1).

That cell is not "the default sliders", and the difference is worth a line: the
form's 5/5/5 draft is physical 5 and mental 5, which `getEffectiveDifficulty`'s
0.3 spillover maps to an **effective difficulty of 6.5**. Difficulty 5 is
reachable — one dimension at 0 — and it is the cell that reproduces the ladder
this section first quoted, which is why the sweep is stated there.

At **default constants the cap is out of reach**: the 24 h maximum at that same
cell is **291.7%** (n = 1), and 41.6% on the pooled path (n = 1, 8 h). The
**569%** first quoted here reproduces under none of the four readings the probe
prints — 291.7% at difficulty 5, **479.7%** over the whole 1–10 × 1–10 slider
grid (d = 2, β = 10), 283.9% at the n = 0 prior posterior, 291.7% at a zero
switch cost. Where it came from is not recoverable; it is replaced, not repaired.

**The ladder is a σ = 0 statement, and σ > 0 moves it.** At ϕ̂ = 0.1 h a non-zero
σ_ϕ fires §5.1's monotone-prefix cut and truncates the optimizer's menu, which
costs the optimizer more than it costs the baseline, so the ratio needs a longer
budget to saturate. Measured rather than assumed, and the assumption would have
been wrong. Fitting the section's own user — 40 logs at 15–30 min spread over the
slider grid — gives σ_ϕ = 0.0184 h (σ/ϕ̂ = 0.051 at that user's own ϕ̂ = 0.3599 h,
far inside `PHI_UNCERTAINTY_RELATIVE_CAP`). Re-running **the ladder** under that
posterior delays every rung by one to four budget steps — 4.5 / 9 / 13.5 /
18.25 / 22.75 h at n = 1–5 — and drops the n = 6 maximum from 912.4% to 862.4%.
The cap stays reachable at every n it was reachable at; it arrives later.

At the fitted user's own ϕ̂ = 0.3599 h the ladder is a different object and the σ
arm is free there: n = 1 saturates at 14.5 h under both arms, n = 2–6 have no
rung within 24 h under either, and the maxima move by at most 1.0 pp. Quoting
that as "no rung moves" would have described a ϕ̂ the ladder is not about.

**The user is reachable.** 14,400 seeded synthetic histories from fast-flow
truths (1–34 logs, three coverage shapes, σ ∈ {0, 0.05, 0.15}) all fitted —
0 fell back to the defaults — and **14,013 of them (97.3%)** put ϕ̂ on the 0.1 h
floor somewhere on the 1–10 × 1–10 slider grid, 255,172 floored cells of
1,440,000. The floor alone is not enough: the ladder also depends on the cell's
own a and p₀, and **160,100 of those 255,172 cells (62.7%)** reach 999% at n = 1
within 24 h. Witness: single-point coverage, one log, σ = 0, difficulty 2,
enjoyment 10, `fitted: true` — first 999% at **6.75 h**.

So the honest statement is: the cap guards the RATIO, for a personalized
fast-flow user with few tasks and a budget far past their stopping time. Not the
`naive = 0` jump it was written for — that arm now requires `budget <
BLOCK_HOURS`, where the optimizer scores 0 too and `gainPercentOf` returns 0.
Swept 2026-08-17 for a counter-example: **0 of 576** ladder days, 0 of 3,000
rv14 random days and 0 of 3,000 pool-starved days have `naive = 0` with
`optimized > 0`.

Two separate questions, and only the first is settled here. The **ratio** arm is
reachable, so `GAIN_PERCENT_CAP` keeps a live trigger and the constant stays. The
**`naive = 0`** arm has no witness in 6,576 swept days, and its reachability does
not follow from the ratio's — they are different branches of `gainPercentOf`. A
sweep that finds nothing is evidence, not a proof of unreachability, so the
branch is left standing and recorded as open rather than argued away: removing it
is a behaviour change and takes its own measurement, not this one's.

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
of the two effects. Both terms are measured against ONE equal split, so they sum
to that comparison's 1.9% and not to the 2.9% the screen reports; §21.4 prices
the 1.0 pp between the two baselines.

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
on the reference set it is scored against. The first two rows are 20000 sampled
plans each, spending their whole billed budget on the 15-minute lattice (arms G
and H); the last two are single reference plans (arms H and J). All at 4 h:

| reference set                                        | optimizer beats it by |
| ---------------------------------------------------- | --------------------- |
| random subset, random split (median)                 | **+62.6%**            |
| all 4 funded, random split (median)                  | +4.2%                 |
| all 4 funded, ONE equal split                        | +1.9%                 |
| all 4 funded, equal split over n rotations (shipped) | **+2.9%**             |

Most of the first row is not planning skill. Σ P̄ sums per-task averages, so
funding four tasks instead of two scores well almost regardless of the split —
the sampler is being rewarded for breadth the user already chose by writing four
tasks down. The last row is what the shipped metric reports, and both sampled
sets read higher than it — but it is not the smallest number here, because the
shipped baseline averages the n cyclic rotations of the list (§19) and an average
cannot exceed the best rotation. On this day it sits below the single
largest-remainder split, whose odd block always lands on the first task: 4.575
against 4.621, with the optimizer at 4.710 (arm J, 2026-08-17).

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
(plan-scoped, §11.8) renders **0/4** on this day. The gain was a headline metric
and flow coverage was not, so the dashboard led with the smaller true statement
and buried the larger one. That was a presentation ordering question, not a model
one, and it has since been answered as one (§28): flow coverage is a headline
tile, the gain is a reference row. Any future work on "the gain looks too low"
should still start at this table, because the gain is not the metric that is
under-reporting.

## 22. Task nature: an absolute gap could not carry a range that starts at 0 (2026-08-07)

`getTaskNature` splits a task into `'cognitive' | 'physical' | 'balanced'` on
the signed gap alone, `d = mental − physical`, with `|d| ≥ 3` claiming the
dominant side. Three consumers read it: the task badge (COG/PHY/HYB),
`calculateTaskVariety`, and `calculateInterleavedOrder` — which is the run order
behind both the `#N` badges and Burnout Risk's block sequence (§11.6). (Two
consumers as of §24, which retires the variety metric. The zero gate matters
more to the two that remain, not less: both make a claim about which pool a task
draws on.)

**The defect.** The threshold was written for a 1–10 rating, where a gap of 2
does mean the two dimensions are comparable: mental 10 / physical 8 is a genuine
mix. But the difficulty sliders admit **0** — deliberately, and unlike enjoyment,
which starts at 1 because §1 declares `βᵤ ∈ [1,10]`. A 0 there is not a low
rating, it is the absence of a dimension. At mental 2 / physical 0 the gap is 2,
so the rule returned `'balanced'` for a task with no physical component
whatsoever: the badge promised "draws on both capacity pools" while
`toEnergyTask` handed the reservoir law `physicalDemand: 0`. The model and the
badge disagreed about the same task, which is the R3 failure, not a wording
problem.

**The rule now.** A zero dimension settles the question before the gap is
consulted; everything else keeps ±3 unchanged.

```text
if d ≠ 0 and min(mental, physical) = 0:  d > 0 ? cognitive : physical
elif d ≥ 3:                              cognitive
elif d ≤ −3:                             physical
else:                                    balanced
```

0/0 stays `'balanced'`. It is an absence rather than a mix, but nothing
downstream reads it as a rating — `getEffectiveDifficulty` clamps that task's
Eᵤ to 1 (its domain is [1,10]), so there is no third label to invent.

**What moves.** Exactly **4 of the 121** integer pairs on the 0–10 square
(enumerated 2026-08-18, `mtr-task-nature.probe.ts`):

```text
(m1,p0) (m2,p0)  balanced → cognitive
(m0,p1) (m0,p2)  balanced → physical
```

The balanced rate over the reachable square falls from **49/121 = 40.5%** to
**45/121 = 37.2%** on the same run, and those four pairs are the whole
difference. Over 1–10 it is 44/100 = 44% either way, which is why §16's table
stands unrevised: `mode-run-order.probe.ts` draws `pick(1, 10, 1)` for both
difficulties and never sampled a zero, so not one of its 300 days contains a
pair this change touches. That the probe's day-space is narrower than the UI's
is itself worth recording — it bounds what §16 measured, not what ships.

**Why not a demand-share rule.** The obvious alternative replaces the gap with
the dominant dimension's share of total demand, `max/(m+p) ≥ 0.65`. Rejected on
its own numbers: it disagrees with the ±3 gap alone on 22 of the 121 pairs and
with the rule as shipped on **18**, reaching the zero gate's verdict on all four
pairs the gate moved (enumerated 2026-08-18, `mtr-task-nature.probe.ts`; of the
18, six turn a sub-3 gap dominant at the bottom of the range and twelve turn a
≥3 gap balanced). It is wrong at the end of the range the gap rule gets right —
it calls mental 10 / physical 6 `'balanced'`, and mental 7 / physical 4 too.
Normalizing away the
magnitude discards the information that a 4-point spread at the top of the scale
is a different claim from a 4-point spread at the bottom. The zero gate adds no
constant and only encodes what `toEnergyTask` already asserts.

**Left alone deliberately.** Mental 3 / physical 1 stays `'balanced'` even
though the mental side is triple the physical one. There is a real physical
component there, so both pools are drawn on and the badge is not lying. Only
zero was.

## 23. Primary Bottleneck named the model's best task (2026-08-07)

`calculateBottleneckTask` returned `argmax E/β` over the active tasks, on the
mapped values of §1, under the tooltip "the biggest drag on your list". The
implementation matched that sentence exactly. The sentence was the problem.

**Defect 1 — the ranking is inverted against the model's own value.** `E/β`
rises with difficulty; so does `P̄(T*)`, because the peak scale is `a = E·β`.
Over the 10×10 integer slider grid at `DEFAULT_USER_CONSTANTS`
(`scripts/mtr-bottleneck-strain.probe.ts`, 2026-08-07):
`Spearman(E/β, −P̄(T*)) = −0.3302`, and on **2982 of 9900 ordered pairs (30.1%)**
the task the row named was worth MORE than the task it beat. Worst case:
difficulty 10 / enjoyment 10 (`E/β = 2.500`, `P̄(T*) = 3.173`) named over
difficulty 2 / enjoyment 1 (`E/β = 1.444`, `P̄(T*) = 0.822`) — the row blamed a
task worth 2.351 more, while the priority list beside it ranked that same task
first. Two readings of one plan, disagreeing about which task is the good one.

**Defect 2 — it was the retired strain heuristic, still running.** §11.6 retired
`Σ max(0, E/β − 1)·h` from Burnout Risk as a formula that "borrowed the model's
symbols but derived from nothing", and settled that _enjoyment does not enter
depletion_ — loved-hard = hated-hard in risk. This row was the last live
consumer of `E/β` as strain, and its code comment still claimed "more
draining". Concretely: difficulty 5 / enjoyment 1 (`E/β = 2.778`) outranked
difficulty 10 / enjoyment 10 (`E/β = 2.500`) at **half** the demand the
reservoir law actually drains on.

**Defect 3 — `p₀ = β/E` is not the `p₀` the curve integrates.** The comment
justified the ratio as `1/p₀`, but §1 caps the effective ratio at
`AMPLITUDE_RATIO_CAP`, so `p₀ = min(β/E, 0.9·a)`. The cap binds on the whole
difficulty-1 row (**10 of 100 cells**), and `E/β` and `1/p₀` disagree on **9 of
9900 ordered pairs** — every one of them reachable as a two-task list, e.g.
`{difficulty 2 enjoyment 6, difficulty 1 enjoyment 2}`, where the row named the
first while the second is the one that actually starts slower (`1/p₀` 0.929 vs
1.000). Small, but the justification was the whole argument for the formula.

**Defect 4 — the band was a constant.** The descriptor read
`band: bottleneckTask === null ? 'neutral' : 'warning'`, so every non-empty
active list produced a warning-coloured headline tile. A list of nothing but
easy, loved tasks warned too. That is §11.6's "in practice a binary flag"
complaint, reached by a different route — here the reading never varied at all.

### 23.1 Primary Bottleneck: the largest draw on the binding pool

The name is worth keeping, so it now means what a bottleneck means — the task
that most consumes the day's binding resource. §11's `calculateHumanCapacity`
already decides which resource that is and how saturated it is:

```
draw_i    = (difficulty_i / 10) · h_i        weight and hours as §11 sums them
binding   = limitType of calculateHumanCapacity(active)   — the SAME list, see below
bottleneck = argmax_{i ∈ active} draw_i  on the binding axis   (null if the max draw is 0)
```

It introduces **no constant of its own**. The axis is the capacity metric's own
`limitType`, computed rather than re-derived; the quantity is the largest single
term in the numerator that metric already sums.

**The property that earns the name.** The pool is fixed, so dropping task `i`
lowers the binding saturation by exactly `draw_i / pool`. The largest draw is
therefore the largest relief available from dropping one task — the row names
the day's best single lever on its own constraint. Pinned end-to-end through
`calculateHumanCapacity` in `calculation.test.ts`, not by re-deriving the draw.
(The guarantee is about the BINDING pool's saturation. If dropping that task
lets the other pool bind, the reported `percent` floors at the other pool's
reading rather than falling by the full amount — the relief is still maximal on
the axis the claim is made about.)

**What changed for the user.** Over 600 seeded days (1–7 tasks, difficulties
0–10, budgets 0.25–16h, same probe, 2026-08-07) the new reading names a
different task than `E/β` would have on **378 of 600 days (63.0%)**. The named
task's share of the total binding draw runs min 0.200, median 0.541, max 1.000 —
a real spread, not a formality. The binding pool was cognitive on 437 of the 600
days at `DEFAULT_CAPACITY_POOLS`.

**Deliberate semantic changes.**

- _Unfunded tasks can no longer be named._ `draw_i` carries `suggestedHours`, so
  a task the plan gave no time draws nothing and is not the bottleneck of a day
  it takes no part in. The old tooltip's "even if today's plan gave it no time"
  is retired with the formula, and §11.8's parenthetical with it.
- _"None detected" is now a real reading, not just the empty-list case._ It is
  what a finished plan or a day with no funded hours honestly reports.
- _The tile is neutral, always._ Naming a task is not a verdict on it, and there
  is no threshold on a draw share that is not invented. Whether the pool is
  over-drawn is Human Capacity's reading, and it is banded there — one number,
  one judgement, in one place.
- _Scope is unchanged: next-up (§11.8)._ It names something in the work still
  ahead, so it depletes as the day is checked off — **axis included**, see below.

**The axis is next-up too (fixed 2026-08-07, same day).** The first cut of this
took `limitType` as an argument and the dashboard passed the PLAN-scoped one
while passing the ACTIVE list — the argument that made the two rows agree by
construction also let them describe different task sets. On a day whose only
physical task is checked off, the plan's binding pool stays physical (a completed
task keeps its allocated hours, §11.7), but nothing remaining draws on it, so
`argmax` over the active list is 0 and the row reads "none detected" with five
cognitive tasks still ahead. **Deleting** that same task removed its demand from
the plan too, so the axis flipped to cognitive and the row worked — two gestures
with the same meaning for what is left, disagreeing. `calculateBottleneckTask`
now solves `calculateHumanCapacity` on the list it was handed, so the axis and
the candidates are the same set by construction and the pair cannot be
mismatched by a caller. Pinned in `daily-metrics.test.ts` as completed ≡ deleted.

The consequence is intended: mid-day this row and Human Capacity may name
different pools. Human Capacity judges the day **as planned** (plan-scoped, so
completing a task must not move it); the bottleneck points at **what is left**.
The display therefore takes the pool name from this reading, never from Human
Capacity's `limitType`. Untouched days agree, because then the two lists are
equal.

### 23.2 Longest Warm-Up: what E/β was actually tracking

`E/β` was not measuring nothing. Both `ϕ = c₁E + c₂β + c₃` and the ratio rise
with effort and fall with enjoyment, and over the same grid
`Spearman(E/β, ϕ) = 0.9351` (against `0.9489` for §11.4's friction gap
`difficulty − enjoyment`, and `−0.3302` for task value). The honest reading
underneath the retired one is **time to reach flow**, which the model already
solves per task and the plan already carries as `flowStateTime`:

```
longestWarmUp = argmax_{i ∈ active} ϕ_i        (null on an empty list)
```

Reported as ϕ in hours, with the task named in the description. Banded on Flow
Coverage's own criterion — `h_i ≥ ϕ_i` — narrowed to this one task, so the two
rows cannot disagree about whether it reaches flow. Next-up scope (§11.8), and
therefore gated on active tasks, which is the one family allowed that gate.

Nothing is recomputed: it reads ϕ off the solved plan, so it costs one pass.

**Why not just `−P̄(T*)`, the model's own worst task.** That is the bottom of
the priority ranking, which the task list already renders in order — a row
restating the last line of the list beside it. `E/β`'s replacement had to say
something the screen did not already say.

**Why not a drop-one counterfactual on the objective (§14).** The most literal
reading of "bottleneck" is the task whose removal most improves the day, priced
by re-solving without it. §14 already builds exactly that machinery — and that
is the argument against duplicating it in a metric tile: it costs one full
allocator solve per task inside a `$derived`, and the plan advice card is where
a priced counterfactual belongs. The binding-pool draw is the same question
answered on the constraint instead of the objective, at one pass and with an
exact guarantee (§23.1) instead of a re-solve.

## 24. Task Variety counted labels, and its repair was Energy Balance (2026-08-07)

`calculateTaskVariety` returned the number of distinct `getTaskNature` labels
present in the plan, over the number of labels that exist:

```text
variety = |{ nature(taskᵢ) }| / 3 · 100
```

**Three defects, and they compound.**

- _The range does not start at 0._ The reading can only be 33, 67 or 100. A day
  of five cognitive tasks — the least varied day expressible — reads **33%**,
  and `getBandBiggerBetter` paints that `warning` rather than the `critical` its
  own scale reserves for the bottom. A single-task day reads 33% too. The
  denominator is a count of enum members, not a maximum anything can reach.
- _It counts labels, not the day._ Hours never enter. Four cognitive tasks
  against one physical one the plan funded for 15 minutes reads 67%, the same as
  an even 3/2 split of the budget — and the same as a plan where the physical
  task got no time at all, since an unfunded task keeps its label.
- _Full marks require the task type that defeats the mechanism._ 100% is only
  reachable with a `'balanced'` task present. But the dual-pool rationale the
  metric cites — and that `calculateInterleavedOrder` is built on — is that
  working the physical system lets the cognitive one recover while the clock
  runs. A balanced task draws on **both** pools at once, so neither rests. A
  perfectly alternating cognitive/physical day caps at 67%.

**Why there is no §24 formula.** The obvious repair is to weigh the two pools by
allocated time and report how evenly the day divides between them:

```text
cog = Σ (mentalᵢ/10)·hᵢ ,  phys = Σ (physicalᵢ/10)·hᵢ
variety = 2·min(cog, phys) / (cog + phys) · 100
```

That is a strict function of readings the dashboard already shows. `cog` and
`phys` are exactly the numerators of **Cognitive Load** and **Physical Load**
(§25: same weights, same hours, both over the budget, which cancels here), and
**Energy Balance** is already `cog/(cog + phys)` — so the repair is
`2·min(EB, 100 − EB)`, a fold of a displayed number that discards which pool
dominates and adds nothing. (Exactly so below the loads' 100% clamp; above it
the fold is merely distorted, not informative.) Three tiles reporting one
quantity is what §23.2 rejected for the bottleneck row, for the same reason.

The other honest reading of "variety" — whether the day **alternates** rather
than merely contains both natures, which is the composition question Energy
Balance cannot answer — is Burnout Risk's (§11.6). It simulates the run order's
blocks through the reservoir law, so it prices the recovery an alternating
sequence actually buys, in the units the model works in. A percentage of nature
switches would restate the run order the `#N` badges already render, computed
from a sequence the planner built to alternate.

So the metric is **retired, with no replacement row**. Nothing displayed is
lost: the reference day of five cognitive tasks read "33%, warning" and now
reads Energy Balance **Cognitive-heavy**, Physical Load **0%** — the same fact,
without an invented denominator, and without a colour that said a uniform day
was a third of the way to varied.

**Scope note.** §11.8 lists Task Variety among the plan-scoped rows and §22
among `getTaskNature`'s consumers; both are amended in place. The scope rule and
the zero gate are unaffected by the retirement — they outlive the metric that
prompted them.

---

## 25. Cognitive and Physical Load: the definition, and what rounding them cost Energy Balance (2026-08-07)

Two dashboard rows and two plan-advice axes (§14) had no definition in this
document. §14.2 cites them twice as "`weightedHours / budget` (§11)", and §11 has
no such entry — the formula was only ever in the code. A review of the two found
the arithmetic sound and three things around it wrong: the displayed copy
described a different quantity, the derived Energy Balance was computed from
already-rounded percents, and that rounding could erase a real load entirely.
The plan is untouched — these are displays (§11.1).

### The definition

For the day's plan (all `suggestedTasks`, completed included — plan scope,
§11.8), with the time budget `B` and per-task allocations `hᵢ`:

```text
  Cognitive Load = min(100, 100 · Σᵢ hᵢ·(mᵢ/10) / B)
  Physical  Load = min(100, 100 · Σᵢ hᵢ·(pᵢ/10) / B)
  Energy Balance = 100 · Cog / (Cog + Phys)          [50 when Cog + Phys = 0]
```

`mᵢ, pᵢ ∈ [0,10]` are the two difficulty sliders. Four properties fix what these
rows may claim:

1. **They are intensity-weighted, not shares of the day.** 8 h of
   mental-difficulty-5 work in an 8 h day reads **50%**, though every hour of it
   is cognitive work. §14.2's "how packed the day is" is the honest gloss; "the
   percentage of your day allocated to cognitive tasks" — which both locale files
   said until this change — is a different number, and is what a share-of-hours
   metric would report (100%). Both descriptions now name the weighting and give
   that 8 h example, per §11.1's rule that the displayed copy matches the formula.
2. **The denominator is the WHOLE budget, switch overhead included.** Switch time
   is not cognitive work, so a more fragmented day reads as less loaded per unit
   time. Deliberate, and it is what makes a wider budget lower both readings with
   no allocation change at all — the denominator mechanics §14.2 relies on when
   it keeps the unpriced `budget + 1` lever.
3. **The numerators are exactly Human Capacity's two pool draws** (§20). Same
   sums, a different denominator: the budget here, the configured pool there. So
   Cognitive Load and Human Capacity cannot disagree about the same day, and the
   pool-relative reading — whether the draw exceeds what the user says they have
   — is §20's alone. A Load band is not a capacity statement.
4. **The clamp is slack, and stays as a guard.** `Σᵢ hᵢ ≤ B − overhead` and every
   weight is ≤ 1, so the exact reading cannot exceed 100. Measured over 3000
   seeded days (2–7 tasks, budget 0.25–12 h, switch cost 5–30 min,
   `scripts/mtr-load-rounding.probe.ts`, 2026-08-07): max load **100.000%**,
   reached exactly on 26 days, exceeded on none. `min(100, ·)` therefore never
   binds on allocator output; it is kept because a hand-built task list measured
   against a smaller budget can break the premise, and 130% is not a percentage
   this row can render.

The two loads are separate systems and their sum may exceed 100% — a day at
mental 8 / physical 8 draws hard on both. Only their ratio is normalized.

### The defect: Energy Balance was a ratio of two rounded numbers

Both loads were rounded to whole percent inside the model layer, and
`calculateEnergyBalance` divided those integers. Rounding twice moves a ratio far
more than it moves either input, and the bands classify the result at 40/60
(`presentation/utils/band.ts`), so the error landed on a classification. On the
same 3000-day sweep, of the 2996 days carrying any load:

- the cognitive/physical/**balanced classification flipped on 49 days (1.6%)** —
  e.g. exact loads 24.00/36.33 → balance **39.78, "Physical Heavy"**, displayed
  as **40, "Balanced"**, warning band traded for success;
- **max |rounded − exact| = 4.17 pp**, largest where the loads are small integers
  and ±0.5 pp is a large share of their sum;
- the plan advisor's ordering of `budget ± 1 h` candidates on this axis flipped on
  **646 of 4000 comparisons (16.1%)**, but the worst true penalty of a
  rounding-only "improvement" is **0.97 pp** of balance — noise in the ranking,
  never a wrong lever.

**And rounding could delete a load that exists.** 0.5 h of difficulty-1 work in a
12 h day is 0.42% cognitive, 0% physical: rounded, `0/0`, which took the 50
sentinel and made the advisor's zero-load `NaN` test fire (§14.1 defect 5) on a
plan that has a load and is purely cognitive. Exactly, it reads 100. Not reachable
on any of the 3000 allocator days — it needs a very thin plan in a wide budget —
but the axis was being dropped for a reading the day did not have.

### The fix, and where rounding lives now

`calculateCognitiveLoad` / `calculatePhysicalLoad` / `calculateEnergyBalance`
return **exact** values; `presentation/utils/metric-descriptor.ts` rounds the two
Load percents for display. This is §20's split applied to the same pair of
quantities — decide on the exact number, round only what is shown — and it is the
reason Human Capacity picks its binding pool correctly.

The **bands read the exact value**, not the displayed one, deliberately: the plan
advisor bands the identical number through `AXIS_BAND`, and a card that offers
advice on an axis whose own row is coloured "success" is the disagreement
`plan-advice-descriptor` pins. The cost is that a row displaying "70%" may be
banded on 70.4 — a ±0.5 pp seam at one boundary, against a classification error
measured at up to 4.17 pp.

Unchanged: the plan, the whole-budget denominator, the 70% band threshold, the
100% clamp, the 50 display sentinel, and the advisor's `NaN` on a genuinely
loadless plan.

**Pinned in the suite** (`calculation.test.ts`, per AGENTS.md §4): the intensity
weighting at the 8 h/50% case, the whole-budget denominator, the plan scope, the
degenerate budgets, one classification flip built to be exact (4 h and 6 h of
full-demand work in a 12 h day: loads 33.33/50, whose exact ratio is the boundary
40 and whose rounded one is 39.76), and the 0.42% thin plan whose balance is 100
and not the sentinel.

### The second rounding: the WORD was coarser than the number (2026-08-08)

The model now decides on the exact balance, but the card and the dashboard both
printed it as one of three words — `energyBalanceSkew`'s 40/60 buckets. The
advisor ranks this axis on continuous badness `|value − 50|` (§14) and keeps a
candidate only if that badness strictly falls, so an option could be a real
improvement and still print the row's own reading back at the reader. The same
defect class as the ratio above, one layer further out: a display coarser than
the decision behind it.

Measured over the standard 600 seeded days
(`adv3-advice-display-resolution.probe.ts`, seed 42, 2026-08-08 — it reads the
strings `buildAdviceDisplay` returns and matches each back to its model option by
lever identity):

- Energy Balance is the **most frequent row on the card — 274 of 600 days, 593
  options**, just ahead of Time Scarcity's 268/628. Not a corner.
- **365 of those 593 options (61.6%)** printed the same word as the row above
  them, hiding a median **1.7** and up to **39.3 points** of improvement. Worst
  case: a lever moving the share **0.0 → 39.3**, still under the 40 cut, so both
  sides read "Physical Heavy".
- **0 of 811** options on every other axis lost this way (628 + 94 + 28 + 37 +
  21 + 3, equivalently 1404 options in total − 593 Energy Balance). The
  three-word bucket is the whole mechanism; whole-percent rounding is not enough
  to collapse one.

**Suppressing the word-identical options was the wrong fix, and the probe is why.**
It would have emptied **99 of 274** Energy Balance rows outright — deleting the
finding, with the largest improvement the day had on the axis (median **6.2**, max
**39.3**), on a day whose balance still reads badly.

So the share is printed beside the word: `energyBalanceReading` in
`presentation/utils/band.ts`, ONE definition for both callers (the words had been
spelled out twice, in `metric-descriptor.ts` and `plan-advice-descriptor.ts`,
which is how the two could have come apart). Re-measured after the change: the
invisible options fall to **111 of 593 (18.7%)** and every one of them is
sub-percent — median **0.0**, p90 **0.4**, **max 0.9 points**, e.g. 33.6 → 34.5
both printing "Physical Heavy 34%". That residue is the ordinary whole-percent
rounding every other row on the card already carries, and the rows suppression
would empty drop from 99 to **2**, both discarding 0.0 points.

Unchanged: the 40/60 cuts, the bands, and the exact value the bands read.

**Pinned in the suite**: `band.test.ts` fixes the three readings and that 100 and
61 no longer print alike; `plan-advice-descriptor.test.ts` fixes the axis's three
rendered strings.

## 26. Deep Work: a step that swung whole blocks, under a band that rewarded the wrong day (2026-08-07)

Like the Loads in §25, this row had no entry in this document — the threshold,
the denominator and the band lived only in `calculateDeepWorkRatio` and
`metric-descriptor.ts`. The quantity it wants to report is sound and the plan is
untouched (§11.1); three things around it were not.

Measured over 2000 seeded days (1–7 tasks, budget 0.25–12 h, switch cost
5–30 min, `scripts/mtr-deep-work.probe.ts`, 2026-08-07). Every rate below is a
property of the allocator's day space, not a bound.

### The definition

For the day's plan (all `suggestedTasks`, completed included — plan scope,
§11.8), with the time budget `B`, per-task allocations `hᵢ` and mental
difficulty `mᵢ ∈ [0,10]`:

```text
  w(m)      = clip((m − 5) / 4, 0, 1)               ramp, 0 below 5, 1 from 9 up
  Deep Work = min(100, 100 · Σᵢ hᵢ·w(mᵢ) / B)
```

Exact; `metric-descriptor.ts` rounds for display, as §25 does for the Loads. The
denominator is the whole budget, switch overhead included — the same choice, for
the same reason, and the clamp is likewise slack on allocator output
(`Σᵢ hᵢ ≤ B − overhead`, `w ≤ 1`) kept against a hand-built list.

This is NOT Cognitive Load with a different weight. Load asks how intense the
day's hours are (`m/10`, so an hour at difficulty 5 is half an hour of load);
Deep Work asks how much of the day is spent in work that requires sustained
focus, and an hour at difficulty 9 is a whole hour of it. Above `m = 9` the two
part company deliberately: Deep Work can exceed Cognitive Load.

### Defect 1 — the band rewarded the day the rest of the dashboard warns about

`getBandBiggerBetter` called ≥75% 'Optimal' and <25% 'critical'. Two consequences:

- **It contradicted its neighbours.** Of the 98 days the old band coloured
  'Optimal', **58 (59%) carry a Cognitive Load the same dashboard bands out of
  band**, and 5 (5%) an out-of-band Burnout Risk. Worst day: Deep Work **77%**
  green, beside Cognitive Load 70% and Burnout Risk 62% (`m/p/e 9/6/6`, 5.5 h,
  switch 25 min). This is §11.7's defect exactly — a row making a depletion claim
  that belongs to Burnout Risk, and disagreeing with it.
- **It alarmed on most days.** Warning or critical on **1620 of 2000 days
  (81%)**, success on 98 (4.9%), against a median reading of 26.7%. A colour four
  days in five is not a signal.

More is not better here, so no monotone band fits. `getBandDeepWork` marks the
interior optimum **25–60%** and is otherwise neutral: it never warns.

- **Lower edge 25%** — a definition, not a measurement: below a quarter of the
  budget the day is not built around sustained focus. The median seeded day
  (26.7%) sits just inside it, which is the point — the shape should be ordinary,
  not an achievement.
- **Upper edge 60%** — where the reservoir law starts to bend. Median Burnout
  Risk by deep-work decile: 19% (30–40), 21% (40–50), 23% (50–60), then **30%
  (60–70) and 37% (70–80)**; the share of days whose risk exceeds its own warning
  threshold holds at 7% through 30–60 and doubles to 12–15% above it.
- **Never warning, deliberately.** A shallow day is a shape, not a defect, and
  the verdict above the upper edge is Burnout Risk's — it simulates the actual
  reservoirs, which is the reading that can tell a 60%-deep 4 h day from a
  60%-deep 12 h one. A percentage of the budget cannot: the band is
  budget-relative and carries no absolute hours ceiling, by construction.

### Defect 2 — one slider point rewrote the row

`mentalDifficulty >= 7` counted an hour in full or not at all. On a fixed plan
(so the allocator's own discontinuity is excluded), one point of mental
difficulty moved the reading by up to **100 pp** under the step and by **25 pp**
under the ramp, and the step moved it at all on only **705 of 7575** single-point
moves — every one of them the 6→7 crossing, with 5→6 and 8→9 reading as no
change whatsoever. A day of mental-6 work read 0% and the same day at mental 7
read 100%.

The ramp keeps the old threshold's meaning at half weight: `w(7) = 0.5`, nothing
below 5, the whole hour from 9. The floor is where `getTaskNature` already stops
calling a dimension dominant, and 9–10 is the band the sliders' own copy calls
maximal.

### Defect 3 — under a bigger-better band, unspent budget read as shallow work

The budget denominator is right, but combined with "more is better" it billed
slack as a failure. Three tasks (`m` 9/8/3), unchanged, against a widening
budget:

```text
  budget    2h   4h   6h    8h   10h   12h
  deep    56.3 67.2 62.5  43.8  35.0  29.2 %
  old      neu  neu  neu  warn  warn  warn
  new      succ neu  neu  succ  succ  succ
```

The old band's advice was to shrink the day. The new band reads the 8–12 h
columns — the same work, with room around it — as the shape it is, and it is the
tight 4–6 h columns that fall outside.

### Pinned in the suite

`calculation.test.ts`: the ramp at 0/5/6/7/8/9/10, the 25 pp move across the old
cut, the whole-budget denominator, exactness, plan scope, the clamp and the
degenerate budgets. `band.test.ts`: the 25/60 edges, and that the band is never
warning or critical at any reading.

Unchanged: the plan, plan scope (§11.8), the whole-budget denominator, and
Burnout Risk as the sole owner of the depletion verdict (§11.6, §11.7).

---

## 27. Sustainable Work billed unbooked time as grind (2026-08-07)

The third row in the affect group had no entry here either, and the same review
that gave §26 its definition found this one measuring a different day than it
named. The predicate is sound and the plan is untouched (§11.1); the denominator
was not.

Measured over 600 seeded days (1–7 tasks, difficulties 0–10, enjoyment 1–10,
budgets 0.25–16 h, switch costs 5–30 min, planned by `calculateSuggestedTasks`,
`scripts/mtr-sustainable-work.probe.ts`, 2026-08-07). Every rate is a property of
the allocator's day space, not a bound.

### The definition

For the day's plan (all `suggestedTasks`, completed included — plan scope,
§11.8), with per-task allocations `hᵢ`, effective difficulty `Eᵤ` (the `§11.4`
composite `max + 0.3·min`) and the raw enjoyment slider `eᵢ`:

```text
  Sustainable Work = 100 · Σ_{eᵢ ≥ Eᵤ(i)} hᵢ / Σᵢ hᵢ        [null when Σᵢ hᵢ = 0]
```

Exact; `metric-descriptor.ts` rounds for display, as §25 and §26 do. Three
properties fix what the row may claim:

1. **The denominator is WORKED time, not the budget.** This is the change, below.
2. **It is the hour-weighted twin of Grind Density, and the threshold twin of
   Friction.** All three read the same two sliders and answer different
   questions — task share, hour share, gap size (§11.4). `eᵢ ≥ Eᵤ` is the exact
   complement of Grind Density's `Eᵤ > eᵢ`, so a tie is sustainable and no
   allocated hour falls outside both rows.
3. **The comparison is a composite against a slider.** §11.4's boundary note
   applies verbatim: 26 of the 1210 reachable `m/p/e` cells (2.1%) count as grind
   although enjoyment beats both difficulty dimensions, worst `m7/p7/e8`.
   Deliberate, and shared with the two siblings so the three cannot disagree
   about which task is which.

### The defect: the budget denominator, under a bigger-better band

The reading was `Σ_{sustainable} hᵢ / B`. Since `Σᵢ hᵢ ≤ B − overhead`, that
factors exactly as

```text
  old reading = (Σᵢ hᵢ / B) · (new reading)
```

— the day's affect, multiplied by how much of the budget the allocator chose to
book. The second factor is Schedule Integrity's and Time Scarcity's subject, and
the median seeded day books **71.4%** of its budget, so the median day forfeited
**28.6 pp** of this row to slack that is not grind by any reading.

Under `getBandBiggerBetter`, which calls ≥75% success, that lands on the colour:

- **A grind-free day could not read 100, and usually did not read green.** Of the
  55 days in the sweep whose plan contains no grind at all, the old formula read
  a median of **67%** and put **10 in the warning band and 5 in critical**; the
  worst read **10%** (`m/p/e 1/1/3`, 12.5 h budget — one small pleasant task in a
  wide day). Over Σh all 55 read 100.
- **It contradicted the row directly above it.** On **24 of 600 days** Grind
  Density banded `success` while Sustainable Work banded `warning`/`critical` on
  the identical predicate, and on 15 of those Grind Density read a literal 0%.
  "0% grind" beside "10% sustainable, critical" is one number in two colours.
  After the change: **0 such days.**
- **The reading tracked the wrong quantity's shape.** Spearman(old, allocated
  share) = 0.1165 is low, so the affect signal did dominate the RANKING — but the
  band reads the LEVEL, and the level was scaled by a factor the metric does not
  name. Old band ladder: success 17 / neutral 59 / warning 161 / critical 363.
  New: 67 / 86 / 173 / 274.

This is §26's defect with the two halves swapped, which is why the two rows
resolve in opposite directions. Deep Work's whole-budget denominator is right —
it asks what share of the DAY is sustained focus — and its band was wrong, so §26
kept `/B` and gave it an interior optimum. Sustainable Work's band is right: more
of your working time being work you can sustain is better without limit, and 100%
is a real day. So the band stays bigger-better and the denominator moves. A
metric may divide by the budget or claim that its maximum is the goal; doing both
puts the top arm out of reach for a reason it never mentions.

**Still its own reading.** Spearman(new, Grind Density) = **−0.9480**, not −1: on
**19 of 600 days** the grind share of HOURS and of TASKS differ by ≥25 pp — one
long grind among short pleasures, or the reverse. That is the weighting the row
exists to add, and it clears §24's "three tiles, one quantity" test. Friction's
own §11.4 correlation moves with the denominator, and is amended there:
Spearman(friction, sustainable) = −0.6046 → **−0.6537**.

**Null, not 0, on a plan that books nothing.** With `Σᵢ hᵢ = 0` there is no
worked time to take a share of, and 0 is the reading for "every allocated hour is
grind" — a false statement about a day with no allocated hours. The model returns
`null` and the row renders N/A, per the gate policy in `metric-descriptor.ts`
(and §11.8's rule that a metric undefined without its input never renders 0).
Reachable the same way §11.5's "budget set but nothing funded" is. The gate stays
plan-scoped: it tests the plan's hours, not the active list.

**The copy named a third quantity.** Both locales said "percentage of time on
tasks where enjoyment ≥ difficulty" — which reads as a share of worked time (now
true, then not) and points at the difficulty sliders rather than the effective
composite. Both now name the booked-hours denominator and the two-dimensional
difficulty, per §11.1.

### Pinned in the suite

`calculation.test.ts`: the worked-hours denominator, 100 on a grind-free plan and
0 when every hour is grind, the hour-weighting against the task count (one 6 h
grind beside three 30-minute joys → 20%), effective difficulty at `m7/p7/e8`, the
tie, plan scope, exactness, and `null` on both an empty list and a plan that
funded nothing. `metric-descriptor.test.ts`: the N/A row on a null reading, and
the display rounding of an exact 66.67.

`mtr-sustainable-work.probe.ts` reads `calculateGrindDensity(p).percent`. It
briefly passed the whole `{ grinds, funded, percent }` record where a number was
expected — §11.10 changed that return shape — which made every grind comparison
test an object: two of the six questions threw and the rest printed `0/600` and
`NaN`. The grind-derived figures above are from the repaired run; `scripts/` is
outside the typecheck include, so nothing caught it but running the probe.

Unchanged: the plan, the predicate, the `getBandBiggerBetter` thresholds, plan
scope (§11.8), and Grind Density and Friction Index, which keep their own
denominators.

## 28. Which four readings are headlines (2026-08-07)

Twenty-four readings, four tiles. The other twenty sit behind a disclosure, so
the choice of four is the whole of what a returning user sees. It had never been
made against a stated test; §21 flagged the consequence and deliberately left it
open. The test used here, applied to each reading:

1. **Actionable** — the reading names something the user can change today.
2. **Non-redundant** — it does not answer a question another tile already answers.
3. **Live all day** — it is not N/A in the morning nor meaningless by evening.
4. **Not already on screen** — it is not re-derivable from the task list beside it.

### The four

| Tile                | Test it passes                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Completion Rate** | Priority-weighted, so it is not the checkbox count (4); gated on `hasTasks`, the loosest gate of the four, so it reads earliest (3).                                                          |
| **Flow Coverage**   | The remedy is in the reading — `2/5` means drop tasks or add hours (1). The only tile that judges the plan's _shape_ rather than its size (2).                                                |
| **Human Capacity**  | Banded, and its description names the pool that binds, which is the action (1). Plan-scoped, so it survives a finished day (3).                                                               |
| **Burnout Risk**    | The highest-stakes reading in the set, and the only one whose inputs — the energy simulation, the user's own calibration, yesterday's carry-over (§11.9) — appear nowhere else in the UI (4). |

Read together they cover both halves of a day: _is this plan one I can finish_
(Flow Coverage, Human Capacity, Burnout Risk) and _how far through it am I_
(Completion Rate).

### The three demoted, and why

**Fallow Gain.** It judges the allocator, not the day — no action a reader takes
moves it, so it fails (1). It also reads small: §20's honest gain is ~3% and
§19.3's pooled arm can print negative. A flagship tile carrying a small,
sometimes-negative, non-actionable number is the weakest of four slots. It stays
first in the reference list, where it still answers "is this thing working".

**Time Scarcity.** A good reading that fails (2): it and Human Capacity both
answer "too much work for the hours". Spending two of four tiles on one question
is the redundancy, and Capacity is the better half of the pair because it names
_which_ pool. Time Scarcity keeps its row.

**Primary Bottleneck.** §23's Defect 4 established that this row is `'neutral'`
either way — naming a task is not a verdict on it. A tile whose band is a
constant forfeits the grid's only affordance beyond size, and the task it names is
visible in the list to its left, so it fails (4) as well. It is a pointer, not a
headline.

### Pinned in the suite

`metrics-dashboard.stories.svelte` carries the four as its headline fixture — two
banded, two neutral — with Fallow Gain, Yield Index, Time Scarcity and Primary
Bottleneck behind the disclosure, and asserts the tile/row split, the "4 more
metrics" count and the five screen-reader band labels.

Unchanged: every formula, every band, every gate. `headline` is a display flag on
the descriptor row and nothing reads it but `metrics-dashboard.svelte`.

## 29. Day Profile: one cut for two different scales, on a day it never weighed (2026-08-07)

The affect group's last unreviewed row, and the one with no entry here at all:
§11.8 assigned it a scope family and nothing has ever stated its law, its cut or
its labels. Reviewing it found the cut calibrated for a scale the difficulty axis
does not live on, and the reading taken over a task list rather than the plan it
claims to describe.

Measured over 600 seeded days (1–7 tasks, difficulties 0–10, enjoyment 1–10,
budgets 0.25–16 h, switch costs 5–30 min, planned by `calculateSuggestedTasks`,
`scripts/mtr-day-profile.probe.ts`, 2026-08-07). Every rate is a property of the
allocator's day space, not a bound.

### The definition

For the day's plan (all `suggestedTasks`, completed included — plan scope,
§11.8), with per-task allocations `hᵢ`, effective difficulty `Eᵤ` (the §11.4
composite `max + 0.3·min`) and the raw enjoyment slider `eᵢ`, over the funded
tasks `F = { i : hᵢ > 0 }`:

```text
  D = Σ_F Eᵤ(i)·hᵢ / Σ_F hᵢ          demanding  ⟺  D ≥ 6.5
  N = Σ_F eᵢ·hᵢ   / Σ_F hᵢ          enjoyable  ⟺  N ≥ 5.5

  flow = demanding ∧ enjoyable      cruise  = ¬demanding ∧ enjoyable
  grind = demanding ∧ ¬enjoyable    routine = ¬demanding ∧ ¬enjoyable

  [null when Σ_F hᵢ = 0]
```

**Each cut is the reading a day rated at the MIDPOINT of its input controls
produces.** That is the principle, and it is the whole of defect 1. Enjoyment is
one slider over 1–10, so its midpoint is 5.5 and stays 5.5. Difficulty is not a
slider: it is a composite over two sliders that start at 0 (§22), so the
midpoint task — 5 and 5 — reads `5 + 0.3×5 = 6.5`. `DEMANDING_CUT` is written
that way in `calculation.ts`, as `5 + DIFFICULTY_SPILLOVER * 5`, so it moves if
the spillover ever does.

### Defect 1 — the difficulty axis was judged against enjoyment's scale

Both cuts were 5.5, the midpoint of a 1–10 slider. Applied to `Eᵤ` it is the
midpoint of nothing: `Eᵤ` is `max` of two dimensions plus a spillover, so it is
skewed high by construction before a single day is drawn. Hour-weighted over the
sweep it reads mean **7.69**, median **7.94** — and **92.8%** of days cleared the
old cut.

An axis that is true on 92.8% of days is not an axis. Two consequences:

- **The 2×2 was a 1×2.** The difficulty term could only discriminate on the
  **7.2%** of days it fell below its cut; on the rest the label reduces to
  `N ≥ 5.5 ? Flow : Grind`. Over the whole sweep the old label equalled that
  pure threshold on enjoyment on **92.8%** of days — a coarser re-reading of the
  Avg Enjoyment row three lines below it on the same dashboard, which is exactly
  the "three tiles, one quantity" test §24 retired Task Variety for failing.
  Cruise and Routine together were **8.7%** of days.
- **A task the user rated below the midpoint on BOTH dimensions read as
  demanding.** 7 of the 36 `m/p` pairs with neither dimension above 5 cleared
  the old cut: `2/5 3/5 4/5 5/2 5/3 5/4 5/5`. This is §11.4's defect class in a
  level threshold instead of a gap — the composite judged against a raw slider's
  calibration.

At 6.5 the difficulty term discriminates on **17.7%** of days and the
enjoyment-alone agreement falls to **82.3%**. Still high, and honestly so: most
days a person bothers to plan ARE demanding. The cut is derived from the input
controls rather than fitted to that distribution, and fitting it to split the
sweep 50/50 would be calibrating the meaning of "demanding" to the seed.

### Defect 2 — a plan metric that never looked at the plan

The reading was an unweighted mean over the raw `tasks` array. Plan scope
(§11.8) asks what the day looks like **as designed**, and the design is the
allocation, so this was the wrong average twice over:

- **A 15-minute task outvoted a 6-hour one.** Weighting alone — same cut, same
  scope — changes the label on **24.5%** of days.
- **Tasks the allocator refused to fund voted on the character of the day it
  built without them.** **15.2%** of days carry at least one 0 h task. The first
  disagreement in the sweep is exactly this: six tasks, of which the plan funds
  five at 15 minutes each and drops the sixth, read `grind` counted and
  `routine` weighted.

Its plan-family siblings — Friction (§11.4), Deep Work (§26), Sustainable Work
(§27) — are all time-weighted already. Grind Density stays a count, deliberately:
it answers "what share of my TASKS are chores", which is the question §27 names
as its own hour-weighted twin. Day Profile is not a share of anything; it is a
description of the day, and a day is made of hours.

Together the two defects relabel **25.0%** of seeded days. The label mix moves
from flow 47.7 / grind 43.7 / cruise 4.0 / routine 4.7 to **flow 54.0 / grind
28.3 / cruise 10.8 / routine 6.8** — the two labels the old law had all but
retired come back to 17.6% of days between them.

### Null, not Routine, on a plan that books nothing

With `Σ_F hᵢ = 0` there is no allocated time to describe, and every label is a
claim about work that is not happening — `routine` most of all, since it reads as
"a light day" rather than "no day". The model returns `null`, `buildMetrics`
gates the row on the READING rather than on the task list, and `countQuadrants`
counts such a day nowhere instead of into `routine`.

**The sweep does not measure this arm.** 0 of 600 days hit it, because the seeded
budgets start at 0.25 h and every plan books something. It is a fixture-only
finding (`calculation.test.ts`), reachable the same way §11.5's "budget set but
nothing funded" is — a zero next to a zero occurrence counter is an empty
measurement, not a clean bill of health.

### Defect 3 — the advisor sold a flip it could not have caused

`AdviceOption` carried the candidate plan's quadrant and
`plan-advice-descriptor` printed "Day Profile → {profile}" whenever it differed
from the baseline's. Two things were wrong with that:

- **It was structurally dead for every budget lever.** `applyLever`'s
  `set-budget` branch changes `availableHours` and nothing else, and the old
  reading was a pure function of `tasks` — so the three budget levers (trim,
  −1 h, +1 h) could never move it, and only `defer-task` could ever print a
  flip. The column silently claimed that dropping work changes the day's
  character and that buying four hours cannot. Hour-weighting is what fixes
  this, not the gate below: the profile now reads the allocation, which is what
  a budget lever moves.
- **The cliff is thinner than the claim.** The label is a hard threshold on two
  averages with no hysteresis. **16.2%** of days sit within 0.25 of a cut, and
  one ±1 slider point on ONE task — re-solved, so the allocation moves with it —
  relabels **31.8%**. A crossing that thin is noise wearing a change of
  character.

So `AdviceOption.quadrant` becomes `quadrantFlip`: the profile the lever moves
the day to, or `null`. The model, not the descriptor, decides — a flip is
reported only when both readings exist, differ, and clear their nearer cut by
`QUADRANT_FLIP_MARGIN = 0.25`, a quarter of one slider point. A baseline already
straddling a cut had no settled character for a lever to change, so both sides
must clear it, not just the candidate. `calculateQuadrantMargin` exists for this
one caller. `PlanAdvice.quadrant` is dropped: with the decision in the model,
nothing read it.

### History reads the day it can afford to solve

Day Profile now depends on the allocation, and `summarizeSession` deliberately
does not solve one — the exact allocator enumerates 2ⁿ funded subsets, which is
**tens of seconds of blocked main thread per 365 days at n = 12** (§31 measures
it per task count: 1.7 s at n = 8, 7.9 s at n = 10, 30.1 s at n = 12, and the
per-n table is the number to quote — a single figure collapses the n that
decides it). Its previous shortcut,
scoring each task on its own, is exact for `completionRate` (priority is
intrinsic, §3) but hands every task its full T* as though it were the only one,
which disagrees with the dashboard's plan on **21.0%** of days.

`solveWithoutSwitchCost` is the middle: the real budget, the real pools and the
real marginal-value pass, with `switchCost = 0` — the one term the 2ⁿ
enumeration exists to price. `bestPlanWithSwitchCost` short-circuits to a single
`allocate` call there, so a year costs **60 ms at n = 12**, and the calendar and
analytics disagree with the dashboard on **7.5%** of days instead of 21.0%.
Stated rather than hidden: the module header no longer claims a day reads
identically everywhere, because for this one reading it does not.

### The copy named a third thing

Both locales said "based on average difficulty and enjoyment" — an unweighted
average, over one difficulty. They now name the hours the plan books and the two
difficulty dimensions, per §11.1.

### Pinned in the suite

`calculation.test.ts`: the four labels; the midpoint of both difficulty sliders
reading demanding and one point under it not (`5/5` vs `5/4` — the spillover
decides, and every pre-§29 fixture set `physicalDifficulty: 0`, the one
configuration where it contributes nothing, which is how the skew survived); the
hour-weighting against the task count (one 6 h grind beside three 30-minute joys
→ grind); an unfunded task getting no vote; `null` on both an empty list and a
plan that funds nothing; and the margin, including a day sitting exactly on a
cut.

Unchanged: the four labels and their names, plan scope (§11.8), Grind Density's
task-count weighting, and `getEffectiveDifficulty` itself.

## 30. The Lab's comparison tile scored the plan on the one thing it does not maximize (2026-08-07)

### The definition

`/energy`'s fourth summary tile answers "is this plan better than the one the
main page would have made?". `EnergyLabStore.#classicEvaluation` builds the
rival: `calculateSuggestedTasks` on the same tasks and window under the day's
switch cost, pools and fit posterior; the funded tasks in
`calculateInterleavedOrder`; each switch cost as a rest gap between them; one
`evaluateSchedule` over the day window. Both sides carry completed tasks
(§11.8), so the comparison is of two full intended days.

**The conversion is exact, and that is not an accident.** The classic allocator
reserves `(m−1)·switchCost` out of the budget for `m` funded tasks (§4), and
`calculateInterleavedOrder` sequences only tasks with hours, so the gaps the Lab
inserts are exactly the overhead the allocator already paid for. Measured over
the §15 draw: **0 of 300 days clipped by `normalizeSchedule`, worst overflow
0.00 h** (`scripts/rv16-output-vs-classic.probe.ts`, seed `0x290729`). No work
is silently truncated off the rival side.

### The defect: raw output is the field the optimizer was not aiming at

The tile divided `totalOutput`. The schedule directly above it is the argmax of
`objective = satiatedOutput + freeTimeBonus + terminalBonus` (§8.4) — so
`totalOutput` is the one field of `ScheduleEvaluation` the plan was **not**
chosen for, and the label said "judged by this model". Same 300 days, energy
plan against classic:

| scoring          | median      | p10    | mean    | p90     | wins    |
| ---------------- | ----------- | ------ | ------- | ------- | ------- |
| `totalOutput`    | **+61.03%** | +15.5% | +73.20% | +161.6% | 295/300 |
| `satiatedOutput` | +36.7%      | +4.8%  | +45.65% | +102.4% | 288/300 |
| `objective`      | **+17.4%**  | +5.0%  | +22.7%  | +47.6%  | 298/300 |

(Re-measured 2026-08-19 at the same seed and draw,
`scripts/rv16-output-vs-classic.probe.ts`, and quoted at the probe's own
precision. Three cells moved with the two §8.6 solver fixes of 2026-08-13 — the
off-midpoint rest break and the two-task pair seeds: `totalOutput` median
[2026-08-07: **+61.4%**] and mean [+73.1%], `satiatedOutput` mean [+45.8%]. So
did consequence 3's per-worked-hour edge below [+39.9%]. Bisected: all four
reproduce at their stated precision at `cbfff71`, the commit before those fixes
(61.38 / 73.06 / 45.80 / 39.85). Every other cell
here reproduces, and so does each reading the table is quoted for — 61.03/17.36
is still ~3.5×, satiety is still 40% of the raw margin, and the paired +12.5%
more hours is exact.)

Three consequences, in the order they matter:

1. **The headline read ~3.5× the model's own verdict.** Satiety alone accounts
   for 40% of the raw margin, and it is not incidental to this comparison: the
   energy plan concentrates on 1–2 tasks against classic's ~4 (§15), and raw
   output is precisely the scoring that does not discount piling hours onto one
   task. The tile was flattering the plan on the axis §8.4 exists to stop
   rewarding.
2. **It disagreed with the optimizer in sign on 5 of 300 days** — 4 where the
   tile showed ≤ −1% while the objective favoured the energy plan, 1 the other
   way. (Separately, the objective itself loses 2/300 to the 45-minute lattice —
   §15, not a defect.)
3. **It mixed "works better" with "works more."** The energy plan books +12.5%
   more hours of the same window (median); per worked hour its raw-output edge
   is +41.97%, not +61.03%.

### A second defect: `-0` signed a loss green

`Math.round(-0.4)` is `-0`, and `-0 >= 0` is true, so the two-way sign test in
`plan-summary.svelte` rendered a plan that lost by under half a point as a green
`+0%`. The tile now reads three ways — win, loss, and tie in neutral ink with no
`+`. A sub-half-point gap is a tie, which is the honest reading of a number
displayed as a whole per cent.

### The fix

`#outputVsClassic` → `valueVsClassic`, over `objective` on both sides, guarded on
`classic.objective <= 0`. Renamed rather than repointed: the old name would have
described the new number wrongly in exactly the way the old copy described the
old number wrongly. Both locales now say **day value**, and the tooltip names
what the objective contains (output after diminishing returns, plus the day's
free time and leftover energy) and that it is deliberately not raw output.

This is the tile agreeing with §15, which cross-scored the two modes under
`objective` from the start — the probe and the product now report the same
quantity.

### Pinned in the suite

`plan-summary.stories.svelte`: the three signs, including the `-0` tie in
neutral ink. `energy-lab-store.svelte.spec.ts`: the reading survives checking a
task off (§11.8). `energy-lab.e2e.ts`: the tooltip, hovered by the new label.

Unchanged: the rival plan's construction, `totalOutput` as the "Total output"
tile and what the chart draws (§8.4 — raw output is still the right thing to
show as a level), and the fact that this tile is the only reading on `/energy`
that switch cost and the capacity pools reach at all.

## 31. What history can plot, and what it cannot (2026-08-07)

Twenty-four readings exist for today and none of them for any other day. The
analytics screen plots one — the priority-weighted completion rate — because
that is the one §29 established as exact off the cheap solve: priority is
intrinsic (§3), so it does not move with the allocation. Everything else on the
dashboard depends on the plan, and `summarizeSession` deliberately does not
solve the real one.

This section is the test applied to the rest: **which allocation-dependent
readings survive `solveWithoutSwitchCost`, and which are noise.** Three do and
one does not.

Measured over 600 seeded days (1–7 tasks, difficulties 0–10, enjoyment 1–10,
budgets 0.25–16 h, switch costs 5–30 min, `scripts/mtr-metric-trend.probe.ts`,
2026-08-07). Every rate is a property of the allocator's day space, not a bound.

### The approximation

`summarizeSession` solves at `switchCost = 0` — §29 has the derivation and the
cost. The exact allocator is 2ⁿ, and the probe measures it per task count rather
than once, because a year is only unaffordable for a heavy user and a single
figure collapses the n that decides it — this table is the one to cite:

| Tasks per day | 365 exact solves |
| ------------- | ---------------: |
| 8             |            1.7 s |
| 10            |            7.9 s |
| 12            |           30.1 s |

Those rows are a standing list of n tasks repeated for a year. The seeded space
below draws n = 1–7 instead, and over ITS 365 days the switch-cost-free solve
plus all three readings costs **~35 ms** — against 75 ms for the exact solve
over the same days, which is the comparison the table above is there to correct:
the mean over a mixed n hides the day that decides it. Wall-clock, so the last
digit moves between runs; the ratios do not. There is no budget in which the
exact solve is the answer at n = 10 and above.

**The allocation is the only thing approximated.** Everything else the readings
depend on is the day's own: its stored `switchCost`, and — for Burnout Risk —
its own morning. `calculateMetricTrend` seeds each point's reservoirs from the
PREVIOUS day's 🪫 rows through `seedMorningReservoirs` (§11.9), exactly as
`DailyPlanStore` does for the viewed day. Simulating every point from full
reservoirs instead would read a rested morning on every day the user actually
started depleted; that gap is not the allocation approximation this section
measures, it does not shrink with a better solve, and it would put the last
point of the series next to a dashboard tile it contradicts.

**Only one of the three** — Burnout Risk — takes `switchCost` as an argument
**separate** from the allocation, so for it the approximation is the allocation
alone and the day's own stored cost is still what it is priced at. That is not a
detail: pricing Burnout Risk at 0 as well moves its p95 error from 5.00 to 14.00.
The two Loads never see a switch cost — `calculateCognitiveLoad(tasks,
availableHours)` takes none — so for them "kept" and "dropped" are the same
number (22.50 and 24.00 either way), and the whole gap is the allocation.

### What survives

Banded by the policy each reading actually ships with — `AXIS_BAND` imported
from `presentation/utils/band.ts`, not restated (AGENTS.md R3). This matters
more than it sounds: the two Loads band through `getBandSmallerBetter(v > 70 ? v
: 0)`, so every ordinary day is `success` and only the top of the range can move
a colour at all.

| Reading                  | Identical | median \|Δ\| | p95 \|Δ\| | Band differs |
| ------------------------ | --------: | -----------: | --------: | -----------: |
| **Burnout Risk** (§11.6) |     60.3% |         0.00 |      5.00 |         2.3% |
| **Cognitive Load** (§25) |     53.3% |         0.00 |     22.50 |         5.0% |
| **Physical Load** (§25)  |     51.7% |         0.00 |     24.00 |         6.5% |

A p95 of 22.50 against a band that only cuts at 70 is why the Loads' |Δ| is
large and their colour is stable. The approximation drops the switch bill, so
the gap is a function of what that bill was worth — and the space draws 0.25 h
budgets against 30-minute switch costs, a regime an ordinary day never reaches:

| Overhead, as a share of budget | Days | Cognitive Load p95 \|Δ\| | Band differs |
| ------------------------------ | ---: | -----------------------: | -----------: |
| 0–5%                           |  184 |                    13.33 |         2.7% |
| 5–15%                          |  218 |                     8.95 |         3.2% |
| 15–30%                         |  138 |                    22.86 |        10.9% |
| 30–100%                        |   60 |                    36.67 |         5.0% |

An 8 h day with four tasks and a 15-minute switch cost spends 45 minutes on
overhead — 9%, the second row. The card says so in one line rather than
implying the series is the dashboard's own history.

The band column is **not monotone in the overhead share** even though the p95
error is, and the `> 70` gate is why: past 30% overhead both arms are usually
loaded enough to sit in the same high band, so a larger error moves the colour
less often. The error column is the one that tracks the bill; the band column
tracks what a reader would see, and those are different questions.

### What does not: Fallow Gain

The gain is the one reading whose **subject** is the term the approximation
drops — it is a ratio between two arms, and the switch bill is what separates
them. Which arm moves is worth stating exactly, because it is not the one the
name suggests: the naive baseline is derived from the task list and the budget,
never from the optimizer's hours (`calculateTaskPlan`'s contract says so), so
dropping `switchCost` from the **solve** leaves it bit-identical. What moves is
the **optimized** arm. Chosen under `switchCost = 0` it reserves no overhead and
spends the whole budget, and is then credited against an unchanged baseline — a
one-signed inflation, not noise around the true value. §19 is the precedent for
why that is fatal rather than merely imprecise: it removed a bill charged to one
arm and not the other, and this reintroduces one in the opposite direction.

Priced coherently instead — both arms at 0 — the error falls by a factor of
four. Over the whole seeded space:

| Pricing                       | p95 \|Δ\| | The reading's own median |
| ----------------------------- | --------: | -----------------------: |
| Day's own switch cost         |     56.70 |                    2.80% |
| Both arms at `switchCost = 0` |     13.50 |                    2.80% |

Those two rows are the whole space, which includes the 0.25 h-budget corner the
Loads' table above sets aside as unreachable. Judging the gain there while
judging the survivors on ordinary days would compare two populations and call
the difference a property of the reading, so the probe buckets the gain on the
**same** overhead shares:

| Overhead share | Days | Priced p95 \|Δ\| | Both arms free p95 \|Δ\| | Gain's own median |
| -------------- | ---: | ---------------: | -----------------------: | ----------------: |
| 0–5%           |  184 |            49.60 |                     5.10 |             1.90% |
| 5–15%          |  218 |             7.80 |                     1.80 |             2.20% |
| 15–30%         |  138 |            60.90 |                    18.80 |             4.50% |
| 30–100%        |   60 |           104.20 |                    25.10 |             7.70% |

This is a weaker claim than "five times the signal at best", and it is the one
the data supports. On the ordinary row the coherently-priced error is 1.80
against a 2.20% reading — comparable to the signal, not five times it. Two
things still decide it:

- **The priced arm is unusable everywhere**, including the ordinary rows (7.80
  against 2.20%), and pricing both arms at 0 is not available to a card that
  must agree with a dashboard tile computed at the day's real cost. §21's
  selection term depends on `switchCost`, so the free arm is a different
  quantity, not a cheaper estimate of the same one.
- **Even at its best the error is the same size as the reading.** §21 established
  that an honest gain reads ~3%; a series whose per-point error is ~2 points on
  a ~2-point signal carries no shape a reader could act on.

**Fallow Gain is not plotted.** The Loads survive because their error is large
against a band that ignores it; the gain does not, because its error is the size
of the reading under every pricing available to the card. It stays a today-only
tile.

### Pinned in the suite

`history.test.ts`: one point per day in the order given; Burnout Risk priced at
the day's stored switch cost even though the plan was solved without it; the
calibrated params reaching the reading (on a two-task fixture — §11.6's plateau
makes a four-task day read 58 under any α, which would pass whether or not the
params were wired at all); zero rather than NaN on a day that booked no hours;
and an empty range returning no points. The overnight carry-over is pinned on
the same two-task fixture at `recoveryRate: 0.1`, because at the default rate a
night heals to >0.999 and the seeding is invisible by construction: a day whose
PREDECESSOR logged 🪫 reads higher than the same day without, and a day carrying
rows of its OWN reads unchanged — which pins the keying in both directions at
once.

`analytics-store.svelte.spec.ts`: the series withheld until the calibrated
params arrive and after a failed model report — a trend fitted to the defaults
would contradict today's tile for a reason nothing on screen explains — and
resliced by the range toggle.

`metric-trend-series.test.ts`: a slot per day recorded or not, an unrecorded day
arriving `null` rather than 0, and the axis thinning to ~7 ticks at any range
length. `metric-trend-chart.stories.svelte`: the line breaking at a gap, a lone
recorded day surviving as a dot, and the single-slot axis centring instead of
dividing by zero.

`mtr-metric-trend.probe.ts` imports `AXIS_BAND` rather than restating a ladder
(AGENTS.md R3). It carried a local three-band 30/60 cut, which is the policy for
none of the four readings, and every "band differs" rate above was measured
against it: the Loads' rate read 17% under that ladder and 5.0/6.5% under the
one that ships.

Unchanged: every formula, every band, and `summarizeSession`'s solve — the
readings are folded off the plan it already computes, so the trend costs one
pass over an array and no second allocation. The carry-over seeding adds no
solve either: `seedMorningReservoirs` is a per-day reservoir wind-forward over
the previous day's rows, not an allocation.

## 32. Two gates that read a sentinel as a verdict (2026-08-08)

§29 established that a plan booking no hours has no Day Profile, and returns
`null` rather than a label. Two readings elsewhere answer the same degenerate
day with a **number** instead, and the display treated those numbers as
findings. Neither is a formula defect — both models are right to return what
they return — so this section changes no math, only which cell is allowed to
render it.

### Defect 1 — a budget that funds nothing read as a schedule failure

`calculateScheduleIntegrity` short-circuits twice: `0` when the budget is 0, and
`0` again when the budget is set but the plan funds nothing — a day whose budget
is too small for any task to fit. The second is a sentinel, not a ratio; there
is no schedule to have integrity about.

`metric-descriptor.ts` gated the row on `planned = hasTasks && hasBudget`, which
is TRUE in exactly that case. So the row rendered `0%` under
`getBandBiggerBetter`, i.e. **critical red** — the "alarm about nothing" its own
adjacent comment claimed to prevent, and precisely the case the plan advisor
answers with `NaN` so it stays silent (§14.1 defect 5). One reading, two layers,
opposite verdicts.

`calculateFrictionIndex` has the same shape and the opposite polarity: `0` on
`totalAllocated <= 0`, banded by `getBandSmallerBetter`, so an unfunded day
rendered a green **0% friction** — a frictionless day that was never planned.

Both rows now gate on `planned && funded`, where `funded = grindDensity.funded >
0` — the count the model already computes and the row above already reads, so
the three cannot disagree about whether the plan funds anything (AGENTS.md R3).
They go N/A, which is what the gate policy means everywhere else in the file:
undefined without its inputs renders N/A, never 0.

### Defect 2 — the Day Profiles bar sized against days it does not count

`countQuadrants` skips a day whose quadrant is `null`, which is §29's rule
working correctly. The analytics screen passed the stacked bar
`total={summaries.length}` — every day on record, including the unprofiled ones.
The segments are drawn `counts[key] / total`, so on any range containing a
zero-budget day they sum to less than the bar's width and **every profile's
share reads low**. A week of five recorded days with one zero-budget day filled
the bar to 80% and understated each segment by a fifth.

The component no longer takes a denominator at all. It derives the bar's 100%
from the `counts` it already receives, which is that quantity by construction,
so no caller can put it out of step with the segments the way a second
independent count would.

Reachability, since it decides whether this is a real defect or a hypothetical:
`SessionStore` autosaves as soon as `tasks.length > 0`, so adding a task before
entering hours writes exactly this day whenever the hours are still 0 — which
since ROADMAP item 16 means a weekday the user has never budgeted, the rest
opening on that weekday's median instead; `moveTaskToTomorrow` writes one
unconditionally. `sanitizeSession` preserves the 0, and
the history read filters on `tasks.length > 0`, not on hours — so the day
reaches the store.

### Pinned in the suite

`metric-descriptor.test.ts`: both rows reading N/A on a day with tasks and a
budget too small to fund one, beside the existing no-budget case.
`quadrant-distribution.stories.svelte`: the segments tiling the bar to 100%
structurally, since the sum is derived from the counts the bar draws.

Unchanged: `calculateScheduleIntegrity`, `calculateFrictionIndex`,
`countQuadrants` and `calculateDailyQuadrant` — every sentinel and every `null`
is still what it was. This is a display-gate change on three cells.

## 33. A plan reads only the logs that precede it (2026-08-08)

**The behaviour.** A user with no ⚡ history plans a five-task day; the top task
is allocated 2h30m against a predicted ϕ of 2h21m. They work it, reach flow in
60 minutes, log that, and tick the task off. Every remaining task's ϕ roughly
halves — 1h54m → 59m on a task they never touched — and three of the four
surviving allocations grow. Nothing they did was about those tasks.

**The mechanism, and why it is not a bug in any formula.** `fitUserConstants`
fits c₁, c₂, c₃, which are **global**: ϕᵢ = c₁Eᵢ + c₂βᵢ + c₃ for every task. One
log therefore re-times the whole list, and the allocator re-solves under the new
ϕ. Every step is correct. What is wrong is only _when_ it lands.

**The rule.**

> A plan for day D is fitted from logs dated **strictly before** D.

Same filter everywhere, three consequences:

| Viewing      | D's own logs | Effect                                                  |
| ------------ | ------------ | ------------------------------------------------------- |
| today        | excluded     | the plan stops moving under the user mid-execution      |
| a future day | included     | the preview already carries every log made so far       |
| a past day   | excluded     | the day reads through the model **it** had, not today's |

The third row was a second, quieter instance of the same defect: before this,
logging one ⚡ silently changed the ϕ every past day's plan had been built from,
and therefore every historical reading derived from it.

**The timing is the whole fix; the magnitude is not the problem.** Measured on
`scripts/causal-fit-window.probe.ts` (2026-08-08), against a bystander task
(difficulty 4, enjoyment 3) that is never logged, re-timed only by logs on a
different task (difficulty 5, enjoyment 2) each measuring 1h:

| logs | ϕ(bystander) | vs the 90.8 min default |
| ---: | -----------: | ----------------------: |
|    1 |     60.8 min |                 −33.0 % |
|    2 |     55.8 min |                 −38.5 % |
|    3 |     53.7 min |                 −40.8 % |
|    5 |     51.9 min |                 −42.9 % |
|    8 |     50.8 min |                 −44.1 % |

The **first log alone accounts for 75 %** of the whole eight-log move, and it
moves tasks the user never logged: at one log, difficulty 1/enjoyment 5 goes
42.8 → 24.5 min (−42.6 %), 3/3 goes 75.9 → 50.1 (−34.0 %), 5/1 goes 108.9 → 75.6
(−30.6 %). That is the size of jump this section relocates. It does **not**
shrink it, and deliberately so: a plan changing at the moment it is made is what
making a plan means, and a plan changing while it is being executed is a broken
promise. The same 33 % arrives either way; only one of the two moments can
absorb it.

Deferring by a day costs essentially nothing in fit quality, which is what makes
the relocation free rather than a trade: under §5.2's H = 365 d half-life, the
same log at age 1 d instead of age 0 d moves the prediction by **0.016 min**
against a 30.0 min jump — three parts in ten thousand. Recency is not the
mechanism here and the causal window does not fight it.

**Scope: identity, never state.** A log does two jobs, and only one of them is
deferred.

- **Identity** — c₁c₂c₃ (§5), α and r (§8.7/§8.9), λ₀ (§8.10). Slow parameters
  answering "who is this user". These are causal.
- **State** — what happened today. `simulateReservoirs`, the §11.9 overnight
  carry-over, the §8.11 stop advisor's worked hours. These read today's logs
  immediately, and must: suppressing them would make a gauge of the present lie.

The two already sit behind separate arguments to separate functions, so the
filter lands on one without touching the other. Concretely: today's 🪫 stops
moving α, and still drains the reservoirs and still feeds the stop advisor.

`ageDays` runs against the **planned** day rather than the live one, since the
§5.2 weights are part of "the fit as of day D" — a past day must not have its
own logs discounted by however long ago that day was.

**Cost: none worth measuring.** On the live path this is one `.filter` in front
of a fit that already runs once per viewed day. §12.1 rejected recomputation at
`O(auditDays × logVolume)`, but that was the cost of refitting **every audited
day**; one day costs one fit.

**History reads each day's own fit, never one fit spread across a range.**
`readDaySummaries` used to apply a single whole-history fit to every day the
calendar and analytics screens show, which is the same defect at the scale of the
user's whole history: one ⚡ logged this afternoon silently moved the completion
rate of a day finished in March. Each day is now scored under the fit
**recorded** on it (§12.1's `fitSnapshots`), which is a read rather than a refit —
the `O(days × logVolume)` recomputation §12.1 rejected is exactly why those
snapshots are stored. `fitFrom` carries the causal window, so the same change
makes the analytics "Your model" card, its energy fits, and the snapshot written
each day all read logs strictly before their date. §12.1's known-approximation
paragraph is closed by this; what survives is the **fallback** — a day with no
stored snapshot is still read through the live fit, per day, and refitting it is
the cost that was rejected.

**The copy has to follow, or the rule reads as a broken button.** The budget
bar's model line counts the logs the fit **used**, never the raw row count, and
names the deferred ones separately: "1 ⚡ logged today — it re-times your model
from tomorrow, so today's plan holds". On a day where nothing has been counted
yet that sentence replaces the "log ⚡ to start personalizing" prompt rather
than joining it, which would otherwise ask the user to do the thing they just
did. The analytics "Your model" card owes the same: Σw is what the fit read, so
today's rows are named beside it ("3.5 ⚡ logs, recency-weighted · 2 logged
today, counted from tomorrow") rather than folded into a count that would then
overstate what moved the fit. The Energy Lab's drain and recovery cards owe it
for the same reason: they are labelled as the user's fitted α and r, so a rating
logged today leaves the row unfitted and is named beside it ("1 rating logged today, counted from tomorrow") rather than
moving a number the main page is not using. The advisor above them keeps every
one of today's rows — that read is the state half of this rule, not a copy
problem.

### Pinned in the suite

`session-store.svelte.spec.ts`: a log made on the viewed day leaves that day's
constants untouched while the same log dated a day earlier moves them, and
`pendingFlowLogCount` reports the gap. `daily-plan-store.svelte.spec.ts`: the
same for the 🪫/☕ fits, with the §11.9 carry-over still reading yesterday's
drain. `day-constraints-bar.stories.svelte`: the deferred-log line visible while
collapsed, and the counted total excluding it.

`session-history.test.ts`: a report dated on the log's own day reads none of it
and reports it pending, while the next day's does; and `readDaySummaries` moves
only the day that has a snapshot, leaving the day without one on the live fit.
`calibration-descriptor.test.ts`: the ϕ row naming the deferred logs beside Σw
rather than adding them to it. `energy-lab-store.svelte.spec.ts`: a rating or a
break dated today leaves the Lab's α and r fits unfitted while the same row dated
a day earlier fits, and `pendingDrainLogCount` / `pendingRestLogCount` report the
gap.

## 34. The subset search gave up one task too early (2026-08-08)

§4 buys its exactness with an exhaustive enumeration of the funded subsets, and
`EXACT_SUBSET_LIMIT = 12` is where it stopped: past 12 tasks the fixed-charge
dimension fell to **greedy forward selection** — seat the best single task, then
keep admitting whichever task most improves the total, stop when none does.
§4 called that "a documented heuristic; a daily planner rarely exceeds 12 tasks"
and attached no number to it, while the pooled path beside it prints its worsts
to four decimals.

Both halves of that sentence were wrong.

**It is reachable.** `daily-plan-store` hands `calculateDailyMetrics` the day's
whole task list and nothing trims it; `calculateTaskPlan` allocates over all of
it, completed tasks included (deliberately — §11.8 plan scope). A 13-item
backlog is an ordinary Tuesday, not an exotic input.

**It is expensive, and expensive exactly where selection is the whole game.**
Measured against exhaustive enumeration over 120 random days per n
(`scripts/subset-search-bound.probe.ts`, seeded; budgets 0.25–10 h on the block
lattice, `switchCost` ∈ {0.1, 0.25, 0.33, 0.5}, default constants, **single
budget** — the fixed-charge dimension in isolation, with no pool to confound it;
the pooled path carries §13.3's separate heuristic gap on top):

| n   | days non-exact | mean forfeit | worst      | worst at ≤ 2 h |
| --- | -------------- | ------------ | ---------- | -------------- |
| 13  | 34/120         | 0.78%        | 14.93%     | **14.93%**     |
| 14  | 33/120         | 0.80%        | **18.41%** | **18.41%**     |
| 15  | 43/120         | 0.94%        | 13.39%     | 13.39%         |

Every worst case sat in the tight-budget band — which is precisely where §21.1
measures the optimizer's entire edge to be **selection** (84.9% of it at 0h30,
0.0% from 2 h up). Forward selection fails at the one thing that matters at the
one budget where it matters. The mechanism is its first move: with a 1 h budget
and `switchCost` 0.33 it seats the best single task at four blocks, and no
admission from that anchor can reach the pair `{(2,8), (2,9)}` — two cheap,
enjoyable tasks each collecting its own activation bonus — which is 18.41%
better and which enumeration finds immediately.

It also **breaks monotonicity in the budget** — a day made 15 minutes longer
planning _worse_ than the shorter one, **20 times in 6400 ladder steps, worst
0.5565 P̄-units**. That cannot happen to a search over a budget-indexed family,
because every plan affordable at B is affordable at B + δ; it happens to forward
selection because its first pick moves with the budget and a better anchor can
lead somewhere worse. Present tense on purpose: the fallback still exists, and
so does a fifth of this — see "What it costs" below.

### The bound

A plan funding m tasks pays at least `(max(startedCount, m) − 1)·switchCost` off
the budget — `startedCount` is the tasks the day has already worked, whose
switches it owes whether or not the plan funds them again (§35) — **and** still
owes every member at least one block, so no plan can fund more than

```text
maxFunded = max { m : budgetBlocksFor(max(startedCount, m)) ≥ m },
            budgetBlocksFor non-increasing in its argument
```

Non-increasing and not decreasing: the floor to whole blocks lets two counts
land on the same number — at `switchCost` 0.1 and B = 4 h, `budgetBlocksFor(2)`
and `budgetBlocksFor(3)` are both 15. The `− m` below is what carries the
strictness.

`max(startedCount, m)` is the smallest day-funded count a size-m subset can
have, which is what makes the result an upper bound.

`g(m) = budgetBlocksFor(max(startedCount, m)) − m` is non-increasing on both
sides of the junction at m = `startedCount` — below it `budgetBlocksFor` is
pinned at the day's own count and only the `− m` moves, above it neither term
rises — so the affordable sizes are still the interval [1, `maxFunded`] and a scan
that stops at the first failure still finds it. A budget under one block affords
no size at all, and the empty plan stands. With `startedCount` = 0, `max(0, m)`
is m and the test is `budgetBlocksFor(m) ≥ m` exactly — the same expression, not
a close one, so no cold day can tell the two apart.

Enumerating only subsets of size ≤ `maxFunded` loses nothing. Take a subset S
with |S| > `maxFunded` and let F ⊆ S be the members the greedy actually funded
out of `b = budgetBlocksFor(dayFundedCount(S))` blocks. Then |F| ≤ b, and since
F ⊆ S gives `dayFundedCount(F) ≤ dayFundedCount(S)`,
`budgetBlocksFor(dayFundedCount(F)) ≥ b ≥ |F|`; and
`max(startedCount, |F|) ≤ dayFundedCount(F)`, so by the monotonicity above
`budgetBlocksFor(max(startedCount, |F|)) ≥ budgetBlocksFor(dayFundedCount(F)) ≥
|F|` — the bound's own test at |F|, which by the interval puts |F| inside
`maxFunded`, so **F is enumerated in its own right**. It is solved with at least as many blocks as S
was, and the S-plan restricted to F is a feasible F-plan, so its value is
reached or beaten. This is §4's existing "a subset that leaves a member at 0
blocks is never strictly better" argument, applied one step further out — and
like that one it inherits the greedy's exactness, so it is a proof on the
single-budget path and carries §13.3's heuristic status on the pooled one.

Σⱼ₌₁^maxFunded C(n, j) plans is the cost, and the search runs whenever that fits
`SUBSET_SEARCH_BUDGET = 2¹² − 1 = 4095` — **the same plan budget the n ≤ 12 path
already spends**, so the worst case does not move. Only when it does not fit
does forward selection run.

The two bounds pull against each other in the useful direction: a tight budget
funds few tasks, which is what leaves room to enumerate a long list; a long day
funds everything, which is what makes the choice cheap to get wrong. So the
bounded search covers the tight band and the fallback keeps the loose one — the
opposite of a compromise.

**Where the crossover actually sits, because it is not "rarely".** At `n` = 13,
the default `switchCost` 0.25 and a cold day — `startedCount` = 0, as every
measured figure in this section is, its sweeps included — the bounded search runs
up to a **3 h** day and the fallback takes everything above it (at 3 h,
`maxFunded` = 6 and Σⱼ₌₁⁶ C(13, j) = 4095 exactly; a quarter-hour more pushes
`maxFunded` to 7 and the count to 5811). Over the 6400-step sweep below, the
bounded path ran on **1587 of 6400 solves, 24.80%** (2026-08-19,
`scripts/subset-search-bound.probe.ts`). So the ordinary 8-hour day with 13 tasks
is a _fallback_ day — the same day §34 opens by calling reachable. That is the
design and not a shortfall in it: §21.1 measures selection at 0.0% of the
optimizer's edge from 2 h up, so the region the bound reaches is the region where
getting the subset wrong is expensive, and the region it cedes is the one where
the remaining forfeit is 2.3–3.8%.

**A prefix moves that line, and that is what the `startedCount` term buys.** At
`n` = 13, B = 4 h, `switchCost` 0.33 and `startedCount` = 8, the subset-only
form gives `maxFunded` = 7 → Σⱼ₌₁⁷ C(13, j) = 5811 > 4095 → forward selection;
the shipped form gives 6 → Σⱼ₌₁⁶ C(13, j) = 4095 ≤ 4095 → the bounded exact
search. On that day the subset-only form forfeits **0.4210 P̄-units, 15.0%**.

`zenith.test.ts`'s "funds the exactly-optimal subset past the limit on a day
already worked" pins that day's plan against exhaustive funded-subset
enumeration, so the shipped half of the pair runs on every suite pass. The
forfeit itself is not measurable from HEAD — the stale bound is gone — so, by
the same standard the "before" column above holds itself to, here is the
command rather than a description of one:

```text
mutate: zenith.ts:1098 → budgetBlocksFor(maxFunded + 1) >= maxFunded + 1
then:   npx vitest run --project=server src/lib/business/model/zenith.test.ts \
          -t "already worked"                            (and git restore after)
```

It fails with `expected 2.3770446424343907 to be close to 2.7980598746692573`,
which is the 0.4210 above.

### What it costs, measured

Same sweep, after (2026-08-08):

| n   | days non-exact  | mean forfeit     | worst             | worst at ≤ 2 h    |
| --- | --------------- | ---------------- | ----------------- | ----------------- |
| 13  | 34 → **9**/120  | 0.78 → **0.10%** | 14.93 → **3.26%** | 14.93 → **0.00%** |
| 14  | 33 → **19**/120 | 0.80 → **0.18%** | 18.41 → **2.28%** | 18.41 → **1.89%** |
| 15  | 43 → **32**/120 | 0.94 → **0.38%** | 13.39 → **3.77%** | 13.39 → **3.31%** |

The tight band is now essentially exact (0/20, 2/28, 1/29 short, none of it
above 3.31%), and the worst case across every band lands at 2.28–3.77% — beside
the pooled path's own 3.37–5.28% (§13.3) rather than four times worse than it.

**Monotonicity is repaired only where the bounded search runs.** Same ladder
sweep — 15-minute steps from one block to 10 h over 160 random days at
n ∈ {13, 14, 16, 20}, 6400 steps — **20 violations before, 4 after**, worst
0.5565 → **0.1249** P̄-units. The fallback survives and so does its defect. All
four survivors are on it — **0 inside the bounded region**, which is what the
bound predicts and the only part of this the fix can claim — and every one sits
at 4.25 h or longer, where selection is worth ~0% (§21.1). The tight budgets
that used to break are clean.

Wall clock, on the pooled path the app actually calls (default pools,
`switchCost` 0.25, ms per solve, every row the probe measures):

| n\B | 1h  | 2h  | 3h  | 4h  | 6h  | 8h  | 12h      |
| --- | --- | --- | --- | --- | --- | --- | -------- |
| 12  | 1.6 | 1.4 | 2.2 | 2.9 | 4.2 | 5.7 | **14.5** |
| 13  | 0.1 | 0.5 | 2.1 | 0.1 | 0.1 | 0.1 | 0.2      |
| 14  | 0.1 | 0.5 | 0.1 | 0.1 | 0.2 | 0.1 | 0.2      |
| 16  | 0.1 | 0.9 | 0.1 | 0.1 | 0.1 | 0.2 | 0.3      |
| 18  | 0.1 | 1.5 | 0.1 | 0.1 | 0.2 | 0.2 | 0.4      |
| 20  | 0.1 | 0.1 | 0.1 | 0.1 | 0.2 | 0.3 | 0.6      |
| 25  | 0.1 | 0.1 | 0.1 | 0.2 | 0.3 | 0.4 | 1.0      |

No cell past n = 12 exceeds 2.1 ms, against the ~14.5 ms the unchanged n = 12
path already spends — and this runs inside a `$derived`, on every keystroke in
the budget field. Raising `EXACT_SUBSET_LIMIT` instead was the obvious move and
is the one that does not fit: the cost doubles per task, so 13 would be ~29 ms
and 15 ~116 ms on that same keystroke.

### Rejected — rank a candidate POOL and enumerate that

The first cut kept a fixed enumeration size by ranking tasks on their menu total
(Σ increments ≈ P̄(T*)) and enumerating subsets of the top 12. It is worse, and
measurably: at n = 14 above 5 h it went from 9/63 days short (worst 2.23%) to
**59/63** (worst **13.94%**), because a pool of 12 cannot express "fund all 14"
and a loose budget usually wants exactly that. Truncating the candidates trades
the regime that was already fine for the one it was meant to fix. The size bound
has no such failure mode — it never removes a task from consideration, only a
subset the budget cannot pay for.

### Reproducing the historical columns

Neither the "before" column nor the rejected variant is measurable from HEAD, so
both were re-measured against restored code on 2026-08-09 rather than quoted
from memory, and both reproduce exactly:

```text
before:   git show 28e2e16:src/lib/business/model/zenith.ts > src/lib/business/model/zenith.ts
rejected: replace the size bound with the pool ranking described above
then:     npm run probe -- scripts/subset-search-bound.probe.ts     (and git restore after)
```

That is what backs 34/33/43 days short, the 0.78/0.80/0.94% means, the 14.93 /
18.41 / 13.39% worsts and the 20-violation monotonicity figure above, and the
rejected variant's 59/63 and 13.94%. The one number NOT from this probe is
§21.1's selection/shape split, which has its own.

The two lines are not equally strong, and the difference is worth stating. The
`before` line is a command: anyone can run it and get the column back. The
`rejected` line is a description, so its column rests on a variant that was
hand-reconstructed from this section's own prose — reproducible in principle,
but only as faithfully as the prose is read. It stays a description because
committing dead code to keep a rejection auditable costs more than the
rejection is worth; the number it yields is the argument for the size bound
over the pool, not a load-bearing constant.

### Pinned in the suite

`zenith.test.ts`: the 14-task, 1 h, `switchCost` 0.33 day matches exhaustive
subset enumeration exactly (the 18.41% fixture); and a 14-task day's value is
non-decreasing across every budget from one block to 3.75 h — the top of the
bounded region at 14 tasks and `switchCost` 0.5, above which the property is
not guaranteed. The old
"falls back to greedy forward selection" test keeps its feasibility and
best-single-task floor, renamed for what it now guards. And the 13-task, 4 h,
`switchCost` 0.33 day with eight tasks already worked matches exhaustive
enumeration under the day's switch bill — the one fixture here that separates
this bound from the subset-only one, which no cold day can.

---

## 35. The plan cannot see the hours you already spent (2026-08-10)

The allocator solves a whole day from zero. At 8am that is the right question
and the plan is the answer to it. At 2pm it is the wrong question twice over:
the hours are partly gone, and they went into tasks that are no longer where
the plan left them. Nothing in `calculateDailyMetrics` reads worked hours, so
the plan at 2pm is the plan at 8am — correct by §11.8's rule, and silent about
the half of the day that has already happened.

The one lever a user has today is the budget slider (§14.2's neighbour), and it
re-solves **cold**: every task back at zero hours. So a task that has had three
hours poured into it is re-offered its `p₀` activation bonus — the largest
increment in any menu (§2) — and can be funded again ahead of work never
started. The slider makes the day shorter; it cannot make it _later_.

### The objective under a prefix

Let `hᵢ ≥ 0` be the hours already worked on task `i` (§18's 🪫 logs, summed per
task by `workedHoursByTask`). The remainder maximizes

```
  max  Σᵢ P̄ᵢ(hᵢ + tᵢ)     over the candidate set: every task except those
                          both completed AND logged (see "A checkbox is not
                          an hours instrument" below)
  s.t. Σᵢ tᵢ + (|S| − 1)·switchCost ≤ B − Σᵢ hᵢ,   S = {i : hᵢ > 0} ∪ {i : tᵢ > 0}
       Σᵢ wcᵢ·(hᵢ + tᵢ) ≤ cognitive pool
       Σᵢ wpᵢ·(hᵢ + tᵢ) ≤ physical pool
```

which is the same objective, the same three constraints, and the same block
lattice as §4 — only the origin moves. Concretely the block menu becomes

```
  Δᵢ(j) = P̄ᵢ(hᵢ + jδ) − P̄ᵢ(hᵢ + (j−1)δ)
```

**Exactness is untouched.** A prefix menu is a _suffix_ of the cold menu when
`hᵢ` is on the block lattice, so it is still positive and non-increasing, which
is the entire premise greedy marginal analysis rests on (Fox 1966; §4). Nothing
about the subset enumeration changes either. `hᵢ = 0` reproduces the cold menu
exactly, because `P̄(0) := 0` — so every existing plan is bit-identical and the
whole §4/§5.1/§34 apparatus is undisturbed.

Two behaviours fall straight out of the menu and needed no code of their own: a
started task stops re-collecting the `≈p₀` activation bonus, and a task already
past its own `T*` gets an **empty** menu, since the truncation at the first
non-positive increment now begins past the stopping point.

### The pools enter depleted, clamped at zero

Hours worked have already drawn on both reservoirs, at the same weights the
plan spends them at (`toPooledInputs`, R3 — the draw and the plan must not
disagree about what a task costs). So the remainder is solved against
`max(0, pool − Σᵢ wᵢhᵢ)`. The clamp is not defensive: an overrun day would
otherwise hand the solver a negative capacity.

A pool at zero funds nothing **that draws on it**, and that is the honest
answer rather than a degenerate one: a day that has spent its 4 cognitive hours
has spent them. It is not a dead stop, because the difficulty sliders allow
**0** on a single dimension (`task-form-fields.svelte`; `getEffectiveDifficulty`
clamps Eᵤ to [1,10] but the pool weight is the raw `dimension/10`), so a purely
physical task keeps a weight of 0 against the exhausted reservoir and stays
fundable — which is the right reading, not a leak. Only a day that has drained
**both** pools is offered nothing at all.

This is the first reading in the app that can reach `band.ts`'s above-100%
critical band, which allocator output could not (ROADMAP item 14 is the row
that will show it).

### The switch bill is the DAY's, not the afternoon's

This is the part that was wrong in the first cut, and the on-plan control is
what caught it.

The obvious accounting charges the remainder `(m − 1)·switchCost` for the `m`
tasks _it_ funds. Under a prefix that is a refund: a plan that abandons two
tasks the morning already worked pockets their switches, buys extra blocks with
them, and reports a higher `Σ P̄` for a day whose real switch count never
changed. Measured on days executed **exactly to plan** — half of every funded
task's own allocation worked, nothing finished — it manufactured a median
**+6.67%** over simply finishing the morning plan, against an expected ≈0. One
4-task, 6 h day is the whole mechanism:

| plan             | t1   | t2   | t3   | t4   | Σ    | switch bill  |
| ---------------- | ---- | ---- | ---- | ---- | ---- | ------------ |
| morning          | 1.75 | 1.75 | 1.25 | 0.5  | 5.25 | 3 × s = 0.75 |
| worked (half)    | 1.0  | 1.0  | 0.75 | 0.25 | 3.0  | —            |
| remainder, naive | 1.25 | 1.5  | 0    | 0    | 2.75 | 1 × s = 0.25 |

The naive remainder drops t3 and t4 and charges one switch — but the day ran
all four, so it owes three. It is spending 0.5 h it does not have.

The rule is therefore stated over the day's funded set: `S` above is
`already worked ∪ newly funded`, so **a task with hours on it is funded whether
or not the remainder gives it more**. `AllocTask.isStarted` carries the flag and
`bestPlanWithSwitchCost` computes its overhead from `|S|`; a task that was
worked and then ticked done never reaches the allocator as a candidate (the next
subsection is precise about which completions do), so `calculateRemainingDay`
charges those switches off the budget directly. With
`isStarted` false everywhere this is exactly `(m − 1)·switchCost` again, which
is why no cold plan moved. §34's size bound is quantified over that same
day-funded set, so the two stay consistent.

Under that rule the on-plan control reads **median 0.00%, mean 0.01%, p90
0.00%**, with the funded set differing from the morning plan's remainder on
**6 of 400** days (1.5%) — the residue is lattice rounding.

**The seam itself stays free.** Re-entering a task the morning started is not
charged an extra switch beyond its place in `S`. That was measured against the
alternative and is not merely the cheaper code: charging it reads median
**0.00%** / mean **−0.45%** against the morning plan where free re-entry reads
median **+0.34%** / mean **+4.23%**, and the two pick a different funded set on
76 of 400 days (19%). Charging twice for a task that simply continued is what
the union rule already exists to prevent.

### A checkbox is not an hours instrument

The candidate set is every task except those that are **both** completed and
logged. That second condition was missing from the first cut, which dropped any
completed task, and it is a second refund of exactly the shape above: a task
ticked done with nothing logged against it left the set, and its hours and its
switch went back into the budget for everyone else to spend — on the evidence of
a checkbox, which measures no hours at all.

The user-visible symptom is that the afternoon moves when nothing about the day
did. The reported day, which reproduces: three purely cognitive tasks at
(Mᵤ, βᵤ) = (6,7), (5,4), (2,2), `B = 4.25`, `s = 0.25`, default constants, so
the plan is 2 / 1.5 / 0.25. Work half an hour on the first and tick it done, and
the remainder offers 2.25 and 1.0. Now tick the **middle** task done without
logging anything against it: the last task jumps to 1.75, its own `T*` of 1.688
rounded up the lattice — a 45-minute gift sourced from a box being checked.

Priced over the same 400 days, the drop moved hours onto other tasks on **301 of
400** days (75.25%), median **0.50 h**, mean 0.61 h, p90 1.50 h, worst 5.00 h,
and it was a **net gain** on 297 of those 301 — a one-directional inflation, not
noise.

The fix is to leave such a task in the candidate set. It keeps drawing the share
the solve gives it, which is the day's presumption that it cost roughly what was
suggested; that share is solved but never reported, since it is an accounting
device and not a recommendation to work a finished task. The presumption is
sharper than it sounds: a task ticked done is one the user did, and the solve's
own allocation is the only unbiased estimate of its cost the model has. Zero is
the one value it is known not to be.

The property this buys is exact rather than approximate. Ticking an unlogged box
changes no input to the solve — same task list, same prefixes, same budget — so
**every other task's hours are identical before and after**, and the §11.8
invariant that the plan family already had now extends to the next-up family
too. Hours are the only instrument that moves either.

The alternative was to pin a presumed spend at the moment the 🪫 editor is
dismissed. Rejected: it makes the day's arithmetic depend on a UI event firing
(completion paths that never open the editor, an un-tick that has to withdraw
the pin), and pinning a number means persisting it, which is a schema change
(R8) for a quantity the solve already computes.

One case survives, and no presumption rule can close it: a task the solve funds
at **zero** — because the budget was too tight to offer it anything — is still
presumed free if the user does it anyway without logging. Only the 🪫 log
answers that one.

### What it is worth (measured 2026-08-10)

`scripts/prefix-replan.probe.ts`, seed `0x9e12ab`, 400 days, 3–7 tasks, budgets
{2,4,4,6,8}, default constants. Scored as `Σ P̄` over the **whole** day, prefix
included — scoring the afternoon's increment alone divides by a small number and
turns a few minutes into triple digits.

Every arm is trimmed to the **same** feasibility before it is scored (drop the
cheapest funded block until the budget, the day's switch bill and both depleted
pools hold). Without that the comparison is meaningless in the direction that
flatters this section: `Σ P̄` prices neither pools nor switches — they are
constraints, not terms — so an arm that ignores them outscores one that respects
them for free. §19 is the same trap one level down.

| against                         | median    | mean  | p90    | worst |
| ------------------------------- | --------- | ----- | ------ | ----- |
| a COLD re-solve (budget slider) | **1.76%** | 3.74% | 9.57%  | 0.00% |
| the MORNING plan's remainder    | **1.21%** | 4.33% | 12.89% | 0.00% |

It never loses, it changes the funded set against the cold solve on **179 of
400** days (44.75%), and the strongest number in the table is not in it: over
those 400 days the re-plan needed **0** feasibility trims, while the cold
re-solve needed 270 and the morning plan's remainder 359. The alternatives are
not merely worse, they are mostly **infeasible** — they spend capacity the
morning already burned.

For scale: §17's whole-day ϕ anchor is 0.074% and the per-task ϕ oracle that
killed ROADMAP item 6 was +0.09%, so the median here is ~24× the anchor;
defaulting the enjoyment slider costs 2.02% (ROADMAP item 15), which is the same
order. **These are well below the +5.8–7.8% the roadmap hypothesised**, and the
gap is the feasibility trim: an untrimmed comparison reproduces figures in that
band and is measuring the baselines' cheating, not this reading's value.

### Scope: a next-up reading, never a plan-family one

`calculateRemainingDay` is deliberately **not** part of `calculateDailyMetrics`,
for two independent reasons, either of which is sufficient:

- **Scope.** Twelve-plus readings are plan-family under §11.8, whose rule is
  verbatim "completing a task must not move them". Solving the plan from a
  prefix converts every one of them into a remaining-day reading — the exact
  defect §11.8 was written to fix, one input wider.
- **Cost.** A second solve inside that `$derived` doubles a computation that
  re-runs on every keystroke and slider drag: **12.4 ms** at n = 12, against
  0.3 ms at n = 7 (same probe). This is §14.2's rule, which keeps
  `budgetMarginal` out of the same place.

So it is a store-level `$derived` gated twice — on the viewed day BEING today,
and on today having any 🪫 hours at all — and it returns before solving when
there is nothing to re-plan, which costs **0.001 ms** and is every morning, i.e.
exactly when the day is being typed into.

It follows that `suggestedHours` is never overwritten with the remainder. The
two are **separate readings of the same row**, stacked in its one `Planned`
cell: the delta leads, reading "spend 45m", and the plan sits under it, reading
"plan 1h 45m", because at 2pm the actionable number is the one saying what to do
next. The plan answers what the day looks like as designed;
the delta answers what is left of it, and it is time to spend ON TOP of the
hours already worked — which is why they are not rendered as a was/now pair,
whose arithmetic would understate the day.

Neither line is phrased as a **comparison**, for the same reason. "45m more"
invites reading the delta as a movement of the plan printed beneath it, which it
is not — the two are on different bases — and the comparison only runs one way:
a task worked past its share leaves the others _less_, so no single word covers
both directions. Each line carries the label of the question it answers instead.

The delta is shown **only where it disagrees with the plan**, and the guard is
the _printed_ figure, not the raw hours — 1.7499 h and 1.75 h are the same "1h
45m", and comparing the numbers would put that repetition back on screen.

The reason is that this reading is global while the trigger for it is local.
Hours logged against **one** task re-plan **every** row, so without the guard a
single 🪫 log grows a second line on tasks nobody touched — and on a day whose
hours went where the plan asked, that line repeats the plan figure. It reads as
news, and its actual cause is nothing more than a drain log existing. The
information is in the disagreement, so that is what is rendered: spend the hours
as planned and the list keeps the shape it had all morning; overrun one task and
the rows it took the hours from say so.

This knowingly hides one case. Equality is not proof nothing moved — the delta
matches the plan both on a task nobody touched and on one worked 30m whose day
then grew by 30m, and the row is given no worked-hours input with which to tell
those apart. The second is suppressed along with the first. What is lost there
is only the fact that a re-plan happened, never an instruction: when the two
figures agree, the hours to spend next are the plan's, which is the figure the
row is already showing.

Completion is not an hours instrument — only a 🪫 log is — so ticking a box
moves neither reading.

### Where to pick up now (2026-08-10)

The remainder's per-row hours answer "how much", and the row order on screen is
the user's, not the model's. The one thing left to say is **which** row, so
`RemainingDay.nextTask` carries position 1 of the run order over the funded
remainder, rendered on the list card's header row.

It is **labelled, never recomputed**. The tempting definition is
`argmax Δᵢ(1)` — the task whose first remaining block is worth most — and it is
not the same task: the allocator picks a funded _subset_ under a switch bill and
two pools (§4), so the block it actually buys next can belong to a task whose
single best increment is not the largest. Two definitions of "next" would be
free to disagree on screen, which is what R3 exists to prevent, so this is
`calculateInterleavedOrder` — the same sequencer behind the `#N` badges and
burnout's block sequence — run over the remainder instead of the plan.

The set it sequences is `hoursByTask`, not the candidate set. A task ticked done
without a log keeps an accounting share (above) that is deliberately never
reported; naming it would send the user back to work they just finished.

**The alternation has no memory of what was just worked.** §16's heuristic
contrasts each task with the one _before it in the sequence it is building_, and
it builds from an empty slate, so position 1 has no predecessor — the line can
open with cognitive work a moment after the user logged three hours of it. This
is not new and it is not the re-plan's: the morning `#N` badges have the same
blind spot, and there it is hidden by the sequence being read whole, where the
previous task is the row above. The instrument to fix it exists — a 🪫 log
carries a task id and a timestamp, so "the nature of the last logged session" is
available — but §16 settled that run order stays the nature-alternation
heuristic, and its measured worth is a median 0.47% of the day. Conditioning
position 1 on the last session is a change to that heuristic and would need
§16's probe re-run, not a patch here.

It never says **stop for the day**. The classic objective prices no leisure
(§14.1), so it has no opinion on whether the next block is worth taking at all —
only on where it goes if it is taken. Day-ending is λ₀'s question and the stop
advisor's (§8.10, §8.11), which is a different reading on a different screen.

### What the day has already spent (2026-08-12)

The pools enter the re-plan depleted by `Σ wᵢhᵢ` (above), and that draw is a
reading in its own right — the one Human Capacity structurally cannot give.
`RemainingDay.capacity` reports it: the pool the worked hours load hardest and
the share of it spent.

Nothing here is a second computation. The binding pool is
`calculatePoolSaturation`, which is what §20 decides Human Capacity's axis with —
the same weights `wᵈ = difficultyᵈ/10` and the same exact-before-rounding tie.
Two definitions of "what is left of your capacity" would be free to disagree on
one screen (R3).

**The two readings differ in scope, not in arithmetic.** Human Capacity is
plan-family (§11.8): it saturates at 100% because the allocator enforces the
pools, so its critical band above 100 is unreachable from allocator output. This
one is next-up and its hours are the user's own 🪫 logs, which no constraint
bounds — a day worked past its pool reads over 100% and nothing left. The pool
it names can differ from Human Capacity's for the same reason Primary
Bottleneck's does (§23.1): one describes the day as designed, the other what has
actually been spent.

**The reading is a share, never a duration (2026-08-12).** The row first showed
`max(0, poolᵈ − Σ wᵢᵈhᵢ)` — the clamped pool the solve already builds — formatted
as hours and minutes. It is a weighted quantity wearing clock-time clothes: an
hour logged on a 2/10 task spends 12 minutes of pool, so a user who logged an
hour watched "Capacity Left" fall by twelve minutes and could not reconcile the
two numbers, every other duration on that screen being real time. So the row
reads `max(0, 100 − spent)`, which carries the same information given the pool
size the tooltip states, in a unit that cannot be subtracted from a log. The
overrun above 100% is carried by the percentage the display bands on; the value
itself floors at 0%, because an overrun day has nothing left, not less than
nothing.

### Pinned in the suite

`zenith.test.ts`: a zero prefix reproduces the cold plan exactly; a task worked
past `T*` is offered nothing; two identical tasks, one started, send the scarce
block to the untouched one; and the single-task prefix plan matches exhaustive
enumeration over the lattice.

`remaining-day.test.ts`: the reading is null before any hours are logged
(including after a task is merely ticked done); a completed task that was
**logged** leaves the candidate set while its hours still spend the budget and
the pools; ticking an **unlogged** task done leaves every other task's hours
untouched to the digit; an exhausted pool funds nothing; and
`worked + planned + (|S| − 1)·switchCost ≤ budget` holds on a binding budget for
both the open and the ticked-done halves of `S`. For `nextTask`: it is null when
the remainder funds nothing, it is never a task outside `hoursByTask` (the
ticked-done accounting share included), and a task worked just past its own `T*`
stops being named while still leading the morning order. For `capacity`: the
draw is at the plan's own weights and names the pool it loads hardest, a logged
task ticked done still counts against the pools, and a day worked past its pool
reads over 100% spent.

`metric-descriptor.test.ts`: the burn-down row reads N/A before the first log of
the day and on a 0-hour pool carrying a draw, reads the share left rather than a
duration, and bands a day worked past its pool critical at 0% — the band no
plan-family reading reaches.

`daily-plan-store.svelte.spec.ts`: logging hours moves **no** plan-scoped metric
— ROADMAP item 12's own kill criterion, at the layer where §11.8 is decided —
and the reading stays null on a day that is not today even while today's own
logs exist.

## 36. What a correction may touch (2026-08-10)

Every measurement freezes the covariates it was taken under: ⚡ stores
`difficulty`, `enjoyment` and the mapped `(E, β)`; 🪫 stores the reservoir demands
`(wc, wp)`; ☕ stores no covariate at all, being five numbers the user typed. §8.7
says why — "so later slider edits don't rewrite past measurements" — and §5's ϕ
fit reads `(E, β)` off the record for the same reason.

Both task-bound kinds also copy the task's `taskTitle`, which is **not** a
covariate and is not protected by this section: no fit reads it, it is the row's
label, and freezing a label only means printing a name the task no longer has.
So the history names a measurement by what its `taskId` is called now
(`analytics-store`'s `taskTitles`, a fold over the year of days it has already
loaded) and falls back to the record's copy for a task that has been deleted or
has aged out — the one case where the frozen name is the only name left. The
record is never rewritten for a rename, so a title that drifted before
2026-08-11 reads correctly too.

**The defect.** Every correction path re-derived those frozen fields from the
task **as it is now**, which is that same rewrite by another route. Raise a
task's `mentalDifficulty` from 5 to 8 on Friday, then fix a typo in Monday's 🪫
`hours`, and Monday's `cognitiveDemand` silently becomes 0.8 — so §8.7 fits α
against a demand that was not in force during the session it measured. ⚡ had it
worse: `logFlow` re-derived `E` and `β` on every amendment, so correcting a
measured 25 min to 30 min also re-priced the point the ϕ fit reads it as — and so
did re-submitting the same number.

**The rule.** A correction rewrites the quantities the user rated and nothing
else — ⚡ its `phiHours`, 🪫 its `hours` and two drain ratings, ☕ its `hours` and
four ratings. The `date` and the original `createdAt` already stood (§18); the
covariates now stand with them. A **new** log is still derived live, because
that is the moment the covariates are being observed.

The rule is about the **correction**, not the address it arrived by, so it binds
the row's writer as much as the record's: `logFlow` still reads the day's task,
but only for the covariates of a measurement that has none yet — with a record
for `(taskId, date)` it carries that record's forward. Otherwise the ✎ on
`/analytics` and the ⚡ badge on a task's row would price the same correction two
different ways.

**What it buys, beyond correctness.** A correction that derives nothing needs
neither a viewed day nor that day's task, so it is addressable by record id
alone. That is what let the analytics history grow a ✎ per row: it lists every
day at once and therefore views none of them, and a task deleted since is no
longer an obstacle to fixing a measurement it produced. ☕ gained a correction
path for the first time on that account — it has no task, hence no row on either
screen, so the history is the only surface that can offer one.

**One writer per address, and they are not interchangeable.** 🪫 and ☕ correct
through `$updateDrainObservation` / `$updateRestObservation`, keyed by record id;
⚡ has both, because a task's row can only address a measurement as
`(taskId, date)` while the analytics list can only address it as a record. The
by-id path is a real `$updateFlowObservation` and **not**
`$createOrUpdateFlowObservation` with the record handed back to it: those differ
exactly when the record has been deleted since the list read it (another tab, or a
✕ the click raced), where the create-or-update's not-found branch inserts
it again under its own id with a fresh `createdAt` — resurrecting a dropped
measurement into the fit and falsifying the one time-of-day instrument the data
carries (§8.3).

**Pinned in the suite.** `energy-observation-store.svelte.spec.ts`: a 🪫
correction sends exactly `{hours, mindDrain, bodyDrain}`, and lands even when the
viewed day holds no such task; a ☕ correction sends its five fields on the day
it was taken. `session-store.svelte.spec.ts`: the row's correction keeps the
record's `(E, β)` against a task that has since changed, a first measurement
derives them, and `editFlowLog` sends only `phiHours`. The three repository tests
are the other half — each edit keeps its day, its stamp and its covariates, and
no-ops on a missing id, with ⚡'s pinning that a deleted record stays deleted. The
types close it: `$updateDrainObservation` takes
`Pick<…, 'hours' | 'mindDrain' | 'bodyDrain'>` and `$updateFlowObservation` takes
`Pick<…, 'phiHours'>`, so re-capturing a covariate is a type error rather than a
convention.
