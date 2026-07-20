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
 *    ranges over (1.5, 1.7933].
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
 *    noise estimate — so callers can quantify how certain a ϕ prediction is,
 *    plus an optional forgetting factor for users whose flow behavior drifts.
 *
 * 5. POSTERIOR-AWARE ALLOCATION (2026-07-18, MATH.md §5.1). Given the fit
 *    posterior, the allocator maximizes the EXPECTED average productivity
 *    under each task's ϕ parameter-uncertainty (5-node Gauss–Hermite mixture
 *    over ϕ). Uncertain tasks are worth strictly less at their optimum, so
 *    plans hedge toward well-measured tasks; as logs accumulate the
 *    uncertainty vanishes and the plan converges to the certainty model,
 *    which remains the exact σ = 0 special case.
 */

export interface TaskInput {
	title: string;
	difficulty: number; // Eᵤ: 1-10 user input
	enjoyment: number; // βᵤ: 1-10 user input
}

export interface TaskAllocation extends TaskInput {
	allocatedHours: number; // Always a multiple of BLOCK_HOURS
	E: number; // True effort (mapped to 1-5)
	beta: number; // True enjoyability (mapped to 1-2)
	phi: number; // Time to flow state (hours)
	peakProductivity: number; // p(ϕ) = a·e^(p₀/a − 1), the curve's actual maximum
	avgProductivity: number; // Average productivity over allocated time
	optimalHours: number; // Single-task optimal stopping time T* = x*(r)/k
	optimalAvgProductivity: number; // P̄(T*): best achievable average — allocation-independent task value
}

export interface UserConstants {
	c1: number; // Effort coefficient for flow state time
	c2: number; // Enjoyability coefficient for flow state time
	c3: number; // Constant offset for flow state time
}

// Default constants (personalized via fitUserConstants on measured ⚡ logs)
export const DEFAULT_USER_CONSTANTS: UserConstants = {
	c1: 0.56, // Higher effort → longer time to flow
	c2: -0.24, // Higher enjoyability → shorter time to flow
	c3: 0.5 // Base offset to keep ϕ positive
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
 * T* = ϕ·x*(r)/(1−r) with multiplier in (1.5, 1.7933], r = p₀/a — so this is now only
 * (a) the exact r → 0 limit, (b) a strict UPPER BOUND on every task's
 * multiplier, and (c) the seed/bracket for the per-task root solve. Use
 * findOptimalSingleTaskTime (or TaskAllocation.optimalHours) for real values.
 * Still consumed by the experimental zenith-energy model, which intentionally
 * remains on the v1 curve (see MATH.md §7).
 */
export const OPTIMAL_PHI_MULTIPLIER = 1.7933;

/**
 * Cap on r = p₀/a, the ratio of initial to peak-scale productivity.
 *
 * WHY: the v2 curve needs p₀ < a for k = (1 − p₀/a)/ϕ to stay positive. With
 * the article's parameter maps, p₀/a = (β/E)/(E·β) = 1/E², which hits exactly
 * 1 at E = 1 (user difficulty 1) — a degenerate flat curve with no flow
 * dynamics and no optimal stopping. Capping r at 0.9 only affects E < 1.054
 * (user difficulty below ≈1.12) and keeps every task's curve well-defined.
 */
export const AMPLITUDE_RATIO_CAP = 0.9;

// Exhaustive funded-subset search is O(2ⁿ · greedy); exact up to this many
// tasks (4096 subsets — instant), greedy forward-selection beyond it.
const EXACT_SUBSET_LIMIT = 12;

/**
 * Map user effort (1-10) to true effort E (1-5)
 * E = (4/9)Eᵤ + 5/9
 */
export function mapEffort(Eu: number): number {
	return (4 / 9) * Eu + 5 / 9;
}

/**
 * Map user enjoyability (1-10) to true enjoyability β (1-2)
 * β = (1/9)βᵤ + 8/9
 */
export function mapEnjoyability(betaU: number): number {
	return (1 / 9) * betaU + 8 / 9;
}

/**
 * Floor on ϕ (6 minutes): a fitted plane may extrapolate to ≈0 (or below) far
 * from the measured tasks. A strictly positive ϕ keeps k finite and the
 * productivity curve well-defined everywhere. Also clamps the ϕ-quadrature
 * nodes of the posterior-aware allocator (see expectedAverageProductivity).
 */
export const PHI_FLOOR_HOURS = 0.1;

/**
 * Calculate time to reach flow state
 * ϕ = c₁E + c₂β + c₃
 */
export function calculateFlowStateTime(E: number, beta: number, constants: UserConstants): number {
	const phi = constants.c1 * E + constants.c2 * beta + constants.c3;
	return Math.max(PHI_FLOOR_HOURS, phi);
}

/**
 * Initial productivity p₀ = β/E.
 *
 * v2: with the new curve this genuinely IS the productivity at t = 0
 * (p(0) = p₀), fixing the v1 mismatch where the curve forced p(0) = 0 and p₀
 * was silently just an amplitude term. Enjoyable, low-effort tasks start
 * productive immediately; hard, unenjoyable ones start near zero.
 *
 * NOTE: calculateTaskParams caps the EFFECTIVE p₀ at AMPLITUDE_RATIO_CAP × a.
 */
export function calculateInitialProductivity(E: number, beta: number): number {
	return beta / E;
}

/**
 * Peak productivity scaling factor a = E × β.
 *
 * Higher effort tasks that we really enjoy correspond to higher peak
 * productivity. v2: the actual curve maximum is p(ϕ) = a·e^(p₀/a − 1), whose
 * first-order expansion in p₀/a is (a + p₀)/e — exactly the v1 peak. So v1's
 * peak was the small-p₀ approximation of the v2 peak.
 */
export function calculatePeakScaling(E: number, beta: number): number {
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
 *   (r→1, by series expansion — MATH.md §3). So under v2 every task still
 *   stops between 1.5ϕ and 1.79ϕ, but tasks that start productive (high p₀
 *   relative to peak) stop earlier: their early hours were already good, so
 *   the tail drags the average down sooner.
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
// polynomial integrands to degree 9 and error ~O(σ⁶) here; nodes are clamped
// to the ϕ floor.

// Gauss–Hermite (n=5) abscissae ξ and probabilist weights w/√π: for
// ϕ = ϕ̂ + √2·σ·ξ these integrate a N(ϕ̂, σ²) density exactly through the
// 9th moment. Symmetric pairs share a weight.
const GH_NODES = [
	{ xi: 0, w: 0.5333333333333333 },
	{ xi: 0.9585724646138185, w: 0.2220759220056126 },
	{ xi: -0.9585724646138185, w: 0.2220759220056126 },
	{ xi: 2.0201828704560856, w: 0.011257411327720688 },
	{ xi: -2.0201828704560856, w: 0.011257411327720688 }
];

/**
 * Cap on σ_ϕ relative to ϕ̂ inside the quadrature: σ_eff = min(σ_ϕ, 0.5·ϕ̂).
 *
 * WHY (probed 2026-07-18, MATH.md §5.1): with σ comparable to ϕ̂ the outer
 * quadrature node collapses onto the ϕ floor and behaves like a fast "spike"
 * curve mixed with slow ones — the mixture turns bimodal in T, which breaks
 * both properties the greedy allocator's exactness rests on (non-increasing
 * block increments, single sign crossing). At σ ≤ 0.5·ϕ̂ the probe grid shows
 * zero bimodal cases and zero truncation loss. A σ beyond this cap also means
 * the Gaussian posterior is a poor description of a positive quantity anyway
 * (mass at ϕ < 0), so clamping is a graceful degradation, not a distortion.
 */
export const PHI_UNCERTAINTY_RELATIVE_CAP = 0.5;

// Quadrature nodes over ϕ for a task with posterior mean phi and std sigmaPhi.
// σ ≤ ~0 collapses to the single point mass — the classic, certainty path.
function phiQuadratureNodes(phi: number, sigmaPhi: number): { phi: number; w: number }[] {
	const sigma = Math.min(Math.max(0, sigmaPhi), PHI_UNCERTAINTY_RELATIVE_CAP * phi);
	if (sigma <= 1e-9) return [{ phi: Math.max(PHI_FLOOR_HOURS, phi), w: 1 }];
	return GH_NODES.map(({ xi, w }) => ({
		phi: Math.max(PHI_FLOOR_HOURS, phi + Math.SQRT2 * sigma * xi),
		w
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
	sigmaPhi: number
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
	sigmaPhi: number
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
 * [T*(ϕ_min), T*(ϕ_max)] with T*(ϕ) = x*(r)·ϕ/(1−r), and inside the σ-cap
 * regime it crosses zero exactly once (probe 2026-07-18). 60-step bisection,
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
 * irreducible observation noise σ̂², which describes stopwatch error and
 * day-to-day scatter around the plane — it never shrinks below the 15-minute
 * noise floor, so using it would make the allocator hedge forever even for a
 * user with hundreds of consistent logs. Parameter uncertainty is the part
 * the data can actually remove; it vanishes as logs accumulate, and with it
 * the hedging — a well-measured user gets exactly the classic plan.
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
 * Calculate task parameters from user input.
 *
 * v2: the effective p₀ is capped at AMPLITUDE_RATIO_CAP × a (only binds for
 * user difficulty below ≈1.12, where the article's maps give p₀ = a and the
 * curve degenerates), and k = (1 − p₀/a)/ϕ replaces v1's k = 1/ϕ so the peak
 * stays exactly at t = ϕ under the new curve.
 */
export function calculateTaskParams(
	task: TaskInput,
	constants: UserConstants = DEFAULT_USER_CONSTANTS
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

	return { E, beta, phi, k, a, p0 };
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
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): number {
	const { a, p0, k } = calculateTaskParams(task, constants);
	return optimalStoppingX(amplitudeRatio(a, p0)) / k;
}

function zeroAllocations(tasks: TaskInput[]): TaskAllocation[] {
	return tasks.map((task) => ({
		...task,
		allocatedHours: 0,
		E: mapEffort(task.difficulty),
		beta: mapEnjoyability(task.enjoyment),
		phi: 0,
		peakProductivity: 0,
		avgProductivity: 0,
		optimalHours: 0,
		optimalAvgProductivity: 0
	}));
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
// budget). It is solved EXACTLY by enumerating funded subsets for n ≤ 12 —
// v1's iterative count-resolution + greedy drop-search heuristic is gone.
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
 * premise of greedy exactness BY CONSTRUCTION instead of by sweep, at the
 * cost of a few low-value blocks in a corner where the fit is dubious anyway.
 * σ_ϕ = 0 never triggers the monotonicity cut (proved in MATH.md §2).
 */
function buildBlockIncrements(a: number, p0: number, phi: number, sigmaPhi: number): number[] {
	const r = amplitudeRatio(a, p0);
	const phiMax = Math.max(...phiQuadratureNodes(phi, sigmaPhi).map((n) => n.phi));
	// No component has positive marginal past its own T*, so the mixture's
	// stopping point is at most T*(ϕ_max).
	const maxBlocks = Math.ceil((optimalStoppingX(r) * phiMax) / (1 - r) / BLOCK_HOURS) + 1;
	const increments: number[] = [];
	let prev = 0;
	let prevDelta = Infinity;
	for (let j = 1; j <= maxBlocks; j++) {
		const value = expectedAverageProductivity(j * BLOCK_HOURS, a, p0, phi, sigmaPhi);
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
 */
function greedyAllocateBlocks(
	tasks: AllocTask[],
	subset: number[],
	budgetBlocks: number,
	poolCog: number,
	poolPhys: number,
	startBlocks?: number[]
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
			const inc = tasks[i].increments[j];
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
	return { blocks, poolBlocked };
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
	poolPhys: number
): number[] {
	let blocks = startBlocks;
	let value = planValue(tasks, blocks);
	const maxIterations = 4 * budgetBlocks + 16;

	for (let iter = 0; iter < maxIterations; iter++) {
		let bestBlocks: number[] | null = null;
		let bestValue = value;
		for (const donor of subset) {
			if (blocks[donor] <= 0) continue;
			const trial = [...blocks];
			trial[donor]--;
			const others = subset.filter((i) => i !== donor);
			const refilled = greedyAllocateBlocks(
				tasks,
				others,
				budgetBlocks,
				poolCog,
				poolPhys,
				trial
			).blocks;
			const refillValue = planValue(tasks, refilled);
			if (refillValue > bestValue + 1e-12) {
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
 * n > EXACT_SUBSET_LIMIT: greedy forward selection on the funded set (add the
 * task whose admission most improves the total, stop when none improves) —
 * documented heuristic for a regime a daily todo list rarely reaches.
 */
function bestPlanWithSwitchCost(
	tasks: AllocTask[],
	totalBudget: number,
	switchCost: number,
	poolCog: number,
	poolPhys: number
): number[] {
	const n = tasks.length;
	const budgetBlocksFor = (fundedCount: number): number => {
		const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;
		return Math.floor((totalBudget - overhead) / BLOCK_HOURS + 1e-9);
	};

	// Greedy + (only when a pool actually blocked a funding step) the
	// resource-aware transfer pass. Pool-less plans skip the pass entirely,
	// preserving plain greedy's exact-optimality on the single constraint.
	const allocate = (subset: number[], budgetBlocks: number): number[] => {
		const { blocks, poolBlocked } = greedyAllocateBlocks(
			tasks,
			subset,
			budgetBlocks,
			poolCog,
			poolPhys
		);
		if (!poolBlocked) return blocks;
		return improveWithTransfers(tasks, subset, blocks, budgetBlocks, poolCog, poolPhys);
	};

	const allTasks = tasks.map((_, i) => i);
	if (switchCost <= 0 || n === 1) {
		return allocate(allTasks, budgetBlocksFor(1));
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
			const budgetBlocks = budgetBlocksFor(subset.length);
			if (budgetBlocks <= 0) continue;
			consider(allocate(subset, budgetBlocks));
		}
		return bestBlocks;
	}

	const funded: number[] = [];
	for (;;) {
		let bestAdd = -1;
		let bestAddBlocks: number[] | null = null;
		let bestAddValue = bestValue;
		for (let i = 0; i < n; i++) {
			if (funded.includes(i)) continue;
			const trial = [...funded, i];
			const budgetBlocks = budgetBlocksFor(trial.length);
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

// Per-task ϕ parameter-uncertainty stds; zeros (classic behavior) without a
// posterior. The stds feed the expected-productivity kernel (MATH.md §5.1).
function phiStdsFor(
	params: ReturnType<typeof calculateTaskParams>[],
	posterior?: FitPosterior
): number[] {
	if (!posterior) return params.map(() => 0);
	return params.map(({ E, beta }) => phiParameterStd(E, beta, posterior));
}

function toAllocations(
	tasks: TaskInput[],
	params: ReturnType<typeof calculateTaskParams>[],
	phiStds: number[],
	optimalTimes: number[],
	blocks: number[]
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
			optimalAvgProductivity: expectedAverageProductivity(optimalTimes[i], a, p0, phi, phiStds[i])
		};
	});
}

/**
 * Main optimization: allocate the time budget across tasks in 15-minute
 * blocks to maximize  Σᵢ P̄ᵢ(tᵢ)  subject to  Σᵢ tᵢ + (m−1)·switchCost ≤ T,
 * where m is the number of tasks that actually receive time.
 *
 * v2: exact on the block grid (greedy marginal analysis per funded subset +
 * exhaustive subset enumeration for the switch-cost fixed charge, n ≤ 12).
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
	posterior?: FitPosterior
): TaskAllocation[] {
	if (tasks.length === 0 || totalBudget <= 0) {
		return zeroAllocations(tasks);
	}

	const params = tasks.map((task) => calculateTaskParams(task, constants));
	const phiStds = phiStdsFor(params, posterior);
	const optimalTimes = params.map(({ a, p0, phi }, i) =>
		expectedOptimalTime(a, p0, phi, phiStds[i])
	);
	const allocTasks: AllocTask[] = params.map(({ a, p0, phi }, i) => ({
		increments: buildBlockIncrements(a, p0, phi, phiStds[i]),
		cognitiveWeight: 0,
		physicalWeight: 0
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
	physicalHours: 6 // ~6h/day of intense physical work
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
 */
export function calculatePooledAllocations(
	tasks: PooledTaskInput[],
	totalBudget: number,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior
): TaskAllocation[] {
	if (tasks.length === 0 || totalBudget <= 0) {
		return zeroAllocations(tasks);
	}

	const params = tasks.map((task) => calculateTaskParams(task, constants));
	const phiStds = phiStdsFor(params, posterior);
	const optimalTimes = params.map(({ a, p0, phi }, i) =>
		expectedOptimalTime(a, p0, phi, phiStds[i])
	);
	const allocTasks: AllocTask[] = params.map(({ a, p0, phi }, i) => ({
		increments: buildBlockIncrements(a, p0, phi, phiStds[i]),
		cognitiveWeight: tasks[i].cognitiveWeight,
		physicalWeight: tasks[i].physicalWeight
	}));

	const blocks = bestPlanWithSwitchCost(
		allocTasks,
		totalBudget,
		switchCost,
		pools.cognitiveHours,
		pools.physicalHours
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
	posterior?: FitPosterior
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
 * WHY (2026-07-18 metric fix, MATH.md §11.2): the naive planner attempts all
 * n tasks and pays (n−1)·switchCost; with many tasks and a small budget its
 * effective budget hits 0, its productivity is 0, and the true relative gain
 * is unbounded. The old guard quietly reported 0% in exactly the scenario
 * where Zenith helps most (it funds fewer tasks and pays fewer switches).
 * Ratios above ~10× carry no extra decision value, so the gain saturates at
 * this cap; a capped value reads as "≥ 10× the naive plan".
 */
export const GAIN_PERCENT_CAP = 999;

function gainPercentOf(optimized: number, naive: number): number {
	if (naive > 0) {
		return Number(Math.min(GAIN_PERCENT_CAP, ((optimized - naive) / naive) * 100).toFixed(1));
	}
	return optimized > 0 ? GAIN_PERCENT_CAP : 0;
}

/**
 * Compare productivity gain from the dual-pool Zenith optimization vs a naive
 * equal time split, under the SAME constraints: the naive planner splits the
 * effective budget equally across all tasks (switching between every one), and
 * its plan is scaled down uniformly if it would overdraw a capacity pool. Both
 * plans being pool-feasible makes the comparison about allocation quality, not
 * about one side ignoring constraints the other must respect.
 */
export function pooledProductivityGain(
	tasks: PooledTaskInput[],
	totalBudget: number,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior
): { optimized: number; naive: number; gainPercent: number } {
	if (tasks.length === 0 || totalBudget <= 0) {
		return { optimized: 0, naive: 0, gainPercent: 0 };
	}

	const allocations = calculatePooledAllocations(
		tasks,
		totalBudget,
		pools,
		constants,
		switchCost,
		posterior
	);
	const optimized = calculateTotalProductivity(
		tasks,
		allocations.map((a) => a.allocatedHours),
		constants,
		posterior
	);

	// Naive: equal split across ALL tasks (a naive planner attempts every task,
	// so it pays n-1 switches), scaled down to stay within the capacity pools.
	// The naive plan stays continuous (not block-quantized): quantization is
	// part of what Zenith imposes, not part of what a naive planner does.
	const switchOverhead = tasks.length > 1 ? (tasks.length - 1) * switchCost : 0;
	const effectiveBudget = Math.max(0, totalBudget - switchOverhead);
	const equalShare = effectiveBudget / tasks.length;
	const cogUse = tasks.reduce((sum, t) => sum + t.cognitiveWeight * equalShare, 0);
	const physUse = tasks.reduce((sum, t) => sum + t.physicalWeight * equalShare, 0);
	const scale = Math.min(
		1,
		cogUse > 0 ? pools.cognitiveHours / cogUse : 1,
		physUse > 0 ? pools.physicalHours / physUse : 1
	);
	const naive = calculateTotalProductivity(
		tasks,
		tasks.map(() => equalShare * scale),
		constants,
		posterior
	);

	return { optimized, naive, gainPercent: gainPercentOf(optimized, naive) };
}

/**
 * Compare productivity gain from Zenith optimization vs naive equal split
 * Both use the same effective budget (after context-switching overhead)
 */
export function productivityGain(
	tasks: TaskInput[],
	totalBudget: number,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST,
	posterior?: FitPosterior
): { optimized: number; naive: number; gainPercent: number } {
	if (tasks.length === 0 || totalBudget <= 0) {
		return { optimized: 0, naive: 0, gainPercent: 0 };
	}

	// Calculate effective budget after context-switching
	const switchOverhead = tasks.length > 1 ? (tasks.length - 1) * switchCost : 0;
	const effectiveBudget = Math.max(0, totalBudget - switchOverhead);

	const optimizedAllocs = calculateTaskAllocations(
		tasks,
		totalBudget,
		constants,
		switchCost,
		posterior
	);
	const optimized = calculateTotalProductivity(
		tasks,
		optimizedAllocs.map((a) => a.allocatedHours),
		constants,
		posterior
	);

	// Naive: equal split of effective budget
	const naiveAlloc = effectiveBudget / tasks.length;
	const naive = calculateTotalProductivity(
		tasks,
		tasks.map(() => naiveAlloc),
		constants,
		posterior
	);

	return { optimized, naive, gainPercent: gainPercentOf(optimized, naive) };
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
}

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
export const RIDGE_PRIOR_STRENGTH = 4;

/**
 * Prior scale for the stopwatch measurement noise: σ₀ = 15 minutes (0.25h),
 * with weight ν₀ = RIDGE_PRIOR_STRENGTH pseudo-observations. "Time until I
 * was in the zone" is self-reported and fuzzy; a quarter-hour standard
 * deviation is an honest floor that keeps σ̂ from collapsing to 0 when the
 * first few logs happen to agree.
 */
export const FLOW_NOISE_PRIOR_STD = 0.25;

/**
 * Posterior of the fitted plane, exposed so callers can quantify uncertainty
 * instead of treating a 2-observation fit like a 200-observation one.
 */
export interface FitPosterior {
	/** 3×3 posterior covariance of (c₁, c₂, c₃): σ̂²·(XᵀWX + λI)⁻¹ */
	covariance: number[][];
	/** Estimated observation noise variance σ̂² (hours²) */
	sigma2: number;
	/** Effective number of observations Σwᵢ (= n when no forgetting) */
	nEff: number;
}

/**
 * Solve a 3×3 linear system via Gaussian elimination with partial pivoting.
 * Returns null when the system is (near-)singular.
 */
function solve3x3(A: number[][], y: number[]): number[] | null {
	const m = A.map((row, i) => [...row, y[i]]);
	const scale = Math.max(1, ...A.flat().map(Math.abs));

	for (let col = 0; col < 3; col++) {
		let pivot = col;
		for (let row = col + 1; row < 3; row++) {
			if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
		}
		if (Math.abs(m[pivot][col]) < 1e-9 * scale) return null;
		[m[col], m[pivot]] = [m[pivot], m[col]];

		for (let row = col + 1; row < 3; row++) {
			const factor = m[row][col] / m[col][col];
			for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
		}
	}

	const x = [0, 0, 0];
	for (let row = 2; row >= 0; row--) {
		let sum = m[row][3];
		for (let k = row + 1; k < 3; k++) sum -= m[row][k] * x[k];
		x[row] = sum / m[row][row];
	}
	return x;
}

// Inverse of a symmetric positive-definite 3×3 via three solves against the
// identity columns; symmetrized to scrub floating-point asymmetry.
function invert3x3(A: number[][]): number[][] | null {
	const cols: number[][] = [];
	for (let i = 0; i < 3; i++) {
		const e = [0, 0, 0];
		e[i] = 1;
		const col = solve3x3(A, e);
		if (!col) return null;
		cols.push(col);
	}
	const inv = [
		[cols[0][0], cols[1][0], cols[2][0]],
		[cols[0][1], cols[1][1], cols[2][1]],
		[cols[0][2], cols[1][2], cols[2][2]]
	];
	for (let i = 0; i < 3; i++) {
		for (let j = i + 1; j < 3; j++) {
			const s = (inv[i][j] + inv[j][i]) / 2;
			inv[i][j] = s;
			inv[j][i] = s;
		}
	}
	return inv;
}

/**
 * Personalize the user constants from measured time-to-flow data.
 *
 * MODEL (v2 — full Bayesian linear regression; v1 computed only the MAP):
 *
 *   ϕᵢ = c·xᵢ + εᵢ,  εᵢ ~ N(0, σ²/wᵢ),  prior c ~ N(c₀, (σ²/λ)·I)
 *
 * with design rows xᵢ = [Eᵢ, βᵢ, 1], prior mean c₀ = fallback constants,
 * λ = RIDGE_PRIOR_STRENGTH, and observation weights wᵢ = γ^(n−1−i) from the
 * optional forgetting factor γ (γ = 1 ⇒ all observations equal; γ < 1 lets a
 * user whose flow behavior drifts shed stale logs — recursive-least-squares
 * style, γ ≈ 0.98 forgets with a ~34-log half-life: 0.98³⁴ ≈ 0.5, while ~50
 * logs is the 1/e time constant — MATH.md §10).
 *
 * Posterior (all closed-form):
 *   mean        ĉ = (XᵀWX + λI)⁻¹ (XᵀWϕ + λc₀)     ← identical to v1's ridge
 *   covariance  Σ = σ̂²·(XᵀWX + λI)⁻¹
 *   noise       σ̂² = (ν₀σ₀² + Σwᵢ(ϕᵢ − ĉ·xᵢ)²)/(ν₀ + Σwᵢ)
 *
 * The point estimate the allocator consumes is unchanged from v1 (the ridge
 * MAP); `posterior` is additional information for callers — see
 * phiPredictionStd for turning it into an uncertainty band on ϕ. WHY: a plan
 * built from 2 logs and a plan built from 200 logs used to look identically
 * confident; downstream UI/logic can now tell them apart (and future work can
 * allocate conservatively when the posterior is wide).
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
 */
export function fitUserConstants(
	observations: FlowObservation[],
	fallback: UserConstants = DEFAULT_USER_CONSTANTS,
	options?: { forgettingFactor?: number }
): { constants: UserConstants; fitted: boolean; posterior?: FitPosterior } {
	if (observations.length === 0) {
		return { constants: fallback, fitted: false };
	}
	const gamma = Math.min(1, Math.max(1e-3, options?.forgettingFactor ?? 1));

	let sEE = 0;
	let sEb = 0;
	let sE = 0;
	let sbb = 0;
	let sb = 0;
	let sEp = 0;
	let sbp = 0;
	let sp = 0;
	let sw = 0;
	const n = observations.length;
	for (let i = 0; i < n; i++) {
		const o = observations[i];
		const w = Math.pow(gamma, n - 1 - i); // newest observation has weight 1
		sEE += w * o.E * o.E;
		sEb += w * o.E * o.beta;
		sE += w * o.E;
		sbb += w * o.beta * o.beta;
		sb += w * o.beta;
		sEp += w * o.E * o.phi;
		sbp += w * o.beta * o.phi;
		sp += w * o.phi;
		sw += w;
	}
	const lambda = RIDGE_PRIOR_STRENGTH;
	const A = [
		[sEE + lambda, sEb, sE],
		[sEb, sbb + lambda, sb],
		[sE, sb, sw + lambda]
	];
	const solution = solve3x3(A, [
		sEp + lambda * fallback.c1,
		sbp + lambda * fallback.c2,
		sp + lambda * fallback.c3
	]);
	// The ridge matrix is positive definite, so solve3x3 cannot hit a singular
	// pivot — the guard stays purely as defense in depth.
	if (!solution) return { constants: fallback, fitted: false };

	const [c1, c2, c3] = solution;
	for (const E of [1, 5]) {
		for (const beta of [1, 2]) {
			const phi = c1 * E + c2 * beta + c3;
			if (!Number.isFinite(phi) || phi > 16) return { constants: fallback, fitted: false };
		}
	}

	// Noise estimate: weighted residual sum of squares blended with the prior
	// scale (inverse-gamma-style pseudo-observations), so σ̂ neither collapses
	// to 0 on a couple of lucky logs nor ignores genuinely noisy users.
	let ssr = 0;
	for (let i = 0; i < n; i++) {
		const o = observations[i];
		const w = Math.pow(gamma, n - 1 - i);
		const resid = o.phi - (c1 * o.E + c2 * o.beta + c3);
		ssr += w * resid * resid;
	}
	const nu0 = RIDGE_PRIOR_STRENGTH;
	const sigma2 = (nu0 * FLOW_NOISE_PRIOR_STD * FLOW_NOISE_PRIOR_STD + ssr) / (nu0 + sw);

	const Ainv = invert3x3(A);
	const posterior: FitPosterior | undefined = Ainv
		? {
				covariance: Ainv.map((row) => row.map((v) => v * sigma2)),
				sigma2,
				nEff: sw
			}
		: undefined;

	return { constants: { c1, c2, c3 }, fitted: true, posterior };
}

/**
 * Predictive standard deviation of a NEW time-to-flow measurement at (E, β):
 *
 *   std = √( σ̂² + xᵀΣx ),   x = [E, β, 1]
 *
 * σ̂² is irreducible stopwatch noise; xᵀΣx is parameter uncertainty, which
 * shrinks as observations accumulate (and grows with distance from the logged
 * region of the E×β plane). Intended for UI ("ϕ ≈ 1.4h ± 0.4h") and for
 * future robust-allocation work; the allocator itself currently consumes only
 * the posterior mean.
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
