/**
 * Measurements behind MATH.md §19: the naive baseline was billed for switches
 * it did not make, and the odd block landed wherever the task list happened to
 * be ordered.
 *
 * §13.2 removed a handicap charged to ONE side of the gain comparison — the
 * block lattice. This probe measures the same shape of handicap in the SWITCH
 * COST, which §13.2 left in place and its "Unchanged: the naive = 0 →
 * GAIN_PERCENT_CAP case ... is a real scenario" bullet endorsed.
 *
 * Arms:
 *   A  how often the OLD baseline's plan seated fewer tasks than it was billed
 *      switches for, and what that did to the reported gain
 *   B  the 999% cap under both bills — is `naive = 0` a real day or an artifact?
 *   C  order dependence of the reported gain, before and after
 *   D  the properties the fix must not break: gain ≥ 0 (single-budget path is a
 *      theorem, Fox 1966 §4; pooled path is a measurement) and the optimizer
 *      never scoring below the naive plan
 *   E  residual permutation dependence of the rotation average when a pool binds
 *      (exactly zero is only provable when none does — §19)
 *
 * The generator is `rv13-naive-lattice.probe.ts`'s, so the numbers here sit on
 * the same draw as §13.2's table: integer sliders, pool weights tied to them,
 * budget on the 0.25h lattice.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	GAIN_PERCENT_CAP,
	calculatePooledAllocations,
	calculateTotalProductivity,
	pooledProductivityGain,
	productivityGain,
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
 * was held back by a capacity pool, which is where §13.3's greedy gap lives.
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

function shuffled(tasks: PooledTaskInput[], rnd: () => number) {
	const out = [...tasks];

	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));

		[out[i], out[j]] = [out[j], out[i]];
	}

	return out;
}

describe('MATH.md §19 — the naive baseline pays for the switches it makes', () => {
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

					const newG = pooledProductivityGain(perm, budget).gainPercent;

					loOld = Math.min(loOld, oldG);
					hiOld = Math.max(hiOld, oldG);
					loNew = Math.min(loNew, newG);
					hiNew = Math.max(hiNew, newG);
				}

				// 0.05pp is the display resolution: gainPercent is rounded to 0.1.
				if (hiOld - loOld > 0.05) movedOld++;

				if (hiNew - loNew > 0.05) movedNew++;

				worstOld = Math.max(worstOld, hiOld - loOld);
				worstNew = Math.max(worstNew, hiNew - loNew);
			}

			console.log(
				`[C] n=${n}: reordering the same day moves the gain on ${pct(movedOld / DAYS_PER_COUNT)} of days before ` +
					`(spread up to ${worstOld.toFixed(1)}pp), ${pct(movedNew / DAYS_PER_COUNT)} after ` +
					`(up to ${worstNew.toFixed(2)}pp)`,
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

				// §13.2's THEOREM, re-asserted against the new baseline: on the
				// single-budget path the naive plan is still one of the block
				// distributions the exact greedy maximizes over (Fox 1966, §4), now
				// under the smaller switch bill of a smaller funded subset. The pooled
				// path never had this guarantee — its greedy is a heuristic (§13.3) —
				// so its rate is measured, not asserted.
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
			`[F] ${cases} (budget, switchCost, n) cases: ${violations} self-consistency violations, ` +
				`${nonMonotone} where a LARGER k was also seatable (scan-down would have missed it)`,
		);

		expect(violations).toBe(0);
		expect(nonMonotone).toBe(0);
	});

	it('arm G — a budget of one whole block is never "the naive plan achieves nothing"', () => {
		// The retracted §13.2 bullet held that naive = 0 is a real day. It is not:
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
});
