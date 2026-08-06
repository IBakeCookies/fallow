/**
 * The measurements behind three unbacked stretches of MATH.md §11.6, §11.9 and
 * §12 — every one a number the document states and nothing in `src/` or
 * `scripts/` reproduces.
 *
 * §11.6, "Monotone in demand and duration, NOT in the declared budget (same
 *   probe)". `scripts/burnout-risk.probe.ts` measures the budget walk and the
 *   duration ladder; it never varies DEMAND, and the suite pins demand at one
 *   pair (mild 3 vs hard 9). The demand arm is measured here over the full 0–10
 *   scale at four durations.
 *
 * §11.6, the worst-drop decomposition — "their three switch gaps are 1.25h of
 *   REST against one gap's 0.42h, so the simulated WORK falls from 2.83h to
 *   2.25h", "both reservoirs end higher", "NOT min() swapping reservoirs — the
 *   cognitive one binds on both sides". Those numbers live in a test COMMENT
 *   beside `expect(riskAt(3.25)).toBe(41)`; the test asserts the two readings
 *   and nothing about the mechanism claimed to produce them.
 *
 * §11.9, the carry-over levels — "at the fit floor, a fully-drained 8 h day
 *   starts the next morning near 92 %, and a 16 h day (8 h gap) near 74 %", and
 *   "ρ_rest = 0.7·1.5 = 1.05/h leaves e^(−16.8) ≈ 5·10⁻⁸ of an 8 h day's
 *   deficit by morning". `energy-calibration.test.ts` pins the closed form, the
 *   no-logs identity, > 0.999 healing at defaults, monotonicity and the > 24 h
 *   guard — no percentage in §11.9 is asserted anywhere.
 *
 * §12, "probe 2026-07-11: two identical tasks on 1h score 1.955 split vs 1.58
 *   concentrated under Σ P̄". The framing of the whole audit rests on the
 *   classic objective preferring to spread; neither number appears in the repo.
 *
 * A probe, not a test: these are properties of the model over an input space
 * (the demand grid) and readings that move legitimately whenever α, r, b or the
 * allocator move. What it FINDS is pinned by one cheap fixture in the suite,
 * never by the sweep.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateBurnoutRisk,
	calculateInterleavedOrder,
	calculateSuggestedTasks,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import {
	averageProductivity,
	calculateTaskParams,
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	RECOVERY_FIT_MIN,
	simulateReservoirs,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import { seedMorningReservoirs } from '$lib/business/model/energy-calibration';
import type { DrainObservationRecord, Task } from '$lib/data/type';

const task = (id: number, mental: number, physical: number, enjoyment: number): Task => ({
	id,
	title: `t${id}`,
	mentalDifficulty: mental,
	physicalDifficulty: physical,
	enjoyment,
	createdAt: '2026-08-06',
	completed: false,
});

const plan = (tasks: Task[], availableHours: number, switchCost: number): SuggestedTask[] =>
	calculateSuggestedTasks(
		tasks,
		availableHours,
		switchCost,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

/** The §11.6 budget-walk worst case: 4 tasks at s = 25m, 3.25h → 3.5h. */
const WORST_DROP_TASKS = [task(1, 9, 10, 6), task(2, 8, 5, 8), task(3, 3, 1, 0), task(4, 4, 8, 2)];
const WORST_DROP_SWITCH_COST = 25 / 60;

describe('MATH.md §11.6 — the demand arm and the worst-drop mechanism', () => {
	/**
	 * Demand, the arm `burnout-risk.probe.ts` never walks. One pure cognitive
	 * task whose budget equals its duration, so the plan funds the whole day and
	 * only the demand moves.
	 */
	it('is monotone in demand at every duration', () => {
		for (const hours of [1, 2, 4, 8]) {
			const readings = Array.from(
				{
					length: 11,
				},
				(_, mental) => {
					const tasks = [task(1, mental, 0, 5)];

					return calculateBurnoutRisk(plan(tasks, hours, 0.25), hours, 0.25);
				},
			);

			let falls = 0;

			for (let i = 1; i < readings.length; i++) if (readings[i] < readings[i - 1]) falls++;

			console.log(
				`[§11.6 demand] ${hours}h, cognitive demand 0→10: ${readings.join('/')}% — ` +
					`${falls} of 10 steps FELL`,
			);
		}
	});

	/**
	 * The mechanism §11.6 and `calculation.test.ts` both narrate but neither
	 * measures. The blocks are rebuilt exactly as `calculateBurnoutRisk` builds
	 * them (interleaved order, switch costs as rest, overhang stretching the
	 * funded blocks pro-rata); the risk it would report is printed beside the
	 * reading the metric actually returns, so the reconstruction is checked
	 * rather than assumed.
	 */
	it('decomposes the 3.25h → 3.5h drop into work, rest and the binding reservoir', () => {
		for (const budget of [3.25, 3.5]) {
			const funded = calculateInterleavedOrder(
				plan(WORST_DROP_TASKS, budget, WORST_DROP_SWITCH_COST),
			);

			const gaps = funded.length > 1 ? funded.length - 1 : 0;
			const rest = gaps * WORST_DROP_SWITCH_COST;
			const allocated = funded.reduce((sum, t) => sum + t.suggestedHours, 0);
			const stretch = 1 + Math.max(0, budget - rest - allocated) / allocated;
			const blocks: ScheduleBlock[] = [];

			funded.forEach((t, i) => {
				if (i > 0)
					blocks.push({
						taskId: null,
						hours: WORST_DROP_SWITCH_COST,
					});

				blocks.push({
					taskId: t.id,
					hours: t.suggestedHours * stretch,
				});
			});

			const { endCog, endPhys } = simulateReservoirs(
				blocks,
				funded.map((t) => ({
					id: t.id,
					cognitiveDemand: t.mentalDifficulty / 10,
					physicalDemand: t.physicalDifficulty / 10,
				})),
				DEFAULT_ENERGY_PARAMS,
			);

			console.log(
				`[§11.6 drop] ${budget}h: ${funded.length} funded, allocated ${allocated.toFixed(2)}h, ` +
					`stretch ${stretch.toFixed(3)}, WORK ${(allocated * stretch).toFixed(2)}h, ` +
					`REST ${rest.toFixed(2)}h in ${gaps} gap(s); endCog ${endCog.toFixed(4)} / ` +
					`endPhys ${endPhys.toFixed(4)} → binds ${endCog <= endPhys ? 'COG' : 'PHYS'}, ` +
					`risk ${Math.round(100 * (1 - Math.min(endCog, endPhys)))}% ` +
					`(metric reads ${calculateBurnoutRisk(plan(WORST_DROP_TASKS, budget, WORST_DROP_SWITCH_COST), budget, WORST_DROP_SWITCH_COST)}%)`,
			);
		}
	});
});

describe('MATH.md §11.9 — overnight carry-over levels', () => {
	const drainLog = (hours: number): DrainObservationRecord => ({
		date: '2026-08-05',
		taskId: 1,
		taskTitle: 't1',
		hours,
		cognitiveDemand: 1,
		physicalDemand: 1,
		mindDrain: 10,
		bodyDrain: 10,
		createdAt: 1,
	});

	it('reports the morning level at the recovery fit floor and at defaults', () => {
		const floor = {
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: RECOVERY_FIT_MIN,
		};

		const rho = (rate: number) => rate * DEFAULT_ENERGY_PARAMS.restRecoveryMultiplier;

		for (const hours of [8, 16]) {
			const seeded = seedMorningReservoirs(floor, [drainLog(hours)]);

			console.log(
				`[§11.9 floor] r = ${RECOVERY_FIT_MIN} (ρ_rest ${rho(RECOVERY_FIT_MIN).toFixed(2)}/h), ` +
					`full-demand ${hours}h day, ${24 - hours}h gap: morning ` +
					`${(seeded.initialCog * 100).toFixed(1)}% cog / ` +
					`${(seeded.initialPhys * 100).toFixed(1)}% phys`,
			);
		}

		const healed = seedMorningReservoirs(DEFAULT_ENERGY_PARAMS, [drainLog(8)]);

		console.log(
			`[§11.9 defaults] ρ_rest ${rho(DEFAULT_ENERGY_PARAMS.recoveryRate).toFixed(2)}/h, ` +
				`full-demand 8h day: morning deficit ${(1 - healed.initialCog).toExponential(2)} cog ` +
				`(e^(−16.8) = ${Math.exp(-16.8).toExponential(2)}), ` +
				`two nights at the fit floor ≤ e^(−4.8) = ` +
				`${(Math.exp(-2 * rho(RECOVERY_FIT_MIN) * 16) * 100).toFixed(2)}%`,
		);
	});
});

describe('MATH.md §12 — the classic objective spreads', () => {
	/**
	 * §12's premise, cited to a 2026-07-11 probe that is gone. The task spec is not
	 * stated with it, so the whole 10×10 difficulty × enjoyment grid is swept: the
	 * PROPERTY (Σ P̄ prefers the split) is what §12 rests on, and the two quoted
	 * numbers have to come from one cell of this grid or from none of them.
	 */
	it('scores two identical tasks split against concentrated on a 1h budget', () => {
		let spreads = 0;
		let cells = 0;
		let closest = '';
		let gap = Infinity;

		for (let difficulty = 1; difficulty <= 10; difficulty++) {
			for (let enjoyment = 1; enjoyment <= 10; enjoyment++) {
				const { a, p0, k } = calculateTaskParams(
					{
						title: 't',
						difficulty,
						enjoyment,
					},
					DEFAULT_USER_CONSTANTS,
				);

				const split = 2 * averageProductivity(0.5, a, p0, k);
				const concentrated = averageProductivity(1, a, p0, k);

				cells++;

				if (split > concentrated) spreads++;

				// Closest cell to the quoted split score of 1.955.
				if (Math.abs(split - 1.955) < gap) {
					gap = Math.abs(split - 1.955);
					closest = `difficulty/enjoyment ${difficulty}/${enjoyment}: split ${split.toFixed(3)} vs concentrated ${concentrated.toFixed(3)}`;
				}
			}
		}

		console.log(
			`[§12 spread] Σ P̄ prefers the split on ${spreads} of ${cells} difficulty × enjoyment cells`,
		);

		console.log(`[§12 spread] closest cell to the quoted 1.955 — ${closest}`);
	});
});
