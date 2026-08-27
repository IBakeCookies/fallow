/**
 * Measurements behind the priced levers.
 *
 * A probe, not a test: it answers "what is true of the model over a large input
 * space" and prints numbers, where a test answers "does this still hold" and is
 * binary. Both numbers below legitimately move whenever the allocator changes,
 * which is why this runs on demand (`npm run probe`) and never in `npm test` —
 * a sweep in the suite goes red on every honest model change while its real
 * signal, the size of the number, is not a regression at all.
 *
 * Usage: npm run probe
 */

import { cpus } from 'node:os';
import { describe, it } from 'vitest';
import { calculateZenithGain } from '$lib/business/model/metric/calculation';
import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { suggestPlanAdjustments } from '$lib/business/model/metric/plan-advice';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

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

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-07-27',
	completed: false,
});

const day = (
	tasks: Task[],
	availableHours: number,
	switchCost: number,
	cognitiveHours: number,
	physicalHours: number,
): DailyMetricsInput => ({
	tasks,
	availableHours,
	switchCost,
	pools: {
		cognitiveHours,
		physicalHours,
	},
	constants: DEFAULT_USER_CONSTANTS,
	energyParams: DEFAULT_ENERGY_PARAMS,
});

/** The day PA-1 was found on, kept by value so the −0.9% stays reproducible. */
const POOL_BOUND = [
	task(1, 9, 9, 6),
	task(2, 3, 5, 4),
	task(3, 1, 10, 7),
	task(4, 0, 1, 6),
	task(5, 0, 5, 9),
	task(6, 9, 5, 2),
	task(7, 8, 6, 8),
];

function randomDays(count: number, seed: number): DailyMetricsInput[] {
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
					length: pick(2, 7, 1),
				},
				(_, index) => task(index + 1, pick(0, 10, 1), pick(0, 10, 1), pick(0, 10, 1)),
			);

			return day(
				tasks,
				pick(0.25, 12, 0.25),
				pick(5, 30, 5) / 60,
				pick(0.5, 6, 0.5),
				pick(0.5, 7, 0.5),
			);
		},
	);
}

/** One seeded n-task day at the configuration the Cost paragraph quotes. */
const timingDay = (n: number): DailyMetricsInput => {
	const random = mulberry32(n * 104729);
	const pick = () => Math.round(random() * 10);

	return day(
		Array.from(
			{
				length: n,
			},
			(_, index) => task(index + 1, pick(), pick(), pick()),
		),
		8,
		DEFAULT_SWITCH_COST,
		DEFAULT_CAPACITY_POOLS.cognitiveHours,
		DEFAULT_CAPACITY_POOLS.physicalHours,
	);
};

const REPS = 11;

interface Timing {
	median: number;
	min: number;
	max: number;
}

/**
 * Median of `REPS` reps after one discarded warm-up. A lone mean is not quotable
 * here: the first call pays JIT and the tail is what freezes a main thread.
 */
function timeMs(run: () => void): Timing {
	run();

	const samples = Array.from(
		{
			length: REPS,
		},
		() => {
			const started = performance.now();

			run();

			return performance.now() - started;
		},
	).sort((a, b) => a - b);

	return {
		median: samples[Math.floor(REPS / 2)],
		min: samples[0],
		max: samples[REPS - 1],
	};
}

const showMs = (timing: Timing) =>
	`${timing.median.toFixed(2)} ms (min ${timing.min.toFixed(2)}, max ${timing.max.toFixed(2)})`;

const percentOf = (value: number, base: number) =>
	base > 0 ? Math.round(((value - base) / base) * 1000) / 10 : null;

const funded = (metrics: DailyMetrics) =>
	metrics.suggestedTasks.filter((task) => task.suggestedHours > 0).length;

const allocated = (metrics: DailyMetrics) =>
	metrics.suggestedTasks.reduce((sum, task) => sum + task.suggestedHours, 0);

/**
 * The trim `budget − planSlack` was taken to be free — it changes no
 * allocation, so it costs no Σ P̄. It is not: the trim keeps the plan FEASIBLE,
 * but `allocate` is path-dependent on `budgetBlocks`, so the re-solve can land
 * on a different, lower-valued distribution of the same hours.
 *
 * `reshaped` is what separates the two claims, and is why it is counted here
 * rather than asserted on one day: a non-free trim that also funds fewer tasks
 * or spends fewer hours would be the original rounding defect coming back, not
 * path-dependence.
 */
function trimFreeness(label: string, inputs: DailyMetricsInput[]): void {
	let levers = 0;
	let nonFree = 0;
	let reshaped = 0;
	let worst = 0;

	for (const input of inputs) {
		const baseline = calculateDailyMetrics(input);
		const slack = baseline.planSlackHours;

		// The same one-minute tolerance `buildLevers` drops the lever under.
		if (slack < 1 / 60) continue;

		const trimmed = calculateDailyMetrics({
			...input,
			availableHours: Math.max(0, baseline.budgetHours - slack),
		});

		const delta = percentOf(trimmed.zenithGain.optimized, baseline.zenithGain.optimized);

		levers++;

		if (delta === null || delta === 0) continue;

		nonFree++;
		worst = Math.min(worst, delta);

		if (
			funded(trimmed) !== funded(baseline) ||
			Math.abs(allocated(trimmed) - allocated(baseline)) > 1e-9
		)
			reshaped++;
	}

	console.log(
		`${label}: ${levers} trim levers, ${nonFree} non-free (${reshaped} of them cut work), worst ${worst}%`,
	);
}

/**
 * Both priced levers are provably ≤ 0 at the exact optimum — a defer contributes
 * P̄ᵢ(0) = 0 and Σ P̄ is monotone non-decreasing in the budget — so a positive
 * cost on the frontier is suboptimality reaching the card.
 */
function pricedSigns(inputs: DailyMetricsInput[]): void {
	const frontiers = inputs
		.flatMap((input) => suggestPlanAdjustments(input).findings)
		.filter((finding) => finding.options.length > 0);

	const deltas = frontiers.flatMap((finding) =>
		finding.options.map((option) => option.planValueDeltaPercent ?? 0),
	);

	const positive = deltas.filter((delta) => delta > 0);

	console.log(
		`priced frontiers ${frontiers.length}, positive deltas ${positive.length}, largest +${Math.max(0, ...positive)}%`,
	);
}

/**
 * One day's levers, split by what they do to Flow Coverage: whether any raises
 * the COUNT the axis ranks on, and how many defers raise only the SHARE — the
 * free improvements a ratio-ranked axis would have offered.
 */
function flowMoves(
	input: DailyMetricsInput,
	baseline: DailyMetrics,
): { lifts: boolean; countDefers: number; freeRatioDefers: number } {
	const { reached, total } = baseline.flowCoverage;
	const share = (reached / total) * 100;

	const candidates = [
		...baseline.activeTasks.map((task) => ({
			...input,
			tasks: input.tasks.filter((other) => other.id !== task.id),
		})),
		{
			...input,
			availableHours: baseline.budgetHours + 1,
		},
	];

	let lifts = false;
	let countDefers = 0;
	let freeRatioDefers = 0;

	for (const candidate of candidates) {
		const after = calculateDailyMetrics(candidate).flowCoverage;
		const isDefer = candidate.tasks.length < input.tasks.length;
		const raisesCount = after.total > 0 && after.reached > reached;

		const raisesShareOnly =
			after.total > 0 && !raisesCount && (after.reached / after.total) * 100 > share;

		lifts = lifts || raisesCount;
		countDefers += isDefer && raisesCount ? 1 : 0;
		freeRatioDefers += isDefer && raisesShareOnly ? 1 : 0;
	}

	return {
		lifts,
		countDefers,
		freeRatioDefers,
	};
}

/**
 * Where Flow Coverage's warning band belongs, and what the axis is worth.
 *
 * Three questions on one sweep. **Which threshold** — the reading counts every
 * task in the plan, funded or not, so a long backlog reads low permanently and
 * a band set by assertion can pin most days amber; ROADMAP refused a
 * week-feasibility reading for exactly that. **What the axis buys** —
 * the share of days where some defer or budget lever raises the COUNT of tasks
 * reaching ϕ, which is the only thing this axis ranks on. **What ranking on the
 * share instead would have cost** — the ratio-ranking defect, counted: defers
 * that lift the ratio without a single task reaching flow.
 */
function flowCoverageBand(inputs: DailyMetricsInput[]): void {
	const thresholds = [50, 75, 80, 100];
	const warned = thresholds.map(() => 0);
	let readable = 0;
	let liftsCount = 0;
	let freeRatioDefers = 0;
	let countDefers = 0;

	for (const input of inputs) {
		const baseline = calculateDailyMetrics(input);
		const { reached, total } = baseline.flowCoverage;

		if (total === 0) continue;

		readable += 1;

		const share = (reached / total) * 100;

		thresholds.forEach((cut, index) => {
			if (share < cut) warned[index] += 1;
		});

		const moves = flowMoves(input, baseline);

		countDefers += moves.countDefers;
		freeRatioDefers += moves.freeRatioDefers;

		if (moves.lifts) liftsCount += 1;
	}

	const percent = (n: number) => ((n / readable) * 100).toFixed(1);

	console.log(
		`[band] ${readable} readable days — warning share at ${thresholds
			.map((cut, index) => `<${cut}: ${percent(warned[index])}%`)
			.join(', ')}`,
	);

	console.log(
		`[value] a lever raises the flow COUNT on ${percent(liftsCount)}% of days; ` +
			`${countDefers} defers do, against ${freeRatioDefers} that raise only the SHARE`,
	);
}

const DAYS = randomDays(600, 42);

describe('plan advice', () => {
	it('measures the pure trim', () => {
		trimFreeness('600 seeded random days', DAYS);

		for (const switchCost of [5, 10, 15, 20, 30])
			trimFreeness(
				`pool-bound fixture, s = ${switchCost}m, budget 0.25–14h`,
				Array.from(
					{
						length: 56,
					},
					(_, index) => day(POOL_BOUND, (index + 1) * 0.25, switchCost / 60, 4.5, 4.5),
				),
			);
	});

	it('measures priced-lever signs', () => {
		pricedSigns(DAYS);
	});

	it('places the flow-coverage band and prices the axis', () => {
		flowCoverageBand(DAYS);
	});

	/**
	 * The Cost paragraphs quote a wall clock no probe reproduced. A wall clock is
	 * only quotable with its machine attached — the same class of day reads ~2×
	 * apart on two boxes — so the box and the runtime are printed once beside the
	 * numbers, and nothing else may be running on it.
	 */
	it('times the solve, the advice run and the two extra solves', () => {
		console.log(`[cost] ${cpus()[0].model}, ${cpus().length} cores, node ${process.version}`);

		for (const n of [3, 6, 9, 12, 15]) {
			const input = timingDay(n);
			const evaluated = suggestPlanAdjustments(input).candidatesEvaluated;

			const solve = timeMs(() => {
				calculateDailyMetrics(input);
			});

			const advice = timeMs(() => {
				suggestPlanAdjustments(input);
			});

			// n > 12 at an 8 h budget does NOT continue the 2ⁿ ladder: `maxFunded` reaches
			// n (the bound's test 33 − m ≥ m holds to m = 16), so the size bound cannot
			// bring the enumeration under `SUBSET_SEARCH_BUDGET` = 4095 and the solve
			// falls through to greedy forward selection.
			const path = n > 12 ? ' — forward-selection fallback, NOT the 2ⁿ enumeration' : '';

			console.log(
				`[cost] n = ${n}: one solve ${showMs(solve)}, whole advice run ${showMs(advice)}, candidatesEvaluated ${evaluated}${path}`,
			);
		}

		for (const n of [8, 12]) {
			const input = timingDay(n);
			const { tasks, switchCost, pools, constants, posterior } = input;
			const budget = calculateDailyMetrics(input).budgetHours;

			// The expression `planValueAt` evaluates (`plan-advice.ts`), not a replica.
			const planValueAt = (candidate: number) =>
				calculateZenithGain(tasks, budget, candidate, pools, constants, posterior).optimized;

			const free = timeMs(() => {
				planValueAt(0);
			});

			const doubled = timeMs(() => {
				planValueAt(switchCost * 2);
			});

			const declared = timeMs(() => {
				planValueAt(switchCost);
			});

			const advice = timeMs(() => {
				suggestPlanAdjustments(input);
			});

			const pair = free.median + doubled.median;

			console.log(
				`[cost] n = ${n}: s = 0 arm ${showMs(free)}, s = 2s arm ${showMs(doubled)}, declared solve ${showMs(declared)}; the pair is ${((100 * pair) / advice.median).toFixed(1)}% of the advice run (${pair.toFixed(2)} of ${advice.median.toFixed(2)} ms), s = 2s is ${(doubled.median / declared.median).toFixed(2)}× the declared solve`,
			);
		}
	});
});
