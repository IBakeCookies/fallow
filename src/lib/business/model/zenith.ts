/**
 * Zenith Gradient Algorithm
 * Based on: https://thequantasticjournal.com/how-to-over-engineer-a-todo-app-the-zenith-gradient-algorithm-67712737135e
 *
 * Mathematical model for optimizing time allocation across tasks to maximize productivity.
 */

export interface TaskInput {
	title: string;
	difficulty: number; // Eᵤ: 1-10 user input
	enjoyment: number; // βᵤ: 1-10 user input
}

export interface TaskAllocation extends TaskInput {
	allocatedHours: number;
	E: number; // True effort (mapped to 1-5)
	beta: number; // True enjoyability (mapped to 1-2)
	phi: number; // Time to flow state (hours)
	peakProductivity: number; // (a + p₀)/e - actual peak at t=ϕ
	avgProductivity: number; // Average productivity over allocated time
}

export interface UserConstants {
	c1: number; // Effort coefficient for flow state time
	c2: number; // Enjoyability coefficient for flow state time
	c3: number; // Constant offset for flow state time
}

// Default constants (can be personalized via linear regression on user data)
export const DEFAULT_USER_CONSTANTS: UserConstants = {
	c1: 0.56, // Higher effort → longer time to flow
	c2: -0.24, // Higher enjoyability → shorter time to flow
	c3: 0.5 // Base offset to keep ϕ positive
};

// Default context-switching cost in hours (15 minutes)
export const DEFAULT_SWITCH_COST = 0.25;

/**
 * Optimal-stopping multiplier: single-task average productivity P̄(t) is
 * maximized at t = OPTIMAL_PHI_MULTIPLIER × ϕ.
 *
 * Derivation: setting dP̄/dt = 0 for p(t) = (a + p₀)·k·t·e^(−kt) reduces to
 * x² + x + 1 = eˣ, where x = t/ϕ. The non-trivial root is x ≈ 1.7933.
 *
 * NOTE: The article's worked example of "≈3.16 hours" is NOT this multiplier.
 * That example had ϕ ≈ 1.762 h, and 1.762 × 1.7933 ≈ 3.16 h — an absolute
 * time for that one task, not a dimensionless multiple of ϕ.
 */
export const OPTIMAL_PHI_MULTIPLIER = 1.7933;

/**
 * Average productivity at the optimal stopping time, as a fraction of (a + p₀):
 * P̄(x·ϕ) = (a + p₀)·[1 − e^(−x)(x + 1)]/x with x = OPTIMAL_PHI_MULTIPLIER.
 * Because x is a fixed dimensionless constant, this makes a task's best
 * achievable average productivity a pure function of its parameters — useful
 * as an allocation-independent measure of task value.
 */
export const OPTIMAL_AVG_FRACTION =
	(1 - Math.exp(-OPTIMAL_PHI_MULTIPLIER) * (OPTIMAL_PHI_MULTIPLIER + 1)) / OPTIMAL_PHI_MULTIPLIER;

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
 * Calculate time to reach flow state
 * ϕ = c₁E + c₂β + c₃
 */
export function calculateFlowStateTime(E: number, beta: number, constants: UserConstants): number {
	const phi = constants.c1 * E + constants.c2 * beta + constants.c3;
	// Floor at 6 minutes: a fitted plane may extrapolate to ≈0 (or below) far
	// from the measured tasks. A strictly positive ϕ keeps k = 1/ϕ finite and
	// the productivity curve well-defined everywhere.
	return Math.max(0.1, phi);
}

/**
 * Calculate the p₀ amplitude term.
 * p₀ = β/E
 *
 * NOTE: despite the name "initial productivity", in the implemented curve
 * p(t) = (a + p₀)·k·t·e^(−kt) this term is a scaling factor on the amplitude,
 * not the literal value at t = 0 (which is 0). It raises the whole curve for
 * enjoyable, low-effort tasks and does not affect where the peak occurs.
 */
export function calculateInitialProductivity(E: number, beta: number): number {
	return beta / E;
}

/**
 * Calculate peak productivity scaling factor
 * a = E × β
 *
 * Higher effort tasks that we really enjoy correspond to higher peak productivity.
 */
export function calculatePeakScaling(E: number, beta: number): number {
	return E * beta;
}

/**
 * Productivity function at time t
 * p(t) = (a + p₀) × k × t × e^(-kt) where k = 1/ϕ
 *
 * The k factor normalizes across different flow state times, ensuring tasks
 * with different ϕ values are comparable in the Lagrange optimization.
 *
 * Note: This form ensures the maximum occurs exactly at t = 1/k = ϕ (flow state time).
 * Taking dp/dt = 0 gives (1 - kt) = 0, so t_max = 1/k = ϕ.
 * Peak productivity at t = ϕ: p(ϕ) = (a + p₀) × k × ϕ × e^(-1) = (a + p₀)/e
 */
export function productivity(t: number, a: number, p0: number, k: number): number {
	if (t <= 0) return 0;
	return (a + p0) * k * t * Math.exp(-k * t);
}

/**
 * Average productivity over interval [0, T]
 * P̄(T) = (1/T) ∫₀ᵀ p(t) dt
 *
 * With p(t) = (a + p₀) × k × t × e^(-kt):
 *
 * Analytical solution:
 * ∫₀ᵀ k × t × e^(-kt) dt = (1/k)[1 - e^(-kT)(kT + 1)]
 *
 * So: P̄(T) = (a + p₀) × [1 - e^(-kT)(kT + 1)] / (T × k)
 */
export function averageProductivity(T: number, a: number, p0: number, k: number): number {
	if (T <= 0) return 0;

	const kT = k * T;
	const expTerm = Math.exp(-kT);
	const integral = (1 / k) * (1 - expTerm * (kT + 1));

	return ((a + p0) * integral) / T;
}

/**
 * Derivative of average productivity with respect to T
 * Used for Lagrange multiplier optimization
 *
 * P̄(T) = (a + p₀)/k × [1 - e^(-kT)(kT + 1)] / T
 *
 * Let f(T) = 1 - e^(-kT)(kT + 1)
 * f'(T) = k²T × e^(-kT)
 *
 * d/dT[P̄(T)] = (a + p₀)/k × [f'(T)×T - f(T)] / T²
 *            = (a + p₀)/k × [k²T² × e^(-kT) - (1 - e^(-kT)(kT + 1))] / T²
 */
export function avgProductivityDerivative(T: number, a: number, p0: number, k: number): number {
	// Only guard the true singularity at T = 0; the closed form below is
	// numerically stable for any T > 0, so evaluating it directly gives the
	// real marginal value (≈ (a + p₀)·k / 2 as T → 0⁺) instead of a placeholder.
	if (T <= 1e-9) return (a + p0) * k * 0.5;

	const kT = k * T;
	const expTerm = Math.exp(-kT);
	const f = 1 - expTerm * (kT + 1);
	const fPrime = k * k * T * expTerm;

	return ((a + p0) / k) * ((fPrime * T - f) / (T * T));
}

/**
 * Calculate task parameters from user input
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
	const k = 1 / phi;
	const p0 = calculateInitialProductivity(E, beta);
	const a = calculatePeakScaling(E, beta);

	return { E, beta, phi, k, a, p0 };
}

/**
 * Find optimal time for a single task (when there's no constraint)
 * Maximize P̄(T) by setting dP̄/dT = 0
 *
 * This requires numerical solving. The optimum is at t = OPTIMAL_PHI_MULTIPLIER × ϕ
 * (≈ 1.79 × ϕ); Newton-Raphson refines from there.
 */
export function findOptimalSingleTaskTime(
	task: TaskInput,
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): number {
	const { a, p0, k, phi } = calculateTaskParams(task, constants);

	// Newton-Raphson to find where derivative = 0, seeded at the analytic optimum
	let T = phi * OPTIMAL_PHI_MULTIPLIER;
	const tolerance = 0.001;
	const maxIterations = 50;

	for (let i = 0; i < maxIterations; i++) {
		const deriv = avgProductivityDerivative(T, a, p0, k);
		if (Math.abs(deriv) < tolerance) break;

		// Numerical derivative of the derivative (for Newton step)
		const h = 0.001;
		const deriv2 = (avgProductivityDerivative(T + h, a, p0, k) - deriv) / h;

		if (Math.abs(deriv2) < 0.0001) break;
		T = T - deriv / deriv2;
		T = Math.max(0.1, T); // Keep positive
	}

	return T;
}

function zeroAllocations(tasks: TaskInput[]): TaskAllocation[] {
	return tasks.map((task) => ({
		...task,
		allocatedHours: 0,
		E: mapEffort(task.difficulty),
		beta: mapEnjoyability(task.enjoyment),
		phi: 0,
		peakProductivity: 0,
		avgProductivity: 0
	}));
}

// Allocations below this are display-rounded to 0h, so a task under it is not
// a real work session and should not be charged a context switch.
const ACTIVE_EPS = 0.005;

/**
 * Invert the marginal-productivity curve: the t ∈ [0, cap] where dP̄/dt equals
 * `price`. The marginal decreases monotonically from (a+p₀)k/2 at t→0⁺ to 0 at
 * the single-task optimum (cap), so an unattainably high price maps to 0 and a
 * non-positive price maps to the cap.
 */
function timeAtMarginal(price: number, a: number, p0: number, k: number, cap: number): number {
	if (price >= avgProductivityDerivative(0, a, p0, k)) return 0;
	if (price <= Math.max(0, avgProductivityDerivative(cap, a, p0, k))) return cap;

	let lo = 0;
	let hi = cap;
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		const deriv = avgProductivityDerivative(mid, a, p0, k);
		if (Math.abs(deriv - price) < 1e-4) return mid;
		if (deriv > price) {
			lo = mid; // marginal still above the price → more time
		} else {
			hi = mid;
		}
	}
	return (lo + hi) / 2;
}

/**
 * Resolve the chicken-and-egg between switch overhead and allocations:
 * switches only happen between tasks that actually receive time, but which
 * tasks receive time depends on the budget left after switch overhead.
 *
 * Two phases:
 * 1. Count resolution — assume all (non-excluded) tasks are active, allocate,
 *    recount the funded tasks, and re-allocate with the smaller overhead until
 *    the count is stable. The `seen` guard breaks the rare oscillation where a
 *    lower overhead re-funds a previously dropped task.
 * 2. Drop search — the allocator funds any task whose marginal beats λ, but a
 *    weak task can be worth less than the switch cost it incurs. Greedily try
 *    force-dropping each funded task (freeing its time AND one switch) and
 *    keep the drop whenever total productivity strictly improves. Each drop is
 *    also tried with the currently-unfunded tasks pinned out: freeing a task's
 *    budget can re-admit a weak task the allocator had starved (its marginal
 *    beats λ, but not the switch it would cost), masking the drop's benefit.
 */
function resolveWithSwitchOverhead(
	taskCount: number,
	totalBudget: number,
	switchCost: number,
	allocate: (effectiveBudget: number, excluded: ReadonlySet<number>) => number[],
	totalValue: (hours: number[]) => number
): number[] {
	const solveWith = (excluded: ReadonlySet<number>): number[] => {
		let assumedActive = taskCount - excluded.size;
		const seen = new Set<number>();
		for (;;) {
			seen.add(assumedActive);
			const overhead = assumedActive > 1 ? (assumedActive - 1) * switchCost : 0;
			const hours = allocate(Math.max(0, totalBudget - overhead), excluded);
			const active = hours.filter((h) => h > ACTIVE_EPS).length;
			if (active === assumedActive || active === 0 || seen.has(active)) return hours;
			assumedActive = active;
		}
	};

	let excluded = new Set<number>();
	let hours = solveWith(excluded);
	// With no switch cost there is no overhead to save, and dropping a task can
	// never improve a concave objective — skip the search.
	if (switchCost <= 0) return hours;

	let value = totalValue(hours);
	for (;;) {
		const funded = hours.map((_, i) => i).filter((i) => hours[i] > ACTIVE_EPS);
		if (funded.length <= 1) break;
		const unfunded = hours
			.map((_, i) => i)
			.filter((i) => hours[i] <= ACTIVE_EPS && !excluded.has(i));

		let bestSet: Set<number> | null = null;
		let bestHours = hours;
		let bestValue = value;
		const tryCandidate = (candidate: Set<number>): void => {
			const trialHours = solveWith(candidate);
			const trialValue = totalValue(trialHours);
			// Require a real improvement so ties keep the more inclusive plan.
			if (trialValue > bestValue + 1e-6) {
				bestSet = candidate;
				bestHours = trialHours;
				bestValue = trialValue;
			}
		};
		for (const i of funded) {
			tryCandidate(new Set([...excluded, i]));
			if (unfunded.length > 0) tryCandidate(new Set([...excluded, i, ...unfunded]));
		}
		if (bestSet === null) break;
		excluded = bestSet;
		hours = bestHours;
		value = bestValue;
	}
	return hours;
}

/**
 * Main optimization: Allocate time budget across multiple tasks
 * Uses Lagrange multipliers to maximize total productivity
 *
 * Maximize: P(t₁, t₂, ..., tₙ) = Σᵢ P̄ᵢ(tᵢ)
 * Subject to: Σᵢ tᵢ = T (total budget minus context-switching overhead)
 *
 * Context-switching penalty: Each task switch costs `switchCost` hours.
 * Only tasks that actually receive time count as switches (resolved
 * iteratively via resolveWithSwitchOverhead).
 *
 * Solution: Find λ such that ∂P̄ᵢ/∂tᵢ = λ for all i
 */
export function calculateTaskAllocations(
	tasks: TaskInput[],
	totalBudget: number,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST
): TaskAllocation[] {
	if (tasks.length === 0 || totalBudget <= 0) {
		return zeroAllocations(tasks);
	}

	// Calculate parameters for each task
	const taskParams = tasks.map((task) => ({
		task,
		...calculateTaskParams(task, constants)
	}));

	// If only one task, give it all the time (up to optimal) — no switches
	if (tasks.length === 1) {
		const { E, beta, phi, k, a, p0 } = taskParams[0];
		const optimalTime = findOptimalSingleTaskTime(tasks[0], constants);
		const allocatedHours = Math.min(totalBudget, optimalTime);

		return [
			{
				...tasks[0],
				allocatedHours,
				E,
				beta,
				phi,
				peakProductivity: (a + p0) / Math.E,
				avgProductivity: averageProductivity(allocatedHours, a, p0, k)
			}
		];
	}

	// Calculate optimal single-task times. These are hard upper bounds: beyond
	// t = optimal, average productivity DECLINES, so we never allocate past them.
	const optimalTimes = taskParams.map((tp) => findOptimalSingleTaskTime(tp.task, constants));

	const allocate = (effectiveBudget: number, excluded: ReadonlySet<number>): number[] => {
		if (effectiveBudget <= 0) return tasks.map(() => 0);
		const included = (i: number): boolean => !excluded.has(i);

		// Never spend more than the sum of the per-task optima: extra time past a
		// task's optimum only lowers its average productivity, so an abundant budget
		// leaves slack rather than being forced onto tasks.
		const sumOpt = optimalTimes.reduce((sum, t, i) => sum + (included(i) ? t : 0), 0);
		const allocationTarget = Math.min(effectiveBudget, sumOpt);

		if (effectiveBudget >= sumOpt) {
			// Budget covers every optimum: give each task its optimum, leave the rest.
			return optimalTimes.map((t, i) => (included(i) ? t : 0));
		}

		// Scarce budget: distribute via the Lagrange multiplier λ.
		// At optimum: ∂P̄ᵢ/∂tᵢ = λ for all tasks with tᵢ > 0.
		// Find λ such that Σᵢ tᵢ(λ) = allocationTarget.
		const timesForLambda = (lambda: number): number[] =>
			taskParams.map((tp, i) =>
				included(i) ? timeAtMarginal(lambda, tp.a, tp.p0, tp.k, optimalTimes[i]) : 0
			);

		const calcTotalTime = (lambda: number): number =>
			timesForLambda(lambda).reduce((sum, t) => sum + t, 0);

		// Bracket λ: higher λ → less total time, lower λ → more total time.
		let lambdaLo = -10;
		let lambdaHi = 100;
		while (calcTotalTime(lambdaLo) < allocationTarget && lambdaLo > -1000) lambdaLo *= 2;
		while (calcTotalTime(lambdaHi) > allocationTarget && lambdaHi < 10000) lambdaHi *= 2;

		let optimalLambda = (lambdaLo + lambdaHi) / 2;
		for (let i = 0; i < 100; i++) {
			const mid = (lambdaLo + lambdaHi) / 2;
			const totalTime = calcTotalTime(mid);
			optimalLambda = mid;

			if (Math.abs(totalTime - allocationTarget) < 0.001) break;

			if (totalTime > allocationTarget) {
				lambdaLo = mid; // Increase lambda to reduce total time
			} else {
				lambdaHi = mid; // Decrease lambda to increase total time
			}
		}

		let currentAllocs = timesForLambda(optimalLambda);

		// Normalize to exactly match the allocation target (handle numerical error).
		const currentTotal = currentAllocs.reduce((sum, t) => sum + t, 0);
		if (currentTotal > 0) {
			const scale = allocationTarget / currentTotal;
			currentAllocs = currentAllocs.map((t) => t * scale);
		}

		return currentAllocs;
	};

	const totalValue = (hours: number[]): number =>
		hours.reduce((sum, h, i) => sum + averageProductivity(h, taskParams[i].a, taskParams[i].p0, taskParams[i].k), 0);

	// Switch overhead is charged only for tasks that actually receive time.
	const hours = resolveWithSwitchOverhead(
		tasks.length,
		totalBudget,
		switchCost,
		allocate,
		totalValue
	);

	// Round each allocation, then adjust the largest to absorb the rounding
	// residual so the rounded sum matches the achieved total exactly.
	const achievedTotal = Math.round(hours.reduce((sum, t) => sum + t, 0) * 100) / 100;
	const roundedHours = hours.map((t) => Math.round(t * 100) / 100);
	const roundedSum = roundedHours.reduce((sum, t) => sum + t, 0);
	const roundingError = Math.round((achievedTotal - roundedSum) * 100) / 100;

	if (roundingError !== 0 && roundedHours.length > 0) {
		let largestIdx = 0;
		for (let i = 1; i < roundedHours.length; i++) {
			if (roundedHours[i] > roundedHours[largestIdx]) largestIdx = i;
		}
		roundedHours[largestIdx] = Math.round((roundedHours[largestIdx] + roundingError) * 100) / 100;
	}

	return taskParams.map((tp, i) => ({
		...tp.task,
		allocatedHours: roundedHours[i],
		E: tp.E,
		beta: tp.beta,
		phi: tp.phi,
		peakProductivity: (tp.a + tp.p0) / Math.E,
		avgProductivity: averageProductivity(roundedHours[i], tp.a, tp.p0, tp.k)
	}));
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
 *   s.t.      Σᵢ tᵢ           ≤ effective budget (time)
 *             Σᵢ wcᵢ × tᵢ     ≤ cognitive pool
 *             Σᵢ wpᵢ × tᵢ     ≤ physical pool
 *             0 ≤ tᵢ ≤ optᵢ   (never past the optimal stopping time)
 *
 * The insight this captures: cognitive and physical fatigue are separate
 * systems. "6h of coding" saturates at the ~4h cognitive pool, but "4h coding
 * + 2h gym" fits — the physical hours draw on a different pool.
 *
 * Solved exactly via Lagrangian duality. Each constraint gets a shadow price
 * (λ for time, μc for the cognitive pool, μp for the physical pool), and at
 * the optimum every funded task sits where its marginal equals its total
 * resource price:
 *
 *   ∂P̄ᵢ/∂tᵢ = λ + μc×wcᵢ + μp×wpᵢ   (clamped to tᵢ ∈ [0, optᵢ])
 *
 * The dual is convex and smooth (each P̄ᵢ is strictly concave), so cyclic
 * coordinate descent on (λ, μc, μp) — bisecting one multiplier at a time to
 * its own constraint while holding the others — converges to the global
 * optimum. This replaces an earlier greedy water-filling + pairwise-transfer
 * heuristic, which got stuck in local optima whenever the time budget and a
 * pool bound simultaneously (escaping required 3-task exchanges that pairwise
 * swaps cannot express).
 */
export function calculatePooledAllocations(
	tasks: PooledTaskInput[],
	totalBudget: number,
	pools: CapacityPools = DEFAULT_CAPACITY_POOLS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST
): TaskAllocation[] {
	if (tasks.length === 0 || totalBudget <= 0) {
		return zeroAllocations(tasks);
	}

	const taskParams = tasks.map((task) => ({
		task,
		...calculateTaskParams(task, constants)
	}));
	const optimalTimes = tasks.map((task) => findOptimalSingleTaskTime(task, constants));

	const allocate = (effectiveBudget: number, excluded: ReadonlySet<number>): number[] => {
		if (effectiveBudget <= 0) return new Array(tasks.length).fill(0);

		// Primal allocation implied by a set of multipliers: each task works until
		// its marginal productivity drops to its total resource price.
		const timesFor = (lambda: number, muCog: number, muPhys: number): number[] =>
			tasks.map((task, i) => {
				if (excluded.has(i)) return 0;
				const price = lambda + muCog * task.cognitiveWeight + muPhys * task.physicalWeight;
				const { a, p0, k } = taskParams[i];
				return timeAtMarginal(price, a, p0, k, optimalTimes[i]);
			});

		const timeUse = (t: number[]): number => t.reduce((sum, x) => sum + x, 0);
		const cogUse = (t: number[]): number =>
			t.reduce((sum, x, i) => sum + x * tasks[i].cognitiveWeight, 0);
		const physUse = (t: number[]): number =>
			t.reduce((sum, x, i) => sum + x * tasks[i].physicalWeight, 0);

		// Smallest multiplier m ≥ 0 whose implied usage fits the limit (usage is
		// monotonically decreasing in m). Returning the feasible-side endpoint of
		// the bracket keeps the constraint satisfied, not just approximated.
		const bisectMultiplier = (usage: (m: number) => number, limit: number): number => {
			if (usage(0) <= limit + 1e-9) return 0;
			let lo = 0;
			let hi = 1;
			while (usage(hi) > limit + 1e-9) {
				hi *= 2;
				if (hi > 1e12) return hi; // unreachable for positive limits; guards limit ≈ 0
			}
			for (let i = 0; i < 60; i++) {
				const mid = (lo + hi) / 2;
				if (usage(mid) > limit + 1e-9) {
					lo = mid;
				} else {
					hi = mid;
				}
			}
			return hi;
		};

		// Cyclic coordinate descent on the dual: re-bisect each multiplier to its
		// own constraint holding the others fixed. Within a round, later steps only
		// raise prices, so every round ends with all three constraints satisfied;
		// across rounds the multipliers settle at the global dual optimum.
		let lambda = 0;
		let muCog = 0;
		let muPhys = 0;
		for (let round = 0; round < 60; round++) {
			const prevLambda = lambda;
			const prevMuCog = muCog;
			const prevMuPhys = muPhys;
			lambda = bisectMultiplier((m) => timeUse(timesFor(m, muCog, muPhys)), effectiveBudget);
			muCog = bisectMultiplier((m) => cogUse(timesFor(lambda, m, muPhys)), pools.cognitiveHours);
			muPhys = bisectMultiplier((m) => physUse(timesFor(lambda, muCog, m)), pools.physicalHours);
			const shift =
				Math.abs(lambda - prevLambda) + Math.abs(muCog - prevMuCog) + Math.abs(muPhys - prevMuPhys);
			if (shift < 1e-7) break;
		}

		return timesFor(lambda, muCog, muPhys);
	};

	const totalValue = (hours: number[]): number =>
		hours.reduce((sum, h, i) => sum + averageProductivity(h, taskParams[i].a, taskParams[i].p0, taskParams[i].k), 0);

	// Switch overhead is charged only for tasks that actually receive time.
	const t = resolveWithSwitchOverhead(tasks.length, totalBudget, switchCost, allocate, totalValue);

	// Round to 0.01h and absorb the residual in the largest allocation so the
	// rounded sum matches the achieved total (pools may leave budget unspent).
	const achievedTotal = Math.round(t.reduce((sum, x) => sum + x, 0) * 100) / 100;
	const roundedHours = t.map((x) => Math.round(x * 100) / 100);
	const roundedSum = roundedHours.reduce((sum, x) => sum + x, 0);
	const roundingError = Math.round((achievedTotal - roundedSum) * 100) / 100;
	if (roundingError !== 0 && roundedHours.length > 0) {
		let largestIdx = 0;
		for (let i = 1; i < roundedHours.length; i++) {
			if (roundedHours[i] > roundedHours[largestIdx]) largestIdx = i;
		}
		roundedHours[largestIdx] = Math.round((roundedHours[largestIdx] + roundingError) * 100) / 100;
	}

	return taskParams.map((tp, i) => ({
		...tp.task,
		allocatedHours: roundedHours[i],
		E: tp.E,
		beta: tp.beta,
		phi: tp.phi,
		peakProductivity: (tp.a + tp.p0) / Math.E,
		avgProductivity: averageProductivity(roundedHours[i], tp.a, tp.p0, tp.k)
	}));
}

/**
 * Calculate total productivity for a given allocation
 * P(t₁, t₂, ..., tₙ) = Σᵢ P̄ᵢ(tᵢ)
 */
export function calculateTotalProductivity(
	tasks: TaskInput[],
	allocations: number[],
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): number {
	return tasks.reduce((total, task, i) => {
		const { a, p0, k } = calculateTaskParams(task, constants);
		return total + averageProductivity(allocations[i], a, p0, k);
	}, 0);
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
	switchCost: number = DEFAULT_SWITCH_COST
): { optimized: number; naive: number; gainPercent: number } {
	if (tasks.length === 0 || totalBudget <= 0) {
		return { optimized: 0, naive: 0, gainPercent: 0 };
	}

	const allocations = calculatePooledAllocations(tasks, totalBudget, pools, constants, switchCost);
	const optimized = calculateTotalProductivity(
		tasks,
		allocations.map((a) => a.allocatedHours),
		constants
	);

	// Naive: equal split across ALL tasks (a naive planner attempts every task,
	// so it pays n-1 switches), scaled down to stay within the capacity pools.
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
		constants
	);

	const gainPercent = naive > 0 ? ((optimized - naive) / naive) * 100 : 0;
	return { optimized, naive, gainPercent: Number(gainPercent.toFixed(1)) };
}

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
 * Prior strength for the ridge-regularized constants fit: the article-default
 * constants act as if they were this many pseudo-observations. Early ⚡ logs
 * nudge the model smoothly away from the defaults instead of a hard
 * defaults→fitted cliff, and the fit stays well-posed even when every logged
 * task is identical (which would leave an unregularized plane underdetermined).
 */
export const RIDGE_PRIOR_STRENGTH = 4;

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

/**
 * Personalize the user constants from measured time-to-flow data: RIDGE
 * least squares fit of the plane ϕ = c₁E + c₂β + c₃ over the observations
 * (the article's "User Dependent Constants" section), regularized toward the
 * fallback constants:
 *
 *   minimize Σᵢ(ϕᵢ − c·xᵢ)² + λ‖c − c₀‖²  →  (XᵀX + λI)c = Xᵀϕ + λc₀
 *
 * with design-matrix rows [E, β, 1], prior c₀ = fallback, λ = RIDGE_PRIOR_STRENGTH.
 *
 * The prior makes the fit graceful everywhere batch least squares is brittle:
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
	fallback: UserConstants = DEFAULT_USER_CONSTANTS
): { constants: UserConstants; fitted: boolean } {
	if (observations.length === 0) {
		return { constants: fallback, fitted: false };
	}

	let sEE = 0;
	let sEb = 0;
	let sE = 0;
	let sbb = 0;
	let sb = 0;
	let sEp = 0;
	let sbp = 0;
	let sp = 0;
	for (const o of observations) {
		sEE += o.E * o.E;
		sEb += o.E * o.beta;
		sE += o.E;
		sbb += o.beta * o.beta;
		sb += o.beta;
		sEp += o.E * o.phi;
		sbp += o.beta * o.phi;
		sp += o.phi;
	}
	const lambda = RIDGE_PRIOR_STRENGTH;
	const solution = solve3x3(
		[
			[sEE + lambda, sEb, sE],
			[sEb, sbb + lambda, sb],
			[sE, sb, observations.length + lambda]
		],
		[sEp + lambda * fallback.c1, sbp + lambda * fallback.c2, sp + lambda * fallback.c3]
	);
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
	return { constants: { c1, c2, c3 }, fitted: true };
}

/**
 * Compare productivity gain from Zenith optimization vs naive equal split
 * Both use the same effective budget (after context-switching overhead)
 */
export function productivityGain(
	tasks: TaskInput[],
	totalBudget: number,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST
): { optimized: number; naive: number; gainPercent: number } {
	if (tasks.length === 0 || totalBudget <= 0) {
		return { optimized: 0, naive: 0, gainPercent: 0 };
	}

	// Calculate effective budget after context-switching
	const switchOverhead = tasks.length > 1 ? (tasks.length - 1) * switchCost : 0;
	const effectiveBudget = Math.max(0, totalBudget - switchOverhead);

	const optimizedAllocs = calculateTaskAllocations(tasks, totalBudget, constants, switchCost);
	const optimized = calculateTotalProductivity(
		tasks,
		optimizedAllocs.map((a) => a.allocatedHours),
		constants
	);

	// Naive: equal split of effective budget
	const naiveAlloc = effectiveBudget / tasks.length;
	const naive = calculateTotalProductivity(
		tasks,
		tasks.map(() => naiveAlloc),
		constants
	);

	const gainPercent = naive > 0 ? ((optimized - naive) / naive) * 100 : 0;

	return { optimized, naive, gainPercent: Number(gainPercent.toFixed(1)) };
}
