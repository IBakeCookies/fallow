/**
 * Measurements behind MATH.md §13.6: the two end-of-day energy readings differ
 * in WHEN they are taken, not in how they aggregate the two reservoirs.
 *
 * §13.6 quotes three sets of numbers: an avg-vs-min re-scoring table over four
 * plans ("moves the objective by ≤ 0.08 and reorders nothing"), a same-day pair
 * showing work ending at C_cog = 0.21 (risk 79%) while `terminalBonus` reads
 * 1.491 after the trailing rest, and a V_T discrimination figure (1.4911 at 6 h
 * of work vs 1.4233 at 8 h, i.e. 0.034 per hour against `freeTimeValue`'s 0.5).
 * The table's fixture is stated only as "one pure-cognitive and one
 * pure-physical task at matched difficulty/enjoyment"; this probe pins it to the
 * pair that reproduces the printed objectives, so the row can be re-derived.
 *
 * `min` is applied here the way Burnout Risk applies it — to the reservoir
 * levels the SAME evaluation ends on — so the only thing that changes between
 * the columns is the aggregator, which is exactly §13.6's claim.
 *
 * A probe, not a test: the objectives move with the energy model. The suite pins
 * the property instead — that the aggregator does not reorder plans.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	simulateReservoirs,
	type EnergyTaskInput,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';

const task = (
	id: number,
	title: string,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title,
	// Matched across the pair, and the values that reproduce §13.6's table.
	difficulty: 8,
	enjoyment: 6,
	cognitiveDemand,
	physicalDemand,
});

const WINDOW_HOURS = 10;
const PAIR = [task(1, 'cognitive', 1, 0), task(2, 'physical', 0, 1)];

describe('MATH.md §13.6 — timing, not aggregation', () => {
	it('re-scores four plans with min in place of avg', () => {
		const plans: [string, ScheduleBlock[]][] = [
			[
				'lopsided 6h cog',
				[
					{
						taskId: 1,
						hours: 6,
					},
				],
			],
			[
				'balanced 3+3',
				[
					{
						taskId: 1,
						hours: 3,
					},
					{
						taskId: 2,
						hours: 3,
					},
				],
			],
			[
				'lopsided 8h cog',
				[
					{
						taskId: 1,
						hours: 8,
					},
				],
			],
			[
				'balanced 4+4',
				[
					{
						taskId: 1,
						hours: 4,
					},
					{
						taskId: 2,
						hours: 4,
					},
				],
			],
		];

		const scored = plans.map(([label, blocks]) => {
			const ev = evaluateSchedule(blocks, PAIR, WINDOW_HOURS, DEFAULT_ENERGY_PARAMS);

			const withMin =
				ev.objective -
				ev.terminalBonus +
				DEFAULT_ENERGY_PARAMS.terminalEnergyValue * Math.min(ev.endCog, ev.endPhys);

			return {
				label,
				avg: ev.objective,
				min: withMin,
			};
		});

		let worst = 0;

		for (const row of scored) {
			worst = Math.max(worst, Math.abs(row.avg - row.min));

			console.log(
				`${row.label}: objective avg ${row.avg.toFixed(4)}, min ${row.min.toFixed(4)}, delta ${(row.avg - row.min).toFixed(4)}`,
			);
		}

		const byAvg = [...scored].sort((x, y) => y.avg - x.avg).map((r) => r.label);
		const byMin = [...scored].sort((x, y) => y.min - x.min).map((r) => r.label);
		console.log(`worst |delta| ${worst.toFixed(4)}; ranking by avg [${byAvg.join(' > ')}]`);
		console.log(`                        ranking by min [${byMin.join(' > ')}]`);
		// §13.6's actual conclusion: switching aggregator buys no behaviour change.
		expect(byMin).toEqual(byAvg);
	});

	it('reads the same day at end-of-work and at end-of-window', () => {
		const cognitive = task(1, 'cognitive', 1, 0);

		for (const workHours of [6, 8]) {
			const blocks: ScheduleBlock[] = [
				{
					taskId: 1,
					hours: workHours,
				},
			];

			// Burnout Risk's reading: the intended workday, no tail.
			const atWork = simulateReservoirs(blocks, [cognitive], DEFAULT_ENERGY_PARAMS);
			// terminalBonus's reading: the end of the window, after implicit rest.
			const atWindow = evaluateSchedule(blocks, [cognitive], WINDOW_HOURS, DEFAULT_ENERGY_PARAMS);

			console.log(
				`${workHours}h of full-demand cognitive work in a ${WINDOW_HOURS}h window: end of WORK C_cog ${atWork.endCog.toFixed(4)} (risk ${Math.round(100 * (1 - Math.min(atWork.endCog, atWork.endPhys)))}%), end of WINDOW C_cog ${atWindow.endCog.toFixed(4)}, terminalBonus ${atWindow.terminalBonus.toFixed(4)} of ${DEFAULT_ENERGY_PARAMS.terminalEnergyValue}`,
			);
		}

		const six = evaluateSchedule(
			[
				{
					taskId: 1,
					hours: 6,
				},
			],
			[cognitive],
			WINDOW_HOURS,
			DEFAULT_ENERGY_PARAMS,
		).terminalBonus;

		const eight = evaluateSchedule(
			[
				{
					taskId: 1,
					hours: 8,
				},
			],
			[cognitive],
			WINDOW_HOURS,
			DEFAULT_ENERGY_PARAMS,
		).terminalBonus;

		const perHour = (six - eight) / 2;

		console.log(
			`V_T's stopping pressure ${perHour.toFixed(4)} per hour against freeTimeValue ${DEFAULT_ENERGY_PARAMS.freeTimeValue} — ${((100 * perHour) / DEFAULT_ENERGY_PARAMS.freeTimeValue).toFixed(1)}% of it`,
		);
	});
});
