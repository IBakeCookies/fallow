/**
 * Measurements behind MATH.md §34: what the funded-subset search forfeits past
 * `EXACT_SUBSET_LIMIT`, and what the size bound costs in wall clock.
 *
 * §4 claims exactness only for n ≤ 12, and until 2026-08-08 said nothing about
 * the size of the gap beyond it — while `daily-plan-store` feeds the allocator
 * every task in the day, so 13+ is an ordinary backlog, not an exotic input.
 * This probe prices that gap: for each random day it runs the allocator and,
 * beside it, an exhaustive enumeration of the funded-subset dimension, and
 * reports the shortfall by budget band. The band split is the point — §21.1
 * shows selection is where the whole edge lives below ~2 h, so a selection
 * search that fails there fails where it matters.
 *
 * The reference enumerates every subset and leaves each subset's block split to
 * the single-budget greedy, which §4 proves exact. That isolates the fixed-charge
 * dimension, which is the one under test; brute force over block distributions
 * is not reachable at n = 14.
 *
 * A probe, not a test: it answers "how much does this cost over a large input
 * space" with numbers that legitimately move whenever the allocator changes.
 * The suite keeps the two fixtures instead (`zenith.test.ts`: the tight-budget
 * subset optimum, and budget monotonicity).
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	calculatePooledAllocations,
	calculateTaskAllocations,
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

interface ProbeTask {
	title: string;
	difficulty: number;
	enjoyment: number;
}

const planValue = (allocations: { avgProductivity: number }[]): number =>
	allocations.reduce((sum, a) => sum + a.avgProductivity, 0);

/** Best plan over EVERY funded subset, each subset solved by the exact greedy. */
function exhaustiveValue(tasks: ProbeTask[], budget: number, switchCost: number): number {
	let best = 0;

	for (let mask = 1; mask < 1 << tasks.length; mask++) {
		const subset = tasks.filter((_, i) => mask & (1 << i));
		const funded = budget - (subset.length - 1) * switchCost;

		if (funded <= 0) continue;

		const value = planValue(calculateTaskAllocations(subset, funded, DEFAULT_USER_CONSTANTS, 0));

		if (value > best) best = value;
	}

	return best;
}

/**
 * Which branch of `bestPlanWithSwitchCost` a day lands on, re-derived here from
 * §34's rule rather than imported — the allocator does not report it, and a
 * probe that asked the code under test which path it took would be measuring
 * nothing. n > 12 only; below that the full enumeration always runs.
 *
 * It re-derives the shipped rule at `startedCount` = 0 — every day this probe
 * generates — where `max(0, m)` is `m` and the day-funded term of §34's bound
 * drops out of the expression.
 */
function boundedSearchRuns(n: number, budget: number, switchCost: number): boolean {
	const blocksFor = (funded: number) =>
		Math.floor((budget - (funded - 1) * switchCost) / BLOCK_HOURS + 1e-9);

	let maxFunded = 0;

	while (maxFunded < n && blocksFor(maxFunded + 1) >= maxFunded + 1) maxFunded++;

	let plans = 0;
	let choose = 1;

	for (let j = 1; j <= maxFunded; j++) {
		choose = (choose * (n + 1 - j)) / j;
		plans += choose;
	}

	return maxFunded > 0 && plans <= (1 << 12) - 1;
}

const BANDS = [
	{
		name: '≤2h',
		holds: (budget: number) => budget <= 2,
	},
	{
		name: '2-5h',
		holds: (budget: number) => budget > 2 && budget <= 5,
	},
	{
		name: '>5h',
		holds: (budget: number) => budget > 5,
	},
];

describe('funded-subset search past the exact limit', () => {
	it('prices the shortfall against exhaustive enumeration, by budget band', () => {
		const rows: unknown[] = [];

		for (const n of [13, 14, 15]) {
			const random = mulberry32(n * 104729);

			const bands = BANDS.map((band) => ({
				band: band.name,
				days: 0,
				short: 0,
				worstPercent: 0,
			}));

			let shortfallSum = 0;
			let days = 0;

			for (let day = 0; day < 120; day++) {
				const tasks: ProbeTask[] = Array.from(
					{
						length: n,
					},
					(_, i) => ({
						title: `t${i}`,
						difficulty: 1 + Math.floor(random() * 10),
						enjoyment: 1 + Math.floor(random() * 10),
					}),
				);

				const budget = Math.max(BLOCK_HOURS, Math.round(random() * 40) * BLOCK_HOURS);
				const switchCost = [0.1, 0.25, 0.33, 0.5][Math.floor(random() * 4)];

				const achieved = planValue(
					calculateTaskAllocations(tasks, budget, DEFAULT_USER_CONSTANTS, switchCost),
				);

				const best = exhaustiveValue(tasks, budget, switchCost);
				const percent = best > 0 ? (100 * (best - achieved)) / best : 0;

				days++;
				shortfallSum += percent;

				const row = bands[BANDS.findIndex((band) => band.holds(budget))];
				row.days++;

				if (percent > 1e-6) row.short++;

				if (percent > row.worstPercent) row.worstPercent = percent;
			}

			rows.push({
				n,
				days,
				meanPercent: shortfallSum / days,
				worstPercent: Math.max(...bands.map((b) => b.worstPercent)),
				bands,
			});
		}

		writeFileSync('/tmp/subset-search-bound.json', JSON.stringify(rows, null, 2));
	});

	it('counts the budget-monotonicity violations the fallback still allows', () => {
		// Every plan affordable at B is affordable at B + a block, so a search over
		// a budget-indexed family cannot lose value as the day grows. Forward
		// selection can: its first pick moves with the budget. The bounded
		// enumeration cannot, so this counts what is LEFT — and where, because a
		// violation inside the bounded region would be a real defect.
		const violations: unknown[] = [];
		let checks = 0;

		// One day's whole budget ladder; hoisted so the sweep stays inside the
		// repo's nesting limit.
		const walkBudgets = (n: number, tasks: ProbeTask[], switchCost: number): void => {
			let previous = 0;

			for (let budget = BLOCK_HOURS; budget <= 10 + 1e-9; budget += BLOCK_HOURS) {
				const value = planValue(
					calculateTaskAllocations(tasks, budget, DEFAULT_USER_CONSTANTS, switchCost),
				);

				checks++;

				if (value < previous - 1e-9)
					violations.push({
						n,
						switchCost,
						budget: Number(budget.toFixed(2)),
						drop: Number((previous - value).toFixed(4)),
						bounded: boundedSearchRuns(n, budget, switchCost),
					});

				previous = value;
			}
		};

		for (const n of [13, 14, 16, 20]) {
			const random = mulberry32(n * 7919);

			for (let day = 0; day < 40; day++) {
				const tasks: ProbeTask[] = Array.from(
					{
						length: n,
					},
					(_, i) => ({
						title: `t${i}`,
						difficulty: 1 + Math.floor(random() * 10),
						enjoyment: 1 + Math.floor(random() * 10),
					}),
				);

				walkBudgets(n, tasks, [0.1, 0.25, 0.33, 0.5][Math.floor(random() * 4)]);
			}
		}

		writeFileSync(
			'/tmp/subset-search-monotonicity.json',
			JSON.stringify(
				{
					checks,
					count: violations.length,
					violations,
				},
				null,
				2,
			),
		);
	});

	it('times the path the app actually calls, per (n, budget)', () => {
		const rows: unknown[] = [];

		for (const n of [12, 13, 14, 16, 18, 20, 25]) {
			const tasks: PooledTaskInput[] = Array.from(
				{
					length: n,
				},
				(_, i) => ({
					title: `t${i}`,
					difficulty: 1 + (i % 10),
					enjoyment: 1 + ((i * 3) % 10),
					cognitiveWeight: 0.3 + ((i * 7) % 7) / 10,
					physicalWeight: 0.2 + ((i * 5) % 6) / 10,
				}),
			);

			for (const budget of [1, 2, 3, 4, 6, 8, 12]) {
				const solve = () =>
					calculatePooledAllocations(
						tasks,
						budget,
						DEFAULT_CAPACITY_POOLS,
						DEFAULT_USER_CONSTANTS,
						0.25,
					);

				solve();

				const started = performance.now();

				for (let repeat = 0; repeat < 5; repeat++) solve();

				rows.push({
					n,
					budget,
					ms: Number(((performance.now() - started) / 5).toFixed(2)),
				});
			}
		}

		writeFileSync('/tmp/subset-search-timing.json', JSON.stringify(rows, null, 2));
	});
});
