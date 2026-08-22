# Alpha review — zenith.ts and zenith-energy.ts

**Date:** 2026-08-22
**Scope:** independent math audit of the two model implementations,
`src/lib/business/model/zenith.ts` (classic planner, v2) and
`src/lib/business/model/zenith-energy.ts` (energy mode, plus `linalg.ts`),
against [MATH.md](MATH.md) §0–§8. Read-only: no source files were created or
edited; verification scripts lived in `/tmp/opencode` and ran against the
current working tree (which carries WIP), not HEAD. Companion to
[alpha-review.md](alpha-review.md), which audits MATH.md itself.

## Verdict

The math holds up. Every formula, constant and structural claim in both files
matches MATH.md §0–§8, including the easy-to-drift details: the series
thresholds (x < 10⁻⁴), the r-cap binding only below user difficulty ≈ 1.12,
greedy tie-breaking toward the lower index, the 1e-9-of-a-block budget epsilon,
ν₀ = 4 decoupled from each fit's tuned λ, the `max(0, ageDays)` recency floor,
the informative-log filters, the calibration conditioning order (r → α → λ₀),
the clock censor reading uncapped span while the window gate reads worked hours,
open-task scoping on both stop readings, and the deliberately uncapped v1
amplitude in the energy model (§7). The executable spec is green (179/179
model tests). No defects were found in either file.

## Method

1. **On-paper re-derivation** of §1–§5 curve algebra while reading the code:
   peak position and value, closed-form average and its kernels, the marginal
   `N(x)`/x², the stopping root and band, the allocator's exactness premises.
2. **Independent numerics from MATH.md transcriptions**
   (`node /tmp/opencode/math-check.mjs`) — formulas written down from the spec,
   never copied off the implementation: fresh integrals, finite differences,
   RK4 references, bisection roots.
3. **Module-level deep checks** (`vite-node /tmp/opencode/deep-check.mts`)
   against the real exports: brute-force allocator reference, a hand-rolled
   weighted Bayesian ridge, dense Simpson-over-ϕ references for the quadrature,
   an end-to-end energy-evaluator replica built from §7/§8 alone, exhaustive
   plan enumeration for the optimizer, fresh minimizers for the three
   calibration fits.
4. **Quadrature adjudication** (`/tmp/opencode/gh-discrim.mts`) to attribute
   the one measured deviation (below).
5. **Executable spec**: `zenith.test.ts` (80), `zenith-energy.test.ts` (99).

## What was verified

### §1–§3 core model

| Claim                                                           | Result                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Parameter maps E, β (§1)                                        | exact                                                               |
| p(0) = p₀; peak exactly at ϕ; peak value `a·e^(r−1)` (§2)       | numeric argmax lands on ϕ within the sweep step; value ≤ 1e-12      |
| Closed form P̄ vs 2M-point integration (§2)                      | rel err ≤ 1e-6 at T ∈ {0.05 … 12}, slider corners and ϕ-floor tasks |
| Marginal `a·k·N(x)/x²` vs central differences (§2)              | ≤ 1e-5                                                              |
| Small-x series `(1−r)/2 + ((1+r)/3 − 1)x` (§2)                  | re-derived by hand — matches                                        |
| lim T→0 dP̄/dT = k(a−p₀)/2 (§2)                                  | Richardson extrapolation off numeric integrals, 3e-5                |
| Root x\*(0) = 1.793282…; multiplier at r = 0.9 is 1.519431 (§3) | exact                                                               |
| Multiplier strictly decreasing in r over [0.01, 0.9] (§3)       | holds                                                               |

### §4 allocator

| Claim                                                                                                                        | Result                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Single-budget exactness vs full block-lattice brute force — n ≤ 4, B ∈ {1.75, 2.76, 3, 6}, s ∈ {0, 0.1, 0.25, 0.33}, σ_ϕ = 0 | ≤ 1e-9 on every case                                                 |
| Returned plans feasible and on the 0.25 h lattice, switch overhead included                                                  | holds                                                                |
| Plan value via shipped `avgProductivity` vs independent kernel                                                               | agree ≤ 1e-9                                                         |
| Pooled plans: lattice, pool and switch feasibility over 12 seeded days                                                       | holds (optimality is §13.3's documented heuristic, not claimed here) |

### §5 / §5.1 posterior-aware kernel

- Weighted Bayesian ridge (n = 1/3/20 seeded datasets, log ages 0–2000 d):
  MAP constants, covariance `σ̂²(XᵀWX + λI)⁻¹`, noise blend and effectiveCount
  match a from-scratch Gaussian-elimination solver to ~1e-9.
- σ = 0 collapse of `expectedAverageProductivity` to `averageProductivity` is
  bit-exact (`Object.is`).
- Gauss–Hermite nodes/weights integrate N(0,1) moments exactly through
  degree 9 (≤ 1e-12).
- `expectedAverageProductivity` vs dense Simpson over ϕ (floor non-binding):
  ≤ 9e-7 at σ/μ ≤ 0.15; ≤ 1.06e-3 at the widest cell — attributed under
  "Findings".
- `phiParameterStd = √(xᵀΣx)` verified via the covariance match above.

### §8 energy model

| Claim                                                                                                                                                                    | Result                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Reservoir closed form vs RK4, incl. w = 0 rest and the w = 1 floor `b·r′/(α+b·r′)` (§8.1/§8.5)                                                                           | ≤ 1e-6; floor exact (0.130435 at defaults)                                             |
| Rest decay `d_after = d_before·e^(−r·m·g)` (§8.9)                                                                                                                        | exact vs ODE                                                                           |
| §8.2 survival figures 84.648 % (5 min) / 1.83 % (2 h)                                                                                                                    | reproduced from e^(−g/τ)                                                               |
| Satiety wrapper: V(0) = 0, V′(κ) = ½ (§8.4)                                                                                                                              | exact                                                                                  |
| Evaluator end-to-end vs independent §7/§8 replica — 20 seeded scenarios (τ ∈ {0.5, 0.25, −1, 1}, satiety {0, 1}, gate b {0, 0.05}, m {1, 1.5}, clipped over-long blocks) | worst field/block diff **2.08e-6** — the shipped Simpson's own documented scale (§8.1) |
| Optimizer vs exhaustive enumeration of every lattice plan (81 / 64 / 243 candidates) + determinism                                                                       | exact ≤ 1e-9; deterministic                                                            |
| Budget-curve hull: slopes non-increasing; knee invariant (last positive slope ⇔ recommendedHours or cap-null) (§8.12)                                                    | holds on the 16-point sweep                                                            |

### §8.7–§8.10 calibration fits

- `fitDrainRate` and `fitRecoveryRate` reproduced by fresh 40k-grid +
  golden-section minimizers over their own objectives: α/r within 0.005;
  informative-filter counts exact.
- Posterior stds match the stated construction (ν₀ = 4 blend, Gauss–Newton
  curvature with h = 1e-4) within 2 %.
- `fitStoppingValue`: identity-prediction MAP `(Σmᵢ + λλ₀)/(n+λ)` and its std
  reproduce to 1e-12 on three constructed two-sided days read through the
  exported `stopIndifferencePoint`.

### Constant sweep

`BLOCK_HOURS` 0.25; `AMPLITUDE_RATIO_CAP` 0.9; `PHI_UNCERTAINTY_RELATIVE_CAP`
0.5; recency half-life 365 d with the future-dated floor; ν₀ = 4 shared and
decoupled from the tuned ridge λs (0.25 / 0.05 / 1); noise floors σ₀
(0.25 h / 0.15 / 0.21 / 0.25); `STOP_INVERSION_MARGIN` 0.25; energy lattice
0.75 h; fit bounds equal to each UI input range — all match MATH.md.

## Findings

**None in the model.** Every discrepancy raised during verification was a bug
in my checker, and each fix moved _my_ number toward the shipped behavior,
never the reverse: (a) comparing the closed-form average against an integral I
forgot to divide by T; (b) stripping `ageDays` before calling the shipped fit,
so it correctly treated decaying weights as fresh; (c) a dense quadrature
reference integrating into negative ϕ, where k flips sign and the kernel
explodes; (d) the same reference truncating the sub-floor Gaussian tail the
shipped nodes legitimately cover; (e) evaluating the unclamped kernel at
exactly ϕ = 0 (an `exp(−∞)·∞` artifact no interior quadrature node can reach);
(f) an operator-precedence slip that silently dropped one tolerance.

**One measured deviation, priced rather than fixed.** At the widest posteriors
(σ/ϕ̂ ≈ 0.3–0.4) the shipped 5-node kernel sits up to ~1.1×10⁻³ (relative) from
dense references. The adjudication run shows why: in those cells no node
touches the ϕ floor, so the shipped value is exactly the plain Gauss–Hermite
estimate of the _unclamped_ expectation, and the residual is the rule's own
truncation error — whose leading term §5.1 pins to the 10th ϕ-derivative and
prices via the cited 12.7 % degree-10 moment figure. The floor-clamped vs
unclamped definitional gap itself measures ≤ 2.1×10⁻⁴ there. Everything lands
inside the sub-1 % envelope §5.1 already claims for this kernel, and since
allocations, totals and gains all consume the same kernel, hedged comparisons
stay internally consistent regardless of its absolute accuracy. Nothing to
change; recorded so the number exists outside the probes.

## Not re-run

- The committed probe sweeps (`allocator-exactness`,
  `phi-cap-reachability`, …): accepted as documented instruments; the
  companion alpha-review confirms registry wiring and citations.
- Pooled-path optimality and the past-12-task forward-selection forfeits —
  documented heuristics by design (§13.3, §34), not claims to verify.
- Performance/timing figures throughout §8.6/§8.12.
- The full five-command green set, lint, depcheck and e2e — left to CI per
  AGENTS.md §3.
- All numbers reflect the current WIP tree, not HEAD.
