import { describe, expect, it } from 'vitest';
import {
	calculateTaskAllocations,
	calculatePooledAllocations,
	calculateTaskParams,
	calculateTotalProductivity,
	averageProductivity,
	avgProductivityDerivative,
	productivity,
	optimalStoppingX,
	mapEffort,
	mapEnjoyability,
	calculateFlowStateTime,
	productivityGain,
	pooledProductivityGain,
	fitUserConstants,
	phiPredictionStd,
	phiParameterStd,
	expectedAverageProductivity,
	expectedOptimalTime,
	findOptimalSingleTaskTime,
	DEFAULT_USER_CONSTANTS,
	DEFAULT_CAPACITY_POOLS,
	BLOCK_HOURS,
	OPTIMAL_PHI_MULTIPLIER,
	GAIN_PERCENT_CAP,
	type FitPosterior,
	type PooledTaskInput,
	type FlowObservation
} from './zenith';

// A representative grid over the whole user-input domain, used by the tests
// that verify preconditions the allocator's exactness rests on (see MATH.md).
const DOMAIN_GRID: { difficulty: number; enjoyment: number }[] = [];
for (const difficulty of [1, 2.5, 4, 5.5, 7, 8.5, 10]) {
	for (const enjoyment of [1, 3.25, 5.5, 7.75, 10]) {
		DOMAIN_GRID.push({ difficulty, enjoyment });
	}
}

describe('Zenith Gradient Algorithm (model v2)', () => {
	describe('Parameter Mappings', () => {
		it('maps user effort (1-10) to true effort E (1-5)', () => {
			// E = (4/9)Eᵤ + 5/9
			expect(mapEffort(1)).toBeCloseTo(1, 10); // Min: 1 → 1
			expect(mapEffort(10)).toBeCloseTo(5, 10); // Max: 10 → 5
			expect(mapEffort(5.5)).toBeCloseTo(3, 10); // Mid: 5.5 → 3
		});

		it('maps user enjoyability (1-10) to true β (1-2)', () => {
			// β = (1/9)βᵤ + 8/9
			expect(mapEnjoyability(1)).toBeCloseTo(1, 10); // Min: 1 → 1
			expect(mapEnjoyability(10)).toBeCloseTo(2, 10); // Max: 10 → 2
		});
	});

	describe('Flow State Time', () => {
		it('calculates ϕ = c₁E + c₂β + c₃', () => {
			// With default constants: c1=0.56, c2=-0.24, c3=0.5
			const E = 3.67; // Effort = 7 user → 3.67 true
			const beta = 1.22; // Enjoyability = 3 user → 1.22 true
			// ϕ = 0.56*3.67 + (-0.24)*1.22 + 0.5 ≈ 2.06 - 0.29 + 0.5 = 2.27
			const phi = calculateFlowStateTime(E, beta, DEFAULT_USER_CONSTANTS);
			expect(phi).toBeCloseTo(2.26, 1);
		});
	});

	describe('Productivity Curve (v2): p(t) = (a·kt + p₀)·e^(−kt)', () => {
		// Mid-range reference parameters (consistent: k = (1 − p₀/a)/ϕ)
		const a = 6;
		const p0 = 0.5;
		const phi = 1.7;
		const k = (1 - p0 / a) / phi;

		it('starts at p(0) = p₀ — the fix the v2 curve exists for', () => {
			expect(productivity(0, a, p0, k)).toBeCloseTo(p0, 10);
		});

		it('peaks exactly at t = ϕ with value a·e^(p₀/a − 1)', () => {
			const peak = productivity(phi, a, p0, k);
			expect(peak).toBeCloseTo(a * Math.exp(p0 / a - 1), 10);
			expect(productivity(phi - 0.01, a, p0, k)).toBeLessThan(peak);
			expect(productivity(phi + 0.01, a, p0, k)).toBeLessThan(peak);
		});

		it('averageProductivity matches numeric integration of p(t)', () => {
			for (const T of [0.25, 1, 2.5, 6]) {
				const n = 50000;
				let sum = 0;
				for (let i = 0; i < n; i++) sum += productivity(((i + 0.5) * T) / n, a, p0, k);
				const numeric = sum / n; // midpoint rule for (1/T)∫₀ᵀ p dt
				expect(averageProductivity(T, a, p0, k)).toBeCloseTo(numeric, 5);
			}
		});

		it('avgProductivityDerivative matches numeric differentiation, incl. the T→0⁺ limit', () => {
			for (const T of [0.05, 0.5, 1.5, 3, 5]) {
				const h = 1e-6;
				const numeric =
					(averageProductivity(T + h, a, p0, k) - averageProductivity(T - h, a, p0, k)) / (2 * h);
				expect(avgProductivityDerivative(T, a, p0, k)).toBeCloseTo(numeric, 5);
			}
			// lim T→0⁺ dP̄/dT = k(a − p₀)/2
			expect(avgProductivityDerivative(0, a, p0, k)).toBeCloseTo((k * (a - p0)) / 2, 10);
		});

		it('P̄ is discontinuous at 0: P̄(0) = 0 but P̄(0⁺) ≈ p₀ (activation bonus)', () => {
			expect(averageProductivity(0, a, p0, k)).toBe(0);
			expect(averageProductivity(1e-7, a, p0, k)).toBeCloseTo(p0, 4);
		});

		it('optimalStoppingX(r) solves eˣ = 1 + x + x²/(1+r); r = 0 recovers the article root 1.7933', () => {
			for (const r of [0, 0.1, 0.3, 0.5, 0.7, 0.9]) {
				const x = optimalStoppingX(r);
				expect(Math.exp(x)).toBeCloseTo(1 + x + (x * x) / (1 + r), 8);
			}
			expect(optimalStoppingX(0)).toBeCloseTo(OPTIMAL_PHI_MULTIPLIER, 3);
		});

		it('findOptimalSingleTaskTime maximizes P̄, with T*/ϕ ∈ (1.5, 1.7933] across the domain', () => {
			for (const task of DOMAIN_GRID) {
				const { a, p0, k, phi } = calculateTaskParams({ title: '', ...task });
				const T = findOptimalSingleTaskTime({ title: '', ...task });
				const best = averageProductivity(T, a, p0, k);
				expect(best).toBeGreaterThanOrEqual(averageProductivity(T * 0.99, a, p0, k));
				expect(best).toBeGreaterThanOrEqual(averageProductivity(T * 1.01, a, p0, k));
				const multiplier = T / phi;
				expect(multiplier).toBeGreaterThan(1.5);
				expect(multiplier).toBeLessThanOrEqual(OPTIMAL_PHI_MULTIPLIER + 1e-6);
			}
		});

		it('marginal dP̄/dT decreases strictly on (0, T*] for every task (bisection/greedy precondition)', () => {
			for (const task of DOMAIN_GRID) {
				const { a, p0, k } = calculateTaskParams({ title: '', ...task });
				const cap = findOptimalSingleTaskTime({ title: '', ...task });
				let prev = Infinity;
				for (let i = 1; i <= 200; i++) {
					const m = avgProductivityDerivative((i / 200) * cap, a, p0, k);
					expect(m).toBeLessThan(prev);
					prev = m;
				}
			}
		});

		it('per-block value increments are non-increasing for every task (greedy exactness precondition)', () => {
			// Checked under the defaults AND a fast-flow constants set that hits the
			// 0.1h ϕ floor (large k stresses the coarse-block regime).
			const constantSets = [DEFAULT_USER_CONSTANTS, { c1: 0.1, c2: -0.05, c3: 0.05 }];
			for (const constants of constantSets) {
				for (const task of DOMAIN_GRID) {
					const { a, p0, k } = calculateTaskParams({ title: '', ...task }, constants);
					const cap = findOptimalSingleTaskTime({ title: '', ...task }, constants);
					// Only the POSITIVE prefix matters: the allocator truncates each
					// task's increment list at the first non-positive delta (P̄ declines
					// past T*, so later blocks are never offered to greedy).
					const maxBlocks = Math.ceil(cap / BLOCK_HOURS) + 2;
					let prevValue = 0;
					let prevDelta = Infinity;
					for (let j = 1; j <= maxBlocks; j++) {
						const value = averageProductivity(j * BLOCK_HOURS, a, p0, k);
						const delta = value - prevValue;
						if (delta <= 1e-12) break;
						expect(delta).toBeLessThanOrEqual(prevDelta + 1e-12);
						prevValue = value;
						prevDelta = delta;
					}
				}
			}
		});
	});

	describe('Task Allocation', () => {
		it('distributes time budget optimally across tasks, in whole 15-minute blocks', () => {
			const allocations = calculateTaskAllocations(
				[
					{ title: 'Write report', difficulty: 4, enjoyment: 2 },
					{ title: 'Practice piano', difficulty: 2, enjoyment: 8 }
				],
				4, // Scarce budget (below the combined single-task optima)
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(allocations).toHaveLength(2);
			// Total should equal budget when budget is scarce
			expect(allocations[0].allocatedHours + allocations[1].allocatedHours).toBeCloseTo(4, 6);
			// Both tasks should get non-zero time
			expect(allocations[0].allocatedHours).toBeGreaterThan(0);
			expect(allocations[1].allocatedHours).toBeGreaterThan(0);
			// v2: plans are 15-minute blocks
			for (const alloc of allocations) {
				expect((alloc.allocatedHours / BLOCK_HOURS) % 1).toBeCloseTo(0, 9);
			}
		});

		it('caps allocations near the optimal stopping time when budget is abundant', () => {
			// Past T* average productivity DECLINES, so an abundant budget must
			// leave slack instead of pushing tasks into diminishing returns.
			const tasks = [
				{ title: 'Write report', difficulty: 4, enjoyment: 2 },
				{ title: 'Practice piano', difficulty: 2, enjoyment: 8 }
			];
			const abundant = calculateTaskAllocations(tasks, 24, DEFAULT_USER_CONSTANTS, 0);
			const total = abundant.reduce((sum, a) => sum + a.allocatedHours, 0);

			// Total stays well below the 24h budget (≈ Σ single-task optima)
			expect(total).toBeLessThan(6);
			// Each task's allocation sits within one planning block of its own T*
			// (v2: T* is task-dependent — no longer a universal 1.79×ϕ)
			for (const a of abundant) {
				expect(Math.abs(a.allocatedHours - a.optimalHours)).toBeLessThanOrEqual(BLOCK_HOURS);
			}
		});

		it('gives equal tasks equal time (sanity check from article)', () => {
			// If all tasks have same E and β, time should be split equally
			const allocations = calculateTaskAllocations(
				[
					{ title: 'Task A', difficulty: 5, enjoyment: 5 },
					{ title: 'Task B', difficulty: 5, enjoyment: 5 },
					{ title: 'Task C', difficulty: 5, enjoyment: 5 }
				],
				6,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(allocations).toHaveLength(3);
			expect(allocations[0].allocatedHours).toBeCloseTo(2, 6);
			expect(allocations[1].allocatedHours).toBeCloseTo(2, 6);
			expect(allocations[2].allocatedHours).toBeCloseTo(2, 6);
		});

		it('reproduces article example allocation pattern', () => {
			// From article: Essay(Eu=7,βu=3), Math(6,6), Video(4,8), Physics(8,5)
			// Essay (high E, low β) should get LEAST time
			// Physics (highest E, medium β) should get MOST time
			const allocations = calculateTaskAllocations(
				[
					{ title: 'Essay', difficulty: 7, enjoyment: 3 },
					{ title: 'Math homework', difficulty: 6, enjoyment: 6 },
					{ title: 'Edit video', difficulty: 4, enjoyment: 8 },
					{ title: 'Study physics', difficulty: 8, enjoyment: 5 }
				],
				6,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(allocations).toHaveLength(4);
			const total = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(total).toBeCloseTo(6, 6);

			const essay = allocations.find((a) => a.title === 'Essay')!;
			const physics = allocations.find((a) => a.title === 'Study physics')!;

			// Essay should get less than physics (article: 0.70 vs 2.31)
			expect(essay.allocatedHours).toBeLessThan(physics.allocatedHours);
		});

		it('applies context-switching penalty correctly', () => {
			const switchCost = 0.25; // 15 minutes per switch
			const tasks = [
				{ title: 'Task A', difficulty: 5, enjoyment: 5 },
				{ title: 'Task B', difficulty: 5, enjoyment: 5 },
				{ title: 'Task C', difficulty: 5, enjoyment: 5 }
			];

			const allocationsNoSwitch = calculateTaskAllocations(tasks, 6, DEFAULT_USER_CONSTANTS, 0);
			const allocationsWithSwitch = calculateTaskAllocations(
				tasks,
				6,
				DEFAULT_USER_CONSTANTS,
				switchCost
			);

			const totalNoSwitch = allocationsNoSwitch.reduce((sum, a) => sum + a.allocatedHours, 0);
			const totalWithSwitch = allocationsWithSwitch.reduce((sum, a) => sum + a.allocatedHours, 0);

			// With 3 tasks, there are 2 switches, so 0.5h overhead
			expect(totalNoSwitch).toBeCloseTo(6, 6);
			expect(totalWithSwitch).toBeCloseTo(5.5, 6); // 6 - 2*0.25 = 5.5
		});

		it('is EXACTLY optimal on the block grid, including the switch-cost fixed charge', () => {
			// Brute force: every block distribution across 3 tasks, charging
			// (funded − 1)·switchCost off the time budget. The allocator (greedy
			// marginal analysis + exhaustive funded-subset enumeration) must match
			// the brute-force optimum exactly — this is the v2 exactness claim.
			const tasks = [
				{ title: 'a', difficulty: 8, enjoyment: 3 },
				{ title: 'b', difficulty: 4, enjoyment: 9 },
				{ title: 'c', difficulty: 6, enjoyment: 6 }
			];
			const budget = 3;
			const switchCost = 0.25;
			const params = tasks.map((t) => calculateTaskParams(t, DEFAULT_USER_CONSTANTS));

			const maxBlocks = Math.floor(budget / BLOCK_HOURS);
			let brute = 0;
			for (let b0 = 0; b0 <= maxBlocks; b0++) {
				for (let b1 = 0; b1 + b0 <= maxBlocks; b1++) {
					for (let b2 = 0; b2 + b1 + b0 <= maxBlocks; b2++) {
						const blocks = [b0, b1, b2];
						const funded = blocks.filter((b) => b > 0).length;
						const overhead = funded > 1 ? (funded - 1) * switchCost : 0;
						const time = (b0 + b1 + b2) * BLOCK_HOURS + overhead;
						if (time > budget + 1e-9) continue;
						const value = blocks.reduce(
							(sum, b, i) =>
								sum + averageProductivity(b * BLOCK_HOURS, params[i].a, params[i].p0, params[i].k),
							0
						);
						if (value > brute) brute = value;
					}
				}
			}

			const allocations = calculateTaskAllocations(
				tasks,
				budget,
				DEFAULT_USER_CONSTANTS,
				switchCost
			);
			const achieved = calculateTotalProductivity(
				tasks,
				allocations.map((a) => a.allocatedHours),
				DEFAULT_USER_CONSTANTS
			);
			expect(achieved).toBeCloseTo(brute, 9);
		});
	});

	describe('Dual-Pool Allocation', () => {
		it('respects the cognitive capacity pool', () => {
			// Three max-intensity cognitive tasks, 10h budget: without pools this
			// would plan ~5h+ of intense mental work; the ~4h cognitive pool caps it.
			const allocations = calculatePooledAllocations(
				[
					{ title: 'A', difficulty: 9, enjoyment: 5, cognitiveWeight: 1, physicalWeight: 0 },
					{ title: 'B', difficulty: 9, enjoyment: 5, cognitiveWeight: 1, physicalWeight: 0 },
					{ title: 'C', difficulty: 9, enjoyment: 5, cognitiveWeight: 1, physicalWeight: 0 }
				],
				10,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0
			);

			const cogSpend = allocations.reduce((sum, a) => sum + a.allocatedHours, 0); // weight 1
			expect(cogSpend).toBeLessThanOrEqual(DEFAULT_CAPACITY_POOLS.cognitiveHours + 1e-9);
			expect(cogSpend).toBeGreaterThan(DEFAULT_CAPACITY_POOLS.cognitiveHours - 2 * BLOCK_HOURS);
		});

		it('mixed day fits more hours than a pure cognitive day (dual-pool insight)', () => {
			const cognitive = { difficulty: 9, enjoyment: 6, cognitiveWeight: 1, physicalWeight: 0 };
			const physical = { difficulty: 9, enjoyment: 6, cognitiveWeight: 0, physicalWeight: 1 };

			const pureCog = calculatePooledAllocations(
				[
					{ title: 'code1', ...cognitive },
					{ title: 'code2', ...cognitive }
				],
				10,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0
			);
			const mixed = calculatePooledAllocations(
				[
					{ title: 'code', ...cognitive },
					{ title: 'gym', ...physical }
				],
				10,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0
			);

			const totalPure = pureCog.reduce((sum, a) => sum + a.allocatedHours, 0);
			const totalMixed = mixed.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(totalMixed).toBeGreaterThan(totalPure);
		});

		it('matches single-budget behavior when pools are ample', () => {
			// Light tasks (low weights) never touch the pools, so the pooled result
			// must agree with the single-budget allocator exactly (same code path).
			const tasks = [
				{ title: 'a', difficulty: 4, enjoyment: 6 },
				{ title: 'b', difficulty: 6, enjoyment: 4 }
			];
			const single = calculateTaskAllocations(tasks, 3, DEFAULT_USER_CONSTANTS, 0);
			const pooled = calculatePooledAllocations(
				tasks.map((t) => ({ ...t, cognitiveWeight: 0.2, physicalWeight: 0.2 })),
				3,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0
			);

			for (let i = 0; i < tasks.length; i++) {
				expect(pooled[i].allocatedHours).toBeCloseTo(single[i].allocatedHours, 9);
			}
		});

		it('never allocates meaningfully past the optimal stopping time', () => {
			const allocations = calculatePooledAllocations(
				[{ title: 'solo', difficulty: 5, enjoyment: 5, cognitiveWeight: 0.1, physicalWeight: 0.1 }],
				24,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0
			);
			// Within one planning block of the task's own T*
			expect(
				Math.abs(allocations[0].allocatedHours - allocations[0].optimalHours)
			).toBeLessThanOrEqual(BLOCK_HOURS);
		});
	});

	describe('Pool-Aware Allocation Quality', () => {
		// Multi-constraint block greedy is a documented heuristic (multi-dimensional
		// knapsack has no exact greedy); these tests pin it within a whisker of the
		// brute-force optimum on the scenarios that broke earlier heuristics.

		it('matches the brute-force block optimum when a pool binds with unequal weights', () => {
			// An hour off the weight-1.0 task frees enough cognitive capacity to
			// fund 1/0.3 ≈ 3.3h of the weight-0.3 task; the allocator must price
			// pool capacity, not just time.
			const tasks: PooledTaskInput[] = [
				{
					title: 'heavy-cog',
					difficulty: 9,
					enjoyment: 8,
					cognitiveWeight: 1.0,
					physicalWeight: 0
				},
				{ title: 'light-cog', difficulty: 5, enjoyment: 6, cognitiveWeight: 0.3, physicalWeight: 0 }
			];
			const pools = { cognitiveHours: 2, physicalHours: 10 };
			const allocations = calculatePooledAllocations(tasks, 10, pools, DEFAULT_USER_CONSTANTS, 0);
			const hours = allocations.map((a) => a.allocatedHours);
			const achieved = calculateTotalProductivity(tasks, hours, DEFAULT_USER_CONSTANTS);

			// Brute-force over the same block grid and constraints
			const params = tasks.map((t) => calculateTaskParams(t, DEFAULT_USER_CONSTANTS));
			let brute = 0;
			for (let b0 = 0; b0 * BLOCK_HOURS <= 10; b0++) {
				for (let b1 = 0; (b0 + b1) * BLOCK_HOURS <= 10; b1++) {
					if (b0 * BLOCK_HOURS * 1.0 + b1 * BLOCK_HOURS * 0.3 > 2 + 1e-9) continue;
					const value =
						averageProductivity(b0 * BLOCK_HOURS, params[0].a, params[0].p0, params[0].k) +
						averageProductivity(b1 * BLOCK_HOURS, params[1].a, params[1].p0, params[1].k);
					if (value > brute) brute = value;
				}
			}

			expect(achieved).toBeGreaterThanOrEqual(brute * 0.99);
			// And the plan respects the binding pool
			expect(hours[0] * 1.0 + hours[1] * 0.3).toBeLessThanOrEqual(2 + 1e-9);
		});

		// Real-world scenario that exposed earlier heuristics' local optima:
		// boxing drains the whole physical pool, guitar/piano compete for the
		// remainder at weight 0.1, and reading is the only zero-physical task.
		const mixedDay: PooledTaskInput[] = [
			{ title: 'boxing', difficulty: 10, enjoyment: 10, cognitiveWeight: 0.4, physicalWeight: 1.0 },
			{ title: 'guitar', difficulty: 4.3, enjoyment: 9, cognitiveWeight: 0.4, physicalWeight: 0.1 },
			{ title: 'piano', difficulty: 6.3, enjoyment: 4, cognitiveWeight: 0.6, physicalWeight: 0.1 },
			{ title: 'reading', difficulty: 4, enjoyment: 3, cognitiveWeight: 0.4, physicalWeight: 0 }
		];

		// Brute force over every 4-task block plan under time (incl. per-funded-
		// count switch overhead) and both pools.
		const bruteForceMixedDay = (
			budget: number,
			pools: { cognitiveHours: number; physicalHours: number },
			switchCost: number
		) => {
			const params = mixedDay.map((t) => calculateTaskParams(t, DEFAULT_USER_CONSTANTS));
			const maxB = Math.floor(budget / BLOCK_HOURS);
			let best = 0;
			for (let b0 = 0; b0 <= maxB; b0++) {
				for (let b1 = 0; b0 + b1 <= maxB; b1++) {
					for (let b2 = 0; b0 + b1 + b2 <= maxB; b2++) {
						for (let b3 = 0; b0 + b1 + b2 + b3 <= maxB; b3++) {
							const blocks = [b0, b1, b2, b3];
							const funded = blocks.filter((b) => b > 0).length;
							const overhead = funded > 1 ? (funded - 1) * switchCost : 0;
							const time = (b0 + b1 + b2 + b3) * BLOCK_HOURS + overhead;
							if (time > budget + 1e-9) continue;
							const cog = blocks.reduce(
								(s, b, i) => s + b * BLOCK_HOURS * mixedDay[i].cognitiveWeight,
								0
							);
							const phys = blocks.reduce(
								(s, b, i) => s + b * BLOCK_HOURS * mixedDay[i].physicalWeight,
								0
							);
							if (cog > pools.cognitiveHours + 1e-9 || phys > pools.physicalHours + 1e-9) continue;
							const value = blocks.reduce(
								(s, b, i) =>
									s + averageProductivity(b * BLOCK_HOURS, params[i].a, params[i].p0, params[i].k),
								0
							);
							if (value > best) best = value;
						}
					}
				}
			}
			return best;
		};

		it('stays near the brute-force optimum when time and a pool bind together (regression)', () => {
			const pools = { cognitiveHours: 8, physicalHours: 1 };
			const allocations = calculatePooledAllocations(
				mixedDay,
				4,
				pools,
				DEFAULT_USER_CONSTANTS,
				0.25
			);
			const hours = allocations.map((a) => a.allocatedHours);
			const achieved = calculateTotalProductivity(mixedDay, hours, DEFAULT_USER_CONSTANTS);

			// Feasibility: time budget incl. switches, and the binding physical pool
			const active = hours.filter((h) => h > 0).length;
			const timeUsed = hours.reduce((s, h) => s + h, 0) + Math.max(0, active - 1) * 0.25;
			expect(timeUsed).toBeLessThanOrEqual(4 + 1e-9);
			expect(hours.reduce((s, h, i) => s + h * mixedDay[i].physicalWeight, 0)).toBeLessThanOrEqual(
				1 + 1e-9
			);

			const brute = bruteForceMixedDay(4, pools, 0.25);
			expect(achieved).toBeGreaterThanOrEqual(brute * 0.98);
		});

		it('prices a task against the switch it would cost (fixed-charge handling)', () => {
			const pools = { cognitiveHours: 8, physicalHours: 2 };
			const allocations = calculatePooledAllocations(
				mixedDay,
				4,
				pools,
				DEFAULT_USER_CONSTANTS,
				0.25
			);
			const hours = allocations.map((a) => a.allocatedHours);
			const achieved = calculateTotalProductivity(mixedDay, hours, DEFAULT_USER_CONSTANTS);

			// The subset enumeration weighs each task's value against the switch it
			// costs; whatever it decides must be within a whisker of brute force.
			const brute = bruteForceMixedDay(4, pools, 0.25);
			expect(achieved).toBeGreaterThanOrEqual(brute * 0.98);
		});
	});

	describe('Switch Overhead', () => {
		it('does not charge switches for tasks that receive no time', () => {
			// The cognitive task is blocked entirely (cognitive pool = 0), so the
			// day has ONE real work session and zero switches: the physical task
			// must get the same time as if it were planned alone.
			const blocked: PooledTaskInput = {
				title: 'blocked',
				difficulty: 8,
				enjoyment: 5,
				cognitiveWeight: 1,
				physicalWeight: 0
			};
			const gym: PooledTaskInput = {
				title: 'gym',
				difficulty: 6,
				enjoyment: 8,
				cognitiveWeight: 0,
				physicalWeight: 1
			};
			const pools = { cognitiveHours: 0, physicalHours: 6 };

			const together = calculatePooledAllocations(
				[blocked, gym],
				2,
				pools,
				DEFAULT_USER_CONSTANTS,
				0.25
			);
			const alone = calculatePooledAllocations([gym], 2, pools, DEFAULT_USER_CONSTANTS, 0.25);

			expect(together.find((a) => a.title === 'blocked')!.allocatedHours).toBe(0);
			expect(together.find((a) => a.title === 'gym')!.allocatedHours).toBeCloseTo(
				alone[0].allocatedHours,
				9
			);
		});
	});

	describe('User Constants Fitting', () => {
		const predict = (c: { c1: number; c2: number; c3: number }, E: number, beta: number) =>
			c.c1 * E + c.c2 * beta + c.c3;

		it('returns the prior untouched with no observations', () => {
			const { constants, fitted } = fitUserConstants([]);
			expect(fitted).toBe(false);
			expect(constants).toEqual(DEFAULT_USER_CONSTANTS);
		});

		it('predictions converge to a noise-free plane as data accumulates', () => {
			// Ridge shrinks toward the prior, so with little data predictions are
			// biased; the bias must vanish as observations accumulate. We test
			// PREDICTIONS (which the allocator consumes), not raw coefficients.
			const truth = { c1: 0.4, c2: -0.3, c3: 0.9 };
			const grid: FlowObservation[] = [];
			for (const E of [1, 2, 3, 4, 5]) {
				for (const beta of [1, 1.33, 1.66, 2]) {
					grid.push({ E, beta, phi: predict(truth, E, beta) });
				}
			}
			const replicate = (n: number) => Array.from({ length: n }, () => grid).flat();

			const maxError = (obs: FlowObservation[]) => {
				const { constants, fitted } = fitUserConstants(obs);
				expect(fitted).toBe(true);
				return Math.max(...grid.map((o) => Math.abs(predict(constants, o.E, o.beta) - o.phi)));
			};

			const errSmall = maxError(replicate(1)); // 20 observations
			const errLarge = maxError(replicate(10)); // 200 observations
			expect(errLarge).toBeLessThan(errSmall); // bias shrinks with data
			// β spans only [1,2], so the c₂ direction is weakly excited and
			// converges slowly: ~6 minutes of residual prior-shrinkage at n=200.
			expect(errLarge).toBeLessThan(0.1);
		});

		it('learns gracefully from degenerate observations (all tasks identical)', () => {
			// Every point at the same (E, β) leaves an unregularized plane
			// underdetermined; the ridge prior keeps the fit well-posed. The
			// prediction at the logged point must move from the prior (≈1.82)
			// toward the measured 3h, while staying anchored (plausible)
			// elsewhere on the domain.
			const observations: FlowObservation[] = Array.from({ length: 5 }, () => ({
				E: 3,
				beta: 1.5,
				phi: 3
			}));
			const { constants, fitted } = fitUserConstants(observations);
			expect(fitted).toBe(true);

			const priorAtPoint = predict(DEFAULT_USER_CONSTANTS, 3, 1.5);
			const fitAtPoint = predict(constants, 3, 1.5);
			expect(fitAtPoint).toBeGreaterThan(priorAtPoint + 0.5); // moved toward 3h
			expect(fitAtPoint).toBeLessThanOrEqual(3.05); // without overshooting
			for (const E of [1, 5]) {
				for (const beta of [1, 2]) {
					expect(predict(constants, E, beta)).toBeGreaterThan(0);
				}
			}
		});

		it('a single log nudges the model without overwhelming the prior', () => {
			const { constants, fitted } = fitUserConstants([{ E: 3, beta: 1.5, phi: 3 }]);
			expect(fitted).toBe(true);

			const priorAtPoint = predict(DEFAULT_USER_CONSTANTS, 3, 1.5);
			const fitAtPoint = predict(constants, 3, 1.5);
			expect(fitAtPoint).toBeGreaterThan(priorAtPoint); // moved toward the log...
			expect(fitAtPoint).toBeLessThan(3); // ...but the prior still holds it back
		});

		it('falls back when the fit predicts absurdly large flow times', () => {
			// Consistently absurd measurements (30h to reach flow) push the plane
			// past any plausible ϕ → reject rather than plan with nonsense
			const observations: FlowObservation[] = Array.from({ length: 8 }, () => ({
				E: 5,
				beta: 1,
				phi: 30
			}));
			const { fitted, constants } = fitUserConstants(observations);
			expect(fitted).toBe(false);
			expect(constants).toEqual(DEFAULT_USER_CONSTANTS);
		});

		it('accepts uniformly short logs even when the plane dips negative at far corners (regression)', () => {
			// A fast-flow user logging ~20m on every task tilts the fitted plane
			// slightly below zero at unobserved corners (e.g. E=1, β=2). The old
			// guard rejected this outright, making it impossible for such users to
			// personalize at all — now the fit is accepted and the 0.1h floor in
			// calculateFlowStateTime handles the far corners.
			const taskPoints = [
				{ Eu: 10, betaU: 10 }, // boxing
				{ Eu: 10, betaU: 7 }, // hybrid work
				{ Eu: 10, betaU: 2 }, // hard grind
				{ Eu: 4.3, betaU: 9 }, // guitar
				{ Eu: 6.3, betaU: 4 }, // piano
				{ Eu: 4, betaU: 3 } // reading
			];
			const observations: FlowObservation[] = taskPoints.map((p) => ({
				E: mapEffort(p.Eu),
				beta: mapEnjoyability(p.betaU),
				phi: 20 / 60
			}));
			const { fitted, constants } = fitUserConstants(observations);
			expect(fitted).toBe(true);

			// Predictions at the LOGGED tasks land near the measured ~20m (ridge
			// blending keeps them within a sane band, not at the defaults' 1.5-3h)
			for (const o of observations) {
				const phi = calculateFlowStateTime(o.E, o.beta, constants);
				expect(phi).toBeGreaterThanOrEqual(0.1);
				expect(phi).toBeLessThan(1);
			}

			// And the floor keeps every corner of the domain usable by the model
			for (const E of [1, 5]) {
				for (const beta of [1, 2]) {
					expect(calculateFlowStateTime(E, beta, constants)).toBeGreaterThanOrEqual(0.1);
				}
			}
		});
	});

	describe('Bayesian Posterior (v2)', () => {
		const obs = (n: number): FlowObservation[] =>
			Array.from({ length: n }, (_, i) => ({
				E: 1 + (i % 5),
				beta: 1 + (i % 4) / 3,
				phi: 0.5 + 0.4 * (1 + (i % 5)) - 0.2 * (1 + (i % 4) / 3)
			}));

		it('the MAP estimate satisfies the ridge normal equations (v1-compatible point estimate)', () => {
			const observations = obs(8);
			const { constants: c, fitted } = fitUserConstants(observations);
			expect(fitted).toBe(true);
			// Gradient of Σ(ϕ − c·x)² + λ‖c − c₀‖² at the solution must vanish
			const lambda = 4;
			const c0 = DEFAULT_USER_CONSTANTS;
			const grad = [0, 0, 0];
			for (const o of observations) {
				const r = c.c1 * o.E + c.c2 * o.beta + c.c3 - o.phi;
				grad[0] += r * o.E;
				grad[1] += r * o.beta;
				grad[2] += r;
			}
			grad[0] += lambda * (c.c1 - c0.c1);
			grad[1] += lambda * (c.c2 - c0.c2);
			grad[2] += lambda * (c.c3 - c0.c3);
			for (const g of grad) expect(Math.abs(g)).toBeLessThan(1e-9);
		});

		it('exposes a symmetric positive posterior covariance and noise estimate', () => {
			const { posterior, fitted } = fitUserConstants(obs(6));
			expect(fitted).toBe(true);
			expect(posterior).toBeDefined();
			expect(posterior!.sigma2).toBeGreaterThan(0);
			expect(posterior!.nEff).toBeCloseTo(6, 9);
			for (let i = 0; i < 3; i++) {
				expect(posterior!.covariance[i][i]).toBeGreaterThan(0);
				for (let j = 0; j < 3; j++) {
					expect(posterior!.covariance[i][j]).toBeCloseTo(posterior!.covariance[j][i], 12);
				}
			}
		});

		it('prediction uncertainty shrinks as observations accumulate', () => {
			const few = fitUserConstants(obs(5)).posterior!;
			const many = fitUserConstants(obs(100)).posterior!;
			const stdFew = phiPredictionStd(3, 1.5, few);
			const stdMany = phiPredictionStd(3, 1.5, many);
			expect(stdMany).toBeLessThan(stdFew);
			// ...but never below the irreducible stopwatch noise floor
			expect(stdMany).toBeGreaterThanOrEqual(Math.sqrt(many.sigma2));
		});

		it('forgetting factor discounts stale observations', () => {
			// 10 old logs say ϕ = 3h at (3, 1.5); 10 recent logs say ϕ = 1h.
			const stale: FlowObservation[] = Array.from({ length: 10 }, () => ({
				E: 3,
				beta: 1.5,
				phi: 3
			}));
			const recent: FlowObservation[] = Array.from({ length: 10 }, () => ({
				E: 3,
				beta: 1.5,
				phi: 1
			}));
			const all = [...stale, ...recent];

			const equal = fitUserConstants(all).constants;
			const forgetting = fitUserConstants(all, DEFAULT_USER_CONSTANTS, {
				forgettingFactor: 0.7
			}).constants;

			const predictAt = (c: { c1: number; c2: number; c3: number }) => c.c1 * 3 + c.c2 * 1.5 + c.c3;
			// With forgetting, the prediction sits meaningfully closer to the
			// recent 1h logs than the equal-weight fit does.
			expect(predictAt(forgetting)).toBeLessThan(predictAt(equal) - 0.2);
		});
	});

	describe('Pooled Productivity Gain', () => {
		it('optimized plan beats the pool-feasible naive split', () => {
			const tasks: PooledTaskInput[] = [
				{ title: 'code', difficulty: 8, enjoyment: 7, cognitiveWeight: 0.9, physicalWeight: 0.1 },
				{ title: 'gym', difficulty: 6, enjoyment: 8, cognitiveWeight: 0.1, physicalWeight: 0.9 },
				{ title: 'chores', difficulty: 3, enjoyment: 3, cognitiveWeight: 0.2, physicalWeight: 0.5 }
			];
			const gain = pooledProductivityGain(
				tasks,
				8,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0.25
			);
			expect(gain.optimized).toBeGreaterThanOrEqual(gain.naive);
			expect(gain.gainPercent).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Productivity Gain', () => {
		it('shows improvement over naive equal split', () => {
			const gain = productivityGain(
				[
					{ title: 'Hard boring', difficulty: 9, enjoyment: 2 },
					{ title: 'Easy fun', difficulty: 2, enjoyment: 9 }
				],
				4,
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			expect(gain.optimized).toBeGreaterThan(gain.naive);
			expect(gain.gainPercent).toBeGreaterThan(0);
		});

		it('caps the gain instead of reporting 0% when the naive plan achieves nothing (2026-07-18 fix)', () => {
			// 10 tasks × 0.25h switch cost = 2.25h of naive overhead > the 2h
			// budget: the naive planner's effective budget is 0 and its
			// productivity 0. The old guard returned gainPercent 0 — hiding
			// Zenith's advantage in exactly the scenario where dropping weak
			// tasks helps most. Now the gain saturates at GAIN_PERCENT_CAP.
			const tasks = Array.from({ length: 10 }, (_, i) => ({
				title: `t${i}`,
				difficulty: 5,
				enjoyment: 3 + (i % 5)
			}));
			const gain = productivityGain(tasks, 2, DEFAULT_USER_CONSTANTS, 0.25);
			expect(gain.naive).toBe(0);
			expect(gain.optimized).toBeGreaterThan(0);
			expect(gain.gainPercent).toBe(GAIN_PERCENT_CAP);

			// Same guard on the pooled variant (what the dashboard shows)
			const pooled = pooledProductivityGain(
				tasks.map((t) => ({ ...t, cognitiveWeight: 0.5, physicalWeight: 0.2 })),
				2,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0.25
			);
			expect(pooled.naive).toBe(0);
			expect(pooled.gainPercent).toBe(GAIN_PERCENT_CAP);
		});

		it('never reports above the cap', () => {
			// (A tiny-but-positive naive value cannot produce a huge FINITE ratio
			// under the v2 curve: continuous slivers still collect ≈ p₀ per task
			// via the activation bonus, so naive is either 0 or substantial —
			// see MATH.md §11.2. The cap therefore mainly guards the naive = 0
			// jump; this sweep just pins the invariant.)
			for (const budget of [0.5, 2, 2.5, 6, 12]) {
				const tasks = Array.from({ length: 9 }, (_, i) => ({
					title: `t${i}`,
					difficulty: 4,
					enjoyment: 3 + (i % 6)
				}));
				const gain = productivityGain(tasks, budget, DEFAULT_USER_CONSTANTS, 0.25);
				expect(gain.gainPercent).toBeLessThanOrEqual(GAIN_PERCENT_CAP);
			}
		});
	});

	describe('ϕ-Uncertainty (posterior-aware allocation, MATH.md §5.1)', () => {
		// Hand-built posteriors: diagonal covariance in (c₁, c₂, c₃) space.
		const widePosterior: FitPosterior = {
			covariance: [
				[0.04, 0, 0],
				[0, 0.04, 0],
				[0, 0, 0.04]
			],
			sigma2: 0.0625,
			nEff: 2
		};

		it('expectedAverageProductivity collapses exactly to averageProductivity at σ = 0', () => {
			for (const { difficulty, enjoyment } of DOMAIN_GRID) {
				const { a, p0, phi, k } = calculateTaskParams({ title: '', difficulty, enjoyment });
				for (const T of [0.25, 1, 2.5, 5]) {
					expect(expectedAverageProductivity(T, a, p0, phi, 0)).toBe(
						averageProductivity(T, a, p0, k)
					);
				}
			}
		});

		it('uncertainty strictly lowers the best achievable average (no free lunch)', () => {
			// Every ϕ-component has the same peak height, so no single T can sit
			// at the optimum of all of them at once.
			const { a, p0, phi } = calculateTaskParams({ title: '', difficulty: 7, enjoyment: 4 });
			const classicBest = averageProductivity(
				findOptimalSingleTaskTime({ title: '', difficulty: 7, enjoyment: 4 }),
				a,
				p0,
				(1 - p0 / a) / phi
			);
			for (const sigma of [0.1, 0.25, 0.5]) {
				const tStar = expectedOptimalTime(a, p0, phi, sigma);
				expect(expectedAverageProductivity(tStar, a, p0, phi, sigma)).toBeLessThan(classicBest);
			}
		});

		it('expectedOptimalTime: reduces to the classic T* at σ = 0 and maximizes E[P̄] at σ > 0', () => {
			for (const { difficulty, enjoyment } of DOMAIN_GRID) {
				const task = { title: '', difficulty, enjoyment };
				const { a, p0, phi } = calculateTaskParams(task);
				expect(expectedOptimalTime(a, p0, phi, 0)).toBeCloseTo(findOptimalSingleTaskTime(task), 10);

				const sigma = 0.3 * phi;
				const tStar = expectedOptimalTime(a, p0, phi, sigma);
				const best = expectedAverageProductivity(tStar, a, p0, phi, sigma);
				for (const dt of [-0.05, 0.05]) {
					expect(expectedAverageProductivity(tStar + dt, a, p0, phi, sigma)).toBeLessThanOrEqual(
						best + 1e-12
					);
				}
			}
		});

		it('mixture block increments stay positive and non-increasing across the domain (greedy precondition)', () => {
			// Regression sweep for the probe result behind the σ-cap: within
			// σ ≤ 0.5ϕ̂ the expected average keeps diminishing increments up to
			// its stopping point (the builder additionally enforces this by
			// construction — this checks the enforcement is a no-op here).
			for (const { difficulty, enjoyment } of DOMAIN_GRID) {
				const { a, p0, phi } = calculateTaskParams({ title: '', difficulty, enjoyment });
				for (const sigmaFrac of [0.1, 0.3, 0.5]) {
					const sigma = sigmaFrac * phi;
					let prevVal = 0;
					let prevInc = Infinity;
					for (let j = 1; j <= 80; j++) {
						const val = expectedAverageProductivity(j * BLOCK_HOURS, a, p0, phi, sigma);
						const inc = val - prevVal;
						if (inc <= 1e-12) break;
						expect(inc).toBeLessThanOrEqual(prevInc + 1e-12);
						prevVal = val;
						prevInc = inc;
					}
				}
			}
		});

		it('phiParameterStd grows with distance from the logged region and shrinks with data', () => {
			const near: FlowObservation[] = Array.from({ length: 4 }, (_, i) => ({
				E: 2 + 0.1 * i,
				beta: 1.5,
				phi: 1.2 + 0.05 * i
			}));
			const many: FlowObservation[] = Array.from({ length: 40 }, (_, i) => ({
				E: 2 + 0.1 * (i % 4),
				beta: 1.5,
				phi: 1.2 + 0.05 * (i % 4)
			}));
			const fitFew = fitUserConstants(near);
			const fitMany = fitUserConstants(many);
			expect(fitFew.posterior).toBeDefined();
			expect(fitMany.posterior).toBeDefined();

			// Far from the cluster (E=5, β=1) the parameter band is wider than at it
			expect(phiParameterStd(5, 1, fitFew.posterior!)).toBeGreaterThan(
				phiParameterStd(2.2, 1.5, fitFew.posterior!)
			);
			// More data shrinks the band everywhere
			expect(phiParameterStd(5, 1, fitMany.posterior!)).toBeLessThan(
				phiParameterStd(5, 1, fitFew.posterior!)
			);
			// And it is parameter-only: strictly below the predictive std, which
			// adds the irreducible noise floor
			expect(phiParameterStd(3, 1.5, fitFew.posterior!)).toBeLessThan(
				phiPredictionStd(3, 1.5, fitFew.posterior!)
			);
		});

		it('allocating with a posterior hedges: uncertain tasks are worth less at their optimum', () => {
			const tasks = [
				{ title: 'a', difficulty: 7, enjoyment: 4 },
				{ title: 'b', difficulty: 3, enjoyment: 8 }
			];
			const classic = calculateTaskAllocations(tasks, 6, DEFAULT_USER_CONSTANTS, 0);
			const hedged = calculateTaskAllocations(tasks, 6, DEFAULT_USER_CONSTANTS, 0, widePosterior);
			for (let i = 0; i < tasks.length; i++) {
				expect(hedged[i].optimalAvgProductivity).toBeLessThan(classic[i].optimalAvgProductivity);
				// ϕ (the posterior MEAN) is untouched — only confidence changed
				expect(hedged[i].phi).toBe(classic[i].phi);
				// Peak height is ϕ-independent, so it must not move either
				expect(hedged[i].peakProductivity).toBe(classic[i].peakProductivity);
			}
			// Plans stay valid: whole blocks, within budget
			const total = hedged.reduce((s, t) => s + t.allocatedHours, 0);
			expect(total).toBeLessThanOrEqual(6 + 1e-9);
			for (const t of hedged) {
				expect(Math.round(t.allocatedHours / BLOCK_HOURS)).toBeCloseTo(
					t.allocatedHours / BLOCK_HOURS,
					9
				);
			}
		});

		it('an end-to-end 2-log fit plans differently from a 200-log fit (the point of §5.1)', () => {
			const logs = (n: number): FlowObservation[] =>
				Array.from({ length: n }, (_, i) => ({
					E: 2 + (i % 3) * 0.8,
					beta: 1.2 + (i % 2) * 0.4,
					phi: 0.9 + (i % 3) * 0.35
				}));
			const few = fitUserConstants(logs(2));
			const lots = fitUserConstants(logs(200));
			const tasks = [
				{ title: 'deep work', difficulty: 9, enjoyment: 5 },
				{ title: 'email', difficulty: 2, enjoyment: 4 }
			];
			const planFew = calculateTaskAllocations(tasks, 8, few.constants, 0.25, few.posterior);
			const planLots = calculateTaskAllocations(tasks, 8, lots.constants, 0.25, lots.posterior);
			// The 200-log plan should be (weakly) more confident about every
			// task's achievable average than a 2-log plan of the same user —
			// compare against each fit's own zero-posterior twin to isolate the
			// uncertainty effect from the constants shift.
			const certainFew = calculateTaskAllocations(tasks, 8, few.constants, 0.25);
			const certainLots = calculateTaskAllocations(tasks, 8, lots.constants, 0.25);
			for (let i = 0; i < tasks.length; i++) {
				const hedgeFew = certainFew[i].optimalAvgProductivity - planFew[i].optimalAvgProductivity;
				const hedgeLots =
					certainLots[i].optimalAvgProductivity - planLots[i].optimalAvgProductivity;
				expect(hedgeFew).toBeGreaterThan(0);
				expect(hedgeLots).toBeGreaterThan(0);
				expect(hedgeLots).toBeLessThan(hedgeFew);
			}
		});
	});

	describe('Bug Fixes', () => {
		it('distributes time across all tasks with small budget (regression test)', () => {
			// This test prevents the bug where only one task got all the time.
			// v2 note: the p₀ activation bonus makes first blocks very valuable,
			// so a scarce budget spreads even more reliably than under v1.
			const allocations = calculateTaskAllocations(
				[
					{ title: 'network', difficulty: 3, enjoyment: 1 },
					{ title: 'Gym', difficulty: 8, enjoyment: 5 },
					{ title: 'Bike', difficulty: 4, enjoyment: 7 },
					{ title: 'reading', difficulty: 5, enjoyment: 5 },
					{ title: 'guitar', difficulty: 4, enjoyment: 9 },
					{ title: 'piano', difficulty: 7, enjoyment: 6 }
				],
				2, // 2 hour budget
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			// All tasks should get some time
			const tasksWithTime = allocations.filter((a) => a.allocatedHours > 0.01);
			expect(tasksWithTime.length).toBeGreaterThanOrEqual(4); // At least 4 tasks should get time

			// Total should equal budget
			const total = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(total).toBeCloseTo(2, 6);

			// High enjoyment tasks should get reasonable allocation
			const guitar = allocations.find((a) => a.title === 'guitar');
			expect(guitar!.allocatedHours).toBeGreaterThan(0.1);
		});

		it('handles 1 hour budget correctly', () => {
			const allocations = calculateTaskAllocations(
				[
					{ title: 'network', difficulty: 3, enjoyment: 1 },
					{ title: 'Gym', difficulty: 8, enjoyment: 5 },
					{ title: 'Bike', difficulty: 4, enjoyment: 7 },
					{ title: 'reading', difficulty: 5, enjoyment: 5 },
					{ title: 'guitar', difficulty: 4, enjoyment: 9 },
					{ title: 'piano', difficulty: 7, enjoyment: 6 }
				],
				1, // 1 hour budget
				DEFAULT_USER_CONSTANTS,
				0 // No switch cost for core algorithm test
			);

			// Total should equal budget
			const total = allocations.reduce((sum, a) => sum + a.allocatedHours, 0);
			expect(total).toBeCloseTo(1, 6);

			// Multiple tasks should get time
			const tasksWithTime = allocations.filter((a) => a.allocatedHours > 0.05);
			expect(tasksWithTime.length).toBeGreaterThanOrEqual(3);
		});
	});
});
