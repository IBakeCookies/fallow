import { describe, expect, it } from 'vitest';
import {
	calculateTaskAllocations,
	calculatePooledAllocations,
	calculateTaskParams,
	calculateTotalProductivity,
	averageProductivity,
	mapEffort,
	mapEnjoyability,
	calculateFlowStateTime,
	productivityGain,
	pooledProductivityGain,
	fitUserConstants,
	findOptimalSingleTaskTime,
	DEFAULT_USER_CONSTANTS,
	DEFAULT_CAPACITY_POOLS,
	type PooledTaskInput,
	type FlowObservation
} from './zenith';

describe('Zenith Gradient Algorithm', () => {
	describe('Parameter Mappings', () => {
		it('maps user effort (1-10) to true effort E (1-5)', () => {
			// E = (4/9)Eᵤ + 5/9
			expect(mapEffort(1)).toBeCloseTo(1, 1); // Min: 1 → 1
			expect(mapEffort(10)).toBeCloseTo(5, 1); // Max: 10 → 5
			expect(mapEffort(5.5)).toBeCloseTo(3, 1); // Mid: 5.5 → 3
		});

		it('maps user enjoyability (1-10) to true β (1-2)', () => {
			// β = (1/9)βᵤ + 8/9
			expect(mapEnjoyability(1)).toBeCloseTo(1, 1); // Min: 1 → 1
			expect(mapEnjoyability(10)).toBeCloseTo(2, 1); // Max: 10 → 2
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

	describe('Task Allocation', () => {
		it('distributes time budget optimally across tasks', () => {
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
			expect(allocations[0].allocatedHours + allocations[1].allocatedHours).toBeCloseTo(4, 1);
			// Both tasks should get non-zero time
			expect(allocations[0].allocatedHours).toBeGreaterThan(0);
			expect(allocations[1].allocatedHours).toBeGreaterThan(0);
		});

		it('caps allocations at the optimal stopping time when budget is abundant', () => {
			// Past t = 1.79×ϕ average productivity DECLINES, so an abundant budget
			// must leave slack instead of pushing tasks into diminishing returns.
			const tasks = [
				{ title: 'Write report', difficulty: 4, enjoyment: 2 },
				{ title: 'Practice piano', difficulty: 2, enjoyment: 8 }
			];
			const abundant = calculateTaskAllocations(tasks, 24, DEFAULT_USER_CONSTANTS, 0);
			const total = abundant.reduce((sum, a) => sum + a.allocatedHours, 0);

			// Total stays well below the 24h budget (≈ Σ single-task optima)
			expect(total).toBeLessThan(6);
			// Each task's allocation sits at ≈ 1.79 × its flow-state time ϕ
			for (const a of abundant) {
				expect(a.allocatedHours).toBeCloseTo(1.7933 * a.phi, 1);
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
			expect(allocations[0].allocatedHours).toBeCloseTo(2, 0.5);
			expect(allocations[1].allocatedHours).toBeCloseTo(2, 0.5);
			expect(allocations[2].allocatedHours).toBeCloseTo(2, 0.5);
		});

		it('reproduces article example allocation pattern', () => {
			// From article: Essay(Eu=7,βu=3), Math(6,6), Video(4,8), Physics(8,5)
			// Article results: Essay=0.70h, Math=1.84h, Video=1.11h, Physics=2.31h
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
			expect(total).toBeCloseTo(6, 1);

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
			expect(totalNoSwitch).toBeCloseTo(6, 1);
			expect(totalWithSwitch).toBeCloseTo(5.5, 1); // 6 - 2*0.25 = 5.5
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
			expect(cogSpend).toBeLessThanOrEqual(DEFAULT_CAPACITY_POOLS.cognitiveHours + 0.02);
			expect(cogSpend).toBeGreaterThan(DEFAULT_CAPACITY_POOLS.cognitiveHours - 0.2);
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
			// should agree with the pure Lagrange allocator.
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
				expect(pooled[i].allocatedHours).toBeCloseTo(single[i].allocatedHours, 1);
			}
		});

		it('never allocates past the optimal stopping time', () => {
			const allocations = calculatePooledAllocations(
				[{ title: 'solo', difficulty: 5, enjoyment: 5, cognitiveWeight: 0.1, physicalWeight: 0.1 }],
				24,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
				0
			);
			// Optimal ≈ 1.79 × ϕ
			expect(allocations[0].allocatedHours).toBeCloseTo(1.7933 * allocations[0].phi, 1);
		});
	});

	describe('Pool-Aware Refinement', () => {
		it('matches the brute-force optimum when a pool binds with unequal weights', () => {
			// An hour off the weight-1.0 task frees enough cognitive capacity to
			// fund 1/0.3 ≈ 3.3h of the weight-0.3 task. A 1:1 time-swap refinement
			// can never discover this; the resource-aware transfer must.
			const tasks: PooledTaskInput[] = [
				{ title: 'heavy-cog', difficulty: 9, enjoyment: 8, cognitiveWeight: 1.0, physicalWeight: 0 },
				{ title: 'light-cog', difficulty: 5, enjoyment: 6, cognitiveWeight: 0.3, physicalWeight: 0 }
			];
			const pools = { cognitiveHours: 2, physicalHours: 10 };
			const allocations = calculatePooledAllocations(tasks, 10, pools, DEFAULT_USER_CONSTANTS, 0);
			const hours = allocations.map((a) => a.allocatedHours);
			const achieved = calculateTotalProductivity(tasks, hours, DEFAULT_USER_CONSTANTS);

			// Brute-force grid search over the feasible region
			const params = tasks.map((t) => calculateTaskParams(t, DEFAULT_USER_CONSTANTS));
			const optima = tasks.map((t) => findOptimalSingleTaskTime(t, DEFAULT_USER_CONSTANTS));
			let best = 0;
			for (let h0 = 0; h0 <= Math.min(optima[0], 2) + 1e-9; h0 += 0.01) {
				const h1Max = Math.min(optima[1], 10 - h0, (2 - h0) / 0.3);
				for (let h1 = 0; h1 <= h1Max + 1e-9; h1 += 0.01) {
					const p =
						averageProductivity(h0, params[0].a, params[0].p0, params[0].k) +
						averageProductivity(h1, params[1].a, params[1].p0, params[1].k);
					if (p > best) best = p;
				}
			}

			expect(achieved).toBeGreaterThan(best * 0.99);
			// And the plan respects the binding pool
			expect(hours[0] * 1.0 + hours[1] * 0.3).toBeLessThanOrEqual(2 + 0.02);
		});

		// Real-world scenario that exposed the pairwise-swap heuristic's local
		// optimum: boxing drains the whole physical pool, guitar/piano compete for
		// the remainder at weight 0.1, and reading is the only zero-physical task.
		const mixedDay: PooledTaskInput[] = [
			{ title: 'boxing', difficulty: 10, enjoyment: 10, cognitiveWeight: 0.4, physicalWeight: 1.0 },
			{ title: 'guitar', difficulty: 4.3, enjoyment: 9, cognitiveWeight: 0.4, physicalWeight: 0.1 },
			{ title: 'piano', difficulty: 6.3, enjoyment: 4, cognitiveWeight: 0.6, physicalWeight: 0.1 },
			{ title: 'reading', difficulty: 4, enjoyment: 3, cognitiveWeight: 0.4, physicalWeight: 0 }
		];

		it('escapes the 3-way exchange trap when time and a pool bind together (regression)', () => {
			const pools = { cognitiveHours: 8, physicalHours: 1 };
			const allocations = calculatePooledAllocations(mixedDay, 4, pools, DEFAULT_USER_CONSTANTS, 0.25);
			const hours = allocations.map((a) => a.allocatedHours);
			const achieved = calculateTotalProductivity(mixedDay, hours, DEFAULT_USER_CONSTANTS);

			// Feasibility: time budget incl. switches, and the binding physical pool
			const active = hours.filter((h) => h > 0.005).length;
			const timeUsed = hours.reduce((s, h) => s + h, 0) + Math.max(0, active - 1) * 0.25;
			expect(timeUsed).toBeLessThanOrEqual(4 + 0.02);
			expect(hours.reduce((s, h, i) => s + h * mixedDay[i].physicalWeight, 0)).toBeLessThanOrEqual(
				1.01
			);

			// Brute-force optimum ≈ 3.725 (0.05h grid + local exchange search). The
			// old heuristic stalled at 3.19: it dumped 1h43m on reading and left piano
			// 4 minutes, because escaping required a boxing→physical→piano exchange
			// that pairwise time-swaps cannot express.
			expect(achieved).toBeGreaterThan(3.72);
			expect(hours[2]).toBeGreaterThan(0.5); // piano gets a real session, not 4m
			expect(hours[3]).toBeLessThan(1.0); // reading stays modest, not 1h43m
		});

		it('drops a task whose value is below its switch cost', () => {
			const pools = { cognitiveHours: 8, physicalHours: 2 };
			const allocations = calculatePooledAllocations(mixedDay, 4, pools, DEFAULT_USER_CONSTANTS, 0.25);
			const hours = allocations.map((a) => a.allocatedHours);

			// Funding reading (~20m of low-marginal work) costs a 15m switch that is
			// worth more than the work: the optimum drops it entirely and spends the
			// day on the other three (total P̄ 4.07 vs 3.94 when funding all four).
			expect(hours[3]).toBe(0);
			expect(hours.filter((h) => h > 0).length).toBe(3);
			const achieved = calculateTotalProductivity(mixedDay, hours, DEFAULT_USER_CONSTANTS);
			expect(achieved).toBeGreaterThan(4.0);
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
				1
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
	});

	describe('Bug Fixes', () => {
		it('distributes time across all tasks with small budget (regression test)', () => {
			// This test prevents the bug where only one task got all the time
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
			expect(total).toBeCloseTo(2, 1);

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
			expect(total).toBeCloseTo(1, 1);

			// Multiple tasks should get time
			const tasksWithTime = allocations.filter((a) => a.allocatedHours > 0.05);
			expect(tasksWithTime.length).toBeGreaterThanOrEqual(3);
		});
	});
});
