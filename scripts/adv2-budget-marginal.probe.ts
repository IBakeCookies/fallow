/**
 * Measurements behind MATH.md §14.2's claims about the budget's shadow price.
 *
 * §14.2 was added on 2026-08-03 quoting a 400-day sweep that was never
 * committed: the zero-marginal share, the median/p90 of a block's worth, the
 * top-priority share, the multi-gainer counts, and the naive per-task column's
 * spread all came from a script that no longer exists. This is that sweep,
 * seeded, so every number in that subsection can be reproduced instead of
 * believed (AGENTS.md §4).
 *
 * §14.2 also quotes the naive column's overstatement twice: over all multi-task
 * days, and restricted to the days whose budget marginal is non-zero (a zero
 * marginal makes every positive column entry an overstatement by construction,
 * which flatters the all-days rate). Both pairs come out of this one sweep.
 *
 * A probe, not a test: the numbers move whenever the allocator changes, which is
 * a legitimate model change and not a regression. Whatever it prints belongs in
 * MATH.md WITH ITS DATE.
 *
 * Usage: npm run probe
 */

import { describe, it, expect } from 'vitest';
import {
	calculateDailyMetrics,
	type DailyMetrics,
	type DailyMetricsInput,
} from '$lib/business/model/metric/daily-metrics';
import { suggestPlanAdjustments } from '$lib/business/model/metric/plan-advice';
import { getEffectiveDifficulty } from '$lib/business/model/metric/calculation';
import {
	BLOCK_HOURS,
	DEFAULT_USER_CONSTANTS,
	averageProductivity,
	calculateTaskParams,
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

/** §14.2's stated space: 2–7 tasks, budget 1–12 h, s 5–30 min, nothing completed. */
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

			return {
				tasks,
				availableHours: pick(1, 12, 0.25),
				switchCost: pick(5, 30, 5) / 60,
				pools: {
					cognitiveHours: pick(0.5, 6, 0.5),
					physicalHours: pick(0.5, 7, 0.5),
				},
				constants: DEFAULT_USER_CONSTANTS,
				energyParams: DEFAULT_ENERGY_PARAMS,
			};
		},
	);
}

const quantile = (values: number[], q: number) => {
	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

const median = (values: number[]) => quantile(values, 0.5);

/** Does the card still offer "work an extra hour" somewhere on the menu? */
const offersExtraHour = (input: DailyMetricsInput, baseline: DailyMetrics) =>
	suggestPlanAdjustments(input, baseline).findings.some(
		(finding) =>
			finding.unpriced?.lever.kind === 'set-budget' &&
			finding.unpriced.lever.hours > baseline.budgetHours,
	);

describe('the marginal of the budget (MATH.md §14.2)', () => {
	it('measures what one more block buys, and how often it buys nothing', () => {
		const days = randomDays(400, 42);
		let zeroMarginal = 0;
		let zeroStillOffered = 0;
		let withRecipient = 0;
		let recipientWithoutGain = 0;
		let topPriority = 0;
		let multiGainer = 0;
		let multiGainerDistinct = 0;
		let inverted = 0;
		let worstInversion = 0;
		let worstDecomposition = 0;
		const gains: number[] = [];
		const spreads: number[] = [];
		let underTenth = 0;
		let fundedSeen = 0;
		let atPeak = 0;
		let multiTask = 0;
		let overstates = 0;
		let overstatement = 0;
		let nonZeroMarginalDays = 0;
		let overstatesNonZero = 0;
		let overstatementNonZero = 0;

		for (const input of days) {
			const baseline = calculateDailyMetrics(input);
			const { budgetMarginal } = suggestPlanAdjustments(input, baseline);

			const wider = calculateDailyMetrics({
				...input,
				availableHours: baseline.budgetHours + BLOCK_HOURS,
			});

			// Nothing is completed here, so the open-scoped per-task decomposition
			// must reproduce the plan's own Σ P̄ rise (§14.2), floor included.
			const rise = wider.zenithGain.optimized - baseline.zenithGain.optimized;

			worstDecomposition = Math.max(
				worstDecomposition,
				Math.abs(budgetMarginal.planValueGain - Math.max(0, rise)),
			);

			// The floor's own frequency and size: §14.2 says Σ P̄ is monotone in the
			// budget at the true optimum and the pooled heuristic can invert.
			if (rise < 0 && baseline.zenithGain.optimized > 0) {
				inverted++;
				worstInversion = Math.min(worstInversion, rise / baseline.zenithGain.optimized);
			}

			if (budgetMarginal.recipient === null && budgetMarginal.planValueGain === 0) {
				zeroMarginal++;

				if (offersExtraHour(input, baseline)) zeroStillOffered++;
			}

			if (budgetMarginal.planValueGain > 0 && budgetMarginal.planValueGainPercent !== null)
				gains.push(budgetMarginal.planValueGainPercent);

			if (budgetMarginal.recipient) {
				withRecipient++;

				// §14.2: the floor can leave a recipient set beside a 0% gain, which the
				// card prints as "goes to X · +0% plan value".
				if (budgetMarginal.planValueGainPercent === 0) recipientWithoutGain++;

				// `activeTasks` is priority-sorted, so the head IS the priority column's top.
				if (baseline.activeTasks[0]?.id === budgetMarginal.recipient.taskId) topPriority++;
			}

			const gainers = baseline.activeTasks
				.map((open) => ({
					extra:
						(wider.suggestedTasks.find((row) => row.id === open.id)?.suggestedHours ?? 0) -
						open.suggestedHours,
				}))
				.filter((row) => row.extra > 0);

			if (gainers.length > 1) {
				multiGainer++;

				if (new Set(gainers.map((row) => row.extra)).size > 1) multiGainerDistinct++;
			}

			// The naive per-task column §14.2 rejected: bump task i's hours by one
			// block on its own curve and hold the rest. Arithmetic, not a solve — it
			// sees neither the pools nor the switch cost.
			const funded = baseline.suggestedTasks.filter((row) => row.suggestedHours > 0);

			if (baseline.suggestedTasks.length < 2 || funded.length === 0) continue;

			multiTask++;

			// The restriction §14.2 quotes beside the all-days pair, counted on the
			// same population and in the same pass.
			const marginalIsNonZero = budgetMarginal.planValueGain > 0;

			if (marginalIsNonZero) nonZeroMarginalDays++;

			const column = funded.map((row) => {
				const { a, p0, k } = calculateTaskParams(
					{
						difficulty: getEffectiveDifficulty(row),
						enjoyment: row.enjoyment,
					},
					DEFAULT_USER_CONSTANTS,
				);

				fundedSeen++;

				if (row.suggestedHours >= row.optimalHours - 1e-9) atPeak++;

				return (
					averageProductivity(row.suggestedHours + BLOCK_HOURS, a, p0, k) -
					averageProductivity(row.suggestedHours, a, p0, k)
				);
			});

			const best = Math.max(...column);

			if (best <= 0) continue;

			const spread = (best - Math.min(...column)) / best;

			spreads.push(spread);

			if (spread < 0.1) underTenth++;

			if (best > budgetMarginal.planValueGain + 1e-12) {
				overstates++;
				overstatement += best - budgetMarginal.planValueGain;

				if (marginalIsNonZero) {
					overstatesNonZero++;
					overstatementNonZero += best - budgetMarginal.planValueGain;
				}
			}
		}

		console.log(
			`[§14.2] 400 seeded days: another block buys nothing on ${zeroMarginal} (${((zeroMarginal / 400) * 100).toFixed(1)}%), of which ${zeroStillOffered} still offer "work an extra hour"`,
		);

		console.log(
			`[§14.2] where it buys something (${gains.length} days): median ${median(gains).toFixed(1)}%, p90 ${quantile(gains, 0.9).toFixed(1)}% of plan value`,
		);

		console.log(
			`[§14.2] recipient named on ${withRecipient} days, the top-priority task on ${topPriority} (${((topPriority / withRecipient) * 100).toFixed(1)}%), beside a 0% gain on ${recipientWithoutGain}`,
		);

		console.log(
			`[§14.2] multi-gainer days ${multiGainer}, ${multiGainerDistinct} of them with gainers of differing size`,
		);

		console.log(
			`[§14.2] floor: Σ P̄ fell at the wider budget on ${inverted} days, worst ${(worstInversion * 100).toFixed(2)}%; worst |gain − max(0, Σ P̄ rise)| = ${worstDecomposition.toExponential(3)}`,
		);

		console.log(
			`[§14.2] naive column over ${multiTask} multi-task days: relative spread median ${median(spreads).toFixed(3)}, p90 ${quantile(spreads, 0.9).toFixed(3)}, max ${Math.max(...spreads).toFixed(3)}, under 0.10 on ${((underTenth / spreads.length) * 100).toFixed(1)}%`,
		);

		console.log(
			`[§14.2] ${atPeak} of ${fundedSeen} funded tasks sit at or past T*; the column's best entry overstates the marginal on ${((overstates / multiTask) * 100).toFixed(1)}% of days, mean overstatement ${(overstatement / Math.max(1, overstates)).toFixed(4)} Σ P̄`,
		);

		console.log(
			`[§14.2] restricted to the ${nonZeroMarginalDays} of ${multiTask} multi-task days whose budget marginal is non-zero: it overstates on ${((overstatesNonZero / nonZeroMarginalDays) * 100).toFixed(1)}% of them, mean overstatement ${(overstatementNonZero / Math.max(1, overstatesNonZero)).toFixed(4)} Σ P̄`,
		);

		// The one genuine invariant in the sweep, and the reason the decomposition
		// needs no second gain solve: with nothing completed, the open-scoped sum of
		// per-task `avgProductivity` rises IS the plan's floored Σ P̄ rise (§14.2).
		expect(worstDecomposition).toBeLessThan(1e-12);

		// The restriction is a subset of the same population, so both of its counts
		// are dominated by the all-days ones — the numbers themselves are figures.
		expect(nonZeroMarginalDays).toBeLessThanOrEqual(multiTask);
		expect(overstatesNonZero).toBeLessThanOrEqual(overstates);
		expect(overstatementNonZero).toBeLessThanOrEqual(overstatement);
	});
});
