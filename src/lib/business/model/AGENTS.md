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
3. If only the _explanation_ was wrong and the model did not change, fix the
   explanation in place. There is no revision log to append to — git holds the
   history, and a log of corrections is one more thing to keep in step.
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
  budget can fund — still exact wherever it fits), plus a
  resource-transfer pass when a capacity pool binds (near-exact heuristic).
- Allocated hours are exact multiples of 0.25h; budget below one block is left
  unplanned. There is no 0.01h rounding step.
- `ϕ = c₁E + c₂β + c₃`, floored at 0.1h. Constants are personalized by
  `fitUserConstants` — a Bayesian linear regression whose MAP equals the old
  ridge fit, plus posterior covariance/noise (`phiPredictionStd`). The
  allocator consumes the MAP; the posterior makes it hedge ϕ-uncertainty
  (§5.1). `SuggestedTask.flowStateTimeStd` is the row's predictive std for
  display — `phiPredictionStd`, not the allocator's hedging term — and absent
  without a posterior. ⚡ logs are **recency-weighted** by a 365-day half-life
  on the log's own date (§5.2), so every caller passes `ageDays` and the card
  reports an
  effective count, not a log count. The three energy fits (r, α, λ₀) are
  deliberately **not** weighted — §5.2 says why, and says to revisit them
  together or not at all.
- **A plan for day D is fitted from logs dated strictly BEFORE D**. The
  constants are global, so one ⚡ re-times every task on the page — 33% on a
  task the user never logged, 75% of it on the very first log — and landing
  that on the day already in flight reshuffles a plan mid-execution. Applies to
  every **identity** fit (c₁c₂c₃, α, r, λ₀) and to **none** of the **state**
  reads: `simulateReservoirs`, the carry-over and the §8.11 advisor take
  today's logs immediately, because a gauge of the present that ignored them
  would lie. `ageDays` runs against the planned day, not the live one. Any UI
  that prints a log count must print the **counted** one and name the deferred
  ones separately, or the ⚡ button reads as broken. History obeys the same rule
  by **reading** the stored `fitSnapshots` per day rather than refitting:
  `readDaySummaries` scores each day under the fit recorded on it, and falls
  back to the live fit only for a day that has none.
- Three constraints: the time budget plus cognitive/physical capacity pools
  (task weight = dimension difficulty / 10). Context switches cost `switchCost`
  hours — attention residue, distinct from ramp-up, which ϕ already prices —
  and are charged only between tasks that receive time.
- **A plan may be solved from a PREFIX of hours already worked**: each
  task's block menu continues from `hᵢ` instead of from zero, the pools enter
  depleted by `Σ wᵢhᵢ` clamped at 0, and the switch bill is charged over the
  **day's** funded set `{worked} ∪ {newly funded}` — a plan that abandons a
  started task does not get its switch back. `hᵢ = 0` everywhere is
  bit-identical to the cold solve, which is what keeps §4 and §5.1
  undisturbed. It feeds ONE next-up reading (`calculateRemainingDay`) and must
  never reach `calculateDailyMetrics`: that would rescope every plan-family row
  and double a per-keystroke `$derived` (the cost rule).

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
  the 0.1h ϕ floor the density falls once a block exceeds 6.4h: the probe's
  off-surface witness reads ~3e-7 up to 6h, 6.9e-7 at 8h, 1.7e-6 at 10h, 3.5e-6
  at 12h and 5.6e-5 in a 24h block, and every task the app can REACH at that
  floor stays under it — the box corner does not
  (`scripts/enb-simpson-error.probe.ts`). Under default constants
  (min ϕ = 0.58h) the cap never binds.
- The optimizer is a deterministic multi-seed steepest-ascent local search over
  (task|rest, duration) block schedules: not slot-greedy (myopic, never rests),
  not full DP. Pure single-step moves strand ~1% of the objective and can
  return the wrong plan **structure** — hence the compound moves (transfer
  between blocks, half-block reassign, T*-session insert), the drop-one classic
  seeds, and the pair seeds, each searched **within its pair** because a seed
  whose search may reach every task climbs back out of the two-task basin it was
  built for; keep those when touching the search. The pair family is capped at
  the four highest-amplitude tasks (`C(4,2)`) — unbounded `C(n,2)` costs an
  order of magnitude more at 15 tasks, because each pair seed starts
  fragmented and climbs long, so do not unbound it
  (`scripts/energy-search-gap.probe.ts`, which prices every cap and what each
  forfeits). §8.6.
- `neighbors` yields **every** interior lattice split of a funded block — one
  step of rest at unchanged worked hours — not the rounded midpoint alone:
  where a mid-session recovery pays for the warm-up it destroys is not the
  middle. That rest step comes out of spare `room`, never out of the block.
- The plan lattice is 45 minutes (`DEFAULT_STEP_HOURS`, §8.8), and the coarse
  and the fine (0.25 h) searches may fund **different sets**. The coarse plan is
  still the enumerated optimum of its own lattice, so a disagreement is
  quantization, not a search defect.
- **Calibration order is load-bearing** (§8.7/§8.9/§8.10). Recovery `r` is
  fitted first from ☕ pre/post-rest pairs — during pure rest the law loses α
  entirely, so rest data identifies `r·m` on its own. The α drain rates are
  then fitted **conditioned on that recovery**, which is what makes α
  identifiable at all; `recoveryRate` is _not_ identifiable from
  end-of-session ratings — don't try. λ₀ is fitted last, conditioned on
  everything else. Each fit is a 1-D ridge toward the **defaults**, not toward
  current inputs. Ratings with demand 0 carry no signal and are dropped.
- `capacityFromDrainRate` runs the reservoir law backwards at full demand: the
  hours at which a fitted α drains one reservoir to a shared floor, which is a
  capacity pool in hours. Its domain is a `CAPACITY_MAP_POLE_MARGIN` multiple of
  the pole `r′·b·(1−C*)/C*` — which MOVES with the recovery params, so no fixed
  α floor bounds it — and below that, or when those params hold the equilibrium
  at or above the floor, it returns **nothing**, never a clamped α's pool. It is an **instrument, not a planner input**: no allocation reads
  it, the pools stay declared, and what would have promoted it is a gate that
  `classicOverlap` cannot run (ROADMAP item 18). §8.13.
- Both stop readings — the λ₀ fit (§8.10) and the live advisor (§8.11) — read
  the day from the 🪫 rows' own log moments: one block per session, in log order,
  the space between them rest. Never re-sum the rows by task on the way in —
  doing that discarded the day's breaks. A day whose rows carry no usable
  moment, or were all written down at once, falls back to one contiguous block
  per task in canonical order, and that fallback must stay bit-identical.
  `fitStoppingValue`'s `unreadBreaksCount` reports how many of the days it USED
  logged two or more sessions and fell back this way — it reports, it never
  changes the reading.
- **The two stop readings answer the window question differently, on purpose**
  (M42, 2026-08-21). §8.10's fit CENSORS a day whose own span — worked hours plus
  the day's UNCAPPED recovered breaks — leaves no room for another step: the
  clock ended that day, so its stop is no evidence about λ₀, and
  `fitStoppingValue` reports how many days it dropped for it. §8.11's
  `window-full` still reads WORKED hours, because a verdict may not turn on
  recovered structure — but the session LENGTHS it prices are capped by the span,
  floored at one step, so the card never invites a session the day cannot hold.
  A day with no recoverable break has no span to read and keeps the worked-hours
  reading on both sides.
- Both stop readings price
  the stop against `openTaskIds` only, a next-up-family scope: a
  checked-off task is no forgone step, though its hours still drained the
  reservoirs and stay in the reconstruction. A day that ended with everything
  ticked reveals no indifference and is censored — and using its `λ₀ ≤ hi`
  reading instead makes the fit WORSE, measured 2026-08-21 (below).
- `STOP_INVERSION_MARGIN = 0.25` — the inversion past which a day is censored
  too — is **stipulated, not derived**: λ₀ fit RMSE is flat in magnitude over
  m ∈ [0.1, 0.5] (swept 2026-08-13), so neither the constant nor the
  inversion-censoring rule moves without evidence above the instrument's 0.134
  bracket half-width. The margin is a dead end.
- **Obligation is not read, and neither repair pays** (2026-08-28,
  `scripts/stop-obligation-bias.probe.ts`, MATH.md §8.10). The fit reads a day's
  hours as a leisure CHOICE, so a compelled day — a deadline ground past the
  rational stop — reads as cheap leisure and biases λ₀ DOWN, the direction that
  plans more work. No censor is aimed at it: such a day drops on the CLOCK when
  the extra work overran the window, almost never on inversion, so censoring
  costs days without protecting the fit. Both repairs were measured and lose to
  shipping nothing: pricing neither bracket side against the `mustDoToday` task
  damages the honest day (which is the majority) and censoring any day that
  worked a pinned task leaves consistent users with no fit at all. `mustDoToday`
  therefore still stops at the defer candidates — not the allocator, not the λ₀
  fit — and the contamination is stated in the card's hint instead of filtered.
- **The censored likelihood is a settled no** (built, measured and refused
  2026-08-21, MATH.md §8.10, `scripts/censored-stopping-fit.probe.ts`; re-read
  2026-08-25 on the app's constraint surface, which moved every figure and left
  the verdict further from the gate). Using the one-sided days instead of
  dropping them gains 0.0403 λ₀ RMSE on the cell the gate is set on — 36.7% of
  the 0.110 gate — and the category that motivated it, the day with every task
  ticked, is worse alone. `stopBracket` is what survives: the two sides, exported
  so a probe can read them instead of rebuilding the bracket, which the three
  older stop probes still do. Do not re-open without
  a bound that is tighter, not merely more numerous.
- A fit never writes params silently: the "Apply my fits" button copies it into
  the manual inputs. **One** button for all four fits, beside the Model
  Parameters heading, because the order above is the math — three per-card
  buttons let the user apply α before r, which adopts an α fitted against the
  old recovery and leaves it stale with only a re-armed button as the tell.
  `EnergyLabStore.applyFits()` is the only public way in; the per-fit setters
  are private so that order cannot be reached.

## History prefills (`budget-memory.ts`, `title-memory.ts`)

Pure folds over the stored days, read once at boot by the state layer
([business/AGENTS.md](../AGENTS.md)) — hours or a rating entered today do not
enter either fold until the next load.

- Only days that **declared** a budget count in the fold: a stored day the user
  never budgeted is not evidence of a habit, and folding those in drags every
  median toward the 0 the prefill exists to replace.
- The budget median takes the **lower of the two middles** on an even count, so
  the answer is always a number the user really declared.
- Prefill order is same-weekday median → overall median → 0.
- Title suggestions need at least `TITLE_QUERY_MIN` = 2 typed characters; the
  match is a **substring**, not a prefix, the order is alphabetical, and the
  list is uncapped — no ranking, no cap.

## Settled decisions — do not re-litigate

Each was considered and decided; most were measured. Re-deciding them is churn.

### The day's plan is solved once per `calculateDailyMetrics`

The allocator dominates dashboard cost (2ⁿ funded-subset enumeration, ~51 ms at
n = 12) and used to run **twice** on identical inputs: the plan, then Zenith
Gain's optimized side. `calculateTaskPlan` returns the plan plus its
`allocatedHours`, and `calculateZenithGain` takes them — halving the dashboard
`$derived` (which re-runs on every keystroke in the budget field) and the plan
advice with it.

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

Settled 2026-07-29. A 300-day cross-scoring probe: each model
beats the other by tens of percent **on the other's objective** (classic wins
`Σ P̄` on 284/300 days, energy wins its own on 298/300). The 16 exceptions are
plans the pooled allocator is forbidden to emit, so neither allocator is
defective. No evidence can rank them; the plan-adherence audit (`plan-audit.ts`)
is a descriptive signal, not
a promotion gate. The user-facing difference the probe does establish: classic
spreads (3.96 tasks/day), energy concentrates (1.95, and **never more** on
0/300 days). Keep both routes.

### Run order stays `calculateInterleavedOrder`'s nature alternation

Settled 2026-07-29. `Σ P̄` is order-invariant, so only the energy
model scores order at all — and under it the heuristic is a median 0.47% below
the best ordering of the same allocation (p90 1.50%). Holding the allocation
fixed bounds any order-only change, the solver's included. The swap is also
actively harmful to one metric: the objective-maximizing order is uncorrelated
with drain (§8 charges no cost for it), so it moves Burnout Risk by >5 points
on 30% of days in no consistent direction. Do not re-open without a reason that
isn't "the optimizer should beat the heuristic".

### ϕ stays one plane for all tasks — no per-task offsets

Settled 2026-08-04. Hierarchical partial pooling `ϕ = c·x + δ_task`
fits fine and cuts held-out ϕ error 23–37%, but it buys **+0.09%** of plan
value — because the oracle that knows every task's true ϕ is itself worth only
+0.16%. `P̄` is flat at `T*`, so ϕ error costs `O(ΔT²)`: **half an hour of
per-task ϕ error costs ~0.3% of the day** (price any per-task-ϕ proposal
against it first). It also costs: 64–79% of logged titles
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
own plan cannot get there (0 of 3000 probed days; 44.1% touch ≥ 99%). The
reading is the share of §4's capacity constraint the plan consumed, on the
allocator's own weights — so which pool it BLAMES is decided on the exact
saturations, never the rounded ones.

`calculatePoolSaturation` is the one definition of "which pool binds, and how
saturated is it" (R3): this row reads it over the hours the plan books and the
executed burn-down over the hours already worked, and neither re-spells
the tie rule — two spellings are free to name different pools off the same
inputs. The burn-down reading is **withheld, not defaulted**: no 🪫 log today,
or a non-finite saturation (a 0-hour pool carrying a draw), leaves the row
unread rather than printing a 0 or an `Infinity` — the gate already placed on
Human Capacity's own value.

### Burnout Risk is not monotone in the declared budget or the switch cost, and that stays

Settled 2026-08-06. Raising `availableHours` over a fixed task
list makes the reading FALL on 3033 of 37800 probed steps, worst 29 points;
walking the declared `switchCost` 0–60 m falls on 3603 of 7200 and rises on 402,
worst rise 33 points (`scripts/burnout-risk.probe.ts`). Not a bug in the metric:
either lever buys more switch gaps, and a gap is a demand-0 block recovering
both reservoirs at full `r′`. Less simulated work is often part of it but never
the whole of it — the fall reproduces with worked hours held fixed. Documented
rather than smoothed — holding the funded set fixed while walking the budget
would report a plan the user is not being shown. Do not "fix" the fall.

### Time Scarcity is not monotone either, in the budget or the task count

Settled 2026-08-25. Its switch bill is over the FUNDED set, so a
`BLOCK_HOURS` budget step that seats **k** more tasks bills `k·s`, and the reading
RISES whenever `Δm·s > BLOCK_HOURS`. From a 20-minute switch cost up one new task
clears that on its own: 2.5–4.1% of budget steps and 100% of probed days, worst
+19 points at 60 minutes. The default 15 minutes measured 0 of 19200 steps but is
**unprotected, not immune** — `Δm = 2` clears the block there too and the sweep
drew none; do not restate the zero as a guarantee. The count carries the same
seam reversed: a task that makes the plan seat FEWER tasks drops the bill by more
than its ϕ adds, and the reading falls on 0.19% of add-a-task steps, worst 13
points (`scripts/mtr-time-scarcity.probe.ts`). Same verdict as Burnout Risk's
fall, and `calculation.test.ts` pins the `s = 45m` witness, so smoothing it gets a
red build. Do not smooth either by billing the LISTED tasks again — that is the
defect that pinned the row at exactly 100 on 10.8% of days, where a 15-minute
day and a 90-minute one read alike.

### Priority is not monotone in difficulty, and that stays

Settled 2026-08-25, MATH.md §3. Swept over effective difficulty 1 → 10, `P̄(T*)`
rises to an interior local max at 1.12, falls to a trough at 2.27 — **9.53% below
the difficulty-1 value**, and β-free — and first regains it at 3.92; on the
integer sliders the worst a harder task falls below an easier one on the PRINTED
score is **1.7 points** (`m/p/e 1/0/10` prints 18.1, the harder `1/2/10` prints
16.4). The shape is the closed form `P̄/β = E·h(r(E))` with `r = 1/E²`: `a = Eβ`
grows the whole way up while `h(r)` falls with r, and the two cross.
**`AMPLITUDE_RATIO_CAP` is NOT the cause, and lowering or removing it makes the
dip WORSE** — the cap binds only to effective difficulty 1.1217, the trough sits
1.15 outside that band, h is flat inside it (spread 1.44e-15) and monotone on
887/887 steps outside it, and uncapped the same trough would be an **18.25%**
drop instead of 9.53% (`scripts/mtr-priority-monotonicity.probe.ts`). Same
verdict as the two rows above: do not smooth it, and do not reach for the cap to
do it.

### The advisor ranks, it does not judge

It reports every axis unconditionally with a lower-is-better badness function;
whether a reading is bad enough to act on is the band
([presentation's](../../presentation/AGENTS.md)). **Badness takes the metrics,
not the reading, and one axis uses that**: Flow Coverage ranks on the COUNT of
tasks reaching ϕ and displays the share, because a defer drops a
task from the share's numerator and denominator at once and would improve it for
free — the reason for retiring Grind Density, measured again here at 259 of
664 defers. Badness only orders candidates, so what it consumes is free to differ
from what the card prints; do not "simplify" it back into a function of `read`. Options per axis are the
Pareto frontier on (improvement ↑, plan value ↑) so there is no weight λ to
defend — "the single biggest improvement" is bad
advice. **Unconditionally includes the axes nothing improves**: one finding per
axis, empty menu and all. Filtering those out in the model is a
presentation decision taken where the bands are not visible, and it made an
unfixable warning — Energy Balance on a day of nothing but cognitive work —
indistinguishable from a day with no warning on it, which the card then called
fine. The card says the empty menu out loud instead.

`PlanAdvice` is contractually today's inputs alone, and
`AdviceDisplay` is built from it — so a reading about ANOTHER day, such as what
the day a defer sends to already holds, is its own descriptor and its own card
prop, never a field on either.

### A budget _increase_ never enters that frontier

Σ P̄ prices deferring and trimming in full, but it does not price
the extra hour — and Σ P̄ is monotone in the budget at the true optimum (the
fallback can invert it), so a `budget + 1` inside the frontier out-values every
defer and dominates the entire menu down to "work more". `plan-advice.ts`
splits the candidates with `isPriced` and returns the increase as
`AdviceFinding.unpriced`, which the card renders last and labelled in hours. Do
not merge the two lists back together.

### The budget levers carry unrounded hours

Rounding `budget − planSlack` to quarter-hours trimmed past the
hours the plan actually spends, so the trim stopped even being feasible. The
card has no Apply for `set-budget`, so there is nothing to align the hours to —
the descriptor rounds the **label**, never the lever. The trim is **feasible,
not free**: `allocate` is path-dependent on `budgetBlocks`, so on a pool-bound
day the re-solve can land up to a measured **−0.9%** below the plan it trimmed
(`scripts/plan-advice.probe.ts`). Do not clamp that to 0 — it
is a plan the allocator really produces, and a real difference must not be
shown as costless.

### The budget's shadow price is a day-level reading, not a per-task column

`PlanAdvice.budgetMarginal` re-solves at `budget + BLOCK_HOURS`
and reports what that block adds plus which task takes it. **Both halves are
open-scoped**: the allocator is blind to `completed`, so the
plan-scoped reading named an already-ticked-off task as the recipient of the
next 15 minutes, worth up to +33.4%. `recipient: null` means a wider budget
buys no remaining work, and says nothing about why — a bound pool, tasks near
their stopping times and a block landing on finished work look identical from
one solve. That concession is about THIS reading and not about the per-task
one below it: `PlanAdvice.unfunded` names a reason per task because it reads
`activeTasks + 3` plan-scoped solves the frontier already paid for, where this
one has a single extra solve to work from.

Do not re-propose the per-task column: the reason originally recorded for
rejecting it (marginals equalize, so a column degenerates) is **false and
measured false**; the two that hold are that no user lever corresponds to a
per-task entry, and that the column is arithmetic on a curve that ignores the
pools and the switch cost, overstating the budget's yield on 63% of probe days.
It lives in `suggestPlanAdjustments`, not `calculateDailyMetrics`: the latter
runs in a `$derived` on every keystroke and every slider drag, where a second
solve doubles dashboard cost.

### The switch cost is instrumented but never advised

2026-08-04. `switchCost` and the pools are ruled "measurements of the user, not
choices about the day" — that excludes them as levers and, by the same
sentence, licenses them as instrument targets.
`PlanAdvice.switchCostPrice` reports the `(m−1)·s` hours the plan reserves over
**funded** tasks, that as a share of the budget, and Σ P̄ re-solved at `s = 0`
and `s = 2s`. Declaring it 2× too high costs a measured **8.47%** of plan value
on a 2–4-task day (18.77% at 5+ tasks), against 0.16% for the ϕ oracle. Four
things it must keep, three of which invert the bullet above:

- **Plan-scoped, not open-scoped**, because it is compared against
  `planValueOf`, which is built from the whole task list. Restricting
  one side to open work reports a difference that is mostly the scope change.
- **Clamped per arm, never floored.** The exact optimum is monotone
  non-increasing in `s`, so a lower declaration reads only ≥ 0 and a higher one
  only ≤ 0; the opposite sign is suboptimality, not the day. Inversions
  are reachable and large — 112 over 71,520 UI-grid configurations, worst free
  arm **−6.53%**, worst doubled arm **+1.36%**, and 40 of them without touching
  `s`. Their magnitude is **not** bounded by the "worst 0.09%", which is a
  single-draw maximum. Do **not** replace this with a floor: that zeroes
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

The flag only removes a task from the defer candidates; neither the allocator
nor §8.10's λ₀ fit sees it — `toEnergyTask` drops the flag, and what that costs
the fit is measured (the §8.10 bullet above) — so a flagged task can
still be funded zero.
`PlanAdvice.unfunded` therefore carries a `pinned` flag per entry, and the card
gives those entries their own warning-coloured line, because a plain unfunded
sentence reads as something the menu below can fix and for these tasks there is
no lever the advisor is allowed to pull. The flag removes a task from the defer
CANDIDATES only: deferring some other task can still fund it, and that is the
reason it is given — what no reason may do is name a flagged task as the one to
drop, since there is no such plan to price. The badge is
worded "Stays today" and the checkbox "Keep on today" for the same
reason: "Must do" beside `0m` reads as a promise the model never made.

### An unfunded task gets one reason, and the order decides which

2026-09-01
([docs/features/why-a-task-got-no-hours.md](../../../docs/features/why-a-task-got-no-hours.md)).
`attributeUnfunded` reads only the candidates `suggestPlanAdjustments` has
already solved, so the read costs no solve: **defer → budget → pool → none**,
first match wins.

- **defer** — the single removal that funds the task, choosing the one whose
  re-solved plan keeps the most Σ P̄ when several do. First because it is the
  only branch the user can act on inside today's declared inputs.
- **budget** — the `set-budget` candidate above today's budget. NOT
  `budgetMarginal`, whose block is open-scoped: two branches of one sentence on
  two scopes read as a contradiction.
- **pool** — `baseline.humanCapacity` at `POOL_FULL_PERCENT` on a pool the task
  draws on. No solve at all, and no prescription: the pools are measurements of
  the user.
- **none** — nothing on offer reaches it.

One reason, never every reason that applies: a task with three of them has told
the user nothing. Measured over the seeded 600
(`scripts/plan-advice.probe.ts`), and gated there — a mix where one branch
takes most of the attributed tasks is one static sentence, not a per-task line.

### The importance weight `v` scales the objective, never a task's own figures

MATH.md §0. `v ∈ {0.5, 1, 2}` (`IMPORTANCE_WEIGHT`, `zenith.ts`) enters at
`increments` in the two `allocTasks` maps and nowhere else, so `planValue`, the
funded-subset enumeration and the greedy inherit it unchanged and `toAllocations`
— which produces every per-task figure the UI prints — is provably untouched.
Because `argmax v·P̄ = argmax P̄`, `v` cannot move a task's own stopping time
`T*` or the intrinsic value at it. It CAN move a funded task's planned hours:
the allocator sorts one pooled marginal menu, so scaling one task's menu
re-sorts it against the others and a task can gain or lose blocks while staying
funded throughout. Do not restate this as "`v` only changes which tasks are
funded" — that was the item's original wording and it is false.

Two consequences are settled:

- **`priorityScore` stays intrinsic** — unweighted, unscaled. It is printed on
  the row, it is the weight in Completion Rate and Yield Index, and it is the
  sort key `calculateInterleavedOrder` breaks ties on; weighting it would
  re-score every stored day against a definition those days were never planned
  under. Do not v-scale the printed figure alone either — that leaves two
  quantities named `priorityScore` disagreeing by a factor of `v` (R3).
- **The energy mode stays unweighted.** `optimizeSchedule` maximizes total
  output (§8), and a value multiplier on an integral of output is a different
  quantity. So `plan-audit.ts`'s classic branch carries the weight — the classic
  plan the user saw is the weighted one — and its energy branch does not.

`Σ vᵢ·P̄ᵢ` now has three implementations that must move in lockstep:
`planValue` over `buildBlockIncrements`, `calculateTotalProductivity` (both
`zenith.ts`), and `plan-advice.ts`'s `extraValue`, which sums the per-task rise
directly. The last one has to apply `importanceWeightOf` itself, because
`avgProductivity` is intrinsic while the `planValueOf` baseline it is compared
against is the weighted objective.

### The productivity curve deviates from the source article on purpose

MATH.md §6.
