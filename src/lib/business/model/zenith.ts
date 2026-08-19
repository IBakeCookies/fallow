/**
 * Zenith Gradient Algorithm — model v2
 *
 * Originally based on:
 * https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e
 * (a copy lives in /zenith.md)
 *
 * The mathematical model optimizes time allocation across tasks to maximize
 * the sum of per-task AVERAGE productivities. This file deviates from the
 * article in several deliberate, documented ways; the full derivations and
 * the reasoning behind every deviation live in /MATH.md. Summary of v2:
 *
 * 1. NEW PRODUCTIVITY CURVE  p(t) = (a·k·t + p₀)·e^(−kt), k = (1 − p₀/a)/ϕ.
 *    The article's curve p(t) = (a+p₀)·k·t·e^(−kt) had p(0) = 0, so its
 *    "initial productivity" p₀ was really just an amplitude term. The v2
 *    curve actually starts at p(0) = p₀, still peaks exactly at t = ϕ
 *    (with value a·e^(p₀/a − 1)), and still has closed-form integrals.
 *
 * 2. PER-TASK OPTIMAL STOPPING. The optimal-stopping equation becomes
 *    eˣ = 1 + x + x²/(1+r) with r = p₀/a and x = k·t — the article's
 *    eˣ = 1 + x + x² is the r → 0 special case (root 1.7933). The stopping
 *    time in units of ϕ now depends on the task: T* = ϕ·x*(r)/(1−r), which
 *    ranges over [1.5194, 1.7933] (1.5 is the r → 1 asymptote, unreachable
 *    because AMPLITUDE_RATIO_CAP bounds r at 0.9).
 *
 * 3. DISCRETE EXACT ALLOCATOR. Time is planned in 15-minute blocks
 *    (BLOCK_HOURS) and distributed by greedy marginal analysis, which is
 *    provably optimal for separable concave objectives over a shared budget
 *    (Fox 1966; Ibaraki & Katoh, "Resource Allocation Problems", MIT Press).
 *    Context-switch cost is handled by exact enumeration of funded-task
 *    subsets (the fixed-charge part of the problem). This replaced the v1
 *    Lagrange-multiplier bisection + iterative drop-search: the v2 curve's
 *    value jump at t = 0⁺ (a task you start at all immediately yields ≈ p₀
 *    average productivity) breaks the concavity that the Lagrange/KKT
 *    machinery required, while the discrete greedy handles it naturally.
 *
 * 4. BAYESIAN PERSONALIZATION. fitUserConstants still returns the same MAP
 *    (ridge) point estimate, but now also the full posterior — covariance and
 *    noise estimate — so callers can quantify how certain a ϕ prediction is.
 *    The fallback paths return the PRIOR as a posterior rather than none, so
 *    "no data" reads as maximally uncertain instead of maximally confident
 *    (2026-07-26 fix, MATH.md §13.1).
 *
 * 5. POSTERIOR-AWARE ALLOCATION (2026-07-18, MATH.md §5.1). Given the fit
 *    posterior, the allocator maximizes the EXPECTED average productivity
 *    under each task's ϕ parameter-uncertainty (5-node Gauss–Hermite mixture
 *    over ϕ). Uncertain tasks are worth strictly less at their optimum, so
 *    plans hedge toward well-measured tasks; as logs accumulate the
 *    uncertainty vanishes and the plan converges to the certainty model,
 *    which remains the exact σ = 0 special case.
 */

import { solve3x3, invert3x3 } from '$lib/business/model/linalg';

interface TaskInput {
	title: string;
	difficulty: number; // Eᵤ: 1-10 user input
	enjoyment: number; // βᵤ: 1-10 user input
}

interface TaskAllocation extends TaskInput {
	allocatedHours: number; // Always a multiple of BLOCK_HOURS
	E: number; // True effort (mapped to 1-5)
	beta: number; // True enjoyability (mapped to 1-2)
	phi: number; // Time to flow state (hours)
	peakProductivity: number; // p(ϕ) = a·e^(p₀/a − 1), the curve's actual maximum
	avgProductivity: number; // Average productivity over allocated time
	// Optimal stopping time, HEDGED for ϕ-uncertainty (§5.1) — not the §3 closed
	// form x*(r)/k, and free to fall below its [1.5194, 1.7933]ϕ band: on the
	// zero-log posterior 23 of the 100 slider pairs do, 6 land under ϕ itself.
	optimalHours: number;
	optimalAvgProductivity: number; // P̄(T*): best achievable average — allocation-independent task value
}

export interface UserConstants {
	c1: number; // Effort coefficient for flow state time
	c2: number; // Enjoyability coefficient for flow state time
	c3: number; // Constant offset for flow state time
}

// Default constants (MATH.md §1; personalized via fitUserConstants on measured ⚡ logs)
export const DEFAULT_USER_CONSTANTS: UserConstants = {
	c1: 0.56, // Higher effort → longer time to flow
	c2: -0.24, // Higher enjoyability → shorter time to flow
	c3: 0.5, // Base offset to keep ϕ positive
};

// Default context-switching cost in hours (15 minutes). Empirically defensible:
// Mark, Gudith & Klocke (CHI 2008) measured ~23 minutes to regain focus after an
// interruption; 15 minutes is a conservative per-planned-switch estimate since a
// planned switch is gentler than an interruption. Interpreted as ATTENTION
// RESIDUE (Leroy 2009, OBHDP) — the cost of disengaging from the previous task —
// NOT as ramp-up time on the next task: ramp-up is already priced into the
// productivity curve through ϕ.
export const DEFAULT_SWITCH_COST = 0.25;

/**
 * Planning granularity: allocations are whole 15-minute blocks.
 *
 * WHY (v2 change): v1 solved the continuous problem and emitted plans like
 * "1.84h". Nobody executes 1.84 hours; blocks are how humans actually plan.
 * The discretization also makes the optimizer EXACT: with diminishing
 * per-block value increments, greedy marginal analysis provably maximizes the
 * objective (see MATH.md §4), replacing v1's numerically-tolerant λ-bisection
 * and its rescaling/rounding-residual patch-ups. Budget below one block is
 * left unplanned — a sub-15-minute sliver is not a real work session.
 */
export const BLOCK_HOURS = 0.25;

/**
 * v1 optimal-stopping multiplier: under the OLD curve p(t) = (a+p₀)·k·t·e^(−kt),
 * average productivity peaked at t = 1.7933ϕ for every task (root of
 * eˣ = x² + x + 1).
 *
 * v2 NOTE: with the new curve the multiplier is task-dependent —
 * T* = ϕ·x*(r)/(1−r) with multiplier in [1.5194, 1.7933], r = p₀/a — so this is now only
 * (a) the exact r → 0 limit, (b) a strict UPPER BOUND on every task's
 * multiplier, and (c) the seed/bracket for the per-task root solve. Use
 * findOptimalSingleTaskTime for real values — NOT TaskAllocation.optimalHours,
 * which hedges ϕ-uncertainty and falls outside the band (MATH.md §5.1).
 * Still consumed by the zenith-energy model, which intentionally remains on
 * the v1 curve (see MATH.md §7).
 */
export const OPTIMAL_PHI_MULTIPLIER = 1.7933;

/**
 * Cap on r = p₀/a, the ratio of initial to peak-scale productivity: the v2
 * curve needs p₀ < a for k = (1 − p₀/a)/ϕ to stay positive, and the article's
 * maps give p₀ = a at user difficulty 1 (MATH.md §1).
 */
const AMPLITUDE_RATIO_CAP = 0.9;

// Exhaustive funded-subset search is O(2ⁿ · greedy); exact up to this many
// tasks (4095 subsets — instant). Past it the same 4095-plan budget is spent on
// the subset sizes the day can actually fund (MATH.md §34). Exported because
// `subset-search-bound.probe.ts` re-derives that branch rule and must compare
// against the shipped cap, not a copy of it (R3).
export const EXACT_SUBSET_LIMIT = 12;

export const SUBSET_SEARCH_BUDGET = (1 << EXACT_SUBSET_LIMIT) - 1;

/**
 * Map user effort (1-10) to true effort E (1-5)
 * E = (4/9)Eᵤ + 5/9 (MATH.md §1)
 */
export function mapEffort(Eu: number): number {
	return (4 / 9) * Eu + 5 / 9;
}

/**
 * Map user enjoyability (1-10) to true enjoyability β (1-2)
 * β = (1/9)βᵤ + 8/9 (MATH.md §1)
 */
export function mapEnjoyability(betaU: number): number {
	return (1 / 9) * betaU + 8 / 9;
}

/**
 * Floor on ϕ (6 minutes): a fitted plane may extrapolate to ≈0 (or below) far
 * from the measured tasks. A strictly positive ϕ keeps k finite and the
 * productivity curve well-defined everywhere (MATH.md §1). Also clamps the
 * ϕ-quadrature nodes of the posterior-aware allocator (MATH.md §5.1, see
 * expectedAverageProductivity).
 */
const PHI_FLOOR_HOURS = 0.1;

/**
 * Calculate time to reach flow state
 * ϕ = c₁E + c₂β + c₃ (MATH.md §1)
 */
export function calculateFlowStateTime(E: number, beta: number, constants: UserConstants): number {
	const phi = constants.c1 * E + constants.c2 * beta + constants.c3;

	return Math.max(PHI_FLOOR_HOURS, phi);
}

/**
 * Initial productivity p₀ = β/E (MATH.md §1).
 *
 * v2: with the new curve this genuinely IS the productivity at t = 0
 * (p(0) = p₀), fixing the v1 mismatch where the curve forced p(0) = 0 and p₀
 * was silently just an amplitude term. Enjoyable, low-effort tasks start
 * productive immediately; hard, unenjoyable ones start near zero.
 *
 * NOTE: calculateTaskParams caps the EFFECTIVE p₀ at AMPLITUDE_RATIO_CAP × a.
 */
function calculateInitialProductivity(E: number, beta: number): number {
	return beta / E;
}

/**
 * Peak productivity scaling factor a = E × β (MATH.md §1).
 *
 * Higher effort tasks that we really enjoy correspond to higher peak
 * productivity. v2: the actual curve maximum is p(ϕ) = a·e^(p₀/a − 1), whose
 * first-order expansion in p₀/a is (a + p₀)/e — exactly the v1 peak. So v1's
 * peak was the small-p₀ approximation of the v2 peak.
 */
function calculatePeakScaling(E: number, beta: number): number {
	return E * beta;
}

// r = p₀/a clamped to [0, AMPLITUDE_RATIO_CAP]. Defensive: calculateTaskParams
// already caps p₀, but the curve helpers accept raw (a, p₀) from tests/callers.
function amplitudeRatio(a: number, p0: number): number {
	if (a <= 0) return 0;

	return Math.min(Math.max(p0, 0) / a, AMPLITUDE_RATIO_CAP);
}

/**
 * Productivity at time t into a task (v2 curve):
 *
 *   p(t) = (a·k·t + p₀)·e^(−kt),   k = (1 − p₀/a)/ϕ
 *
 * Properties (derivations in MATH.md §2):
 * - p(0) = p₀ — the task starts at its initial productivity (v1 started at 0)
 * - dp/dt = k·e^(−kt)·(a − p₀ − a·k·t) = 0  ⇒  peak exactly at t = ϕ
 * - p(ϕ) = a·e^(p₀/a − 1)  (≈ (a+p₀)/e for small p₀/a, the v1 value)
 * - p is concave on the whole working range [0, T*] (inflection at
 *   k·t = 2 − p₀/a, which always lies beyond the optimal stopping point —
 *   proved in MATH.md §2, marginal fact 3)
 */
export function productivity(t: number, a: number, p0: number, k: number): number {
	if (t < 0) return 0;

	const r = amplitudeRatio(a, p0);

	return (a * k * t + r * a) * Math.exp(-k * t);
}

// Shared kernels of the average-productivity integral, in x = kT units:
//   f(x) = 1 − e^(−x)(x + 1)   from ∫ k·t·e^(−kt) dt
//   g(x) = 1 − e^(−x)          from ∫ k·e^(−kt) dt
// Series fallbacks avoid catastrophic cancellation at tiny x (both kernels are
// differences of nearly-equal quantities ~O(x²) and ~O(x)).
function kernelF(x: number): number {
	if (x < 1e-4) return (x * x) / 2 - (x * x * x) / 3;

	return 1 - Math.exp(-x) * (x + 1);
}

function kernelG(x: number): number {
	if (x < 1e-4) return x - (x * x) / 2 + (x * x * x) / 6;

	return 1 - Math.exp(-x);
}

/**
 * Average productivity over (0, T]:  P̄(T) = (1/T) ∫₀ᵀ p(t) dt
 *
 * With the v2 curve (x = kT, r = p₀/a):
 *
 *   ∫₀ᵀ a·k·t·e^(−kt) dt = (a/k)·[1 − e^(−kT)(kT + 1)]        = (a/k)·f(x)
 *   ∫₀ᵀ p₀·e^(−kt)   dt = (p₀/k)·(1 − e^(−kT))                = (a·r/k)·g(x)
 *
 *   P̄(T) = a·[f(x) + r·g(x)] / x
 *
 * IMPORTANT DISCONTINUITY (v2): lim T→0⁺ P̄(T) = p₀ > 0, but P̄(0) := 0 — a
 * task you never start contributes nothing. Working a task AT ALL immediately
 * yields ≈ p₀ of average productivity ("activation bonus"). This jump is what
 * makes the objective non-concave and motivated the discrete allocator; see
 * MATH.md §3–4.
 */
export function averageProductivity(T: number, a: number, p0: number, k: number): number {
	if (T <= 0) return 0;

	const r = amplitudeRatio(a, p0);
	const x = k * T;

	return (a * (kernelF(x) + r * kernelG(x))) / x;
}

/**
 * Derivative of average productivity with respect to T.
 *
 * d/dx[(f + r·g)/x] = [(f' + r·g')·x − (f + r·g)] / x²  with f' = x·e^(−x),
 * g' = e^(−x), collapses to N(x)/x² where
 *
 *   N(x) = e^(−x)·(x² + (1+r)x + (1+r)) − (1+r)
 *
 * so  dP̄/dT = a·k·N(x)/x².  Limit T → 0⁺:  a·k·(1−r)/2  (= k(a−p₀)/2).
 *
 * The marginal decreases strictly from that limit, crosses 0 at the optimal
 * stopping point x*(r), and stays negative beyond it. Both facts are PROVED
 * in MATH.md §2 (marginal facts 1–2; before 2026-07-14 they were only
 * checked numerically): d/dx[N/x²] = D/x³ with D(0) = 0 and
 * D' = e^(−x)·x²·(x + r − 2) < 0 below x = 2 − r, a range containing the
 * whole working range (0, x*]. The block allocator's exactness rests on the
 * resulting diminishing per-block increments; the numeric sweep in
 * zenith.test.ts remains as a regression check.
 */
export function avgProductivityDerivative(T: number, a: number, p0: number, k: number): number {
	const r = amplitudeRatio(a, p0);

	if (T <= 1e-9) return a * k * ((1 - r) / 2);

	const x = k * T;

	if (x < 1e-4) {
		// Series: N/x² = (1 − (1+r)/2) + ((1+r)/3 − 1)·x + O(x²)
		return a * k * ((1 - r) / 2 + ((1 + r) / 3 - 1) * x);
	}

	const N = Math.exp(-x) * (x * x + (1 + r) * x + (1 + r)) - (1 + r);

	return (a * k * N) / (x * x);
}

/**
 * Optimal-stopping root x*(r): the dimensionless time x = kT at which dP̄/dT = 0.
 *
 * Setting N(x) = 0 and rearranging:   eˣ = 1 + x + x²/(1 + r)
 *
 * - r = 0 recovers the article's equation eˣ = x² + x + 1 with root 1.7933
 *   (OPTIMAL_PHI_MULTIPLIER — under v1's curve the multiplier for EVERY task).
 * - x*(r) is strictly decreasing in r; the stopping time in units of ϕ is
 *   T* = ϕ·x*(r)/(1−r), whose multiplier decreases from 1.7933 (r→0) toward 3/(1+r) → 1.5
 *   (r→1, by series expansion — MATH.md §3). The r→1 end is an ASYMPTOTE:
 *   AMPLITUDE_RATIO_CAP stops r at 0.9, where the multiplier is 1.5194, so
 *   under v2 every task stops between 1.5194ϕ and 1.7933ϕ. Tasks that start
 *   productive (high p₀ relative to peak) stop earlier: their early hours
 *   were already good, so the tail drags the average down sooner.
 *
 * Solved by bisection on q(x) = eˣ − 1 − x − x²/(1+r): q < 0 on (0, x*) and
 * q > 0 beyond, with x* ≤ 1.7933 < 1.80 for every r ≥ 0.
 */
export function optimalStoppingX(r: number): number {
	let lo = 1e-6;
	let hi = 1.8;

	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		const q = Math.exp(mid) - 1 - mid - (mid * mid) / (1 + r);

		if (q < 0) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	return (lo + hi) / 2;
}

// ==================== ϕ-uncertainty (posterior-aware) kernel ====================
//
// MATH.md §5.1. When a task's time-to-flow is uncertain (ϕ ~ N(ϕ̂, σ_ϕ²) from
// the fit posterior), the honest objective is the EXPECTED average
// productivity E[P̄(T; ϕ)] rather than P̄(T; ϕ̂) — P̄ is nonlinear in ϕ, so the
// two differ. Only k = (1−r)/ϕ depends on ϕ (a, p₀, r do not), and every
// component curve has the same peak height, so uncertainty strictly lowers
// the best achievable average: you cannot stop at the optimum of every
// possible ϕ simultaneously. Consequences (probe-verified 2026-07-18, locked
// in as tests): uncertain tasks are worth less at their optimum, their
// increments flatten, and the allocator shifts hours toward well-measured
// tasks — a 2-log task and a 200-log task finally plan differently.
//
// The expectation is a 5-node Gauss–Hermite quadrature over ϕ, exact for
// polynomial integrands through degree 9 — so the quadrature's own leading
// error rides on the 10th ϕ-derivative of P̄ and is negligible here. The
// accuracy floor is NOT the rule's order: it is the ϕ-floor clamping of the
// outer nodes (weight 0.0113 each), which makes the effective mixture
// slightly narrower than N(ϕ̂, σ²) once ϕ̂ − √2σ·2.0202 drops below 0.1h.
// Inside PHI_UNCERTAINTY_RELATIVE_CAP that is a sub-1% shift of the mean ϕ for
// ϕ̂ ≳ 0.31h — below that the inner nodes clamp too and the shift reaches 16.7%
// at a floored ϕ̂ (MATH.md §5.1) —
// and it is exactly the graceful degradation the cap exists to bound — a
// Gaussian is the wrong posterior for a positive quantity out there anyway.
// (An earlier comment called the error "~O(σ⁶)", which understated the rule
// and pointed at the wrong term entirely — MATH.md §13.5.)

// Gauss–Hermite (n=5) abscissae ξ and probabilist weights w/√π: for
// ϕ = ϕ̂ + √2·σ·ξ these integrate a N(ϕ̂, σ²) density exactly through the
// 9th moment. Symmetric pairs share a weight.
const GH_NODES = [
	{
		xi: 0,
		w: 0.5333333333333333,
	},
	{
		xi: 0.9585724646138185,
		w: 0.2220759220056126,
	},
	{
		xi: -0.9585724646138185,
		w: 0.2220759220056126,
	},
	{
		xi: 2.0201828704560856,
		w: 0.011257411327720688,
	},
	{
		xi: -2.0201828704560856,
		w: 0.011257411327720688,
	},
];

/**
 * Cap on σ_ϕ relative to ϕ̂ inside the quadrature: σ_eff = min(σ_ϕ, 0.5·ϕ̂).
 *
 * WHY (probed 2026-07-18, MATH.md §5.1): with σ comparable to ϕ̂ the outer
 * quadrature node collapses onto the ϕ floor and behaves like a fast "spike"
 * curve mixed with slow ones — the mixture turns bimodal in T, which breaks
 * both properties the greedy allocator's exactness rests on (non-increasing
 * block increments, single sign crossing). At σ ≤ 0.5·ϕ̂ the grid is clean for
 * every ϕ̂ the default constants can reach (≤ 3.06h) — but not for all ϕ̂: the
 * spike starts at σ/ϕ̂ ≈ 0.35, so a FITTED ϕ̂ past ~3h still finds bimodal cells
 * inside the cap (re-measured 2026-08-06, `scripts/phi-uncertainty-cap.probe.ts`,
 * MATH.md §5.1). Truncation is what makes that safe, not this cap alone. A σ
 * beyond the cap also means
 * the Gaussian posterior is a poor description of a positive quantity anyway
 * (mass at ϕ < 0), so clamping is a graceful degradation, not a distortion.
 *
 * DO NOT lower this to 0.35 to "close" that gap — measured and rejected
 * 2026-08-06 (`scripts/phi-cap-reachability.probe.ts`, MATH.md §5.1). A real fit
 * cannot produce ϕ̂ > 3.06h and σ/ϕ̂ > 0.35 together (the ridge's λ = 4 anchor
 * shrinks ϕ̂ exactly when σ is large): 0 of 576 000 fitted cells reach the lossy
 * corner, and the 5 of 28 800 that extrapolation reaches forfeit 0.0000%.
 * Lowering the cap clamps 1.23% of realistic cells that hedge today, worth up to
 * +6.809% of conjured task value — ~7% harmful, 0% helpful.
 */
const PHI_UNCERTAINTY_RELATIVE_CAP = 0.5;

// Quadrature nodes over ϕ for a task with posterior mean phi and std sigmaPhi.
// σ ≤ ~0 collapses to the single point mass — the classic, certainty path.
function phiQuadratureNodes(phi: number, sigmaPhi: number): { phi: number; w: number }[] {
	const sigma = Math.min(Math.max(0, sigmaPhi), PHI_UNCERTAINTY_RELATIVE_CAP * phi);

	if (sigma <= 1e-9)
		return [
			{
				phi: Math.max(PHI_FLOOR_HOURS, phi),
				w: 1,
			},
		];

	return GH_NODES.map(({ xi, w }) => ({
		phi: Math.max(PHI_FLOOR_HOURS, phi + Math.SQRT2 * sigma * xi),
		w,
	}));
}

/**
 * Expected average productivity under ϕ-uncertainty:
 *
 *   E[P̄(T; ϕ)],  ϕ ~ N(ϕ̂, σ_ϕ²)  (clamped: σ_eff ≤ 0.5·ϕ̂, nodes ≥ ϕ floor)
 *
 * With σ_ϕ = 0 this IS averageProductivity(T, a, p0, (1−r)/ϕ̂) — the classic
 * model is the exact zero-uncertainty special case, so call sites without a
 * posterior are bit-identical to v2 behavior.
 */
export function expectedAverageProductivity(
	T: number,
	a: number,
	p0: number,
	phi: number,
	sigmaPhi: number,
): number {
	const r = amplitudeRatio(a, p0);
	let sum = 0;

	for (const node of phiQuadratureNodes(phi, sigmaPhi)) {
		sum += node.w * averageProductivity(T, a, p0, (1 - r) / node.phi);
	}

	return sum;
}

// d/dT of the expected average — the mixture marginal Σ wₙ·dP̄/dT(T; ϕₙ).
function expectedAvgProductivityDerivative(
	T: number,
	a: number,
	p0: number,
	phi: number,
	sigmaPhi: number,
): number {
	const r = amplitudeRatio(a, p0);
	let sum = 0;

	for (const node of phiQuadratureNodes(phi, sigmaPhi)) {
		sum += node.w * avgProductivityDerivative(T, a, p0, (1 - r) / node.phi);
	}

	return sum;
}

/**
 * Optimal stopping time under ϕ-uncertainty: the maximizer of E[P̄(T; ϕ)].
 *
 * The mixture marginal is positive below every component's own optimum and
 * negative above all of them, so the root is bracketed by
 * [T*(ϕ_min), T*(ϕ_max)] with T*(ϕ) = x*(r)·ϕ/(1−r), and inside the σ-cap it
 * crosses zero exactly once for every ϕ̂ a default-constants user reaches — 7 of
 * 1400 grid cells at ϕ̂ > 3h are the exception (MATH.md §5.1). 60-step bisection,
 * matching optimalStoppingX's tolerance. σ_ϕ = 0 reduces to the closed-form
 * classic T*.
 */
export function expectedOptimalTime(a: number, p0: number, phi: number, sigmaPhi: number): number {
	const r = amplitudeRatio(a, p0);
	const xStar = optimalStoppingX(r);
	const nodes = phiQuadratureNodes(phi, sigmaPhi);

	if (nodes.length === 1) return (xStar * nodes[0].phi) / (1 - r);

	let lo = (xStar * Math.min(...nodes.map((n) => n.phi))) / (1 - r);
	let hi = (xStar * Math.max(...nodes.map((n) => n.phi))) / (1 - r);

	// Defensive: if the bracket doesn't straddle (only possible at floor-clamped
	// extremes), fall back to the boundary the marginal points at.
	if (expectedAvgProductivityDerivative(lo, a, p0, phi, sigmaPhi) <= 0) return lo;

	if (expectedAvgProductivityDerivative(hi, a, p0, phi, sigmaPhi) >= 0) return hi;

	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;

		if (expectedAvgProductivityDerivative(mid, a, p0, phi, sigmaPhi) > 0) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	return (lo + hi) / 2;
}

/**
 * Parameter-uncertainty std of ϕ at (E, β):  √(xᵀΣx),  x = [E, β, 1].
 *
 * This is deliberately NOT phiPredictionStd: the predictive std adds the
 * observation noise σ̂², which describes stopwatch error and day-to-day scatter
 * around the plane — a property of the user, not of how much we have measured
 * them, so it converges to their own scatter rather than to zero, and using it
 * would make the allocator hedge against tomorrow's scatter forever. Parameter
 * uncertainty is the part the data can actually remove; it vanishes as logs
 * accumulate, and with it the hedging — a well-measured user gets exactly the
 * classic plan. (σ̂ is NOT floored at σ₀ = 0.25h: §5's estimator is a weighted
 * average that the prior anchors only while n is small — MATH.md §10.)
 */
export function phiParameterStd(E: number, beta: number, posterior: FitPosterior): number {
	const x = [E, beta, 1];
	let quad = 0;

	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			quad += x[i] * posterior.covariance[i][j] * x[j];
		}
	}

	return Math.sqrt(Math.max(0, quad));
}

/**
 * Calculate task parameters from user input (the whole map of MATH.md §1).
 *
 * v2: the effective p₀ is capped at AMPLITUDE_RATIO_CAP × a (only binds for
 * user difficulty below ≈1.12, where the article's maps give p₀ = a and the
 * curve degenerates), and k = (1 − p₀/a)/ϕ replaces v1's k = 1/ϕ so the peak
 * stays exactly at t = ϕ under the new curve.
 */
export function calculateTaskParams(
	task: TaskInput,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): {
	E: number;
	beta: number;
	phi: number;
	k: number;
	a: number;
	p0: number;
} {
	const E = mapEffort(task.difficulty);
	const beta = mapEnjoyability(task.enjoyment);
	const phi = calculateFlowStateTime(E, beta, constants);
	const a = calculatePeakScaling(E, beta);
	const p0 = Math.min(calculateInitialProductivity(E, beta), AMPLITUDE_RATIO_CAP * a);
	const k = (1 - p0 / a) / phi;

	return {
		E,
		beta,
		phi,
		k,
		a,
		p0,
	};
}

/**
 * Optimal time for a single task: T* = x*(r)/k, the unique maximizer of P̄(T).
 *
 * v2: closed-form via the optimal-stopping root — no Newton-Raphson iteration
 * needed anymore (v1 seeded Newton at the fixed 1.7933ϕ; v2's root solve IS
 * the answer).
 */
export function findOptimalSingleTaskTime(
	task: TaskInput,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): number {
	const { a, p0, k } = calculateTaskParams(task, constants);

	return optimalStoppingX(amplitudeRatio(a, p0)) / k;
}

// ==================== Discrete allocator (v2) ====================
//
// The objective Σᵢ P̄ᵢ(tᵢ) is maximized over 15-minute blocks by greedy
// marginal analysis. Correctness rests on two facts (fact 1 is proved in
// MATH.md §2 and regression-checked in tests; fact 2 is the classical
// marginal-analysis theorem):
//
// 1. DIMINISHING INCREMENTS: each task's value of its j-th block,
//    Δᵢ(j) = P̄ᵢ(j·δ) − P̄ᵢ((j−1)·δ), is non-increasing in j. The first block
//    carries the p₀ activation bonus (largest by far); subsequent blocks
//    follow the strictly-decreasing marginal of the concave region.
// 2. GREEDY EXACTNESS: with diminishing increments and a single shared block
//    budget, repeatedly funding the highest remaining increment is exactly
//    optimal (Fox 1966 "Discrete optimization via marginal analysis";
//    Ibaraki & Katoh 1988). Equivalently: the optimal plan is the top-B
//    increments of the merged, sorted increment lists.
//
// Switch cost makes "which tasks get funded at all" a fixed-charge decision
// that greedy can't price (an (m)-task plan pays (m−1)·switchCost off the
// budget). It is solved EXACTLY by enumerating funded subsets for n ≤ 12, and
// past that for every subset size the budget can afford (MATH.md §34) — v1's
// iterative count-resolution + greedy drop-search heuristic is gone.
//
// With capacity pools (calculatePooledAllocations) a block is only eligible
// while both pools can absorb its weights. Multi-constraint greedy is no
// longer provably exact (that is a multi-dimensional knapsack), but it is
// feasible by construction, handles the p₀ jump correctly, and lands within
// a block or two of the brute-force optimum on the regression scenarios in
// zenith.test.ts. The v1 Lagrangian-dual coordinate descent it replaces was
// only "exact" for a concave objective — a premise the v2 curve's activation
// bonus breaks — so its guarantee was already gone; see MATH.md §4.

interface AllocTask {
	increments: number[]; // Δ(j) for j = 1..len: positive, non-increasing, truncated at the optimum
	cognitiveWeight: number;
	physicalWeight: number;
	// Already worked today, so the day pays its switch whether or not this plan
	// funds it again (MATH.md §35). False everywhere on the cold path.
	isStarted?: boolean;
}

/**
 * Per-block value increments for one task, truncated at the first non-positive
 * increment (the discrete optimal stopping point — greedy must never be
 * offered a block that lowers the objective, and blocks past T* do).
 *
 * Posterior-aware (σ_ϕ > 0): increments come from the EXPECTED average
 * E[P̄(T; ϕ)] (MATH.md §5.1), and the menu is additionally truncated at the
 * first non-DECREASING increment. Under the σ-cap the mixture's increments
 * are non-increasing everywhere the probe grid reaches, but at floor-clamped
 * extremes (ϕ̂ ≈ hours with σ̂ ≈ half of it) tiny convex wiggles of order
 * 10⁻⁴ appear; cutting the menu there guarantees the diminishing-increments
 * premise of greedy exactness BY CONSTRUCTION instead of by sweep, at a cost
 * that is real where it fires — up to 0.71% of the cell's best value at
 * slider-reachable cells and 28.00% on a wider grid, every cut landing before
 * the menu's own best block count (MATH.md §19.3, 2026-08-17) — in a corner no
 * fitted user has been shown to reach.
 * σ_ϕ = 0 never triggers the monotonicity cut (proved in MATH.md §2).
 *
 * `workedHours` continues the menu from a PREFIX (MATH.md §35): the j-th block
 * is worth P̄(h+jδ) − P̄(h+(j−1)δ), which is the same non-increasing sequence
 * from a later starting index. A started task therefore no longer re-collects
 * the ≈p₀ activation bonus, and one already past T* gets an empty menu.
 * h = 0 is the cold menu exactly — P̄(0) := 0, so `prev` starts where it did.
 */
function buildBlockIncrements(
	a: number,
	p0: number,
	phi: number,
	sigmaPhi: number,
	workedHours = 0,
): number[] {
	const r = amplitudeRatio(a, p0);
	const phiMax = Math.max(...phiQuadratureNodes(phi, sigmaPhi).map((n) => n.phi));

	// No component has positive marginal past its own T*, so the mixture's
	// stopping point is at most T*(ϕ_max) — of which the prefix has already
	// spent `workedHours`, so a spent task offers no blocks at all.
	const maxBlocks =
		Math.ceil(((optimalStoppingX(r) * phiMax) / (1 - r) - workedHours) / BLOCK_HOURS) + 1;

	const increments: number[] = [];
	let prev = expectedAverageProductivity(workedHours, a, p0, phi, sigmaPhi);
	let prevDelta = Infinity;

	for (let j = 1; j <= maxBlocks; j++) {
		const value = expectedAverageProductivity(workedHours + j * BLOCK_HOURS, a, p0, phi, sigmaPhi);
		const delta = value - prev;

		if (delta <= 1e-12 || delta > prevDelta + 1e-12) break;

		increments.push(delta);
		prev = value;
		prevDelta = delta;
	}

	return increments;
}

/**
 * Greedy marginal analysis over a task subset: fund the highest remaining
 * increment until the block budget, the increment lists, or the pools run out.
 * Ties break toward the lower task index, which round-robins identical tasks
 * into equal splits (the article's sanity check). Starts from an existing
 * partial plan when given one (used by the transfer improvement pass).
 *
 * `byPoolRatio` switches the ranking from raw increment to increment per unit
 * of SCARCE pool consumed — the multi-dimensional-knapsack ranking. It exists
 * only as a second candidate plan for pool-bound subsets (MATH.md §13.3); the
 * single-constraint path never sets it, so plain greedy's exactness (Fox 1966)
 * is untouched.
 */
function greedyAllocateBlocks(
	tasks: AllocTask[],
	subset: number[],
	budgetBlocks: number,
	poolCog: number,
	poolPhys: number,
	startBlocks?: number[],
	byPoolRatio = false,
): { blocks: number[]; poolBlocked: boolean } {
	const blocks = startBlocks ? [...startBlocks] : new Array<number>(tasks.length).fill(0);
	let used = 0;
	let remCog = poolCog;
	let remPhys = poolPhys;

	for (let i = 0; i < tasks.length; i++) {
		used += blocks[i];
		remCog -= blocks[i] * BLOCK_HOURS * tasks[i].cognitiveWeight;
		remPhys -= blocks[i] * BLOCK_HOURS * tasks[i].physicalWeight;
	}

	// Fraction of the scarcer pool one block of task i eats. Zero-demand blocks
	// score infinitely well (they cost no pool at all), and the +1e-9 keeps them
	// ordered among themselves by plain increment.
	const poolShare = (i: number): number =>
		Math.max(
			poolCog === Infinity ? 0 : (BLOCK_HOURS * tasks[i].cognitiveWeight) / poolCog,
			poolPhys === Infinity ? 0 : (BLOCK_HOURS * tasks[i].physicalWeight) / poolPhys,
		);

	let poolBlocked = false;

	for (let b = used; b < budgetBlocks; b++) {
		let best = -1;
		let bestInc = 0;

		for (const i of subset) {
			const j = blocks[i];

			if (j >= tasks[i].increments.length) continue;

			if (
				BLOCK_HOURS * tasks[i].cognitiveWeight > remCog + 1e-9 ||
				BLOCK_HOURS * tasks[i].physicalWeight > remPhys + 1e-9
			) {
				poolBlocked = true;
				continue;
			}

			const inc = byPoolRatio
				? tasks[i].increments[j] / (poolShare(i) + 1e-9)
				: tasks[i].increments[j];

			if (inc > bestInc + 1e-12) {
				best = i;
				bestInc = inc;
			}
		}

		if (best === -1) break;

		blocks[best]++;
		remCog -= BLOCK_HOURS * tasks[best].cognitiveWeight;
		remPhys -= BLOCK_HOURS * tasks[best].physicalWeight;
	}

	return {
		blocks,
		poolBlocked,
	};
}

/**
 * Resource-aware transfer pass for pool-bound plans.
 *
 * WHY: plain block greedy ranks by increment VALUE and is blind to how much
 * scarce pool capacity a block consumes. When a pool binds, an hour off a
 * weight-1.0 task frees enough capacity to fund ~3.3h of a weight-0.3 task —
 * a trade greedy can never see (this is the multi-dimensional-knapsack gap;
 * v1's dual coordinate descent priced pools but relied on a concavity premise
 * the v2 curve breaks — MATH.md §4).
 *
 * Move: give back the donor task's most recent block, then greedily refill
 * the freed time + pool capacity across the OTHER tasks; keep the move only
 * if total value strictly improves. Strict improvement makes cycling
 * impossible, and each pass runs only when greedy actually hit a pool wall,
 * so the single-constraint path (pools = ∞) keeps its exactness untouched.
 */
function improveWithTransfers(
	tasks: AllocTask[],
	subset: number[],
	startBlocks: number[],
	budgetBlocks: number,
	poolCog: number,
	poolPhys: number,
): number[] {
	let blocks = startBlocks;
	let value = planValue(tasks, blocks);
	const maxIterations = 4 * budgetBlocks + 16;

	for (let iter = 0; iter < maxIterations; iter++) {
		let bestBlocks: number[] | null = null;
		let bestValue = value;

		for (const donor of subset) {
			if (blocks[donor] <= 0) continue;

			const others = subset.filter((i) => i !== donor);

			// Donate 1, 2, or ALL of the donor's blocks. One block is often too
			// little to unlock the trade: freeing enough pool for a cheap task can
			// need several hours off an expensive one, and every intermediate
			// single-block state is downhill, so a one-block-at-a-time pass stalls
			// (MATH.md §13.3). The all-blocks variant is the "wrong task got the
			// scarce pool" case in a single move.
			for (const give of new Set([1, 2, blocks[donor]])) {
				if (give > blocks[donor]) continue;

				const trial = [...blocks];
				trial[donor] -= give;

				const refilled = greedyAllocateBlocks(
					tasks,
					others,
					budgetBlocks,
					poolCog,
					poolPhys,
					trial,
				).blocks;

				const refillValue = planValue(tasks, refilled);

				if (refillValue > bestValue + 1e-12) {
					bestBlocks = refilled;
					bestValue = refillValue;
				}
			}
		}

		// Admission move: greedy ranks by VALUE, so a task whose blocks are
		// pool-expensive can stay unfunded even when admitting it dominates —
		// and no sequence of single-donor transfers reaches that plan, because
		// the refill immediately re-buys the cheap blocks it just freed. Force
		// one block in, evicting the lowest-value funded blocks until the budget
		// and both pools allow, then refill around it (MATH.md §13.3).
		for (const newcomer of subset) {
			if (blocks[newcomer] > 0 || tasks[newcomer].increments.length === 0) continue;

			const trial = [...blocks];
			trial[newcomer] = 1;

			for (;;) {
				let used = 0;
				let cog = 0;
				let phys = 0;

				for (let i = 0; i < tasks.length; i++) {
					used += trial[i];
					cog += trial[i] * BLOCK_HOURS * tasks[i].cognitiveWeight;
					phys += trial[i] * BLOCK_HOURS * tasks[i].physicalWeight;
				}

				if (used <= budgetBlocks && cog <= poolCog + 1e-9 && phys <= poolPhys + 1e-9) break;

				let victim = -1;
				let cheapest = Infinity;

				for (const i of subset) {
					if (i === newcomer || trial[i] <= 0) continue;

					const inc = tasks[i].increments[trial[i] - 1];

					if (inc < cheapest) {
						cheapest = inc;
						victim = i;
					}
				}

				if (victim === -1) break;

				trial[victim]--;
			}

			const refilled = greedyAllocateBlocks(
				tasks,
				subset,
				budgetBlocks,
				poolCog,
				poolPhys,
				trial,
			).blocks;

			const refillValue = planValue(tasks, refilled);

			if (
				refillValue > bestValue + 1e-12 &&
				feasible(tasks, refilled, budgetBlocks, poolCog, poolPhys)
			) {
				bestBlocks = refilled;
				bestValue = refillValue;
			}
		}

		if (bestBlocks === null) break;

		blocks = bestBlocks;
		value = bestValue;
	}

	return blocks;
}

// The admission move can leave an infeasible plan when the newcomer alone
// overdraws a pool, so its result is checked before being accepted. Every
// other move is feasible by construction.
function feasible(
	tasks: AllocTask[],
	blocks: number[],
	budgetBlocks: number,
	poolCog: number,
	poolPhys: number,
): boolean {
	let used = 0;
	let cog = 0;
	let phys = 0;

	for (let i = 0; i < tasks.length; i++) {
		used += blocks[i];
		cog += blocks[i] * BLOCK_HOURS * tasks[i].cognitiveWeight;
		phys += blocks[i] * BLOCK_HOURS * tasks[i].physicalWeight;
	}

	return used <= budgetBlocks && cog <= poolCog + 1e-9 && phys <= poolPhys + 1e-9;
}

function planValue(tasks: AllocTask[], blocks: number[]): number {
	let value = 0;

	for (let i = 0; i < tasks.length; i++) {
		for (let j = 0; j < blocks[i]; j++) value += tasks[i].increments[j];
	}

	return value;
}

/**
 * Best block plan accounting for switch cost: a plan funding m tasks pays
 * (m−1)·switchCost out of the time budget before any block is placed.
 *
 * n ≤ EXACT_SUBSET_LIMIT: enumerate every funded subset (exact — this is the
 * fixed-charge dimension of the problem and n is small in a daily planner).
 * A subset where greedy leaves a member at 0 blocks is never strictly best
 * (the same plan under the smaller subset has more budget), so enumeration
 * remains exact without special-casing. Ties prefer the plan funding more
 * tasks, preserving v1's "keep the more inclusive plan" behavior.
 *
 * n > EXACT_SUBSET_LIMIT: the same enumeration, bounded to subsets no larger
 * than the budget can fund — still exact wherever it fits the same plan budget,
 * and it fits on the tight days where the subset choice matters most (up to a
 * 3h day at n = 13). Longer days fall through to greedy forward selection,
 * which is where its residual forfeit is 2.3–3.8% (MATH.md §34).
 */
function bestPlanWithSwitchCost(
	tasks: AllocTask[],
	totalBudget: number,
	switchCost: number,
	poolCog: number,
	poolPhys: number,
): number[] {
	const n = tasks.length;
	// The day's funded set is `already started ∪ this plan's subset`, so a plan
	// that abandons a started task does not get its switch back (MATH.md §35).
	// Zero on every cold solve, where this reduces to the old (m−1)·switchCost.
	const startedCount = tasks.filter((t) => t.isStarted).length;

	const budgetBlocksFor = (fundedCount: number): number => {
		const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;

		return Math.floor((totalBudget - overhead) / BLOCK_HOURS + 1e-9);
	};

	// How many tasks the whole DAY funds if this subset is the plan: the started
	// ones, plus whichever members of the subset are not among them.
	const dayFundedCount = (subset: number[]): number =>
		startedCount + subset.reduce((fresh, i) => fresh + (tasks[i].isStarted ? 0 : 1), 0);

	const budgetBlocksForSubset = (subset: number[]): number =>
		budgetBlocksFor(dayFundedCount(subset));

	// Greedy + (only when a pool actually blocked a funding step) a second,
	// ratio-ranked candidate plan, with the resource-aware improvement pass run on
	// BOTH candidates and the better end state kept — picking a start by its
	// initial value is exactly what does not work (MATH.md §13.3). Pool-less plans skip both entirely,
	// preserving plain greedy's exact-optimality on the single constraint.
	const allocate = (subset: number[], budgetBlocks: number): number[] => {
		const { blocks, poolBlocked } = greedyAllocateBlocks(
			tasks,
			subset,
			budgetBlocks,
			poolCog,
			poolPhys,
		);

		if (!poolBlocked) return blocks;

		const byRatio = greedyAllocateBlocks(
			tasks,
			subset,
			budgetBlocks,
			poolCog,
			poolPhys,
			undefined,
			true,
		).blocks;

		// Improve BOTH candidates and keep the better end state. Comparing the
		// two before the pass is not enough: the ratio plan can start higher and
		// finish lower (or vice versa), so picking a start would make this path
		// occasionally worse than plain greedy alone.
		const improved = [blocks, byRatio].map((start) =>
			improveWithTransfers(tasks, subset, start, budgetBlocks, poolCog, poolPhys),
		);

		return planValue(tasks, improved[1]) > planValue(tasks, improved[0])
			? improved[1]
			: improved[0];
	};

	const allTasks = tasks.map((_, i) => i);

	if (switchCost <= 0 || n === 1) {
		return allocate(allTasks, budgetBlocksForSubset(allTasks));
	}

	let bestBlocks = new Array<number>(n).fill(0);
	let bestValue = 0;
	let bestFunded = 0;

	const consider = (blocks: number[]): void => {
		const value = planValue(tasks, blocks);
		const funded = blocks.filter((b) => b > 0).length;

		if (value > bestValue + 1e-9 || (value > bestValue - 1e-9 && funded > bestFunded)) {
			bestBlocks = blocks;
			bestValue = value;
			bestFunded = funded;
		}
	};

	if (n <= EXACT_SUBSET_LIMIT) {
		for (let mask = 1; mask < 1 << n; mask++) {
			const subset: number[] = [];
			for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(i);
			const budgetBlocks = budgetBlocksForSubset(subset);

			if (budgetBlocks <= 0) continue;

			consider(allocate(subset, budgetBlocks));
		}

		return bestBlocks;
	}

	// Past the limit, a tight budget bounds the search back into range on its
	// own: a plan funding m tasks pays (m−1)·switchCost and still owes every
	// member a block, so subsets larger than `maxFunded` are unaffordable — and
	// were never optimal anyway (the subset greedy really funds gets the same
	// blocks out of a bigger budget). Enumerating only up to that size is exact
	// whenever it fits the same plan budget the n ≤ 12 path spends, which is
	// every day tight enough for the choice of subset to be worth much.
	//
	// "Never optimal anyway" is a proof only here, against the single budget.
	// Once pools bind, `improveWithTransfers` can admit a zero-block member and
	// then empty a donor, so a task the greedy did not fund still shapes the
	// plan and the step does not close; there the bound keeps §13.3's measured
	// status (MATH.md §34).
	//
	// `budgetBlocksFor(max(startedCount, m)) − m` is non-increasing, so the
	// affordable sizes are the interval [1, maxFunded] and stopping at the first
	// failure finds it. A budget under one block affords nothing and leaves the
	// empty plan.
	let maxFunded = 0;

	// `max(startedCount, m)` is the SMALLEST day-funded count a size-m subset can
	// have (every member already started), so this never bounds out a subset the
	// budget could actually afford.
	while (maxFunded < n && budgetBlocksFor(Math.max(startedCount, maxFunded + 1)) >= maxFunded + 1)
		maxFunded++;

	if (maxFunded === 0) return bestBlocks;

	if (subsetCount(n, maxFunded) <= SUBSET_SEARCH_BUDGET) {
		const subset: number[] = [];

		const enumerateFrom = (start: number): void => {
			for (let i = start; i < n; i++) {
				subset.push(i);
				consider(allocate(subset, budgetBlocksForSubset(subset)));

				if (subset.length < maxFunded) enumerateFrom(i + 1);

				subset.pop();
			}
		};

		enumerateFrom(0);

		return bestBlocks;
	}

	// A long enough day funds everything, so no bound brings the enumeration
	// back: greedy forward selection — add the task whose admission most improves
	// the total, stop when none does. Documented heuristic, still 2.3–3.8% short and
	// still non-monotone in the budget, in the regime where that costs least
	// (MATH.md §34).
	const funded: number[] = [];

	for (;;) {
		let bestAdd = -1;
		let bestAddBlocks: number[] | null = null;
		let bestAddValue = bestValue;

		for (let i = 0; i < n; i++) {
			if (funded.includes(i)) continue;

			const trial = [...funded, i];
			const budgetBlocks = budgetBlocksForSubset(trial);

			if (budgetBlocks <= 0) continue;

			const blocks = allocate(trial, budgetBlocks);
			const value = planValue(tasks, blocks);

			if (value > bestAddValue + 1e-9) {
				bestAdd = i;
				bestAddBlocks = blocks;
				bestAddValue = value;
			}
		}

		if (bestAdd === -1 || bestAddBlocks === null) break;

		funded.push(bestAdd);
		bestBlocks = bestAddBlocks;
		bestValue = bestAddValue;
		bestFunded = funded.length;
	}

	return bestBlocks;
}

// Σⱼ₌₁ᵏ C(n, j) — how many plans a size-bounded enumeration costs.
function subsetCount(n: number, maxSize: number): number {
	let plans = 0;
	let choose = 1;

	for (let j = 1; j <= maxSize; j++) {
		choose = (choose * (n + 1 - j)) / j;
		plans += choose;
	}

	return plans;
}

// Per-task ϕ parameter-uncertainty stds; zeros (classic behavior) without a
// posterior. The stds feed the expected-productivity kernel (MATH.md §5.1).
function phiStdsFor(
	params: ReturnType<typeof calculateTaskParams>[],
	posterior?: FitPosterior,
): number[] {
	if (!posterior) return params.map(() => 0);

	return params.map(({ E, beta }) => phiParameterStd(E, beta, posterior));
}

/**
 * Curve parameters, ϕ-uncertainty and single-task optima — the preamble every
 * allocation path shares. One place, so a funded plan and the empty plan cannot
 * compute a task's intrinsic values differently.
 */
function buildTaskParams(tasks: TaskInput[], constants: UserConstants, posterior?: FitPosterior) {
	const params = tasks.map((task) => calculateTaskParams(task, constants));
	const phiStds = phiStdsFor(params, posterior);

	return {
		params,
		phiStds,
		optimalTimes: params.map(({ a, p0, phi }, i) => expectedOptimalTime(a, p0, phi, phiStds[i])),
	};
}

function toAllocations(
	tasks: TaskInput[],
	params: ReturnType<typeof calculateTaskParams>[],
	phiStds: number[],
	optimalTimes: number[],
	blocks: number[],
): TaskAllocation[] {
	return tasks.map((task, i) => {
		const { E, beta, phi, a, p0 } = params[i];
		const hours = blocks[i] * BLOCK_HOURS;

		return {
			...task,
			allocatedHours: hours,
			E,
			beta,
			phi,
			// The peak height a·e^(r−1) does not depend on ϕ — uncertainty moves
			// WHEN the peak happens, not how high it is — so no expectation needed.
			peakProductivity: a * Math.exp(p0 / a - 1),
			avgProductivity: expectedAverageProductivity(hours, a, p0, phi, phiStds[i]),
			optimalHours: optimalTimes[i],
			optimalAvgProductivity: expectedAverageProductivity(optimalTimes[i], a, p0, phi, phiStds[i]),
		};
	});
}

/**
 * The empty plan: nobody gets time, but every task-INTRINSIC quantity keeps
 * its real value (MATH.md §3). ϕ, T*, the peak height and P̄(T*) are functions
 * of the task's own (E, β) and the user constants alone — not of the budget,
 * the pools, or the other tasks — so zeroing them made a task's intrinsic
 * priority score read 0 at budget 0, contradicting the invariant at exactly
 * the boundary where it is the only thing left to rank by. Only
 * `allocatedHours` and `avgProductivity` are allocation-dependent, and both
 * are legitimately 0 here (P̄(0) := 0 by definition — see averageProductivity).
 */
function zeroAllocations(
	tasks: TaskInput[],
	constants: UserConstants,
	posterior?: FitPosterior,
): TaskAllocation[] {
	const { params, phiStds, optimalTimes } = buildTaskParams(tasks, constants, posterior);

	return toAllocations(
		tasks,
		params,
		phiStds,
		optimalTimes,
		tasks.map(() => 0),
	);
}

/**
 * Main optimization: allocate the time budget across tasks in 15-minute
 * blocks to maximize  Σᵢ P̄ᵢ(tᵢ)  subject to  Σᵢ tᵢ + (m−1)·switchCost ≤ T,
 * where m is the number of tasks that actually receive time.
 *
 * v2: exact on the block grid (greedy marginal analysis per funded subset +
 * exhaustive subset enumeration for the switch-cost fixed charge, n ≤ 12, and
 * bounded by what the budget can fund past that — MATH.md §34).
 * An abundant budget still leaves slack: blocks past a task's optimal
 * stopping time have negative increments and are never offered to greedy.
 *
 * With a fit `posterior` the objective becomes the EXPECTED average
 * productivity under each task's ϕ-uncertainty (MATH.md §5.1); without one,
 * behavior is bit-identical to the certainty model.
 */
export function calculateTaskAllocations(
	tasks: TaskInput[],
	totalBudget: number,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior,
): TaskAllocation[] {
	if (tasks.length === 0 || totalBudget <= 0) {
		return zeroAllocations(tasks, constants, posterior);
	}

	const { params, phiStds, optimalTimes } = buildTaskParams(tasks, constants, posterior);

	const allocTasks: AllocTask[] = params.map(({ a, p0, phi }, i) => ({
		increments: buildBlockIncrements(a, p0, phi, phiStds[i]),
		cognitiveWeight: 0,
		physicalWeight: 0,
	}));

	const blocks = bestPlanWithSwitchCost(allocTasks, totalBudget, switchCost, Infinity, Infinity);

	return toAllocations(tasks, params, phiStds, optimalTimes, blocks);
}

/**
 * Human capacity pools: hours of *intense* work each energy system sustains
 * per day. An hour of a task drains each pool by its weight (e.g. a task with
 * cognitiveWeight 0.8 spends 0.8 cognitive-hours per clock hour), so light
 * tasks stretch further than max-intensity ones.
 */
export interface CapacityPools {
	cognitiveHours: number;
	physicalHours: number;
}

export const DEFAULT_CAPACITY_POOLS: CapacityPools = {
	cognitiveHours: 4, // ~4h/day of intense mental work
	physicalHours: 6, // ~6h/day of intense physical work
};

export interface PooledTaskInput extends TaskInput {
	cognitiveWeight: number; // 0-1: how hard the task draws on the cognitive pool
	physicalWeight: number; // 0-1: how hard the task draws on the physical pool
}

/**
 * Dual-pool optimization: allocate a time budget across tasks under THREE
 * resource constraints instead of one:
 *
 *   Maximize  Σᵢ P̄ᵢ(tᵢ)
 *   s.t.      Σᵢ tᵢ + (m−1)·switchCost ≤ time budget
 *             Σᵢ wcᵢ × tᵢ  ≤ cognitive pool
 *             Σᵢ wpᵢ × tᵢ  ≤ physical pool
 *
 * The insight this captures: cognitive and physical fatigue are separate
 * systems (Boksem & Tops 2008). "6h of coding" saturates at the ~4h cognitive
 * pool, but "4h coding + 2h gym" fits — the physical hours draw on a
 * different pool.
 *
 * v2 solver: the same block-greedy as the single-budget allocator, with a
 * block only eligible while both pools can absorb its weights. This replaced
 * the v1 Lagrangian-dual coordinate descent, whose global-optimality argument
 * required a concave objective — the v2 curve's activation bonus at t = 0⁺
 * (see averageProductivity) breaks exactly that premise. The greedy is not
 * provably exact under multiple constraints (multi-dimensional knapsack), but
 * every plan it emits is feasible by construction, and the brute-force
 * regression tests hold it within a block of optimal; see MATH.md §4.
 *
 * `workedHours` (index-aligned with `tasks`) re-plans from a PREFIX — hours
 * already spent today, so each task's menu continues from where it is rather
 * than from zero (MATH.md §35). It moves only the menus: `totalBudget` is the
 * budget the plan may still spend and `pools` the capacity it may still draw,
 * both the caller's to deplete, because a task that no longer takes hours (a
 * completed one) still spent them.
 */
export function calculatePooledAllocations(
	tasks: PooledTaskInput[],
	totalBudget: number,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior,
	workedHours?: number[],
): TaskAllocation[] {
	if (tasks.length === 0 || totalBudget <= 0) {
		return zeroAllocations(tasks, constants, posterior);
	}

	const { params, phiStds, optimalTimes } = buildTaskParams(tasks, constants, posterior);

	const allocTasks: AllocTask[] = params.map(({ a, p0, phi }, i) => ({
		increments: buildBlockIncrements(a, p0, phi, phiStds[i], workedHours?.[i] ?? 0),
		cognitiveWeight: tasks[i].cognitiveWeight,
		physicalWeight: tasks[i].physicalWeight,
		isStarted: (workedHours?.[i] ?? 0) > 0,
	}));

	const blocks = bestPlanWithSwitchCost(
		allocTasks,
		totalBudget,
		switchCost,
		pools.cognitiveHours,
		pools.physicalHours,
	);

	return toAllocations(tasks, params, phiStds, optimalTimes, blocks);
}

/**
 * Calculate total productivity for a given allocation
 * P(t₁, t₂, ..., tₙ) = Σᵢ P̄ᵢ(tᵢ)
 *
 * With a `posterior`, each term is the expected average under that task's
 * ϕ-uncertainty — the same objective the posterior-aware allocator maximizes,
 * so plan values and gain comparisons stay in one currency.
 */
export function calculateTotalProductivity(
	tasks: TaskInput[],
	allocations: number[],
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior,
): number {
	return tasks.reduce((total, task, i) => {
		const { E, beta, a, p0, phi } = calculateTaskParams(task, constants);
		const sigma = posterior ? phiParameterStd(E, beta, posterior) : 0;

		return total + expectedAverageProductivity(allocations[i], a, p0, phi, sigma);
	}, 0);
}

/**
 * Display cap for the relative gain vs the naive baseline, in percent.
 *
 * Ratios above ~10× carry no extra decision value, so the gain saturates here;
 * a capped value reads as "≥ 10× the naive plan".
 *
 * WHY it fires (2026-08-06, MATH.md §19.4 — this REPLACES the §11.2 rationale).
 * §11.2 added the cap for `naive = 0`, which it read as "many tasks, small
 * budget, switch overhead eats everything". That was an artifact of billing the
 * baseline for switches its plan never made, and §19 removed it: the `naive = 0`
 * arm of `gainPercentOf` now needs a budget under one whole block, where the
 * optimizer scores 0 too and the function returns 0 rather than the cap.
 *
 * What still reaches the cap is the opposite regime. The baseline must spend its
 * whole block target, so a long budget poured into FEW tasks pushes each past
 * its own T*, where P̄ decays like C/T, while the optimizer stops at T* and
 * leaves the slack unused. Measured 2026-08-17 (`gain-cap-trigger.probe.ts`) at
 * difficulty 5 / enjoyment 5, σ_ϕ = 0: with a fitted ϕ̂ at the 0.1h floor the
 * single-budget gain reads 999% from 4.25h at n = 1 (8.5 / 13 / 17.25 / 21.75h
 * at n = 2 / 3 / 4 / 5, never within 24h at n = 6). At the σ_ϕ a 15–30m history
 * fits, every rung is one to four budget steps LATER, none of them lost. At
 * DEFAULT constants it is unreachable — the 24h maximum is 291.7% there and
 * 479.7% anywhere on the slider grid, and 41.6% on the pooled path the dashboard
 * shows. The user is reachable too: 97.3% of seeded fast-flow histories fit a ϕ̂
 * onto the floor.
 */
export const GAIN_PERCENT_CAP = 999;

/**
 * The naive planner's plan: an equal split of `target` blocks across at most
 * `maxFunded` of the tasks in `order`, on the SAME 15-minute lattice the
 * optimizer is held to. Blocks are handed out round-robin (so the split is
 * equal to within one block, ties toward the front of `order` like greedy),
 * skipping any task whose next block would overdraw a capacity pool. Pools of
 * Infinity give the single-budget baseline.
 *
 * `maxFunded` caps how many DISTINCT tasks may be opened, which is what keeps
 * the switch bill honest (`naiveBaselineValue`) — but the walk still runs over
 * the whole of `order`, so a pool-blocked task is passed over in favour of the
 * next feasible one instead of costing the plan a seat. Restricting `order`
 * itself to the first `maxFunded` entries is the tempting shortcut and it is
 * wrong: a window that happens to hold only pool-blocked tasks yields an
 * all-zero plan, which drags the rotation average down and resurrects the very
 * `naive = 0 → GAIN_PERCENT_CAP` reading §19 removed (measured before this
 * guard: 8 tasks at 0.25h against a zeroed physical pool reported 700%, and
 * 12 tasks reported the full 999%, where the honest answer is 0%).
 *
 * WHY quantized (2026-07-26, MATH.md §13.2 — this REVERSES the §7 "naive
 * baselines stay continuous" decision). A continuous baseline can hand every
 * task a 0.373h sliver and collect its ≈ p₀ activation bonus (§2), something
 * Zenith structurally cannot do. The gain metric was therefore measuring two
 * things at once — allocation quality AND a lattice handicap charged to one
 * side only — and the handicap dominated: measured over random days the
 * reported gain was NEGATIVE on 3.8–7.8% of them, with no trend in n (the
 * "4% at n = 2 rising to 19% at n = 6" first quoted here came from a draw whose
 * generator was never committed and does not reproduce — §13.2). Since the
 * lattice is an accounting choice rather than a cost Zenith imposes on the
 * user (nobody executes 0.373h either way), both planners now face the same
 * feasible set and the number isolates allocation quality.
 */
function naiveBlockPlan(
	weights: { cognitiveWeight: number; physicalWeight: number }[],
	order: number[],
	target: number,
	maxFunded: number,
	poolCog: number,
	poolPhys: number,
): number[] {
	const blocks = new Array<number>(weights.length).fill(0);
	let remCog = poolCog;
	let remPhys = poolPhys;
	let placed = 0;
	let funded = 0;

	while (placed < target) {
		let any = false;

		for (const i of order) {
			if (placed >= target) break;

			if (blocks[i] === 0 && funded >= maxFunded) continue;

			const cog = BLOCK_HOURS * weights[i].cognitiveWeight;
			const phys = BLOCK_HOURS * weights[i].physicalWeight;

			if (cog > remCog + 1e-9 || phys > remPhys + 1e-9) continue;

			if (blocks[i] === 0) funded++;

			blocks[i]++;
			remCog -= cog;
			remPhys -= phys;
			placed++;
			any = true;
		}

		if (!any) break;
	}

	return blocks.map((b) => b * BLOCK_HOURS);
}

/**
 * The naive baseline's productivity — the denominator of the reported gain.
 *
 * Two properties the plain round-robin above did not have on its own, both
 * fixed here (2026-08-06, MATH.md §19):
 *
 * 1. **It pays for the switches it makes.** The baseline used to be billed
 *    (n−1)·switchCost for ALL n listed tasks while the plan it produced seated
 *    only as many as the leftover budget could reach — on 39.3% of days at
 *    n = 8 and 3.3% at n = 2 (`scripts/rv14-naive-switch-bill.probe.ts` arm A,
 *    2026-08-06). That is the same one-sided handicap §13.2 removed from the
 *    lattice,
 *    and it is the sole cause of the `naive = 0 → GAIN_PERCENT_CAP` reading
 *    (which fires exactly when budget < n·BLOCK_HOURS). The bill is instead the
 *    largest k the plan genuinely seats — the same "funded, not listed" rule the
 *    switch-cost lever already uses (`metric/plan-advice.ts`).
 *
 *    Affordability is necessary but NOT sufficient, which is why the scan below
 *    validates k against the plan rather than against the budget alone: a task
 *    the pools cannot seat is one the baseline must not be charged a switch for
 *    either. Budget-only, the bill over-charged on 18.9% of pool-bound days, and
 *    on a zeroed pool it withheld a full hour of the baseline's own budget.
 * 2. **It does not depend on the order of the task list.** `target` blocks
 *    rarely divide evenly, so round-robin hands the remainder to whichever
 *    tasks sit early in the array — and `addTask` PREPENDS, so adding a task
 *    moved the reported gain of an unchanged plan (on 73.5% of days at n = 8,
 *    by up to 602.6pp). Averaging over the n cyclic rotations gives every task
 *    the odd block equally often; because the objective is a sum of per-task
 *    terms, that average is EXACTLY permutation-invariant whenever no pool
 *    binds. When one does the skips are not separable and a residue survives:
 *    permutation-exact on 96.13% of 2400 days, worst baseline spread 1.61%,
 *    worst reported-gain spread 3.4pp (2026-08-06, §19).
 */
function naiveBaselineValue(
	tasks: PooledTaskInput[],
	totalBudget: number,
	switchCost: number,
	poolCog: number,
	poolPhys: number,
	constants: UserConstants,
	posterior?: FitPosterior,
): number {
	const n = tasks.length;

	const blocksFor = (funded: number): number =>
		Math.floor((totalBudget - (funded > 1 ? (funded - 1) * switchCost : 0)) / BLOCK_HOURS + 1e-9);

	/**
	 * The plan this rotation's naive planner ends up with: the largest k it can
	 * both afford (k whole blocks left after k−1 switches) and actually seat
	 * (the pools admit k distinct tasks). Scanning down accepts the first k that
	 * survives both, so the bill and the plan always agree. All-zero when the
	 * budget is under one block — the optimizer scores 0 there too.
	 */
	const planFrom = (start: number): number[] => {
		const order = Array.from(
			{
				length: n,
			},
			(_, j) => (start + j) % n,
		);

		for (let k = n; k >= 1; k--) {
			const target = blocksFor(k);

			if (target < k) continue;

			const hours = naiveBlockPlan(tasks, order, target, k, poolCog, poolPhys);

			if (hours.filter((h) => h > 0).length === k) return hours;
		}

		return new Array<number>(n).fill(0);
	};

	let total = 0;

	for (let start = 0; start < n; start++) {
		total += calculateTotalProductivity(tasks, planFrom(start), constants, posterior);
	}

	return total / n;
}

function gainPercentOf(optimized: number, naive: number): number {
	if (naive > 0) {
		return Number(Math.min(GAIN_PERCENT_CAP, ((optimized - naive) / naive) * 100).toFixed(1));
	}

	return optimized > 0 ? GAIN_PERCENT_CAP : 0;
}

/**
 * Compare productivity gain from the dual-pool Zenith optimization vs a naive
 * equal time split, under the SAME constraints: the naive planner splits the
 * budget equally over as many tasks as the day can actually seat, pays only
 * those switches, and skips any task whose next whole block would overdraw a
 * capacity pool — averaged over the n cyclic rotations of the task list so the
 * odd block is not an artifact of list order (`naiveBaselineValue`, MATH.md
 * §19). Both plans being pool-feasible and billed for their own switches makes
 * the comparison about allocation quality, not about one side carrying a
 * constraint the other is spared.
 */
export function pooledProductivityGain(
	tasks: PooledTaskInput[],
	totalBudget: number,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior,
	/**
	 * The optimized plan's hours per task, index-aligned with `tasks`, when the
	 * caller has already solved it. Omit and the plan is solved here. This is
	 * not an optimization detail the caller may skip lightly: a screen showing
	 * both the plan and its gain would otherwise run the 2ⁿ funded-subset
	 * enumeration twice on identical inputs (~50ms each at n = 12), and the
	 * second run can only reproduce the first — the allocator is deterministic.
	 */
	allocatedHours?: number[],
): { optimized: number; naive: number; gainPercent: number } {
	if (tasks.length === 0 || totalBudget <= 0) {
		return {
			optimized: 0,
			naive: 0,
			gainPercent: 0,
		};
	}

	// The length is checked, not trusted: a short array pairs a task with
	// `undefined` hours, and the whole optimized sum comes back NaN — a rendered
	// "NaN%" rather than a wrong number, from a caller that only got the
	// bookkeeping slightly wrong. Falling back to the solve costs time and
	// nothing else.
	const solvedHours =
		allocatedHours?.length === tasks.length
			? allocatedHours
			: calculatePooledAllocations(tasks, totalBudget, pools, constants, switchCost, posterior).map(
					(allocation) => allocation.allocatedHours,
				);

	const optimized = calculateTotalProductivity(tasks, solvedHours, constants, posterior);

	// Naive: an equal split on the same block lattice and inside the same pools
	// as the optimized plan, spread over as many tasks as the day can seat and
	// billed for exactly those switches — see naiveBaselineValue.
	const naive = naiveBaselineValue(
		tasks,
		totalBudget,
		switchCost,
		pools.cognitiveHours,
		pools.physicalHours,
		constants,
		posterior,
	);

	return {
		optimized,
		naive,
		gainPercent: gainPercentOf(optimized, naive),
	};
}

/**
 * Compare productivity gain from Zenith optimization vs a naive equal split,
 * with both pools unbounded so the time budget is the only constraint.
 *
 * Each side is billed for the switches its OWN plan makes — the optimizer for
 * its funded subset, the baseline for the tasks it seats (MATH.md §19) — so
 * neither is handicapped by the other's task count.
 */
export function productivityGain(
	tasks: TaskInput[],
	totalBudget: number,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior,
): { optimized: number; naive: number; gainPercent: number } {
	if (tasks.length === 0 || totalBudget <= 0) {
		return {
			optimized: 0,
			naive: 0,
			gainPercent: 0,
		};
	}

	const optimizedAllocs = calculateTaskAllocations(
		tasks,
		totalBudget,
		constants,
		switchCost,
		posterior,
	);

	const optimized = calculateTotalProductivity(
		tasks,
		optimizedAllocs.map((a) => a.allocatedHours),
		constants,
		posterior,
	);

	// Naive: the same baseline as the pooled path with both pools unbounded, so
	// the only constraint is the time budget (naiveBaselineValue explains it).
	const naive = naiveBaselineValue(
		tasks.map((task) => ({
			...task,
			cognitiveWeight: 0,
			physicalWeight: 0,
		})),
		totalBudget,
		switchCost,
		Infinity,
		Infinity,
		constants,
		posterior,
	);

	return {
		optimized,
		naive,
		gainPercent: gainPercentOf(optimized, naive),
	};
}

// ==================== Personalization (Bayesian, v2) ====================

/**
 * A measured "time until flow state" data point, as the article prescribes:
 * for each task, a stopwatch measures how long it took to get in the zone.
 */
export interface FlowObservation {
	E: number; // mapped effort (1-5) of the task when the observation was taken
	beta: number; // mapped enjoyability (1-2)
	phi: number; // measured time to reach flow state, in hours
	/** Calendar days between the log and today; omitted counts as fresh (MATH.md §5.2) */
	ageDays?: number;
}

/**
 * Half-life of a ⚡ log's influence on the ϕ fit, in days (MATH.md §5.2).
 *
 * ϕ is not stationary: a new job, a newborn, an illness or ten years of ageing
 * all move how long it takes a person to reach flow, and an unweighted fit
 * averages the person they were with the person they are. One year is slow
 * enough that a steady logger keeps a personal fit through a quiet stretch, and
 * fast enough that a decade-old log lands at 2⁻¹⁰ ≈ 0.001 — effectively gone.
 *
 * Applied to ⚡ ONLY. The energy fits (r, α, λ₀) stay unweighted — see §5.2.
 */
export const PHI_RECENCY_HALF_LIFE_DAYS = 365;

/**
 * Prior strength for the regularized constants fit. Bayesian reading (v2):
 * with observation noise σ and coefficient prior c ~ N(c₀, (σ²/λ)·I), the
 * posterior mean is EXACTLY the ridge solution with this λ — i.e. v1's ridge
 * fit was already the MAP estimate of this model; v2 just surfaces the rest
 * of the posterior. λ = 4 ⇒ prior std per coefficient = σ/2 (≈ 7–8 minutes
 * with the default noise scale), and the defaults act like 4
 * pseudo-observations: early ⚡ logs nudge the model smoothly away from the
 * defaults, and the fit stays well-posed even when every logged task is
 * identical.
 */
const RIDGE_PRIOR_STRENGTH = 4;
/**
 * Prior scale for the stopwatch measurement noise: σ₀ = 15 minutes (0.25h),
 * with weight ν₀ = RIDGE_PRIOR_STRENGTH pseudo-observations. "Time until I
 * was in the zone" is self-reported and fuzzy; a quarter-hour standard
 * deviation is an honest floor that keeps σ̂ from collapsing to 0 when the
 * first few logs happen to agree.
 */
const FLOW_NOISE_PRIOR_STD = 0.25;

/**
 * Posterior of the fitted plane, exposed so callers can quantify uncertainty
 * instead of treating a 2-observation fit like a 200-observation one.
 */
export interface FitPosterior {
	/** 3×3 posterior covariance of (c₁, c₂, c₃): σ̂²·(XᵀWX + λI)⁻¹, W = §5.2 weights */
	covariance: number[][];
	/** Estimated observation noise variance σ̂² (hours²) */
	sigma2: number;
}

/**
 * The PRIOR as a posterior: what the model believes before (or instead of) any
 * data. It is literally the n = 0 limit of the fitted formulas — with no
 * observations XᵀX = 0, so Σ = σ̂²·(λI)⁻¹ = (σ₀²/λ)·I and σ̂² = σ₀².
 *
 * WHY this exists (2026-07-26 math-review fix, MATH.md §13.1): every fallback
 * path used to return NO posterior, and a missing posterior means σ_ϕ = 0
 * downstream — i.e. the allocator treated a user with ZERO ⚡ logs as
 * PERFECTLY certain, then started hedging the moment they logged their first
 * one. Measured at (E, β) = (2.78, 1.44): σ_ϕ was 0 at n = 0, 0.191h at n = 1,
 * 0.002473h at n = 200. The honest sequence is 0.411 → 0.191 → 0.002473, monotone
 * decreasing in data — which is exactly what §5.1's whole premise claims.
 * Returning the prior posterior restores that ordering; `fitted` still reports
 * whether the DATA moved the constants, which is what the UI keys on.
 */
function priorPosterior(): FitPosterior {
	const variance = (FLOW_NOISE_PRIOR_STD * FLOW_NOISE_PRIOR_STD) / RIDGE_PRIOR_STRENGTH;

	return {
		covariance: [
			[variance, 0, 0],
			[0, variance, 0],
			[0, 0, variance],
		],
		sigma2: FLOW_NOISE_PRIOR_STD * FLOW_NOISE_PRIOR_STD,
	};
}

/**
 * Personalize the user constants from measured time-to-flow data.
 *
 * MODEL (v2 — full Bayesian linear regression; v1 computed only the MAP):
 *
 *   ϕᵢ = c·xᵢ + εᵢ,  εᵢ ~ N(0, σ²),  prior c ~ N(c₀, (σ²/λ)·I)
 *
 * with design rows xᵢ = [Eᵢ, βᵢ, 1], prior mean c₀ = fallback constants and
 * λ = RIDGE_PRIOR_STRENGTH.
 *
 * Posterior (all closed-form), with W = diag(wᵢ) the §5.2 recency weights:
 *   mean        ĉ = (XᵀWX + λI)⁻¹ (XᵀWϕ + λc₀)     ← v1's ridge at every wᵢ = 1
 *   covariance  Σ = σ̂²·(XᵀWX + λI)⁻¹
 *   noise       σ̂² = (ν₀σ₀² + Σwᵢ(ϕᵢ − ĉ·xᵢ)²)/(ν₀ + Σwᵢ)
 *
 * Σwᵢ is the data mass: it replaces the observation count everywhere n stood,
 * and is returned as `effectiveCount` — "how many fresh logs is this history
 * worth", which is what the "Your model" card prints.
 *
 * The point estimate the allocator consumes is unchanged from v1 (the ridge
 * MAP); `posterior` is what makes a 2-log plan differ from a 200-log plan
 * (MATH.md §5.1) — see phiPredictionStd for turning it into an uncertainty
 * band on ϕ.
 *
 * The prior keeps the fit graceful everywhere batch least squares is brittle:
 * a single observation nudges the model instead of being ignored; degenerate
 * data (every logged task identical) shifts predictions near the logged point
 * while staying anchored to the prior elsewhere; and the system matrix is
 * always positive definite, so there is no singular case.
 *
 * Falls back (fitted: false) only with zero observations, or if the fitted
 * plane predicts an absurdly large ϕ (> 16h) somewhere on the E×β domain
 * (possible with wildly inconsistent measurements). Negative predictions at
 * unobserved corners are deliberately ALLOWED: uniformly short measured flow
 * times (a fast-flow user logging 15–30m everywhere) legitimately tilt the
 * plane slightly below zero far from their tasks, and rejecting that made
 * such users unable to personalize at all. calculateFlowStateTime floors
 * every prediction at 0.1h, so a negative corner never reaches the model.
 *
 * EVERY return carries a posterior, including the fallbacks: falling back
 * means "the prior is all we know", and the prior's own uncertainty is real
 * information the allocator must see (priorPosterior, MATH.md §13.1). Before
 * 2026-07-26 the fallbacks returned none, which downstream read as certainty.
 */
export function fitUserConstants(
	observations: FlowObservation[],
	fallback: UserConstants = DEFAULT_USER_CONSTANTS,
): {
	constants: UserConstants;
	fitted: boolean;
	posterior: FitPosterior;
	effectiveCount: number;
} {
	if (observations.length === 0) {
		return {
			constants: fallback,
			fitted: false,
			posterior: priorPosterior(),
			effectiveCount: 0,
		};
	}

	// A backup restored from a device with a fast clock carries a log dated
	// ahead of today; without the floor its weight exceeds 1 and that one log
	// outvotes the rest.
	const weights = observations.map((o) =>
		Math.pow(2, -Math.max(0, o.ageDays ?? 0) / PHI_RECENCY_HALF_LIFE_DAYS),
	);

	let sEE = 0;
	let sEb = 0;
	let sE = 0;
	let sbb = 0;
	let sb = 0;
	let sEp = 0;
	let sbp = 0;
	let sp = 0;
	// Σw replaces the observation count everywhere n appeared: it is the ridge's
	// data mass, so a fit of ancient logs is pulled to the prior exactly as a fit
	// of few logs is — and it is therefore also the honest count to report.
	// (Σw)²/Σw², the usual effective sample size, is the WRONG statistic here: it
	// measures how evenly weight is spread, so 20 logs all ten years old score a
	// full 20 beside a fit that has returned to the prior.
	let sumWeight = 0;

	for (const [i, o] of observations.entries()) {
		const w = weights[i];
		sEE += w * o.E * o.E;
		sEb += w * o.E * o.beta;
		sE += w * o.E;
		sbb += w * o.beta * o.beta;
		sb += w * o.beta;
		sEp += w * o.E * o.phi;
		sbp += w * o.beta * o.phi;
		sp += w * o.phi;
		sumWeight += w;
	}

	const lambda = RIDGE_PRIOR_STRENGTH;

	const A = [
		[sEE + lambda, sEb, sE],
		[sEb, sbb + lambda, sb],
		[sE, sb, sumWeight + lambda],
	];

	const solution = solve3x3(A, [
		sEp + lambda * fallback.c1,
		sbp + lambda * fallback.c2,
		sp + lambda * fallback.c3,
	]);

	// The ridge matrix is positive definite, so solve3x3 cannot hit a singular
	// pivot — the guard stays purely as defense in depth.
	if (!solution)
		return {
			constants: fallback,
			fitted: false,
			posterior: priorPosterior(),
			effectiveCount: sumWeight,
		};

	const [c1, c2, c3] = solution;

	for (const E of [1, 5]) {
		for (const beta of [1, 2]) {
			const phi = c1 * E + c2 * beta + c3;

			if (!Number.isFinite(phi) || phi > 16) {
				return {
					constants: fallback,
					fitted: false,
					posterior: priorPosterior(),
					effectiveCount: sumWeight,
				};
			}
		}
	}

	// Noise estimate: residual sum of squares blended with the prior scale
	// (inverse-gamma-style pseudo-observations), so σ̂ neither collapses to 0 on
	// a couple of lucky logs nor ignores genuinely noisy users.
	let ssr = 0;

	for (const [i, o] of observations.entries()) {
		const resid = o.phi - (c1 * o.E + c2 * o.beta + c3);
		ssr += weights[i] * resid * resid;
	}

	const nu0 = RIDGE_PRIOR_STRENGTH;
	const sigma2 = (nu0 * FLOW_NOISE_PRIOR_STD * FLOW_NOISE_PRIOR_STD + ssr) / (nu0 + sumWeight);
	const Ainv = invert3x3(A);

	if (!Ainv)
		return {
			constants: {
				c1,
				c2,
				c3,
			},
			fitted: true,
			posterior: priorPosterior(),
			effectiveCount: sumWeight,
		};

	return {
		constants: {
			c1,
			c2,
			c3,
		},
		fitted: true,
		posterior: {
			covariance: Ainv.map((row) => row.map((v) => v * sigma2)),
			sigma2,
		},
		effectiveCount: sumWeight,
	};
}

/**
 * Predictive standard deviation of a NEW time-to-flow measurement at (E, β):
 *
 *   std = √( σ̂² + xᵀΣx ),   x = [E, β, 1]
 *
 * σ̂² is irreducible stopwatch noise; xᵀΣx is parameter uncertainty, which
 * shrinks as observations accumulate (and grows with distance from the logged
 * region of the E×β plane). For UI bands ("ϕ ≈ 1.4h ± 0.4h"). The allocator
 * hedges with `phiParameterStd` instead — it has consumed the covariance, not
 * just the mean, since 2026-07-18 (MATH.md §5.1), and the σ̂² term here is
 * exactly the part it must not see.
 */
export function phiPredictionStd(E: number, beta: number, posterior: FitPosterior): number {
	const x = [E, beta, 1];
	let quad = 0;

	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			quad += x[i] * posterior.covariance[i][j] * x[j];
		}
	}

	return Math.sqrt(Math.max(0, posterior.sigma2 + quad));
}
