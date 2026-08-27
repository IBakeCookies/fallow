/**
 * The price of quantizing the energy optimizer's plans to `DEFAULT_STEP_HOURS`
 * — the 45-minute lattice (MATH.md §8.8). The suite pins one cell of it: the
 * ≥ 97% objective ratio and the funded-set match at 8 h, on two days. The sweep
 * behind that bound is here, on the same two days over windows 4–14 h, read off
 * this file's own run (2026-08-27):
 *
 *   (a) the coarse/fine objective ratio (0.75 vs 0.25 step) bottoms out at
 *       0.9693 on the 3-task day (at 4 h) and 0.9759 on the mixed day (at
 *       12 h), and is 1.0000 on both at 6 h;
 *   (b) the funded-task set matches the fine-step optimum in all 12 cells —
 *       both days, every window;
 *   (c) exhaustive enumeration of all 1,048,576 45-min plans on the probe day
 *       × 8 h reaches 10.6274, which is the search's own answer, gap 0;
 *   (d) the fine lattice costs 39×–44× the coarse one on the 3-task/8 h day,
 *       ~30 ms against ~1.3 s. A wall clock, so the band is the result: three
 *       runs on this box read 30.5/1252.8, 28.4/1233.4 and 34.7/1346.2 ms;
 *   (e) fine-step optima at long windows degenerate into 15-min rest confetti
 *       — five 0.25 h rests on the mixed day at 12 h where the coarse lattice
 *       returns one 45-min break — at ~2% of the objective.
 *
 * Plus the §8.8 invariant the prose argues inductively: every block is a whole
 * number of steps and the total never exceeds the lattice-floor of the window
 * (so `normalizeSchedule`'s window clip cannot fire).
 *
 * A probe, not a test: the ratios and the millisecond figures move whenever the
 * curves, the reservoir law or the search's move set move — legitimately. The
 * suite keeps the structural half ("45-min block granularity (MATH.md §8.8)" in
 * `zenith-energy.test.ts`).
 *
 * Usage: npm run probe
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	optimizeSchedule,
	type EnergyTaskInput,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';

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

const task = (
	id: number,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title: `t${id}`,
	difficulty,
	enjoyment,
	cognitiveDemand,
	physicalDemand,
});

/**
 * The 2026-07-14 probe day (boxing / guitar / reading), as in the suite.
 * Aligned 2026-08-21 (ROADMAP M44): guitar 0.4/0.3 → 0.6/0 and reading
 * 0.5/0.05 → 0.4/0, the demands the three integer sliders actually reach at the
 * difficulties this day is stated in.
 */
const PROBE_DAY: EnergyTaskInput[] = [
	task(1, 10, 10, 0.2, 1.0),
	task(2, 6, 9, 0.6, 0),
	task(3, 4, 7, 0.4, 0),
];

/** The suite's second §8.8 day: four tasks, mixed cognitive/physical. */
const MIXED_DAY: EnergyTaskInput[] = [
	task(1, 8, 6, 0.9, 0.1),
	task(2, 4, 7, 0.1, 0.9),
	task(3, 3, 3, 0.4, 0.1),
	task(4, 7, 5, 0.8, 0.1),
];

const funded = (blocks: ScheduleBlock[]) =>
	[...new Set(blocks.filter((b) => b.taskId !== null).map((b) => b.taskId))].sort().join(',');

const rests = (blocks: ScheduleBlock[]) => blocks.filter((b) => b.taskId === null);
const REPS = 5;

/** A wall clock is a range, so a reading carries the spread it was read at. */
interface Timing {
	median: number;
	min: number;
	max: number;
}

/** Median of `REPS`, WITH the extremes it came from. Warm-up is the caller's. */
function timeMs(run: () => void): Timing {
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

/** Half the observed range, as a percent of the median: the digit that survives. */
const ms = (t: Timing) =>
	`${t.median.toFixed(1)} ms ±${Math.round((50 * (t.max - t.min)) / t.median)}%`;

const fine = (tasks: EnergyTaskInput[], windowHours: number) =>
	optimizeSchedule(tasks, windowHours, DEFAULT_ENERGY_PARAMS, undefined, {
		stepHours: 0.25,
	});

describe('45-min lattice', () => {
	it('measures the quantization loss against the 15-min lattice (MATH.md §8.8)', () => {
		for (const [name, tasks] of [
			['probe day, 3 tasks', PROBE_DAY],
			['mixed day, 4 tasks', MIXED_DAY],
		] as const) {
			let worst = {
				ratio: Infinity,
				windowHours: 0,
			};

			for (const windowHours of [4, 6, 8, 10, 12, 14]) {
				const coarse = optimizeSchedule(tasks, windowHours);
				const finer = fine(tasks, windowHours);
				const ratio = coarse.evaluation.objective / finer.evaluation.objective;

				console.log(
					`[§8.8 loss] ${name}, ${windowHours}h: coarse/fine objective ${ratio.toFixed(4)} (${coarse.evaluation.objective.toFixed(4)} vs ${finer.evaluation.objective.toFixed(4)}), funded ${funded(coarse.blocks)} vs ${funded(finer.blocks)}${
						funded(coarse.blocks) === funded(finer.blocks) ? '' : ' — MISMATCH'
					}, rests ${rests(coarse.blocks).length} vs ${rests(finer.blocks).length} (fine rest hours ${rests(
						finer.blocks,
					)
						.map((b) => b.hours)
						.join('/')})`,
				);

				if (ratio < worst.ratio)
					worst = {
						ratio,
						windowHours,
					};
			}

			console.log(
				`[§8.8 loss] ${name}: worst ratio ${worst.ratio.toFixed(4)} at ${worst.windowHours}h (the suite bounds it ≥ 0.97 at 8h)`,
			);
		}
	});

	it('times the two lattices on the 3-task/8h day', () => {
		// One warm-up run each: `buildCurves` caches, and the first call pays for
		// the cache the quoted milliseconds were never meant to include.
		optimizeSchedule(PROBE_DAY, 8);
		fine(PROBE_DAY, 8);

		const coarse = timeMs(() => optimizeSchedule(PROBE_DAY, 8));
		const finer = timeMs(() => fine(PROBE_DAY, 8));

		console.log(
			`[§8.8 speed] 3-task/8h day, ${REPS} reps: coarse ${ms(coarse)} vs fine ${ms(finer)} (${(finer.median / coarse.median).toFixed(1)}×)`,
		);
	});

	it('enumerates every 45-min plan on the probe day (MATH.md §8.8)', () => {
		const windowHours = 8;
		const steps = Math.floor(windowHours / DEFAULT_STEP_HOURS + 1e-9);
		const slots: (number | null)[] = [...PROBE_DAY.map((t) => t.id), null];
		const search = optimizeSchedule(PROBE_DAY, windowHours);
		// Every assignment of the `steps` lattice slots to a task or to rest —
		// all task orders, all allocations, all interior rest placements. Adjacent
		// equal slots merge into one block, which is exactly the plan shape the
		// search emits.
		let best = -Infinity;
		let bestPlan: ScheduleBlock[] = [];
		let evaluations = 0;
		const assignment = new Array<number>(steps).fill(0);

		for (;;) {
			const plan: ScheduleBlock[] = [];

			for (const index of assignment) {
				const taskId = slots[index];
				const last = plan[plan.length - 1];

				if (last !== undefined && last.taskId === taskId) last.hours += DEFAULT_STEP_HOURS;
				else
					plan.push({
						taskId,
						hours: DEFAULT_STEP_HOURS,
					});
			}

			const objective = evaluateSchedule(
				plan,
				PROBE_DAY,
				windowHours,
				DEFAULT_ENERGY_PARAMS,
				DEFAULT_USER_CONSTANTS,
			).objective;

			evaluations++;

			if (objective > best) {
				best = objective;
				bestPlan = plan;
			}

			let i = 0;

			while (i < steps && assignment[i] === slots.length - 1) assignment[i++] = 0;

			if (i === steps) break;

			assignment[i]++;
		}

		console.log(
			`[§8.8 enumerated] probe day × 8h: ${evaluations} lattice plans, best ${best.toFixed(4)} vs search ${search.evaluation.objective.toFixed(4)} (gap ${(best - search.evaluation.objective).toExponential(2)})`,
		);

		console.log(
			`[§8.8 enumerated] best plan ${bestPlan.map((b) => `${b.taskId ?? 'rest'}:${b.hours}`).join(' ')}`,
		);
	});

	it('checks the lattice invariant on seeded random days (MATH.md §8.8)', () => {
		const random = mulberry32(20260806);
		let worstOverfill = 0;
		let offLattice = 0;

		for (let day = 0; day < 150; day++) {
			const tasks = Array.from(
				{
					length: 1 + Math.floor(random() * 4),
				},
				(_, index) =>
					task(
						index + 1,
						1 + Math.round(random() * 9),
						1 + Math.round(random() * 9),
						Math.round(random() * 10) / 10,
						Math.round(random() * 10) / 10,
					),
			);

			// Deliberately off-lattice windows: the sub-step remainder is the case
			// §8.8's window-tail paragraph is about.
			const windowHours = 0.25 + Math.round(random() * 60) * 0.25;
			const { blocks } = optimizeSchedule(tasks, windowHours);
			const total = blocks.reduce((sum, b) => sum + b.hours, 0);
			const latticeFloor = Math.floor(windowHours / DEFAULT_STEP_HOURS + 1e-9) * DEFAULT_STEP_HOURS;

			worstOverfill = Math.max(worstOverfill, total - latticeFloor);

			for (const b of blocks) {
				const units = b.hours / DEFAULT_STEP_HOURS;

				if (Math.abs(units - Math.round(units)) > 1e-9) offLattice++;
			}
		}

		console.log(
			`[§8.8 invariant] 150 seeded random days, windows 0.25–15.25h: off-lattice blocks ${offLattice}, worst (total − lattice-floor of window) ${worstOverfill.toExponential(2)}`,
		);

		// The inductive argument in §8.8, as an invariant: not a moving number.
		expect(offLattice).toBe(0);
		expect(worstOverfill).toBeLessThan(1e-9);
	});
});
