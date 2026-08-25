/**
 * Measurements behind MATH.md §34: what the funded-subset search forfeits past
 * `EXACT_SUBSET_LIMIT`, what the size bound costs in wall clock, and where the
 * bounded path gives way to the fallback — the crossover §7 quotes.
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
 * subset optimum, and budget monotonicity). The crossover arm is the exception
 * that proves the rule — it asserts the SHAPES §7 argues from, plus the one digit
 * §7 reasons from directly, its ≤ 2 h band.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import {
	BLOCK_HOURS,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	EXACT_SUBSET_LIMIT,
	SUBSET_SEARCH_BUDGET,
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

/** One population's running totals; the sample replay feeds two of them. */
interface Totals {
	bands: { band: string; solves: number; short: number; worstPercent: number }[];
	shortfallSum: number;
	solves: number;
}

interface Crossover {
	n: number;
	switchCost: number;
	lastBoundedBudget: number;
	steps: number;
	maxFunded: number;
	plans: number;
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
 * `maxFunded` and the Σⱼ C(n, j) plan count §34's bound tests, re-derived here
 * from §34's rule rather than imported — the allocator does not report them, and
 * a probe that asked the code under test which path it took would be measuring
 * nothing. The cap it compares against is the shipped `SUBSET_SEARCH_BUDGET`,
 * so the derivation moves with the rule rather than with a copy of it. Runs past
 * `EXACT_SUBSET_LIMIT` only; below that the full enumeration always runs.
 *
 * It re-derives the shipped rule at `startedCount` = 0 — every day this probe
 * generates — where `max(0, m)` is `m` and the day-funded term of §34's bound
 * drops out of the expression.
 */
function boundedSearchSize(
	n: number,
	budget: number,
	switchCost: number,
): { maxFunded: number; plans: number } {
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

	return {
		maxFunded,
		plans,
	};
}

/** Which branch of `bestPlanWithSwitchCost` a day lands on. */
function boundedSearchRuns(n: number, budget: number, switchCost: number): boolean {
	const { maxFunded, plans } = boundedSearchSize(n, budget, switchCost);

	return maxFunded > 0 && plans <= SUBSET_SEARCH_BUDGET;
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

const emptyTotals = (): Totals => ({
	bands: BANDS.map((band) => ({
		band: band.name,
		solves: 0,
		short: 0,
		worstPercent: 0,
	})),
	shortfallSum: 0,
	solves: 0,
});

/** Rounded at emit, so a figure quoted in MATH.md is one this file printed. */
const emitTotals = (totals: Totals) => ({
	solves: totals.solves,
	short: totals.bands.reduce((sum, band) => sum + band.short, 0),
	meanPercent: Number((totals.shortfallSum / totals.solves).toFixed(2)),
	worstPercent: Number(Math.max(...totals.bands.map((b) => b.worstPercent)).toFixed(2)),
	bands: totals.bands.map((band) => ({
		...band,
		worstPercent: Number(band.worstPercent.toFixed(2)),
	})),
});

describe('funded-subset search past the exact limit', () => {
	it('prices the shortfall against exhaustive enumeration, by budget band', () => {
		const rows: unknown[] = [];

		for (const n of [13, 14, 15]) {
			const union = emptyTotals();
			const sample = emptyTotals();

			const drawTasks = (random: () => number): ProbeTask[] =>
				Array.from(
					{
						length: n,
					},
					(_, i) => ({
						title: `t${i}`,
						difficulty: 1 + Math.floor(random() * 10),
						enjoyment: 1 + Math.floor(random() * 10),
					}),
				);

			const price = (
				tasks: ProbeTask[],
				budget: number,
				switchCost: number,
				into: Totals[],
			): void => {
				const achieved = planValue(
					calculateTaskAllocations(tasks, budget, DEFAULT_USER_CONSTANTS, switchCost),
				);

				const best = exhaustiveValue(tasks, budget, switchCost);
				const percent = best > 0 ? (100 * (best - achieved)) / best : 0;

				for (const totals of into) {
					totals.solves++;
					totals.shortfallSum += percent;

					const row = totals.bands[BANDS.findIndex((band) => band.holds(budget))];
					row.solves++;

					if (percent > 1e-6) row.short++;

					if (percent > row.worstPercent) row.worstPercent = percent;
				}
			};

			// One day against the whole (switchCost, budget) grid; hoisted so the
			// sweep stays inside the repo's nesting limit.
			const sweepDay = (tasks: ProbeTask[]): void => {
				for (const switchCost of [0.1, 0.25, 0.33, 0.5])
					for (let budget = BLOCK_HOURS; budget <= 10 + 1e-9; budget += BLOCK_HOURS)
						price(tasks, budget, switchCost, [union]);
			};

			const swept = mulberry32(n * 31337);

			for (let day = 0; day < 8; day++) sweepDay(drawTasks(swept));

			// The grid alone bounds a worst case only over the days it swept, so the
			// historical 120-day sample runs beside it, into two sets of totals. Only
			// `worstPercent` is a max and cannot fall, so §34 takes its two worsts from
			// the union and its count and mean from `sample`, where they stay
			// comparable to its 120-day before-table. The sample's seed and draw order
			// are e02bb3a's exactly, so it reproduces that population.
			const sampled = mulberry32(n * 104729);

			for (let day = 0; day < 120; day++) {
				const tasks = drawTasks(sampled);
				const budget = Math.max(BLOCK_HOURS, Math.round(sampled() * 40) * BLOCK_HOURS);

				price(tasks, budget, [0.1, 0.25, 0.33, 0.5][Math.floor(sampled() * 4)], [union, sample]);
			}

			rows.push({
				n,
				...emitTotals(union),
				sample: emitTotals(sample),
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
		let boundedCount = 0;

		// One day's whole budget ladder; hoisted so the sweep stays inside the
		// repo's nesting limit.
		const walkBudgets = (n: number, tasks: ProbeTask[], switchCost: number): void => {
			let previous = 0;

			for (let budget = BLOCK_HOURS; budget <= 10 + 1e-9; budget += BLOCK_HOURS) {
				const value = planValue(
					calculateTaskAllocations(tasks, budget, DEFAULT_USER_CONSTANTS, switchCost),
				);

				const bounded = boundedSearchRuns(n, budget, switchCost);

				checks++;

				if (bounded) boundedCount++;

				if (value < previous - 1e-9)
					violations.push({
						n,
						switchCost,
						budget: Number(budget.toFixed(2)),
						drop: Number((previous - value).toFixed(4)),
						bounded,
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
					bounded: boundedCount,
					boundedShare: Number((boundedCount / checks).toFixed(4)),
					count: violations.length,
					violations,
				},
				null,
				2,
			),
		);
	});

	it('walks the bounded region, per (n, switchCost)', () => {
		// §7 and §34 both quote where the bounded path gives way, and nothing in the
		// repo emitted it. `steps` beside the last budget is what shows the region is
		// an interval: they agree iff every budget below the crossover is bounded too.
		// The one-hour column answers §7's other claim — how long the list must be
		// before the LIST alone sends a one-hour day to the fallback.
		const walkBoundedRegion = (n: number, switchCost: number): { last: number; steps: number } => {
			let last = 0;
			let steps = 0;

			for (let budget = BLOCK_HOURS; budget <= 24 + 1e-9; budget += BLOCK_HOURS)
				if (boundedSearchRuns(n, budget, switchCost)) {
					last = budget;
					steps++;
				}

			return {
				last,
				steps,
			};
		};

		const crossovers: Crossover[] = [];
		const oneHour: unknown[] = [];

		for (const switchCost of [0.1, 0.25, 0.33, 0.5]) {
			for (const n of [13, 14, 15, 16, 20]) {
				const { last, steps } = walkBoundedRegion(n, switchCost);

				crossovers.push({
					n,
					switchCost,
					lastBoundedBudget: Number(last.toFixed(2)),
					steps,
					...boundedSearchSize(n, last, switchCost),
				});
			}

			let onset = EXACT_SUBSET_LIMIT + 1;

			while (onset < 200 && boundedSearchRuns(onset, 1, switchCost)) onset++;

			oneHour.push({
				switchCost,
				fallbackFromN: onset,
			});
		}

		writeFileSync(
			'/tmp/subset-search-crossover.json',
			JSON.stringify(
				{
					crossovers,
					oneHour,
				},
				null,
				2,
			),
		);

		// The digits above are §7's; these are the shapes §7 reasons with, plus §7's
		// own ≤ 2 h band at the end. `BLOCK_HOURS` and `SUBSET_SEARCH_BUDGET` are
		// imported and not restated, so a change to either moves every crossover
		// legitimately, leaves the shapes standing, and turns that last assertion
		// red.
		for (const row of crossovers) {
			// A crossover exists inside the ladder, and the bounded region below it is
			// an interval: `steps` counts every bounded budget, so it equals the
			// crossover's step index iff nothing below the crossover fell through.
			expect(row.lastBoundedBudget).toBeGreaterThan(0);
			expect(row.lastBoundedBudget).toBeLessThan(24);
			expect(row.steps).toBe(Math.round(row.lastBoundedBudget / BLOCK_HOURS));
		}

		for (const switchCost of new Set(crossovers.map((row) => row.switchCost))) {
			// A longer list crosses over no later: same `maxFunded`, more subsets.
			const byN = crossovers.filter((row) => row.switchCost === switchCost);

			for (let i = 1; i < byN.length; i++)
				expect(byN[i].lastBoundedBudget).toBeLessThanOrEqual(byN[i - 1].lastBoundedBudget);
		}

		for (const n of new Set(crossovers.map((row) => row.n))) {
			// A dearer switch crosses over no earlier: the charge holds `maxFunded`
			// down, which is what leaves the enumeration affordable further up the
			// ladder. This ordering is what lets §7 read every ≤ 2 h shortfall in
			// §34's after-table as a `switchCost` 0.1 day.
			const bySwitchCost = crossovers.filter((row) => row.n === n);

			for (let i = 1; i < bySwitchCost.length; i++)
				expect(bySwitchCost[i].lastBoundedBudget).toBeGreaterThanOrEqual(
					bySwitchCost[i - 1].lastBoundedBudget,
				);
		}

		// The same deduction's absolute half: from `switchCost` 0.25 up, no day at
		// n ≤ 15 in the ≤ 2 h band reaches the fallback at all.
		for (const row of crossovers)
			if (row.switchCost >= 0.25 && row.n <= 15)
				expect(row.lastBoundedBudget).toBeGreaterThanOrEqual(2);
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
