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
	peakProductivity: number; // a + p₀
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
 * Calculate initial productivity
 * p₀ = β/E
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
 * p(t) = (a + p₀) × t × e^(-kt) where k = 1/ϕ
 *
 * Note: This form ensures the maximum occurs exactly at t = 1/k = ϕ (flow state time).
 * Taking dp/dt = 0 gives (1 - kt) = 0, so t_max = 1/k = ϕ.
 */
export function productivity(t: number, a: number, p0: number, k: number): number {
	if (t <= 0) return 0;
	return (a + p0) * t * Math.exp(-k * t);
}

/**
 * Average productivity over interval [0, T]
 * P̄(T) = (1/T) ∫₀ᵀ p(t) dt
 *
 * Analytical solution:
 * ∫₀ᵀ t × e^(-kt) dt = (1/k²)[1 - e^(-kT)(kT + 1)]
 *
 * So: P̄(T) = (a + p₀) × [1 - e^(-kT)(kT + 1)] / (T × k²)
 */
export function averageProductivity(T: number, a: number, p0: number, k: number): number {
	if (T <= 0) return 0;

	const kT = k * T;
	const expTerm = Math.exp(-kT);
	const integral = (1 / (k * k)) * (1 - expTerm * (kT + 1));

	return ((a + p0) * integral) / T;
}

/**
 * Derivative of average productivity with respect to T
 * Used for Lagrange multiplier optimization
 *
 * d/dT[P̄(T)] = d/dT[(a + p₀) × (1 - e^(-kT)(kT + 1)) / (T × k²)]
 *
 * Let f(T) = 1 - e^(-kT)(kT + 1)
 * f'(T) = k²T × e^(-kT)
 *
 * P̄(T) = (a + p₀)/(k²) × f(T)/T
 * d/dT[P̄(T)] = (a + p₀)/(k²) × [f'(T)×T - f(T)] / T²
 *            = (a + p₀)/(k²) × [k²T² × e^(-kT) - (1 - e^(-kT)(kT + 1))] / T²
 */
export function avgProductivityDerivative(T: number, a: number, p0: number, k: number): number {
	if (T <= 0.01) return 1000; // Large positive derivative at start

	const kT = k * T;
	const expTerm = Math.exp(-kT);
	const f = 1 - expTerm * (kT + 1);
	const fPrime = k * k * T * expTerm;

	return ((a + p0) / (k * k)) * ((fPrime * T - f) / (T * T));
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
 * This requires numerical solving. The optimal time is approximately 3.16 × ϕ
 */
export function findOptimalSingleTaskTime(
	task: TaskInput,
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): number {
	const { a, p0, k, phi } = calculateTaskParams(task, constants);

	// Newton-Raphson to find where derivative = 0
	let T = phi * 3; // Initial guess based on article
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

/**
 * Main optimization: Allocate time budget across multiple tasks
 * Uses Lagrange multipliers to maximize total productivity
 *
 * Maximize: P(t₁, t₂, ..., tₙ) = Σᵢ P̄ᵢ(tᵢ)
 * Subject to: Σᵢ tᵢ = T (total budget minus context-switching overhead)
 *
 * Context-switching penalty: Each task switch costs `switchCost` hours.
 * For n tasks, there are (n-1) switches, so effective budget = T - (n-1) × switchCost
 *
 * Solution: Find λ such that ∂P̄ᵢ/∂tᵢ = λ for all i
 */
export function calculateTaskAllocations(
	tasks: TaskInput[],
	totalBudget: number,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	switchCost: number = DEFAULT_SWITCH_COST
): TaskAllocation[] {
	// Calculate effective budget after context-switching overhead
	const switchOverhead = tasks.length > 1 ? (tasks.length - 1) * switchCost : 0;
	const effectiveBudget = Math.max(0, totalBudget - switchOverhead);

	if (tasks.length === 0 || effectiveBudget <= 0) {
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

	// Calculate parameters for each task
	const taskParams = tasks.map((task) => ({
		task,
		...calculateTaskParams(task, constants)
	}));

	// If only one task, give it all the time (up to optimal)
	if (tasks.length === 1) {
		const { E, beta, phi, k, a, p0 } = taskParams[0];
		const optimalTime = findOptimalSingleTaskTime(tasks[0], constants);
		const allocatedHours = Math.min(effectiveBudget, optimalTime);

		return [
			{
				...tasks[0],
				allocatedHours,
				E,
				beta,
				phi,
				peakProductivity: a + p0,
				avgProductivity: averageProductivity(allocatedHours, a, p0, k)
			}
		];
	}

	// Use bisection search to find the Lagrange multiplier λ
	// At optimum: ∂P̄ᵢ/∂tᵢ = λ for all tasks with tᵢ > 0
	// We need to find λ such that Σᵢ tᵢ(λ) = effectiveBudget

	// First, calculate optimal single-task times (upper bounds)
	const optimalTimes = taskParams.map((tp) => findOptimalSingleTaskTime(tp.task, constants));

	// Function to find time allocation for a given marginal value λ
	// For each task, find t such that ∂P̄/∂t = λ (or t = 0 if λ is too high)
	const findTimeForLambda = (
		lambda: number,
		tp: (typeof taskParams)[0],
		optTime: number
	): number => {
		const { a, p0, k } = tp;

		// Binary search for t where derivative equals lambda
		let lo = 0.001;
		let hi = optTime * 2;

		// Check if lambda is achievable
		const derivAtLo = avgProductivityDerivative(lo, a, p0, k);
		const derivAtHi = avgProductivityDerivative(hi, a, p0, k);

		// Derivative decreases as t increases (diminishing returns)
		// If lambda > derivAtLo, task gets minimum time
		if (lambda >= derivAtLo) return 0;
		// If lambda < derivAtHi, task gets maximum time
		if (lambda <= derivAtHi) return hi;

		// Binary search
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

	// Binary search for the optimal lambda
	// Higher lambda = less total time allocated
	// Lower lambda = more total time allocated
	let lambdaLo = -10;
	let lambdaHi = 100;

	// Find lambda bounds
	const calcTotalTime = (lambda: number): number => {
		return taskParams.reduce((sum, tp, i) => {
			return sum + findTimeForLambda(lambda, tp, optimalTimes[i]);
		}, 0);
	};

	// Expand bounds if needed
	while (calcTotalTime(lambdaLo) < effectiveBudget && lambdaLo > -1000) {
		lambdaLo *= 2;
	}
	while (calcTotalTime(lambdaHi) > effectiveBudget && lambdaHi < 10000) {
		lambdaHi *= 2;
	}

	// Binary search for optimal lambda
	let optimalLambda = (lambdaLo + lambdaHi) / 2;
	for (let i = 0; i < 100; i++) {
		const mid = (lambdaLo + lambdaHi) / 2;
		const totalTime = calcTotalTime(mid);

		if (Math.abs(totalTime - effectiveBudget) < 0.001) {
			optimalLambda = mid;
			break;
		}

		if (totalTime > effectiveBudget) {
			lambdaLo = mid; // Increase lambda to reduce total time
		} else {
			lambdaHi = mid; // Decrease lambda to increase total time
		}
		optimalLambda = mid;
	}

	// Calculate final allocations with optimal lambda
	let allocations = taskParams.map((tp, i) => ({
		...tp,
		optimalTime: optimalTimes[i],
		currentAlloc: findTimeForLambda(optimalLambda, tp, optimalTimes[i])
	}));

	// Normalize to exactly match budget (handle any numerical errors)
	const currentTotal = allocations.reduce((sum, a) => sum + a.currentAlloc, 0);
	if (currentTotal > 0) {
		allocations = allocations.map((a) => ({
			...a,
			currentAlloc: (a.currentAlloc / currentTotal) * effectiveBudget
		}));
	}

	// Build result with rounding correction
	// Round each allocation, then adjust the largest to absorb rounding error
	const roundedAllocations = allocations.map((a) => ({
		...a,
		roundedHours: Math.round(a.currentAlloc * 100) / 100
	}));

	const roundedSum = roundedAllocations.reduce((sum, a) => sum + a.roundedHours, 0);
	const roundingError = Math.round((effectiveBudget - roundedSum) * 100) / 100;

	// Find the largest allocation to absorb the error
	if (roundingError !== 0 && roundedAllocations.length > 0) {
		const largestIdx = roundedAllocations.reduce(
			(maxIdx, a, idx, arr) => (a.roundedHours > arr[maxIdx].roundedHours ? idx : maxIdx),
			0
		);
		roundedAllocations[largestIdx].roundedHours =
			Math.round((roundedAllocations[largestIdx].roundedHours + roundingError) * 100) / 100;
	}

	return roundedAllocations.map((a) => ({
		...a.task,
		allocatedHours: a.roundedHours,
		E: a.E,
		beta: a.beta,
		phi: a.phi,
		peakProductivity: a.a + a.p0,
		avgProductivity: averageProductivity(a.currentAlloc, a.a, a.p0, a.k)
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
