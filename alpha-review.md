# Alpha review — MATH.md and its probes

**Date:** 2026-08-22
**Scope:** independent audit of `MATH.md` (all sections) against the shipped model
code and the committed probe registry. Read-only: no source or doc files were
changed; verification scripts lived in `/tmp/opencode` and ran against the
current working tree (which carries WIP), not against HEAD.

## Verdict

The math holds up. Every derivation in §0–§5 that could be checked by hand was,
and every check that could be re-derived numerically from the shipped exports
reproduced the documented figures. The executable spec is green (193/193 model
tests). Three documentation defects were found — none affects the model's
arithmetic; all are stale prose.

## Method

1. **On-paper re-derivation** of §0–§5: curve algebra, the three structural
   facts about `N(x)`, the closed-form average, the stopping root and band, the
   r → 1 asymptote.
2. **Independent numerics** (`npx vite-node /tmp/opencode/math-audit.mts`,
   `/tmp/opencode/adjudicate.mts`, `/tmp/opencode/monotone-diag.mts`) against
   the real exports — fresh Simpson integrals, finite differences, integer-grid
   sweeps — deliberately not reusing the suite's own fixtures.
3. **Executable spec**: `zenith.test.ts` (80), `zenith-energy.test.ts` (99),
   `energy-calibration.test.ts` (14) — all pass.
4. **Doc gates**: `scripts/math-index.mjs --check` and
   `scripts/probe-registry.mjs --check` both clean.
5. **Cross-audit of §6–§36**: ~18 formula spot-checks against
   `zenith-energy.ts`, `energy-calibration.ts`, `metric/calculation.ts`,
   `plan-advice.ts`; existence check of every cited probe/test; scan for
   unbacked numbers and internal contradictions.

## What was verified

### §0–§3 core model

| Claim                                                                                                                     | Result                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Parameter maps E, β (§1)                                                                                                  | exact                                                                                                                           |
| r-cap boundary `1/√0.9` → difficulty 1.121708, 1.35% of slider range (§1)                                                 | reproduced                                                                                                                      |
| p(0) = p₀; peak at ϕ; peak value `a·e^(r−1)` (§2)                                                                         | max rel err ≤ 5e−13 over slider grid                                                                                            |
| Concavity on working range (§2)                                                                                           | min p″ < 0 across grid                                                                                                          |
| Closed form P̄ vs numerical integration (§2)                                                                               | worst abs err 5.9e−13                                                                                                           |
| Marginal integrates back to `P̄ − p_eff` (§2)                                                                              | worst abs err 2.0e−12 (with cap-aware `p_eff = a·r`)                                                                            |
| Facts 1–3 about N: `N′ = e^(−x)x(1−r−x)`, unique root beyond 1−r, `D′ < 0` below 2−r, `u(r) = N(2−r) < 0 ⇒ x* < 2−r` (§2) | proved by hand and confirmed numerically                                                                                        |
| Root at r=0 is 1.793282…; multiplier at r=0.9 is 1.5194 (§3)                                                              | exact                                                                                                                           |
| Multiplier strictly decreasing in r                                                                                       | holds on the reachable domain r ∈ [0, 0.9] (`AMPLITUDE_RATIO_CAP`); violations exist only at r > 0.9999, which no task can have |
| Asymptote `m(r) → 3/(1+r) → 1.5` (§3)                                                                                     | \|m − 3/(1+r)\| → 1.8e−4 by r = 0.99999                                                                                         |
| T\* = argmax P̄ (§3)                                                                                                       | worst rel err 2e−14                                                                                                             |

### §5 / §5.1 posterior-aware kernel

- **Gauss–Hermite rule is correct as shipped.** The stored nodes are physicist
  Hermite abscissae (roots of 32t⁵ − 160t³ + 120t), whose half-variance is why
  the substitution `ϕ̂ + √2·σ·ξ` yields exactly variance σ². Under that
  convention Σw = 1 and moments are exact through degree 9 (m₂ = ½, m₄ = ¾,
  m₆ = 15/8, m₈ = 105/16), and the degree-10 relative error reproduces the
  documented **12.7%** exactly.
- σ = 0 collapse of `expectedAverageProductivity` to `averageProductivity` is
  bit-exact across the grid.
- Hedging is a strict penalty at every sampled σ > 0.
- `expectedOptimalTime(σ=0)` reduces to the closed form within 1 ulp (worst abs
  diff 4.4e−16).
- Floored ϕ̂ effective node mean shift reproduces the documented **16.7%**.
- `phiParameterStd` = √(xᵀΣx), exact.

An early version of this audit flagged three apparent failures here; all three
were bugs in the checker, not the model: (a) dividing by a zero analytic
derivative at T = T\*, (b) float accumulation in a naive monotonicity sweep that
ran past the r-cap, (c) testing GH moments against unit-variance instead of the
half-variance convention its nodes imply. The corrected instruments all pass.

### §6–§36 cross-audit

No formula mismatches (~18 spot-checks, all match code). No stale citations:
every `scripts/*.probe.ts` and test/spec cited in §6–§36 exists. Registry and
section-index gates pass.

## Defects found (documentation, not model)

1. **Stale ladder cross-reference — MATH.md:2819 (§8.12).** Quotes "§8.3's
   ladder (12 h → 11.25 → 10.5 → 6 → 4.5 → **0**)". §8.3 (MATH.md:991) records
   the current ladder as **12 h → 12 → 9.75 → 6 → 4.5 → 0**, noting on
   2026-08-21 that the 0.4 and 0.8 cells moved off 11.25/10.5. The §8.12
   sentence still carries the pre-realignment values.
2. **91.3 vs 92.8 — calculation.ts:784 comment.** The comment says the old cut
   put "**91.3%** of seeded days above it"; MATH.md §29 (lines 7417, 7420, 7425)
   says **92.8%**. A live run of `scripts/mtr-day-profile.probe.ts` (test 1)
   prints "demanding at the OLD cut 5.5: **92.8%**" — MATH.md is right, the code
   comment is stale.
3. **Unbacked measurements in §8.6 (soft finding).** The timing tables and pair
   -seed ratios (MATH.md:1262–1300) and the "b = 0 legacy world's optimum
   improved too (10.70 vs 10.65)" line (:1260–1261) name no instrument, and no
   probe prints those figures. They read as dated ad-hoc records (2026-08-13,
   two machines, methodology described), but by PROBES.md's own standard ("a
   number with neither a probe nor a fixture is unbacked") they are unbacked —
   unlike comparable wall-clock claims elsewhere, which cite
   `plan-advice.probe.ts` / `subset-search-bound.probe.ts`.
4. **Withdrawn during review:** §8.7's posterior stds (0.088 → 0.033, 0.090 at
   ±3-notch scatter, MATH.md:1477–1479) initially looked unbacked;
   `scripts/sat-drain-identifiability.probe.ts` names those exact figures in its
   header and arm B output. Backed; not a defect.

Items 1–2 are one-line fixes whenever those files are next touched.

## Not re-run

- `allocator-exactness.probe.ts` (6400-case sweep) and
  `phi-cap-reachability.probe.ts` (576k-cell sweep): too heavy for an audit
  cadence; they remain committed instruments and the registry confirms wiring.
- All numbers above reflect the current WIP tree, not HEAD.
