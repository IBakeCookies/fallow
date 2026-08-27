/**
 * Measurements behind the naive baseline: it was billed for switches it did not
 * make, and the odd block landed wherever the task list happened to be
 * ordered.
 *
 * An earlier fix removed a handicap charged to ONE side of the gain comparison
 * — the block lattice. This probe measures the same shape of handicap in the
 * SWITCH COST, which that fix left in place and its "Unchanged: the naive = 0 →
 * GAIN_PERCENT_CAP case ... is a real scenario" bullet endorsed.
 *
 * Arms:
 *   A  how often the OLD baseline's plan seated fewer tasks than it was billed
 *      switches for, and what that did to the reported gain
 *   B  the 999% cap under both bills — is `naive = 0` a real day or an artifact?
 *   C  order dependence of the reported gain, before and after
 *   D  the properties the fix must not break: gain ≥ 0 (single-budget path is
 *      Fox 1966 §4 over the truncated menu; pooled path is a measurement) and
 *      the optimizer never scoring below the naive plan
 *   E  residual permutation dependence of the rotation average when a pool binds
 *      (exactly zero is only provable when none does)
 *   F  the affordability scan's monotonicity, exhaustively
 *   H  regression: a pool the baseline cannot draw on must not inflate the gain.
 *      The first cut windowed the round-robin to `seated` tasks, and a
 *      window of only pool-blocked tasks brought the 999% cap back.
 *   J  the exactness argument dominates EVERY rotation, which is strictly
 *      stronger than dominating their average — how often, and by how much, the
 *      average really sits below the best rotation
 *   K  what the rotation baseline costs in wall clock, against the previous
 *      baseline and against the 2ⁿ funded-subset solve it runs beside
 *
 * The generator is `rv13-naive-lattice.probe.ts`'s, so the day-sweep numbers
 * here sit on the same draw as that probe's table: integer sliders, pool
 * weights tied to them, budget on the 0.25h lattice. Arm K is a timing, not a
 * draw: it states its own day, machine and repetition count, because nothing
 * else makes a millisecond reproducible.
 *
 * Usage: npm run probe
 */

import { cpus } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	GAIN_PERCENT_CAP,
	calculatePooledAllocations,
	calculateTaskAllocations,
	calculateTotalProductivity,
	pooledProductivityGain,
	productivityGain,
	type FitPosterior,
	type PooledTaskInput,
} from '$lib/business/model/zenith';

/** Seeded so a quoted number can be reproduced, not just re-rolled. */
function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const DAYS_PER_COUNT = 400;
const COUNTS = [2, 3, 4, 5, 6, 8];

function randomDay(rnd: () => number, n: number) {
	const tasks: PooledTaskInput[] = Array.from(
		{
			length: n,
		},
		(_, i) => {
			const mental = 1 + Math.floor(rnd() * 10);
			const physical = 1 + Math.floor(rnd() * 10);

			return {
				title: `t${i}`,
				difficulty: Math.min(10, Math.max(mental, physical) + 0.3 * Math.min(mental, physical)),
				enjoyment: 1 + Math.floor(rnd() * 10),
				cognitiveWeight: mental / 10,
				physicalWeight: physical / 10,
			};
		},
	);

	return {
		tasks,
		budget: 0.5 + Math.floor(rnd() * 32) * 0.25,
	};
}

/**
 * The PRE-2026-08-06 baseline, replicated: round-robin over all n tasks out of a
 * budget already docked (n−1)·switchCost whether or not the plan seats n tasks.
 */
function oldNaiveHours(
	tasks: PooledTaskInput[],
	budget: number,
	poolCog: number,
	poolPhys: number,
) {
	const overhead = tasks.length > 1 ? (tasks.length - 1) * DEFAULT_SWITCH_COST : 0;
	const blocks = new Array<number>(tasks.length).fill(0);
	const target = Math.floor(Math.max(0, budget - overhead) / BLOCK_HOURS + 1e-9);
	let remCog = poolCog;
	let remPhys = poolPhys;
	let placed = 0;

	while (placed < target) {
		let any = false;

		for (let i = 0; i < tasks.length && placed < target; i++) {
			const cog = BLOCK_HOURS * tasks[i].cognitiveWeight;
			const phys = BLOCK_HOURS * tasks[i].physicalWeight;

			if (cog > remCog + 1e-9 || phys > remPhys + 1e-9) continue;

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

const pct = (x: number, d = 1) => `${(100 * x).toFixed(d)}%`;

/**
 * Did a pool, rather than the clock, stop the optimized plan? A plan that spent
 * its whole block budget was time-limited; one that left a block on the table
 * was held back by a capacity pool, which is where the greedy gap lives.
 */
function isPoolLimited(tasks: PooledTaskInput[], budget: number): boolean {
	const plan = calculatePooledAllocations(tasks, budget);
	const spent = plan.reduce((s, a) => s + a.allocatedHours, 0);
	const funded = plan.filter((a) => a.allocatedHours > 0).length;
	const room = Math.max(0, budget - (funded > 1 ? (funded - 1) * DEFAULT_SWITCH_COST : 0));

	return room - spent > BLOCK_HOURS - 1e-9;
}

/**
 * `naiveBaselineValue`'s `seated`, recomputed here because it is module-private:
 * the largest task count whose switch bill still leaves it a whole block each.
 */
function seatedCount(n: number, budget: number, switchCost: number): number {
	for (let k = n; k >= 1; k--) {
		if (blockTarget(k, budget, switchCost) >= k) return k;
	}

	return 1;
}

function blockTarget(funded: number, budget: number, switchCost: number): number {
	return Math.floor((budget - (funded > 1 ? (funded - 1) * switchCost : 0)) / BLOCK_HOURS + 1e-9);
}

/**
 * ONE rotation of `naiveBaselineValue`'s plan, which is module-private and only
 * ever returns the average of all n. With both pools Infinity — the
 * single-budget path — `naiveBlockPlan`'s pool skips cannot fire, so the plan is
 * `target` blocks round-robin over the first `k` tasks of the rotation order,
 * `k` the largest count the budget can seat. Same relationship to the shipped
 * code as `oldNaiveHours` has to the previous baseline; arm J asserts the
 * average of these equals the shipped one to 12 decimals.
 */
function rotationHours(
	tasks: PooledTaskInput[],
	budget: number,
	switchCost: number,
	start: number,
): number[] {
	const n = tasks.length;
	const k = seatedCount(n, budget, switchCost);
	const target = blockTarget(k, budget, switchCost);
	const blocks = new Array<number>(n).fill(0);

	if (target < k) return blocks;

	for (let placed = 0; placed < target; placed++) blocks[(start + (placed % k)) % n]++;

	return blocks.map((b) => b * BLOCK_HOURS);
}

// 500, not 50: at 50 the FIRST closure timed in a run read 3× the same work
// measured later, which is the JIT and not the code.
const TIMING_WARMUP = 500;
const TIMING_REPS = 2000;
/** The 2ⁿ solve is ~1000× the cost of the pieces beside it; 20 calls is minutes' worth of the others. */
const SOLVE_REPS = 20;

function timePerCall(call: () => unknown, reps: number): number {
	for (let i = 0; i < TIMING_WARMUP; i++) call();

	const started = performance.now();

	for (let i = 0; i < reps; i++) call();

	return (performance.now() - started) / reps;
}

function shuffled(tasks: PooledTaskInput[], rnd: () => number) {
	const out = [...tasks];

	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));

		[out[i], out[j]] = [out[j], out[i]];
	}

	return out;
}

describe('the naive baseline pays for the switches it makes', () => {
	it('arms A+B — seated tasks vs the switch bill, and what the 999% cap really was', () => {
		for (const n of COUNTS) {
			const rnd = mulberry32(100 + n);
			let overbilled = 0;
			let oldCapped = 0;
			let newCapped = 0;
			const deltas: number[] = [];

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const { tasks, budget } = randomDay(rnd, n);

				const oldHours = oldNaiveHours(
					tasks,
					budget,
					DEFAULT_CAPACITY_POOLS.cognitiveHours,
					DEFAULT_CAPACITY_POOLS.physicalHours,
				);

				const seated = oldHours.filter((h) => h > 0).length;

				if (seated < n) overbilled++;

				const oldNaive = calculateTotalProductivity(tasks, oldHours, DEFAULT_USER_CONSTANTS);
				const { optimized, naive, gainPercent } = pooledProductivityGain(tasks, budget);

				if (oldNaive <= 0 && optimized > 0) oldCapped++;

				if (gainPercent === GAIN_PERCENT_CAP) newCapped++;

				if (oldNaive > 0 && naive > 0)
					deltas.push(((optimized - oldNaive) / oldNaive) * 100 - gainPercent);
			}

			deltas.sort((a, b) => a - b);

			console.log(
				`[A] n=${n}: the old baseline seated < n tasks on ${pct(overbilled / DAYS_PER_COUNT)} of days ` +
					`— billed n−1 = ${n - 1} switches either way`,
			);

			console.log(
				`[A] n=${n}: gain overstated by median ${(deltas[Math.floor(deltas.length / 2)] ?? 0).toFixed(1)}pp, ` +
					`p90 ${(deltas[Math.floor(deltas.length * 0.9)] ?? 0).toFixed(1)}pp, ` +
					`max ${(deltas.at(-1) ?? 0).toFixed(1)}pp over ${deltas.length} days uncapped under both bills`,
			);

			console.log(
				`[B] n=${n}: 999% cap fires on ${pct(oldCapped / DAYS_PER_COUNT)} of days before, ` +
					`${pct(newCapped / DAYS_PER_COUNT)} after`,
			);
		}
	});

	it('arm C — order dependence of the reported gain, before and after', () => {
		for (const n of COUNTS) {
			const rnd = mulberry32(700 + n);
			let movedOld = 0;
			let movedNew = 0;
			let worstOld = 0;
			let worstNew = 0;
			let movedOptimized = 0;
			let worstOptimized = 0;

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const { tasks, budget } = randomDay(rnd, n);
				const optimized = pooledProductivityGain(tasks, budget).optimized;

				const gainFrom = (naive: number) =>
					naive > 0
						? Math.min(GAIN_PERCENT_CAP, ((optimized - naive) / naive) * 100)
						: GAIN_PERCENT_CAP;

				let loOld = Infinity;
				let hiOld = -Infinity;
				let loNew = Infinity;
				let hiNew = -Infinity;
				let loOpt = Infinity;
				let hiOpt = -Infinity;

				for (let p = 0; p < 8; p++) {
					const perm = p === 0 ? tasks : shuffled(tasks, rnd);

					const oldG = gainFrom(
						calculateTotalProductivity(
							perm,
							oldNaiveHours(
								perm,
								budget,
								DEFAULT_CAPACITY_POOLS.cognitiveHours,
								DEFAULT_CAPACITY_POOLS.physicalHours,
							),
							DEFAULT_USER_CONSTANTS,
						),
					);

					const permuted = pooledProductivityGain(perm, budget);

					loOld = Math.min(loOld, oldG);
					hiOld = Math.max(hiOld, oldG);
					loNew = Math.min(loNew, permuted.gainPercent);
					hiNew = Math.max(hiNew, permuted.gainPercent);
					// The OPTIMIZED side under the same permutations: the attribution
					// claim needs a measured number, not an assumption.
					loOpt = Math.min(loOpt, permuted.optimized);
					hiOpt = Math.max(hiOpt, permuted.optimized);
				}

				// 0.05pp is the display resolution: gainPercent is rounded to 0.1.
				if (hiOld - loOld > 0.05) movedOld++;

				if (hiNew - loNew > 0.05) movedNew++;

				if (hiOpt - loOpt > 1e-12) {
					movedOptimized++;
					worstOptimized = Math.max(worstOptimized, (hiOpt - loOpt) / loOpt);
				}

				worstOld = Math.max(worstOld, hiOld - loOld);
				worstNew = Math.max(worstNew, hiNew - loNew);
			}

			console.log(
				`[C] n=${n}: reordering the same day moves the gain on ${pct(movedOld / DAYS_PER_COUNT)} of days before ` +
					`(spread up to ${worstOld.toFixed(1)}pp), ${pct(movedNew / DAYS_PER_COUNT)} after ` +
					`(up to ${worstNew.toFixed(2)}pp)`,
			);

			console.log(
				`[C] n=${n}: the OPTIMIZED side moves on ${pct(movedOptimized / DAYS_PER_COUNT, 2)} of the same days ` +
					`(worst ${pct(worstOptimized, 3)} of the plan value) — pooled greedy tie-breaking`,
			);
		}
	});

	it('arm D — the guarantees the fix must not break', () => {
		for (const n of COUNTS) {
			const rnd = mulberry32(2600 + n);
			let negativeSingle = 0;
			let negativePooled = 0;
			let optimizerBelow = 0;
			let worst = 0;
			let negativeAndPoolBound = 0;

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const { tasks, budget } = randomDay(rnd, n);
				const single = productivityGain(tasks, budget);
				const pooled = pooledProductivityGain(tasks, budget);

				if (single.gainPercent < 0) negativeSingle++;

				const negative = pooled.gainPercent < 0;

				if (negative) negativePooled++;

				if (negative) worst = Math.min(worst, pooled.gainPercent);

				if (negative && isPoolLimited(tasks, budget)) negativeAndPoolBound++;

				if (pooled.naive > pooled.optimized + 1e-9) optimizerBelow++;

				// The earlier guarantee, re-asserted against the new baseline: on the
				// single-budget path the naive plan is still one of the block
				// distributions the exact greedy maximizes over (Fox 1966, §4), now
				// under the smaller switch bill of a smaller funded subset. Exact over
				// the TRUNCATED increment menu, which is the caveat on record — a
				// σ_ϕ > 0 menu cut can leave the naive plan free to place a block the
				// optimizer was never offered — which this generator cannot produce at
				// all, since it passes no posterior and so draws σ_ϕ = 0. Whether a
				// real user reaches that corner is `naive-menu-cut-corner.probe.ts`.
				expect(single.gainPercent).toBeGreaterThanOrEqual(0);
			}

			console.log(
				`[D] n=${n}: gain < 0 on ${pct(negativeSingle / DAYS_PER_COUNT)} single-budget (theorem), ` +
					`${pct(negativePooled / DAYS_PER_COUNT)} pooled (worst ${worst.toFixed(1)}%, ` +
					`${negativeAndPoolBound}/${negativePooled} of them pool-limited); ` +
					`optimizer below naive on ${pct(optimizerBelow / DAYS_PER_COUNT)}`,
			);
		}
	});

	it('arm E — residual permutation dependence when a pool binds', () => {
		let poolBoundDays = 0;
		let exact = 0;
		let worstRel = 0;
		let days = 0;

		for (const n of COUNTS) {
			const rnd = mulberry32(4400 + n);

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const { tasks, budget } = randomDay(rnd, n);
				const base = pooledProductivityGain(tasks, budget).naive;

				// A pool binds the naive plan when it cannot spend its own block target.
				const hours = oldNaiveHours(
					tasks,
					budget,
					DEFAULT_CAPACITY_POOLS.cognitiveHours,
					DEFAULT_CAPACITY_POOLS.physicalHours,
				);

				const bound =
					hours.reduce((s, h) => s + h, 0) <
					Math.max(0, budget - (n - 1) * DEFAULT_SWITCH_COST) - BLOCK_HOURS + 1e-9;

				let lo = base;
				let hi = base;

				for (let p = 0; p < 8; p++) {
					const naive = pooledProductivityGain(shuffled(tasks, rnd), budget).naive;

					lo = Math.min(lo, naive);
					hi = Math.max(hi, naive);
				}

				days++;

				if (bound) poolBoundDays++;

				if (hi - lo <= 1e-12) exact++;
				else if (lo > 0) worstRel = Math.max(worstRel, (hi - lo) / lo);
			}
		}

		console.log(
			`[E] the rotation-averaged naive value is permutation-EXACT on ${pct(exact / days, 2)} of ${days} days ` +
				`(${pct(poolBoundDays / days)} of them pool-bound); worst residual spread ${pct(worstRel, 4)} of the baseline`,
		);
	});

	it('arm F — `seated` is self-consistent, and the scan-down finds the largest one', () => {
		// The code comment claims the predicate `blockTarget(k) >= k` is monotone in
		// k, so scanning down and taking the first hit gives the LARGEST seatable
		// count. Monotonicity is the load-bearing assumption; check it exhaustively
		// over a lattice of budgets and switch costs — including costs that are not
		// multiples of BLOCK_HOURS, and a zero cost, where the arithmetic degenerates.
		let violations = 0;
		let nonMonotone = 0;
		let cases = 0;

		const grid = [0, 0.1, 0.25, 0.33, 0.5, 1, 3].flatMap((switchCost) =>
			Array.from(
				{
					length: 64,
				},
				(_, b) => (b + 1) * BLOCK_HOURS,
			).flatMap((budget) =>
				Array.from(
					{
						length: 12,
					},
					(_, i) => ({
						switchCost,
						budget,
						n: i + 1,
					}),
				),
			),
		);

		for (const { switchCost, budget, n } of grid) {
			const seated = seatedCount(n, budget, switchCost);

			cases++;

			// Self-consistency: the bill is for `seated` tasks and there are at least
			// `seated` blocks to give them one each.
			if (blockTarget(seated, budget, switchCost) < seated) violations++;

			// Monotone: no k ABOVE the scan's answer may satisfy the predicate.
			const larger = Array.from(
				{
					length: n - seated,
				},
				(_, j) => seated + 1 + j,
			);

			if (larger.some((k) => blockTarget(k, budget, switchCost) >= k)) nonMonotone++;
		}

		console.log(
			`[F] ${cases} (budget, switchCost, n) cases: ${violations} affordability violations, ` +
				`${nonMonotone} where a LARGER k was also affordable (scan-down would have missed it)`,
		);

		expect(violations).toBe(0);
		expect(nonMonotone).toBe(0);
	});

	it('arm H — a pool the baseline cannot draw on never inflates the gain (regression)', () => {
		// The first cut restricted the rotation's round-robin to a WINDOW of
		// the first `seated` tasks. A window holding only pool-blocked tasks then
		// produced an all-zero plan, dragged the rotation average down, and brought
		// the 999% cap back through the pool door: 8 tasks at 0.25h against a zeroed
		// physical pool read 700%, 12 tasks read the full 999%, where the honest
		// answer is 0% — one task is seatable, the naive planner gives it the day,
		// and so does the optimizer. Both are reachable from the UI (the physical
		// capacity input allows 0, and physicalDifficulty 0 gives weight 0).
		const zeroPoolDay = (n: number): PooledTaskInput[] =>
			Array.from(
				{
					length: n,
				},
				(_, i) => ({
					title: `t${i}`,
					difficulty: 5,
					enjoyment: 5,
					cognitiveWeight: 0.5,
					physicalWeight: i === n - 1 ? 0 : 0.5,
				}),
			);

		// Exactly one task is seatable, so the honest baseline is "that task gets
		// the whole budget, no switches paid". Asserting the VALUE rather than a
		// 0% gain keeps the check independent of T*: past the seatable task's own
		// optimal stopping point the naive planner keeps grinding and the optimizer
		// stops, which is a real advantage the metric should report.
		let worstGain = 0;
		let worstBaselineError = 0;
		let capped = 0;

		for (const n of [2, 3, 4, 6, 8, 11, 12, 13, 16]) {
			for (let blocks = 1; blocks <= 40; blocks++) {
				const tasks = zeroPoolDay(n);
				const budget = blocks * BLOCK_HOURS;

				const { gainPercent, naive } = pooledProductivityGain(tasks, budget, {
					cognitiveHours: 8,
					physicalHours: 0,
				});

				const honest = calculateTotalProductivity(
					tasks,
					tasks.map((_, i) => (i === n - 1 ? budget : 0)),
					DEFAULT_USER_CONSTANTS,
				);

				worstBaselineError = Math.max(worstBaselineError, Math.abs(naive - honest) / honest);
				worstGain = Math.max(worstGain, gainPercent);

				if (gainPercent === GAIN_PERCENT_CAP) capped++;
			}
		}

		console.log(
			`[H] 360 zeroed-physical-pool cells: baseline off the honest value by at most ` +
				`${pct(worstBaselineError, 4)}; cap fires ${capped} times; worst gain ${worstGain.toFixed(1)}% ` +
				`(the seatable task worked past its own T*, which is a real win)`,
		);

		expect(worstBaselineError).toBeLessThan(1e-12);
		expect(capped).toBe(0);
	});

	it('arm I — a starved pool cannot make the bill exceed the seats', () => {
		// Choosing the switch bill from the TIME budget alone over-charges whenever a
		// POOL, not the clock, is what keeps a task out — measured at 20% of days on
		// the low-pool grid below, worst +14.35pp of reported gain. The shipped scan
		// validates k against the plan instead, so `funded === k` holds by
		// construction; the only escape is the all-zero fallback. This arm pins that
		// the fallback fires ONLY where it should: no seatable task, or a budget
		// under one block — never as a silent over-charge.
		const rnd = mulberry32(8800);
		let zeroBaseline = 0;
		let zeroAndExplained = 0;
		let days = 0;

		for (let day = 0; day < 3000; day++) {
			const n = 2 + Math.floor(rnd() * 9);

			const tasks: PooledTaskInput[] = Array.from(
				{
					length: n,
				},
				(_, i) => ({
					title: `t${i}`,
					difficulty: 1 + Math.floor(rnd() * 10),
					enjoyment: 1 + Math.floor(rnd() * 10),
					cognitiveWeight: 0.5 + Math.round(rnd() * 5) / 10,
					physicalWeight: Math.round(rnd() * 4) / 10,
				}),
			);

			// The starved corner: pools dialled toward zero on the 0.5h UI step.
			const pools = {
				cognitiveHours: Math.round(rnd() * 6) / 2,
				physicalHours: Math.round(rnd() * 8) / 2,
			};

			const budget = (1 + Math.floor(rnd() * 40)) * BLOCK_HOURS;
			const { naive, optimized } = pooledProductivityGain(tasks, budget, pools);

			days++;

			if (naive > 0) continue;

			zeroBaseline++;

			// A zero baseline is honest only when the optimizer also scores zero —
			// i.e. nothing was seatable at all. Otherwise it is the old defect back.
			if (optimized <= 0) zeroAndExplained++;
		}

		console.log(
			`[I] ${days} starved-pool days: baseline is 0 on ${zeroBaseline}, of which ${zeroAndExplained} ` +
				`also have optimized = 0 (nothing seatable). Unexplained zeros: ${zeroBaseline - zeroAndExplained}`,
		);

		expect(zeroBaseline - zeroAndExplained).toBe(0);
	});

	it('arm G — a budget of one whole block is never "the naive plan achieves nothing"', () => {
		// The retracted bullet held that naive = 0 is a real day. It is not:
		// the only way to score 0 now is a budget under one block, where the
		// OPTIMIZER scores 0 too and the ratio is 0/0, not a suppressed win.
		for (const n of COUNTS) {
			const rnd = mulberry32(3300 + n);

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const { tasks } = randomDay(rnd, n);
				const { naive, optimized } = pooledProductivityGain(tasks, BLOCK_HOURS);

				expect(naive).toBeGreaterThan(0);
				expect(optimized).toBeGreaterThan(0);
			}
		}
	});

	it('arm J — the rotation average against the best rotation', () => {
		// The exactness argument is that the optimizer dominates EVERY rotation,
		// which is strictly stronger than dominating their average. The gap between
		// the two is what makes that non-vacuous, and nothing measured it: the
		// shipped function returns only the average.
		let daysBelow = 0;
		let days = 0;

		for (const n of COUNTS) {
			const rnd = mulberry32(5200 + n);
			let below = 0;
			let worstGap = 0;

			for (let day = 0; day < DAYS_PER_COUNT; day++) {
				const { tasks, budget } = randomDay(rnd, n);

				const values = Array.from(
					{
						length: n,
					},
					(_, start) =>
						calculateTotalProductivity(
							tasks,
							rotationHours(tasks, budget, DEFAULT_SWITCH_COST, start),
							DEFAULT_USER_CONSTANTS,
						),
				);

				const average = values.reduce((sum, value) => sum + value, 0) / n;
				const best = Math.max(...values);

				// The replica is only worth a number if it IS the shipped baseline.
				expect(average).toBeCloseTo(productivityGain(tasks, budget).naive, 12);

				days++;

				if (best > average + 1e-12) {
					below++;
					daysBelow++;
					worstGap = Math.max(worstGap, (best - average) / average);
				}
			}

			console.log(
				`[J] n=${n}: the rotation average is strictly below the best rotation on ${pct(below / DAYS_PER_COUNT)} of days, ` +
					`worst gap ${pct(worstGap, 2)} of the average`,
			);
		}

		console.log(`[J] pooled over ${days} days: ${pct(daysBelow / days)}`);
	});

	it('arm K — what the rotation baseline costs, timed', () => {
		// Three millisecond figures were quoted and `performance.now()` appears in
		// six probes and never in this one. A 12-task day is the enumeration's own
		// worst case (2¹² funded subsets), and σ_ϕ > 0 is what turns every P̄
		// evaluation into a 5-node quadrature — so the posterior is hand-built
		// rather than fitted: the cost depends on σ_ϕ being non-zero, not on which
		// user produced it.
		// The generator's own 12-task day, re-timed at three budgets: the solve's
		// cost is dominated by how many blocks each of the 2¹² subsets has to place,
		// so a single budget would report the ratio of one day rather than a cost.
		// 8.25h is this generator's maximum draw.
		const { tasks } = randomDay(mulberry32(9100), 12);

		const posterior: FitPosterior = {
			covariance: [
				[0, 0, 0],
				[0, 0, 0],
				[0, 0, 0.04],
			],
			sigma2: 0.04,
		};

		for (const budget of [2, 4, 8.25]) {
			const solve = () =>
				calculateTaskAllocations(
					tasks,
					budget,
					DEFAULT_USER_CONSTANTS,
					DEFAULT_SWITCH_COST,
					posterior,
				);

			const solved = solve().map((allocation) => allocation.allocatedHours);

			const score = () =>
				calculateTotalProductivity(tasks, solved, DEFAULT_USER_CONSTANTS, posterior);

			// One scoring of the optimized plan PLUS the rotation baseline: handing
			// the solved hours in is the only way to reach `naiveBaselineValue`,
			// which is module-private. Infinite pools make it the single-budget
			// baseline.
			const scoreAndBaseline = () =>
				pooledProductivityGain(
					tasks,
					budget,
					{
						cognitiveHours: Infinity,
						physicalHours: Infinity,
					},
					DEFAULT_USER_CONSTANTS,
					DEFAULT_SWITCH_COST,
					posterior,
					solved,
				);

			const oldMs = timePerCall(
				() =>
					calculateTotalProductivity(
						tasks,
						oldNaiveHours(tasks, budget, Infinity, Infinity),
						DEFAULT_USER_CONSTANTS,
						posterior,
					),
				TIMING_REPS,
			);

			const scoreMs = timePerCall(score, TIMING_REPS);
			const baselineMs = timePerCall(scoreAndBaseline, TIMING_REPS) - scoreMs;
			const solveMs = timePerCall(solve, SOLVE_REPS);

			console.log(
				`[K] n=12, budget ${budget}h, σ_ϕ = 0.2h: previous baseline ${oldMs.toFixed(4)} ms/call ` +
					`(one round-robin + one Σ P̄), rotation baseline ${baselineMs.toFixed(4)} ms/call ` +
					`(12 rotations × 12 Σ P̄ terms), 2ⁿ funded-subset solve ${solveMs.toFixed(2)} ms/call ` +
					`— the baseline is ${pct(baselineMs / solveMs, 2)} of it`,
			);
		}

		console.log(
			`[K] ${TIMING_REPS} timed calls after ${TIMING_WARMUP} warm-up (${SOLVE_REPS} for the solve), ` +
				`node ${process.version} on ${cpus()[0]?.model ?? 'unknown CPU'}`,
		);
	});
});
