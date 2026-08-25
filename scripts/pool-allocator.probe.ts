/**
 * Measurements behind MATH.md's open question: does the pooled
 * allocator's suboptimality have an ENVELOPE, or is every quoted worst case
 * just the maximum of one draw?
 *
 * MATH.md reports "exact on 99.5%, p99 0.00%, worst 0.09%" over 1471 random
 * pool-bound days, then adds (2026-08-05) that a fresh draw from the same
 * generator reaches 6.03%. Two numbers from one generator that differ by 60×
 * are not an envelope, they are two samples of a tail — and §4:276 still
 * prints "within 1–2% of brute-force block optima" while zenith.test.ts
 * asserts `worst < 0.005`. This probe measures the spread directly: the SAME
 * sweep on FIVE seeds over TWO input spaces, so the per-seed worsts can be
 * read side by side. That spread is the answer; a single seed cannot produce
 * it, which is why no number here can be an error bound.
 *
 * A probe, not a test: it answers "what is true of the model over a large
 * input space" with numbers that legitimately move whenever the allocator
 * changes, where a test answers "does this still hold" and is binary. In the
 * suite that is a red build carrying no regression, so this runs on demand
 * (`npm run probe`) and never in `npm test`. The suite keeps ONE fixture
 * instead — the randomized envelope test in zenith.test.ts.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	BLOCK_HOURS,
	calculatePooledAllocations,
	calculateTotalProductivity,
	DEFAULT_USER_CONSTANTS,
	type CapacityPools,
	type PooledTaskInput,
} from '$lib/business/model/zenith';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';

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

interface ProbeDay {
	tasks: PooledTaskInput[];
	budget: number;
	pools: CapacityPools;
	switchCost: number;
}

/**
 * Brute force enumerates every block distribution and is exponential in the
 * total block count, so a day whose enumeration is wider than this is SKIPPED
 * rather than approximated, and counted in the output — a skipped day is a day
 * this probe says nothing about. 56 blocks is the 14h budget ceiling of both
 * spaces below, i.e. the cap is set where it skips nothing; lower it (and
 * watch the skip counts) if the model ever gets slower per solve.
 *
 * The five seeds are the point of the whole file, and 2000 days each is what
 * makes a per-seed worst mean anything at a ~6% tail rate.
 */
const BRUTE_BLOCK_CAP = 56;
const SEEDS = [1, 2, 3, 4, 5];
const DAYS_PER_SEED = 2000;

/**
 * The exhaustive optimum over the same feasible set the allocator faces:
 * every block distribution under both pools and the (m−1)·switchCost
 * funded-count overhead, scored with `calculateTotalProductivity`.
 *
 * Scoring is memoized PER TASK because that objective is a sum of independent
 * per-task terms — `calculateTotalProductivity([tᵢ], [b·BLOCK_HOURS])` is
 * exactly the i-th term of the full call — so the table is the real model
 * function, not a re-implementation of it. Without the memo a single day
 * costs hundreds of thousands of full model evaluations.
 *
 * Returns null when the enumeration exceeds BRUTE_BLOCK_CAP total blocks.
 */
function bruteForceOptimum(day: ProbeDay): number | null {
	const { tasks, budget, pools, switchCost } = day;
	const n = tasks.length;
	const budgetBlocks = Math.floor(budget / BLOCK_HOURS + 1e-9);

	if (budgetBlocks < 1) return null;

	const values: number[][] = [];
	const caps: number[] = [];

	for (let i = 0; i < n; i++) {
		const task = tasks[i];

		// A block is only reachable while both pools can still absorb it.
		const poolMax = Math.min(
			task.cognitiveWeight > 0
				? Math.floor(pools.cognitiveHours / (BLOCK_HOURS * task.cognitiveWeight) + 1e-9)
				: budgetBlocks,
			task.physicalWeight > 0
				? Math.floor(pools.physicalHours / (BLOCK_HOURS * task.physicalWeight) + 1e-9)
				: budgetBlocks,
		);

		const maxBlocks = Math.min(budgetBlocks, poolMax);
		const row = [0];
		let cap = 0;
		let best = -Infinity;

		for (let b = 1; b <= maxBlocks; b++) {
			const value = calculateTotalProductivity([task], [b * BLOCK_HOURS], DEFAULT_USER_CONSTANTS);

			row.push(value);

			// Past a task's own optimum more blocks are strictly worse AND cost
			// more of all three resources, so no optimal plan ever holds them:
			// truncating at the last argmax loses nothing.
			if (value >= best) {
				best = value;
				cap = b;
			}
		}

		values.push(row);
		caps.push(cap);
	}

	const totalCap = Math.min(
		budgetBlocks,
		caps.reduce((sum, cap) => sum + cap, 0),
	);

	if (totalCap > BRUTE_BLOCK_CAP) return null;

	let brute = 0;

	const search = (
		i: number,
		blocks: number,
		funded: number,
		cog: number,
		phys: number,
		value: number,
	): void => {
		if (i === n) {
			if (value > brute) brute = value;

			return;
		}

		const task = tasks[i];

		for (let b = 0; b <= caps[i]; b++) {
			const nextCog = cog + b * BLOCK_HOURS * task.cognitiveWeight;
			const nextPhys = phys + b * BLOCK_HOURS * task.physicalWeight;
			const nextFunded = funded + (b > 0 ? 1 : 0);
			const overhead = nextFunded > 1 ? (nextFunded - 1) * switchCost : 0;

			// Every quantity here grows with b, so the first infeasible b ends
			// the row. b = 0 is feasible whenever the parent state was.
			if (
				b > 0 &&
				(nextCog > pools.cognitiveHours + 1e-9 ||
					nextPhys > pools.physicalHours + 1e-9 ||
					(blocks + b) * BLOCK_HOURS + overhead > budget + 1e-9)
			)
				break;

			search(i + 1, blocks + b, nextFunded, nextCog, nextPhys, value + values[i][b]);
		}
	};

	search(0, 0, 0, 0, 0, 0);

	return brute;
}

function achievedValue(day: ProbeDay): number {
	const allocations = calculatePooledAllocations(
		day.tasks,
		day.budget,
		day.pools,
		DEFAULT_USER_CONSTANTS,
		day.switchCost,
	);

	return calculateTotalProductivity(
		day.tasks,
		allocations.map((allocation) => allocation.allocatedHours),
		DEFAULT_USER_CONSTANTS,
	);
}

const percentile = (sorted: number[], q: number): number =>
	sorted.length === 0 ? 0 : sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];

const pct = (value: number): string => `${(value * 100).toFixed(2)}%`;

interface SweepResult {
	worst: number;
	worstDay: ProbeDay | null;
}

/**
 * Shortfall = (brute − achieved)/brute, per day. `over2` is §4:276's stated
 * "within 1–2%" being exceeded; `over009` is the 0.09% being used as a
 * bound and failing. A count of 0 over a big sweep would itself be the result.
 */
function sweep(label: string, days: ProbeDay[]): SweepResult {
	const shortfalls: number[] = [];
	let tooWide = 0;
	let noWork = 0;
	let exact = 0;
	let worst = 0;
	let worstDay: ProbeDay | null = null;

	for (const day of days) {
		const brute = bruteForceOptimum(day);

		if (brute === null) {
			tooWide++;
			continue;
		}

		// Budget below one block: no plan has any value, nothing to compare.
		if (brute <= 1e-9) {
			noWork++;
			continue;
		}

		const shortfall = Math.max(0, (brute - achievedValue(day)) / brute);

		shortfalls.push(shortfall);

		if (shortfall < 1e-9) exact++;

		if (shortfall > worst) {
			worst = shortfall;
			worstDay = day;
		}
	}

	const compared = shortfalls.length;
	const sorted = [...shortfalls].sort((a, b) => a - b);
	const over2 = shortfalls.filter((shortfall) => shortfall > 0.02).length;
	const over009 = shortfalls.filter((shortfall) => shortfall > 0.0009).length;

	console.log(
		`${label}: ${compared} days compared (${tooWide} skipped as too wide, ${noWork} with no feasible block), ` +
			`exact ${pct(exact / Math.max(1, compared))}, ` +
			`p99 ${pct(percentile(sorted, 0.99))}, p999 ${pct(percentile(sorted, 0.999))}, ` +
			`worst ${pct(worst)}, over 2% ${over2}, over 0.09% ${over009}`,
	);

	return {
		worst,
		worstDay,
	};
}

/** Prints the per-seed spread — the actual answer to "is one draw an envelope". */
function summarize(space: string, results: SweepResult[]): void {
	const worsts = results.map((result) => result.worst);
	const max = Math.max(...worsts);
	const min = Math.min(...worsts);
	const worstOverall = results.find((result) => result.worst === max);

	console.log(
		`${space} across ${results.length} seeds: max-over-seeds worst ${pct(max)}, ` +
			`best seed's worst ${pct(min)}, spread ${pct(max - min)}, per-seed worsts [${worsts.map(pct).join(', ')}]`,
	);

	console.log(`${space} worst day: ${JSON.stringify(worstOverall?.worstDay)}`);
}

function randomDays(count: number, seed: number, wide: boolean): ProbeDay[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() => {
			const tasks = Array.from(
				{
					length: pick(2, 6, 1),
				},
				(_, index): PooledTaskInput => {
					if (wide)
						return {
							title: `t${index + 1}`,
							difficulty: 1 + random() * 9,
							enjoyment: 1 + random() * 9,
							cognitiveWeight: random(),
							physicalWeight: random(),
						};

					// App-reachable: the two difficulty sliders are integers 1–10,
					// and calculation.ts derives BOTH the effort parameter and the
					// pool weights from them — so difficulty and weights are not
					// independent here the way they are in the wide space.
					const mental = pick(1, 10, 1);
					const physical = pick(1, 10, 1);

					return {
						title: `t${index + 1}`,
						difficulty: getEffectiveDifficulty({
							mentalDifficulty: mental,
							physicalDifficulty: physical,
						}),
						enjoyment: pick(1, 10, 1),
						cognitiveWeight: mental / 10,
						physicalWeight: physical / 10,
					};
				},
			);

			return {
				tasks,
				budget: pick(0.25, 14, 0.25),
				pools: {
					cognitiveHours: pick(0.5, 8, 0.5),
					physicalHours: pick(0.5, 8, 0.5),
				},
				switchCost: pick(0, 30, 5) / 60,
			};
		},
	);
}

/**
 * The structural blind spot MATH.md named: greedy ranks blocks by VALUE, so a
 * high-value task that is expensive in the scarce pool crowds out cheap tasks
 * that the pool could afford several hours of. Curated rather than sampled
 * because a random sweep hits this shape rarely — the fixture asks "how bad is
 * the known-bad shape", the sweep asks "how often and how bad is anything".
 *
 * Its numbers come out identical at every switch cost, which is the fixture
 * working as intended rather than `switchCost` being dropped: with these
 * weights the pools bind long before the clock does, so the funded-count
 * overhead never becomes the active constraint.
 */
const POOL_TRAP: PooledTaskInput[] = [
	{
		title: 'heavy-valuable',
		difficulty: getEffectiveDifficulty({
			mentalDifficulty: 10,
			physicalDifficulty: 9,
		}),
		enjoyment: 10,
		cognitiveWeight: 1,
		physicalWeight: 0.9,
	},
	{
		title: 'heavy-second',
		difficulty: getEffectiveDifficulty({
			mentalDifficulty: 9,
			physicalDifficulty: 8,
		}),
		enjoyment: 9,
		cognitiveWeight: 0.9,
		physicalWeight: 0.8,
	},
	{
		title: 'light-cheap',
		difficulty: getEffectiveDifficulty({
			mentalDifficulty: 2,
			physicalDifficulty: 1,
		}),
		enjoyment: 8,
		cognitiveWeight: 0.2,
		physicalWeight: 0.1,
	},
	{
		title: 'light-dull',
		difficulty: getEffectiveDifficulty({
			mentalDifficulty: 1,
			physicalDifficulty: 2,
		}),
		enjoyment: 3,
		cognitiveWeight: 0.1,
		physicalWeight: 0.2,
	},
];

describe('pooled allocator suboptimality', () => {
	it('sweeps app-reachable days on five seeds', () => {
		summarize(
			'app-reachable',
			SEEDS.map((seed) =>
				sweep(`app-reachable seed ${seed}`, randomDays(DAYS_PER_SEED, seed, false)),
			),
		);
	});

	it('sweeps the wide space on five seeds', () => {
		summarize(
			'wide',
			SEEDS.map((seed) => sweep(`wide seed ${seed}`, randomDays(DAYS_PER_SEED, seed, true))),
		);
	});

	it('measures the curated pool-trap fixture', () => {
		for (const switchCost of [0, 5, 15, 30])
			sweep(
				`pool-trap fixture, s = ${switchCost}m, budget 0.25–8h × pools 0.5–4h`,
				[0.5, 1, 1.5, 2, 3, 4].flatMap((pool) =>
					Array.from(
						{
							length: 32,
						},
						(_, index): ProbeDay => ({
							tasks: POOL_TRAP,
							budget: (index + 1) * 0.25,
							pools: {
								cognitiveHours: pool,
								physicalHours: pool,
							},
							switchCost: switchCost / 60,
						}),
					),
				),
			);
	});
});
