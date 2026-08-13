# Model layer — invariants and settled decisions

Pure functions only. Full derivations live in [MATH.md](../../../../MATH.md) —
read the section, not the file (its `## Section index` gives line ranges).
`zenith.test.ts` is the executable spec (closed forms vs. numeric integration,
root equations, allocator vs. brute force). Do not change these without reading
the derivation first. Read with the root [AGENTS.md](../../../../AGENTS.md).

## R7 — Math changes go in MATH.md, in the same change

`MATH.md` is the spec; the code is the implementation. If you change a formula,
a constant, a bound, or a fit's conditioning:

1. Update the relevant `MATH.md` section **in the same commit**.
2. Cite the section from the code comment (`// MATH.md §8.7`) so the two stay
   findable from each other.
3. If only the _explanation_ was wrong and the model did not change, log it in
   MATH.md §10 (doc-only revision log) — do not imply a model change.
4. Never "fix" the code to match `zenith.md`. The implementation deliberately
   deviates from the article; MATH.md §6 lists how and why.
5. If you added or moved a section, run `node scripts/math-index.mjs` — never
   retype a row of the section index. Its ranges are a fixed point (the index
   sits above what it indexes, so a new row shifts its own numbers) and its
   columns have truncation rules that are invisible in the output.
   `npm run lint` fails on a stale index.

## Zenith model (`zenith.ts`, model v2)

- User inputs are 1–10; the model maps difficulty Eᵤ∈[1,10]→E∈[1,5] and
  enjoyment βᵤ∈[1,10]→β∈[1,2]. Metrics comparing E against β must account for
  the asymmetry (some deliberately use raw values instead).
- Productivity curve: `p(t) = (a·kt + p₀)·e^(−kt)`, `k = (1−p₀/a)/ϕ`, so
  `p(0) = p₀` genuinely holds; peak at `t = ϕ`, value `a·e^(p₀/a−1)`. The ratio
  `r = p₀/a` is capped at 0.9 (`AMPLITUDE_RATIO_CAP`).
- The single-task optimum is **per task**: `T* = ϕ·x*(r)/(1−r)` where `x*(r)`
  solves `eˣ = 1 + x + x²/(1+r)`; the multiplier ranges over [1.5194, 1.7933] —
  1.5 is the r → 1 asymptote and `AMPLITUDE_RATIO_CAP = 0.9` forbids it.
  `OPTIMAL_PHI_MULTIPLIER` (1.7933) is only the r→0 limit / upper bound (and
  the energy model's seed) — use `findOptimalSingleTaskTime` for real values.
  `TaskAllocation.optimalHours` is the ϕ-uncertainty-hedged optimum and is free
  to fall **below** that band: every user carries a posterior from day one, so
  on the zero-log posterior 23 of the 100 slider pairs land under 1.5194ϕ and 6
  under ϕ itself, bottoming at 0.7219ϕ (§5.1). The other 77 do sit in the band
  — but nothing holds them there, so no copy may quote it. The allocator never
  assigns time meaningfully past a task's `T*`.
- The objective is `Σᵢ P̄ᵢ(tᵢ)` — a sum of average productivity _rates_, not
  total output. `P̄` jumps from 0 to ≈`p₀` at `t = 0⁺` ("activation bonus"), so
  the objective is **not concave** — Lagrange/KKT solvers are invalid here. The
  allocator works on discrete 15-minute blocks (`BLOCK_HOURS`): greedy marginal
  analysis (exact for the single budget), exhaustive funded-subset enumeration
  for switch costs (exact, n ≤ 12; past that, bounded to the subset sizes the
  budget can fund — still exact wherever it fits, §34), plus a
  resource-transfer pass when a capacity pool binds (near-exact heuristic).
- Allocated hours are exact multiples of 0.25h; budget below one block is left
  unplanned. There is no 0.01h rounding step.
- `ϕ = c₁E + c₂β + c₃`, floored at 0.1h. Constants are personalized by
  `fitUserConstants` — a Bayesian linear regression whose MAP equals the old
  ridge fit, plus posterior covariance/noise (`phiPredictionStd`). The
  allocator consumes the MAP; the posterior makes it hedge ϕ-uncertainty
  (§5.1). ⚡ logs are **recency-weighted** by a 365-day half-life on the log's
  own date (§5.2), so every caller passes `ageDays` and the card reports an
  effective count, not a log count. The three energy fits (r, α, λ₀) are
  deliberately **not** weighted — §5.2 says why, and says to revisit them
  together or not at all.
- **A plan for day D is fitted from logs dated strictly BEFORE D** (§33). The
  constants are global, so one ⚡ re-times every task on the page — 33% on a
  task the user never logged, 75% of it on the very first log — and landing
  that on the day already in flight reshuffles a plan mid-execution. Applies to
  every **identity** fit (c₁c₂c₃, α, r, λ₀) and to **none** of the **state**
  reads: `simulateReservoirs`, the §11.9 carry-over and the §8.11 advisor take
  today's logs immediately, because a gauge of the present that ignored them
  would lie. `ageDays` runs against the planned day, not the live one. Any UI
  that prints a log count must print the **counted** one and name the deferred
  ones separately, or the ⚡ button reads as broken. History obeys the same rule
  by **reading** §12.1's stored `fitSnapshots` per day rather than refitting:
  `readDaySummaries` scores each day under the fit recorded on it, and falls
  back to the live fit only for a day that has none.
- Three constraints: the time budget plus cognitive/physical capacity pools
  (task weight = dimension difficulty / 10). Context switches cost `switchCost`
  hours — attention residue, distinct from ramp-up, which ϕ already prices —
  and are charged only between tasks that receive time.
- **A plan may be solved from a PREFIX of hours already worked** (§35): each
  task's block menu continues from `hᵢ` instead of from zero, the pools enter
  depleted by `Σ wᵢhᵢ` clamped at 0, and the switch bill is charged over the
  **day's** funded set `{worked} ∪ {newly funded}` — a plan that abandons a
  started task does not get its switch back. `hᵢ = 0` everywhere is
  bit-identical to the cold solve, which is what keeps §4, §5.1 and §34
  undisturbed. It feeds ONE next-up reading (`calculateRemainingDay`) and must
  never reach `calculateDailyMetrics`: that would rescope every plan-family row
  (§11.8) and double a per-keystroke `$derived` (§14.2's cost rule).

## Energy model (`zenith-energy.ts`, `/energy` only)

Standalone by design: shares the curve/ϕ machinery with `zenith.ts` but none of
its allocation code, so the main page is unaffected by changes here.

- Objective is `Σ_tasks V(task's daily output)`, not `Σ P̄` — total output per
  task through the concave satiety wrapper `V(O) = κ·ln(1+O/κ)`,
  `κ = satietyScale·(that task's reference single-session output)`. Satiety
  breaks winner-take-all (re-running the best task always beat switching); it
  must key on cumulative **output**, never on session phase, which decays over
  gaps and could be gamed with breaks. `satietyScale ≤ 0` recovers pure total
  output. The objective is only well-posed with its stopping terms:
  `freeTimeValue` (per hour not worked) and `terminalEnergyValue`
  (end-of-window energy). Fatigue alone never leaves the end of the window idle
  — it only produces instrumental mid-day rest. §8.4 lists rejected satiety
  forms.
- Warm-up `p(s)` uses a per-task session phase with **decaying carryover**:
  leaving a task for a gap `g` and returning resumes at `s·e^(−g/τ)`
  (`resumptionTimeConstant`), not 0. `normalizeSchedule` merges adjacent
  same-task blocks. Fragmentation stays costly (probe-verified), just not the
  old hard-reset cliff.
- Reservoirs follow `dC/dτ = −α·w·C + r'·g·(1−C)` with recovery gate
  `g = 1−(1−b)·w` (`b = microRecoveryFraction`, default 0.05) and
  `r' = recoveryRate·restRecoveryMultiplier` — closed-form exponential per
  block, no ODE solver. The gate keeps a full-demand (w = 1) task above the
  floor `b·r'/(α+b·r')` instead of draining to zero; without it there is no
  basal floor at all (the 2026-07-14 "demand 10 vs 9.5 flips the plan" cliff
  does not reproduce under today's search — §8.5). A `(1−w^q)` gate does **not**
  fix this (still 0 at w = 1, probe-verified) — don't re-propose it. `b = 0`
  recovers the pure `(1−w)` gate. §8.5.
- Output gate is Cobb-Douglas: `C_cog^wc · C_phys^wp`, demands
  `w = dimensionDifficulty/10`. Block output uses composite Simpson with 16
  nodes per fastest timescale (min of ϕ, 1/ρ), **capped at 1024 nodes** — so at
  the 0.1h ϕ floor the density falls once a block exceeds 6.4h: relative error
  is ~3e-7 up to 6h, 6.9e-7 at 8h, 1.7e-6 at 10h, 3.5e-6 at 12h and 5.6e-5 in a
  24h block (`scripts/enb-simpson-error.probe.ts`). Under default constants
  (min ϕ = 0.58h) the cap never binds.
- The optimizer is a deterministic multi-seed steepest-ascent local search over
  (task|rest, duration) block schedules: not slot-greedy (myopic, never rests),
  not full DP. Pure single-step moves strand ~1% of the objective and can
  return the wrong plan **structure** — hence the compound moves (transfer
  between blocks, half-block reassign, T*-session insert) and drop-one classic
  seeds; keep those when touching the search. §8.6.
- **Calibration order is load-bearing** (§8.7/§8.9/§8.10). Recovery `r` is
  fitted first from ☕ pre/post-rest pairs — during pure rest the law loses α
  entirely, so rest data identifies `r·m` on its own. The α drain rates are
  then fitted **conditioned on that recovery**, which is what makes α
  identifiable at all; `recoveryRate` is _not_ identifiable from
  end-of-session ratings — don't try. λ₀ is fitted last, conditioned on
  everything else. Each fit is a 1-D ridge toward the **defaults**, not toward
  current inputs. Ratings with demand 0 carry no signal and are dropped.
- Both stop readings — the λ₀ fit (§8.10) and the live advisor (§8.11) — price
  the stop against `openTaskIds` only, a next-up-family scope (§11.8): a
  checked-off task is no forgone step, though its hours still drained the
  reservoirs and stay in the reconstruction. A day that ended with everything
  ticked reveals no indifference and is censored.
- A fit never writes params silently: the "Apply my fits" button copies it into
  the manual inputs. **One** button for all four fits, beside the Model
  Parameters heading, because the order above is the math — three per-card
  buttons let the user apply α before r, which adopts an α fitted against the
  old recovery and leaves it stale with only a re-armed button as the tell.
  `EnergyLabStore.applyFits()` is the only public way in; the per-fit setters
  are private so that order cannot be reached.

## Settled decisions — do not re-litigate

Each was considered and decided; most were measured. Re-deciding them is churn.

### The day's plan is solved once per `calculateDailyMetrics`

The allocator dominates dashboard cost (2ⁿ funded-subset enumeration, ~51 ms at
n = 12) and used to run **twice** on identical inputs: the plan, then Zenith
Gain's optimized side. `calculateTaskPlan` returns the plan plus its
`allocatedHours`, and `calculateZenithGain` takes them — halving the dashboard
`$derived` (which re-runs on every keystroke in the budget field) and the plan
advice with it (MATH.md §14).

The hours are passed in **input order**, and that is not cosmetic: hours are
paired to tasks **by index** all the way down
(`calculateTotalProductivity`), so the priority-sorted array would charge each
task the time of whichever task outranked it. `pooledProductivityGain`
therefore checks the length and re-solves rather than trusting a mismatched
array — index-pairing turns one missing entry into a NaN optimized sum, i.e. a
rendered "NaN%". A test in `daily-metrics.test.ts` asserts the gain equals what
a self-solving `calculateZenithGain` reports, on a **reversed** task list — the
one fixture shape that can catch a mix-up, because priority is intrinsic and
the other fixtures happen to plan in input order.

### `buildCurves` is built once per search or fit

2026-08-01: the optimizer and the stopping fit thread one curve map through
every evaluation (`evaluateWithCurves`); public `evaluateSchedule` still builds
its own. Hoisting measured 2.6× (104 → 40 ms on a 4-task/8h solve).

### `zenith.ts`, `zenith-energy.ts` and `session-store.svelte.ts` are not worth splitting

A 2026-07-23 interface analysis ran the arithmetic over every proposed split:
each would force currently-private helpers (`amplitudeRatio`,
`phiQuadratureNodes`, `reservoirLaw`, date-routing state) into cross-module
exports — more surface, not less. Two seams were worth cutting and are cut:
generic 3×3 linalg → `linalg.ts`, and the drain/rest measurements →
`energy-observation-store.svelte.ts`.

**The first two are deep; `session-store.svelte.ts` is not, and the decision
does not rest on that.** It stands behind **39 public members** — 1 per 27
lines, against ~1 per 51 in `zenith.ts` — a wide facade, so size was never the
argument either way. What the arithmetic prices is the split, not the module.
**Re-measure rather than quoting these numbers** (2026-08-13; 34 of the 39 were
single-caller on 2026-07-23, when the same 39 sat behind 675 lines).

### The energy model is a peer mode, not a candidate to replace the main plan

Settled 2026-07-29, MATH.md §15. A 300-day cross-scoring probe: each model
beats the other by tens of percent **on the other's objective** (classic wins
`Σ P̄` on 283/300 days, energy wins its own on 298/300). The 17 exceptions are
plans the pooled allocator is forbidden to emit, so neither allocator is
defective. No evidence can rank them; §12's audit is a descriptive signal, not
a promotion gate. The user-facing difference the probe does establish: classic
spreads (3.96 tasks/day), energy concentrates (1.97, and **never more** on
0/300 days). Keep both routes.

### Run order stays `calculateInterleavedOrder`'s nature alternation

Settled 2026-07-29, MATH.md §16. `Σ P̄` is order-invariant, so only the energy
model scores order at all — and under it the heuristic is a median 0.47% below
the best ordering of the same allocation (p90 1.50%). Holding the allocation
fixed bounds any order-only change, the solver's included. The swap is also
actively harmful to one metric: the objective-maximizing order is uncorrelated
with drain (§8 charges no cost for it), so it moves Burnout Risk by >5 points
on 30% of days in no consistent direction. Do not re-open without a reason that
isn't "the optimizer should beat the heuristic".

### ϕ stays one plane for all tasks — no per-task offsets

Settled 2026-08-04, MATH.md §17. Hierarchical partial pooling `ϕ = c·x + δ_task`
fits fine and cuts held-out ϕ error 23–37%, but it buys **+0.09%** of plan
value — because the oracle that knows every task's true ϕ is itself worth only
+0.16%. `P̄` is flat at `T*`, so ϕ error costs `O(ΔT²)`: **half an hour of
per-task ϕ error costs ~0.3% of the day** (§17 has the table — price any
per-task-ϕ proposal against it first). It also costs: 64–79% of logged titles
carry one log, so δ absorbs stopwatch noise and the displayed ϕ gets 68–98%
worse for users with no per-task structure; a never-logged task's σ_ϕ rises
0.058 → 0.259 h, which §5.1 turns into a permanent demotion of every task the
user hasn't logged; and the grouping key would have to be the free-text title,
since `nextTaskId` gives each day's instance a fresh id. Re-open only with real
logs showing `Σδ̂²` above the 0.25 h noise floor **and** a habitually ≤2 h budget.

### `PHI_UNCERTAINTY_RELATIVE_CAP` stays 0.5 — do not lower it to 0.35

Settled 2026-08-06, MATH.md §5.1. §5.1 records that the cap does not exclude
everything it claims to: bimodality and truncation loss start at σ/ϕ̂ ≈ 0.35, not
0.5. Tightening it is the obvious repair and the wrong one. A real fit cannot
reach the gap — the ridge's λ = 4 anchor shrinks ϕ̂ exactly when σ is large, so 0
of 576 000 fitted cells land in it, and the 5 of 28 800 that extrapolation
reaches forfeit 0.0000% (`scripts/phi-cap-reachability.probe.ts`). Lowering it
would clamp 1.23% of realistic cells and hedge them LESS, worth up to +6.809%
of conjured value for the few-log users the posterior exists to protect.

### Human Capacity is unclamped

It may read over 100%, and the band above 100 stays even though the allocator's
own plan cannot get there (0 of 3000 probed days; 44.1% touch ≥ 99%,
MATH.md §20). The reading is the share of §4's capacity constraint the plan
consumed, on the allocator's own weights — so which pool it BLAMES is decided
on the exact saturations, never the rounded ones (§20.1).

### Burnout Risk is not monotone in the declared budget, and that stays

Settled 2026-08-06, MATH.md §11.6. Raising `availableHours` over a fixed task
list makes the reading FALL on 3006 of 37800 probed steps, worst 29 points
(`scripts/burnout-risk.probe.ts`). Not a bug in the metric: the larger budget
funds more tasks, and their switch gaps are real rest, so the simulated day
contains less work. Documented rather than smoothed — holding the funded set
fixed while walking the budget would report a plan the user is not being shown.
Do not "fix" the fall.

### The advisor ranks, it does not judge

It reports every axis unconditionally with a lower-is-better badness function;
whether a reading is bad enough to act on is the band
([presentation's](../../presentation/AGENTS.md)). Options per axis are the
Pareto frontier on (improvement ↑, plan value ↑) so there is no weight λ to
defend — see MATH.md §14 for why "the single biggest improvement" is bad
advice. **Unconditionally includes the axes nothing improves**: one finding per
axis, empty menu and all (MATH.md §14.4). Filtering those out in the model is a
presentation decision taken where the bands are not visible, and it made an
unfixable warning — Energy Balance on a day of nothing but cognitive work —
indistinguishable from a day with no warning on it, which the card then called
fine. The card says the empty menu out loud instead.

### A budget _increase_ never enters that frontier

MATH.md §14.1. Σ P̄ prices deferring and trimming in full, but it does not price
the extra hour — and Σ P̄ is monotone in the budget at the true optimum (§34's
fallback can invert it), so a `budget + 1` inside the frontier out-values every
defer and dominates the entire menu down to "work more". `plan-advice.ts`
splits the candidates with `isPriced` and returns the increase as
`AdviceFinding.unpriced`, which the card renders last and labelled in hours. Do
not merge the two lists back together.

### The budget levers carry unrounded hours

MATH.md §14.1. Rounding `budget − planSlack` to quarter-hours trimmed past the
hours the plan actually spends, so the trim stopped even being feasible. The
card has no Apply for `set-budget`, so there is nothing to align the hours to —
the descriptor rounds the **label**, never the lever. The trim is **feasible,
not free**: `allocate` is path-dependent on `budgetBlocks`, so on a pool-bound
day the re-solve can land up to a measured **−0.9%** below the plan it trimmed
(MATH.md §14.1-2, `scripts/plan-advice.probe.ts`). Do not clamp that to 0 — it
is a plan the allocator really produces, and §14.1-3 forbids showing a real
difference as costless.

### The budget's shadow price is a day-level reading, not a per-task column

MATH.md §14.2. `PlanAdvice.budgetMarginal` re-solves at `budget + BLOCK_HOURS`
and reports what that block adds plus which task takes it. **Both halves are
open-scoped** (§11.8): the allocator is blind to `completed`, so the
plan-scoped reading named an already-ticked-off task as the recipient of the
next 15 minutes, worth up to +33.4%. `recipient: null` means a wider budget
buys no remaining work, and says nothing about why — a bound pool, tasks near
their stopping times and a block landing on finished work look identical from
one solve.

Do not re-propose the per-task column: the reason originally recorded for
rejecting it (marginals equalize, so a column degenerates) is **false and
measured false**; the two that hold are that no user lever corresponds to a
per-task entry, and that the column is arithmetic on a curve that ignores the
pools and the switch cost, overstating the budget's yield on 63% of probe days.
It lives in `suggestPlanAdjustments`, not `calculateDailyMetrics`: the latter
runs in a `$derived` on every keystroke and every slider drag, where a second
solve doubles dashboard cost.

### The switch cost is instrumented but never advised

2026-08-04, MATH.md §14.3. MATH.md §14 rules `switchCost` and the pools
"measurements of the user, not choices about the day" — that excludes them as
levers and, by the same sentence, licenses them as instrument targets.
`PlanAdvice.switchCostPrice` reports the `(m−1)·s` hours the plan reserves over
**funded** tasks, that as a share of the budget, and Σ P̄ re-solved at `s = 0`
and `s = 2s`. Declaring it 2× too high costs a measured **8.47%** of plan value
on a 2–4-task day (18.77% at 5+ tasks), against 0.16% for the ϕ oracle. Four
things it must keep, three of which invert the bullet above:

- **Plan-scoped, not open-scoped**, because it is compared against
  `planValueOf`, which is built from the whole task list (§11.8). Restricting
  one side to open work reports a difference that is mostly the scope change.
- **Clamped per arm, never floored.** The exact optimum is monotone
  non-increasing in `s`, so a lower declaration reads only ≥ 0 and a higher one
  only ≤ 0; the opposite sign is §13.3 suboptimality, not the day. Inversions
  are reachable and large — 112 over 71,520 UI-grid configurations, worst free
  arm **−6.53%**, worst doubled arm **+1.36%**, and 40 of them without touching
  `s`. Their magnitude is **not** bounded by §13.3's "worst 0.09%", which is a
  single-draw maximum. Do **not** replace this with §14.2's floor: that zeroes
  the doubled arm on 284 of 596 fixture alternatives, the arm that says
  over-declaring is the expensive direction. Tests pin both a symmetric floor
  and an inverted clamp.
- **Read through `calculateZenithGain`**, not by summing `avgProductivity` over
  the returned plan. The plan comes back priority-sorted, so the same terms add
  in a different order and land a few ulps off `planValueOf`.
- **The copy stays conditional** — "if your switch cost were X, this plan would
  read Y". It reports plan value _under a declaration_, never the cost of
  mis-declaring, which would require knowing which value is true. The two even
  differ in sign: planning as if switching were free raises reported value,
  while switching for free-that-isn't lowers realized value.

It gets no `AdviceLever`, no axis, no frontier entry and no Apply button, and
must not be wired to suppress anything. Do not re-propose **fitting** `s` from
the observed funded-task count: `m(s)` is not monotone (195 violations on 115
of the 298 fixture days × 101 `s` values), a one-day bracket is a median 0.50 h
wide against a [0,1] h range, and one mis-counted task moves the bracket edge
0.34 h.

### `mustDoToday` promises the day, not the hours

MATH.md §14. The flag only removes a task from the defer candidates; the
allocator never sees it, so a flagged task can still be funded zero.
`suggestPlanAdjustments` therefore **partitions** the unfunded read —
`unfundedMustDoTaskIds` beside `unfundedTaskIds` — and the card gives it its own
warning-coloured line, because the plain unfunded sentence reads as something
the menu below can fix and for these tasks there is no lever left. The badge is
worded "Stays today" and the checkbox "Don't move off today" for the same
reason: "Must do" beside `0m` reads as a promise the model never made.

### The productivity curve deviates from the source article on purpose

MATH.md §6.
