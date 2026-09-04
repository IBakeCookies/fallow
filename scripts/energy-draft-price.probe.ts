/**
 * Is the Total Output row the panel prints a magnitude, or a foregone
 * conclusion?
 *
 * `task-form-energy-preview.svelte` prints Total Output before and after the
 * draft, and it is expected to RISE nearly always: adding a candidate cannot
 * lower the maximum of the objective the search climbs, since every plan that
 * ignored the draft is still available, and `totalOutput` tracks that climb
 * loosely. Which is the same near-tautology ROADMAP's "add a task as an advice
 * lever" was rejected on — so the row is only honest if the size of the gain is
 * what it reports, and if how often it is NOT a gain is a measured number
 * rather than an assertion. That is this probe.
 *
 * Two things make the answer non-trivial rather than arithmetic. `optimizeSchedule`
 * is a seeded hill climb, not an exact maximiser, so a draft can send it to a
 * WORSE local optimum. And `totalOutput` is not the objective: the search
 * maximises satiated output plus the free-time and terminal-energy terms, so a
 * plan that wins on the objective can lose on raw output — the same gap
 * `#valueVsClassic` documents from the other side.
 *
 * Days are drawn on the app's surface: integer sliders, enjoyment from 1
 * (MATH.md §1's βᵤ ∈ [1,10]), 1-6 existing tasks, windows on the 15-minute grid
 * the budget stepper writes. The draft is drawn the same way, and priced
 * through the shipped `calculateEnergyDraftImpact` against the day's own plan —
 * the same call the Lab's button makes.
 *
 * READ, from the run below. **The row is a magnitude, and it is not a
 * tautology — but the interesting share is over the FUNDED days.** Over all 200
 * days the delta is ≤ 0 on 57.5% of them, which flatters the claim: 91 of those
 * 115 are days the optimizer gave the draft no hours at all, where the delta is
 * exactly 0 by construction. Restricted to the 107 days that DID fund it, the
 * delta is still ≤ 0 on 22.4% — median +0.798 output units, p10 −0.499, worst
 * −1.745. So on roughly one funded day in five, pricing the draft in LOWERS the
 * day's raw output, and a panel that printed "adding a task raises your output"
 * as a sentence would be wrong often enough to notice. Printing both numbers and
 * letting the two cost rows beside it argue is the reading that survives.
 *
 * Those days are the search's and the objective's, not a broken model: the hill
 * climb can land on a worse local optimum, and a plan that wins on satiated
 * output plus the free-time and terminal-energy terms can lose on raw output.
 *
 * FINDINGS — run 2026-09-04, seed 7, 200 days (figures reproduce byte-for-byte;
 * re-read them here after any change to the optimizer):
 *
 *   [delta] 200 days: p10 -0.105, median 0.000, p90 2.201, min -1.745,
 *       max 8.718 output units
 *   [relative] median +0.00%, p10 -1.17%, p90 +27.99%
 *   [not a gain] 115 of 200 days ≤ 0 (57.5%), of which 24 funded the draft
 *   [funded] 107 of 200 days gave the draft hours: median 0.798, p10 -0.499,
 *       min -1.745; 24 of them ≤ 0 (22.4%)
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import type { DraftTask } from '$lib/business/model/metric/draft-impact';
import { calculateEnergyDraftImpact } from '$lib/business/model/metric/energy-draft-impact';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS, optimizeSchedule } from '$lib/business/model/zenith-energy';
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

interface Day {
	tasks: Task[];
	windowHours: number;
	draft: DraftTask;
}

function randomDays(count: number, seed: number): Day[] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	const ratings = () => ({
		physicalDifficulty: pick(0, 10, 1),
		mentalDifficulty: pick(0, 10, 1),
		enjoyment: pick(1, 10, 1),
	});

	return Array.from(
		{
			length: count,
		},
		() => ({
			tasks: Array.from(
				{
					length: pick(1, 6, 1),
				},
				(_, index) => ({
					id: index + 1,
					title: `t${index + 1}`,
					createdAt: '2026-09-04',
					completed: false,
					...ratings(),
				}),
			),
			windowHours: pick(2, 12, 0.25),
			draft: ratings(),
		}),
	);
}

const quantile = (sorted: number[], q: number) =>
	sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`;

describe('what the draft does to the optimized day’s Total Output', () => {
	it('measures the delta and how often it is not a gain', () => {
		const rows = randomDays(200, 7).map(({ tasks, windowHours, draft }) => {
			const impact = calculateEnergyDraftImpact(
				{
					tasks,
					windowHours,
					params: DEFAULT_ENERGY_PARAMS,
					constants: DEFAULT_USER_CONSTANTS,
				},
				draft,
				optimizeSchedule(
					tasks.map(toEnergyTask),
					windowHours,
					DEFAULT_ENERGY_PARAMS,
					DEFAULT_USER_CONSTANTS,
				),
			)!;

			return {
				delta: impact.totalOutput.after - impact.totalOutput.before,
				relative:
					impact.totalOutput.before > 0
						? ((impact.totalOutput.after - impact.totalOutput.before) / impact.totalOutput.before) *
							100
						: 0,
				isFunded: impact.suggestedHours > 0,
			};
		});

		const deltas = rows.map((row) => row.delta).sort((a, b) => a - b);
		const relatives = rows.map((row) => row.relative).sort((a, b) => a - b);
		const notGain = rows.filter((row) => row.delta <= 0);

		console.log(
			`[delta] ${rows.length} days: p10 ${quantile(deltas, 0.1).toFixed(3)}, median ${quantile(deltas, 0.5).toFixed(3)}, p90 ${quantile(deltas, 0.9).toFixed(3)}, min ${deltas[0].toFixed(3)}, max ${deltas[deltas.length - 1].toFixed(3)} output units`,
		);

		console.log(
			`[relative] median +${quantile(relatives, 0.5).toFixed(2)}%, p10 ${quantile(relatives, 0.1).toFixed(2)}%, p90 +${quantile(relatives, 0.9).toFixed(2)}%`,
		);

		console.log(
			`[not a gain] ${notGain.length} of ${rows.length} days ≤ 0 (${percent(notGain.length, rows.length)}), of which ${notGain.filter((row) => row.isFunded).length} funded the draft`,
		);

		// The reading that matters: an unfunded draft moves nothing, so it lands on
		// the ≤ 0 side with a delta of exactly 0 and would flatter the share above.
		const funded = rows.filter((row) => row.isFunded);
		const fundedDeltas = funded.map((row) => row.delta).sort((a, b) => a - b);

		console.log(
			`[funded] ${funded.length} of ${rows.length} days gave the draft hours: median ${quantile(fundedDeltas, 0.5).toFixed(3)}, p10 ${quantile(fundedDeltas, 0.1).toFixed(3)}, min ${fundedDeltas[0].toFixed(3)}; ${funded.filter((row) => row.delta <= 0).length} of them ≤ 0 (${percent(funded.filter((row) => row.delta <= 0).length, funded.length)})`,
		);
	});
});
