/**
 * Measurements behind MATH.md §14's claims about the priced levers.
 *
 * A probe, not a test: it answers "what is true of the model over a large input
 * space" and prints numbers, where a test answers "does this still hold" and is
 * binary. Both numbers below legitimately move whenever the allocator changes,
 * which is why this runs on demand (`npm run probe`) and never in `npm test` —
 * a sweep in the suite goes red on every honest model change while its real
 * signal, the size of the number, is not a regression at all.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports. An undated number in that document is unfalsifiable: the sweep that
 * produced §14.1-2's "the trim is free" was thrown away, which is exactly how
 * that claim stayed in the document while being false (see the trim
 * measurement below, which is what corrected it).
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { suggestPlanAdjustments } from '$lib/business/model/metric/plan-advice';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
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

const percentOf = (value: number, base: number) =>
	base > 0 ? Math.round(((value - base) / base) * 1000) / 10 : null;

const funded = (metrics: DailyMetrics) =>
	metrics.suggestedTasks.filter((task) => task.suggestedHours > 0).length;

const allocated = (metrics: DailyMetrics) =>
	metrics.suggestedTasks.reduce((sum, task) => sum + task.suggestedHours, 0);

/**
 * §14.1-2 said `budget − planSlack` was free — it changes no allocation, so it
 * costs no Σ P̄. Corrected 2026-08-06 by this measurement: the trim keeps the
 * plan FEASIBLE, but `allocate` is path-dependent on `budgetBlocks` (§13.3), so
 * the re-solve can land on a different, lower-valued distribution of the same
 * hours.
 *
 * `reshaped` is what separates the two claims, and is why it is counted here
 * rather than asserted on one day: a non-free trim that also funds fewer tasks
 * or spends fewer hours would be §14.1-2's original rounding defect coming back,
 * not path-dependence.
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
 * P̄ᵢ(0) = 0 and Σ P̄ is monotone non-decreasing in the budget (§14.1-1) — so a
 * positive cost on the frontier is §13.3 suboptimality reaching the card.
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

const DAYS = randomDays(600, 42);

describe('plan advice', () => {
	it('measures the pure trim (MATH.md §14.1-2)', () => {
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

	it('measures priced-lever signs (MATH.md §14/§14.1)', () => {
		pricedSigns(DAYS);
	});
});
