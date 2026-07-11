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
	return Math.max(0.1, phi); // Ensure positive
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
 * Resolve the chicken-and-egg between switch overhead and allocations:
 * switches only happen between tasks that actually receive time, but which
 * tasks receive time depends on the budget left after switch overhead.
 *
 * Iterate: assume all tasks are active, allocate, recount the funded tasks,
 * and re-allocate with the smaller overhead until the count is stable. The
 * `seen` guard breaks the rare oscillation where a lower overhead re-funds a
 * previously dropped task (keeping the last, most-generous allocation).
 */
function resolveWithSwitchOverhead(
	taskCount: number,
	totalBudget: number,
	switchCost: number,
	allocate: (effectiveBudget: number) => number[]
): number[] {
	let assumedActive = taskCount;
	const seen = new Set<number>();
	for (;;) {
		seen.add(assumedActive);
		const overhead = assumedActive > 1 ? (assumedActive - 1) * switchCost : 0;
		const hours = allocate(Math.max(0, totalBudget - overhead));
		const active = hours.filter((h) => h > ACTIVE_EPS).length;
		if (active === assumedActive || active === 0 || seen.has(active)) return hours;
		assumedActive = active;
	}
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
	const sumOptimal = optimalTimes.reduce((sum, t) => sum + t, 0);

	const allocate = (effectiveBudget: number): number[] => {
		if (effectiveBudget <= 0) return tasks.map(() => 0);

		// Never spend more than the sum of the per-task optima: extra time past a
		// task's optimum only lowers its average productivity, so an abundant budget
		// leaves slack rather than being forced onto tasks.
		const allocationTarget = Math.min(effectiveBudget, sumOptimal);

		if (effectiveBudget >= sumOptimal) {
			// Budget covers every optimum: give each task its optimum, leave the rest.
			return optimalTimes.slice();
		}

		// Scarce budget: distribute via the Lagrange multiplier λ.
		// At optimum: ∂P̄ᵢ/∂tᵢ = λ for all tasks with tᵢ > 0.
		// Find λ such that Σᵢ tᵢ(λ) = allocationTarget.

		// For a given marginal value λ, find t ∈ (0, optTime] with ∂P̄/∂t = λ.
		const findTimeForLambda = (
			lambda: number,
			tp: (typeof taskParams)[number],
			optTime: number
		): number => {
			const { a, p0, k } = tp;

			// Binary search for t where derivative equals lambda. Capped at optTime
			// because the marginal is ≤ 0 beyond the single-task optimum.
			let lo = 0.001;
			let hi = optTime;

			const derivAtLo = avgProductivityDerivative(lo, a, p0, k);
			const derivAtHi = avgProductivityDerivative(hi, a, p0, k);

			// Derivative decreases as t increases (diminishing returns)
			// If lambda > derivAtLo, the marginal is unattainable → no time
			if (lambda >= derivAtLo) return 0;
			// If lambda < derivAtHi, the marginal always exceeds λ → full optimum
			if (lambda <= derivAtHi) return hi;

			for (let i = 0; i < 50; i++) {
				const mid = (lo + hi) / 2;
				const derivAtMid = avgProductivityDerivative(mid, a, p0, k);

				if (Math.abs(derivAtMid - lambda) < 0.0001) return mid;

				if (derivAtMid > lambda) {
					lo = mid; // Need more time to reduce derivative
				} else {
					hi = mid; // Need less time to increase derivative
				}
			}

			return (lo + hi) / 2;
		};

		const calcTotalTime = (lambda: number): number =>
			taskParams.reduce((sum, tp, i) => sum + findTimeForLambda(lambda, tp, optimalTimes[i]), 0);

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

		let currentAllocs = taskParams.map((tp, i) =>
			findTimeForLambda(optimalLambda, tp, optimalTimes[i])
		);

		// Normalize to exactly match the allocation target (handle numerical error).
		const currentTotal = currentAllocs.reduce((sum, t) => sum + t, 0);
		if (currentTotal > 0) {
			const scale = allocationTarget / currentTotal;
			currentAllocs = currentAllocs.map((t) => t * scale);
		}

		return currentAllocs;
	};

	// Switch overhead is charged only for tasks that actually receive time.
	const hours = resolveWithSwitchOverhead(tasks.length, totalBudget, switchCost, allocate);

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
 * With three multipliers, the single-λ bisection of calculateTaskAllocations
 * no longer applies. Instead: steepest-ascent water-filling (repeatedly give
 * the next time increment to the feasible task with the highest marginal
 * productivity — optimal in the Δ→0 limit for concave P̄ᵢ with a single
 * binding constraint), followed by resource-aware transfer refinement to
 * restore KKT stationarity when pool constraints bind with unequal weights.
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

	const STEP = 0.01; // hours; matches the display rounding granularity

	const allocate = (effectiveBudget: number): number[] => {
		const t = new Array(tasks.length).fill(0);
		if (effectiveBudget <= 0) return t;

		let budgetLeft = effectiveBudget;
		let cogLeft = pools.cognitiveHours;
		let physLeft = pools.physicalHours;

		const isFeasible = (i: number, delta: number): boolean =>
			t[i] + delta <= optimalTimes[i] + 1e-9 &&
			delta <= budgetLeft + 1e-9 &&
			tasks[i].cognitiveWeight * delta <= cogLeft + 1e-9 &&
			tasks[i].physicalWeight * delta <= physLeft + 1e-9;

		const spend = (i: number, delta: number): void => {
			t[i] += delta;
			budgetLeft -= delta;
			cogLeft -= tasks[i].cognitiveWeight * delta;
			physLeft -= tasks[i].physicalWeight * delta;
		};

		// Greedy water-filling: each increment goes to the feasible task with the
		// highest marginal productivity. Marginals decrease in t, so this equalizes
		// them across tasks exactly like the Lagrange condition requires.
		const greedyFill = (): void => {
			for (;;) {
				let best = -1;
				let bestMarginal = 0; // only allocate while the marginal is positive
				for (let i = 0; i < tasks.length; i++) {
					if (!isFeasible(i, STEP)) continue;
					const { a, p0, k } = taskParams[i];
					const marginal = avgProductivityDerivative(t[i] + STEP / 2, a, p0, k);
					if (marginal > bestMarginal) {
						bestMarginal = marginal;
						best = i;
					}
				}
				if (best === -1) break;
				spend(best, STEP);
			}
		};

		// Resource-aware transfer refinement: when a pool binds, tasks draw on it
		// at different rates, so an hour given up by donor i can fund MORE than an
		// hour on recipient j — e.g. with the cognitive pool binding, an hour off
		// weight-1.0 work funds 1/0.3 ≈ 3.3h of weight-0.3 work. The donor always
		// gives up STEP; the recipient gains as much as the freed resources plus
		// existing slack allow (candidates: the 1:1 swap and the maximum gain).
		const refineSweep = (): boolean => {
			let improved = false;
			for (let i = 0; i < tasks.length; i++) {
				for (let j = 0; j < tasks.length; j++) {
					if (i === j) continue;
					const { a: ai, p0: p0i, k: ki } = taskParams[i];
					const { a: aj, p0: p0j, k: kj } = taskParams[j];
					// Keep transferring between this pair while it improves total P.
					for (;;) {
						if (t[i] < STEP) break;
						const maxGain = Math.min(
							optimalTimes[j] - t[j],
							budgetLeft + STEP,
							tasks[j].cognitiveWeight > 0
								? (cogLeft + tasks[i].cognitiveWeight * STEP) / tasks[j].cognitiveWeight
								: Infinity,
							tasks[j].physicalWeight > 0
								? (physLeft + tasks[i].physicalWeight * STEP) / tasks[j].physicalWeight
								: Infinity
						);
						if (maxGain <= 1e-9) break;

						const donorLoss =
							averageProductivity(t[i], ai, p0i, ki) -
							averageProductivity(t[i] - STEP, ai, p0i, ki);
						let bestDelta = 0;
						let bestGain = 1e-9; // require a real improvement, not float noise
						for (const delta of maxGain > STEP ? [maxGain, STEP] : [maxGain]) {
							const gain =
								averageProductivity(t[j] + delta, aj, p0j, kj) -
								averageProductivity(t[j], aj, p0j, kj) -
								donorLoss;
							if (gain > bestGain) {
								bestGain = gain;
								bestDelta = delta;
							}
						}
						if (bestDelta === 0) break;

						t[i] -= STEP;
						t[j] += bestDelta;
						budgetLeft += STEP - bestDelta;
						cogLeft += tasks[i].cognitiveWeight * STEP - tasks[j].cognitiveWeight * bestDelta;
						physLeft += tasks[i].physicalWeight * STEP - tasks[j].physicalWeight * bestDelta;
						improved = true;
					}
				}
			}
			return improved;
		};

		greedyFill();
		for (let round = 0; round < 100; round++) {
			if (!refineSweep()) break;
			greedyFill(); // spend any budget/pool slack the transfers freed up
		}

		return t;
	};

	// Switch overhead is charged only for tasks that actually receive time.
	const t = resolveWithSwitchOverhead(tasks.length, totalBudget, switchCost, allocate);

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

// Below this many data points a 3-parameter plane fit is mostly noise.
export const MIN_FLOW_OBSERVATIONS = 5;

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
 * Personalize the user constants from measured time-to-flow data: linear
 * least squares fit of the plane ϕ = c₁E + c₂β + c₃ over the observations
 * (the article's "User Dependent Constants" section), via normal equations.
 *
 * Falls back (fitted: false) when:
 * - there are fewer than MIN_FLOW_OBSERVATIONS data points,
 * - the observations are degenerate (e.g. every logged task has the same E
 *   and β, leaving the plane underdetermined), or
 * - the fitted plane predicts an implausible ϕ (≤ 0 or > 16h) somewhere on
 *   the E×β domain, which happens with wildly noisy measurements.
 */
export function fitUserConstants(
	observations: FlowObservation[],
	fallback: UserConstants = DEFAULT_USER_CONSTANTS
): { constants: UserConstants; fitted: boolean } {
	if (observations.length < MIN_FLOW_OBSERVATIONS) {
		return { constants: fallback, fitted: false };
	}

	// Normal equations (XᵀX)c = Xᵀϕ with design-matrix rows [E, β, 1]
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
	const solution = solve3x3(
		[
			[sEE, sEb, sE],
			[sEb, sbb, sb],
			[sE, sb, observations.length]
		],
		[sEp, sbp, sp]
	);
	if (!solution) return { constants: fallback, fitted: false };

	const [c1, c2, c3] = solution;
	for (const E of [1, 5]) {
		for (const beta of [1, 2]) {
			const phi = c1 * E + c2 * beta + c3;
			if (phi <= 0 || phi > 16) return { constants: fallback, fitted: false };
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
