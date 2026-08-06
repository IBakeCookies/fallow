/**
 * The measurement behind MATH.md §16 — "run order stays a heuristic": the
 * ~0.47% median gap between `calculateInterleavedOrder` and the best possible
 * ordering of the SAME allocation, and the two-sided Burnout Risk noise the
 * objective-maximizing order would inject. Those two numbers are why
 * model-derived run order is unbuilt, and they are quoted in
 * `calculation.ts`'s `calculateInterleavedOrder` docstring as well as in §16.
 *
 * §16 describes a probe run on 2026-07-29 that was never committed, so no cell
 * of its table could be re-checked — the §14.1-2 failure again. This rebuild
 * follows §16's description (300 random days, 3–8 tasks, budget 4–10 h, default
 * pools/switch cost/energy params; the classic allocation held FIXED — same
 * funded set, same hours, same `stretch = 1 + overhang/allocated` and
 * switch-costs-as-rest that §11.6 applies — with only the sequence varying,
 * scored by `evaluateSchedule().objective`; exhaustive over all permutations up
 * to 6 funded tasks, 720 sampled orderings above that) plus the one input the
 * text omits: the seed.
 *
 * The block construction is §11.6's, rebuilt here from exported parts because
 * `calculateBurnoutRisk` computes its own order internally and takes no
 * sequence — which is precisely the seam an order probe needs.
 *
 * A probe, not a test: every number moves when the allocator, the curve or the
 * reservoir law moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	type ReservoirDemand,
	type ScheduleBlock,
	evaluateSchedule,
	simulateReservoirs,
} from '$lib/business/model/zenith-energy';
import {
	type SuggestedTask,
	calculateInterleavedOrder,
	calculateTaskPlan,
	toEnergyTask,
} from '$lib/business/model/metric/calculation';
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

const DAYS = 300;
/** Above this many funded tasks, sample instead of enumerating (6! = 720). */
const EXHAUSTIVE_LIMIT = 6;
const SAMPLES = 720;

interface ProbeDay {
	tasks: Task[];
	budget: number;
}

function drawDays(count: number, seed: number): ProbeDay[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() => ({
			tasks: Array.from(
				{
					length: pick(3, 8, 1),
				},
				(_, index): Task => ({
					id: index + 1,
					title: `t${index + 1}`,
					mentalDifficulty: pick(1, 10, 1),
					physicalDifficulty: pick(1, 10, 1),
					enjoyment: pick(1, 10, 1),
					createdAt: '2026-07-29',
					completed: false,
				}),
			),
			budget: pick(4, 10, 0.25),
		}),
	);
}

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((x, y) => x - y);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

function permutations<T>(items: T[]): T[][] {
	if (items.length <= 1) return [items];

	return items.flatMap((item, index) =>
		permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
			item,
			...rest,
		]),
	);
}

function shuffled<T>(items: T[], random: () => number): T[] {
	const out = [...items];

	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}

	return out;
}

/**
 * §11.6's day: the funded tasks in the given sequence, switch costs as rest
 * gaps, intended overwork spread pro-rata over the funded blocks.
 */
function blocksFor(order: SuggestedTask[], stretch: number, switchCost: number): ScheduleBlock[] {
	const blocks: ScheduleBlock[] = [];

	order.forEach((task, index) => {
		if (index > 0 && switchCost > 0)
			blocks.push({
				taskId: null,
				hours: switchCost,
			});

		blocks.push({
			taskId: task.id,
			hours: task.suggestedHours * stretch,
		});
	});

	return blocks;
}

const demandsFor = (order: SuggestedTask[]): ReservoirDemand[] =>
	order.map((task) => ({
		id: task.id,
		cognitiveDemand: task.mentalDifficulty / 10,
		physicalDemand: task.physicalDifficulty / 10,
	}));

/** §11.6's risk, on an arbitrary sequence: 100 × (1 − min end reservoir). */
function riskOf(order: SuggestedTask[], stretch: number, switchCost: number): number {
	const { endCog, endPhys } = simulateReservoirs(
		blocksFor(order, stretch, switchCost),
		demandsFor(order),
		DEFAULT_ENERGY_PARAMS,
	);

	return Math.round(100 * (1 - Math.min(endCog, endPhys)));
}

interface DayResult {
	/** % the best ordering gains over interleaved. */
	bestOverInterleaved: number;
	/** % the best ordering gains over the worst. */
	bestOverWorst: number;
	/** % interleaved gains over plain priority order. */
	interleavedOverPriority: number;
	/** Fraction of orderings strictly better than interleaved, in percent. */
	percentileRank: number;
	isInterleavedOptimal: boolean;
	isReordered: boolean;
	fundedCount: number;
	/** Funded tasks whose nature is 'balanced' — the alternation's no-op case. */
	balancedCount: number;
	/** Burnout Risk under interleaved minus under the objective-maximizing order. */
	riskDelta: number;
}

function measure(day: ProbeDay, random: () => number): DayResult | null {
	const plan = calculateTaskPlan(
		day.tasks,
		day.budget,
		DEFAULT_SWITCH_COST,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

	const priority = plan.suggestedTasks.filter((task) => task.suggestedHours > 0);

	if (priority.length < 2) return null;

	const interleaved = calculateInterleavedOrder(plan.suggestedTasks);
	const allocated = priority.reduce((sum, task) => sum + task.suggestedHours, 0);
	const overhead = (priority.length - 1) * DEFAULT_SWITCH_COST;
	const overhang = Math.max(0, day.budget - overhead - allocated);
	const stretch = 1 + overhang / allocated;
	const energyTasks = day.tasks.map(toEnergyTask);

	const score = (order: SuggestedTask[]) =>
		evaluateSchedule(
			blocksFor(order, stretch, DEFAULT_SWITCH_COST),
			energyTasks,
			day.budget,
			DEFAULT_ENERGY_PARAMS,
			DEFAULT_USER_CONSTANTS,
		).objective;

	const candidates =
		priority.length <= EXHAUSTIVE_LIMIT
			? permutations(priority)
			: [
					priority,
					interleaved,
					...Array.from(
						{
							length: SAMPLES - 2,
						},
						() => shuffled(priority, random),
					),
				];

	const scores = candidates.map(score);
	const interleavedScore = score(interleaved);
	const priorityScore = score(priority);
	let best = -Infinity;
	let worst = Infinity;
	let bestOrder = interleaved;

	candidates.forEach((order, index) => {
		if (scores[index] > best) {
			best = scores[index];
			bestOrder = order;
		}

		worst = Math.min(worst, scores[index]);
	});

	const better = scores.filter((value) => value > interleavedScore + 1e-9).length;

	return {
		bestOverInterleaved: ((best - interleavedScore) / interleavedScore) * 100,
		bestOverWorst: ((best - worst) / worst) * 100,
		interleavedOverPriority: ((interleavedScore - priorityScore) / priorityScore) * 100,
		percentileRank: (better / scores.length) * 100,
		isInterleavedOptimal: better === 0,
		isReordered: interleaved.some((task, index) => task.id !== priority[index].id),
		fundedCount: priority.length,
		balancedCount: priority.filter((task) => task.nature === 'balanced').length,
		riskDelta:
			riskOf(interleaved, stretch, DEFAULT_SWITCH_COST) -
			riskOf(bestOrder, stretch, DEFAULT_SWITCH_COST),
	};
}

describe('MATH.md §16 — run order stays a heuristic', () => {
	it('prices every ordering of a fixed classic allocation', () => {
		const random = mulberry32(0x160729);

		const results = drawDays(DAYS, 0x290716)
			.map((day) => measure(day, random))
			.filter((result): result is DayResult => result !== null);

		const column = (pick: (result: DayResult) => number) => results.map(pick);

		const row = (label: string, values: number[]) =>
			console.log(
				`[§16] ${label.padEnd(32)} median ${quantile(values, 0.5).toFixed(2)}% | ` +
					`p90 ${quantile(values, 0.9).toFixed(2)}% | max ${Math.max(...values).toFixed(2)}%`,
			);

		const fundedTasks = results.reduce((sum, r) => sum + r.fundedCount, 0);

		console.log(
			`[§16] ${results.length}/${DAYS} days with ≥2 funded tasks, 3–8 tasks, budget 4–10h; ` +
				`exhaustive ≤${EXHAUSTIVE_LIMIT} funded, ${SAMPLES} sampled on the ` +
				`${results.filter((r) => r.fundedCount > EXHAUSTIVE_LIMIT).length} days above that; ` +
				`${((100 * results.reduce((sum, r) => sum + r.balancedCount, 0)) / fundedTasks).toFixed(0)}% of ` +
				`funded tasks are 'balanced' (the alternation's no-op case)`,
		);

		row(
			'best ordering vs interleaved',
			column((r) => r.bestOverInterleaved),
		);

		row(
			'best vs worst (whole spread)',
			column((r) => r.bestOverWorst),
		);

		row(
			'interleaved vs plain priority',
			column((r) => r.interleavedOverPriority),
		);

		const reordered = results.filter((r) => r.isReordered);

		row(
			`— on the ${reordered.length} days it re-orders`,
			reordered.map((r) => r.interleavedOverPriority),
		);

		const ranks = column((r) => r.percentileRank);

		console.log(
			`[§16] interleaved sits at the ${quantile(ranks, 0.5).toFixed(2)}th percentile of orderings ` +
				`(p90: ${quantile(ranks, 0.9).toFixed(0)}th), outright optimal on ` +
				`${results.filter((r) => r.isInterleavedOptimal).length}/${results.length} days; ` +
				`re-orders on ${reordered.length}/${results.length} days`,
		);

		const deltas = column((r) => r.riskDelta);

		console.log(
			`[§16 burnout Δ points, interleaved − objective-maximizing] min ${Math.min(...deltas).toFixed(2)} ` +
				`p10 ${quantile(deltas, 0.1).toFixed(2)} median ${quantile(deltas, 0.5).toFixed(2)} ` +
				`mean ${mean(deltas).toFixed(2)} p90 ${quantile(deltas, 0.9).toFixed(2)} ` +
				`max ${Math.max(...deltas).toFixed(2)}; |Δ| > 5 on ` +
				`${deltas.filter((d) => Math.abs(d) > 5).length}/${results.length} days`,
		);
	});
});
