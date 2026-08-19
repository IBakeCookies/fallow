/**
 * §18's worked inversion, priced through the shipped advisor. The section
 * justifies making the 🪫 writer APPEND with one witness — window 8 h, one task
 * (difficulty 7, enjoyment 6, w = (0.8, 0.2)), λ₀ = 0.5 — and three marginals
 * off it: 3 h logged reads `continue` at 0.667/h, the pre-fix upsert's stored
 * 1.5 h reads `continue` at 1.099/h (less worked, priced HIGHER), and the true
 * 4.5 h day reads `stop` at 0.372/h. No probe reached any of them.
 *
 * Which half is measured where. The 4.5 h day is what the SHIPPED writer
 * produces — two rows, summed by `workedHoursByTask`, the one join
 * `adviseStop` reads — and the probe checks the two-row day against the
 * one-row 4.5 h day to show the append is faithful. The truncated 1.5 h day is
 * NOT reachable through `$createDrainObservation` any more, so it is
 * constructed at the advisor's input: one stored row, exactly what the upsert
 * left behind.
 *
 * Then two things §18 states as one example: how far the truncation moves the
 * price at every split of the day (`SPLITS`), and whether the verdict flip is
 * reachable on APP tasks at all — the witness is a model-level
 * `EnergyTaskInput`, and `toEnergyTask` cannot pair difficulty 7 with
 * w = (0.8, 0.2) (demands 0.8/0.2 come from sliders 8/2, which is difficulty
 * 8 + 0.3·2 = 8.6).
 *
 * Usage: npx vitest run --config vitest.probe.config.ts --disableConsoleIntercept scripts/session-row-truncation.probe.ts
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	adviseStop,
	workedHoursByTask,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { EnergyTaskInput, StopObservation } from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

/** §18's witness, verbatim. Every parameter below is a shipped default. */
const WITNESS: EnergyTaskInput = {
	id: 1,
	title: 'Deep work',
	difficulty: 7,
	enjoyment: 6,
	cognitiveDemand: 0.8,
	physicalDemand: 0.2,
};

const WINDOW = 8;
const DAYS = 200;
const SEED = 0x18_0805;
const ORIGIN = Date.parse('2026-08-18T08:00:00.000Z');
/** Every two-session split of §18's 4.5 h day, plus the day itself. */
const SPLITS: number[][] = [[4.5], [0.75, 3.75], [1.5, 3], [2.25, 2.25], [3, 1.5], [3.75, 0.75]];

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * One task's stored rows for today, as the advisor's input sees them. Each row
 * carries the wall-clock moment it ended, `gapHours` apart — that spacing is
 * what the reconstruction reads the day's breaks out of (MATH.md §8.10). Back
 * to back (the default) the rows recover no break and the day reads summed,
 * which is the reading §18's identity claim is about.
 */
function observe(task: EnergyTaskInput, rows: number[], gapHours = 0): StopObservation {
	let clock = 0;

	return {
		tasks: [task],
		windowHours: WINDOW,
		workedHours: rows.map((hours, i) => {
			clock += (i === 0 ? 0 : gapHours) + hours;

			return {
				taskId: task.id,
				hours,
				endedAt: ORIGIN + clock * 3_600_000,
			};
		}),
		openTaskIds: new Set([task.id]),
	};
}

function price(task: EnergyTaskInput, rows: number[], gapHours = 0) {
	const advice = adviseStop(
		observe(task, rows, gapHours),
		DEFAULT_ENERGY_PARAMS,
		DEFAULT_USER_CONSTANTS,
	);

	// No arm reaches either state, so this fails the probe rather than skipping.
	if (advice === null || advice.verdict === 'window-full')
		throw new Error(`unpriceable: ${advice?.verdict ?? 'no advice'}`);

	return advice;
}

const stored = (task: EnergyTaskInput, rows: number[]) =>
	workedHoursByTask([task], observe(task, rows).workedHours).get(task.id) ?? 0;

const line = (label: string, task: EnergyTaskInput, rows: number[]) => {
	const p = price(task, rows);

	console.log(
		`  ${label.padEnd(36)} rows [${rows.join(' + ')}] -> stored ${stored(task, rows).toFixed(2)}h` +
			`, ${p.verdict} ${(p.sessionHours * 60).toFixed(0)}min at ${p.marginalValue.toFixed(4)}/h`,
	);
};

/** App tasks only: sliders through `toEnergyTask`, so every arm is reachable. */
function drawTasks(count: number, seed: number): EnergyTaskInput[] {
	const random = mulberry32(seed);
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	return Array.from(
		{
			length: count,
		},
		(_, i) => {
			const task: Task = {
				id: 1,
				title: `t${i}`,
				mentalDifficulty: slider(0),
				physicalDifficulty: slider(0),
				enjoyment: slider(1),
				createdAt: '2026-08-18',
				completed: false,
			};

			return toEnergyTask(task);
		},
	);
}

describe('§18 — one row per session, not per task-day', () => {
	it("prices the three states §18's advisor bullet quotes", () => {
		console.log(
			`witness: difficulty ${WITNESS.difficulty}, enjoyment ${WITNESS.enjoyment}, ` +
				`w = (${WITNESS.cognitiveDemand}, ${WITNESS.physicalDemand}), window ${WINDOW}h, ` +
				`λ₀ = ${DEFAULT_ENERGY_PARAMS.freeTimeValue} (all shipped defaults)`,
		);

		console.log('§18 bullet "Why the advisor is where it bites":');
		line('claim 1: 3h, continue 0.667/h', WITNESS, [3]);
		line('claim 2: upsert, continue 1.099/h', WITNESS, [1.5]);
		line('claim 3: true 4.5h day, stop 0.372/h', WITNESS, [3, 1.5]);

		// The append is only faithful if two rows and one row of the sum price
		// identically — the "After" bullet's whole claim.
		const appended = price(WITNESS, [3, 1.5]);
		const single = price(WITNESS, [4.5]);

		console.log(
			`  two rows vs one 4.5h row: Δ marginal ` +
				`${Math.abs(appended.marginalValue - single.marginalValue).toExponential(1)}` +
				`, verdicts ${appended.verdict}/${single.verdict}`,
		);

		// Where §18's identity ENDS (2026-08-19). Two rows are only the same day
		// as one when nothing happened between them; once their log moments are
		// apart, the reconstruction rests through the gap and the same 4.5 h reads
		// LOWER — recovered energy makes the next session cheaper to beat, so the
		// verdict can also come back.
		for (const gapHours of [0, 0.75, 1.5, 3]) {
			const p = price(WITNESS, [3, 1.5], gapHours);

			console.log(
				`  two rows ${(gapHours * 60).toFixed(0)}min apart: ${p.verdict} at ` +
					`${p.marginalValue.toFixed(4)}/h (one 4.5h row: ${single.marginalValue.toFixed(4)}/h)`,
			);
		}
	});

	it('prices every split of the same day, truncated against true', () => {
		const truth = price(WITNESS, [4.5]);

		console.log(
			`true 4.5h day: ${truth.verdict} at ${truth.marginalValue.toFixed(4)}/h — ` +
				`what the upsert would have read instead:`,
		);

		for (const rows of SPLITS) {
			const last = rows[rows.length - 1];
			const truncated = price(WITNESS, [last]);

			console.log(
				`  split [${rows.join(' + ')}] -> upsert keeps ${last.toFixed(2)}h: ` +
					`${truncated.verdict} at ${truncated.marginalValue.toFixed(4)}/h ` +
					`(${(truncated.marginalValue / truth.marginalValue).toFixed(2)}× the true price` +
					`${truncated.verdict === truth.verdict ? '' : ', VERDICT FLIPPED'})`,
			);
		}
	});

	it('counts how far the truncation reaches on app-reachable tasks', () => {
		const tasks = drawTasks(DAYS, SEED);
		let flipped = 0;
		let overPriced = 0;
		let worstGap = 0;
		let worstTask = '';

		// The same 3h-then-1.5h day §18 quotes, on each drawn task.
		for (const task of tasks) {
			const truth = price(task, [4.5]);
			const truncated = price(task, [1.5]);

			if (truncated.marginalValue > truth.marginalValue) overPriced++;

			if (truncated.verdict !== truth.verdict) flipped++;

			if (truncated.marginalValue - truth.marginalValue > worstGap) {
				worstGap = truncated.marginalValue - truth.marginalValue;
				worstTask = `d=${task.difficulty.toFixed(1)} e=${task.enjoyment} w=(${task.cognitiveDemand}, ${task.physicalDemand})`;
			}
		}

		console.log(
			`${DAYS} seeded app tasks (seed ${SEED.toString(16)}), 3h+1.5h day: ` +
				`truncated price higher on ${overPriced}, ` +
				`verdict flipped on ${flipped} (${((flipped / DAYS) * 100).toFixed(1)}%), ` +
				`worst absolute gap ${worstGap.toFixed(4)}/h on ${worstTask}`,
		);

		// §18's own witness demands, at the difficulty `toEnergyTask` gives them.
		const reachable = toEnergyTask({
			id: 1,
			title: 'sliders 8/2',
			mentalDifficulty: 8,
			physicalDifficulty: 2,
			enjoyment: 6,
			createdAt: '2026-08-18',
			completed: false,
		});

		console.log(
			`w = (0.8, 0.2) through toEnergyTask is difficulty ${reachable.difficulty} ` +
				`(sliders 8/2), not 7:`,
		);

		line('  8.6, w=(0.8,0.2): 3h', reachable, [3]);
		line('  8.6, w=(0.8,0.2): upsert 1.5h', reachable, [1.5]);
		line('  8.6, w=(0.8,0.2): true 4.5h', reachable, [3, 1.5]);

		console.log(`(one step = ${(DEFAULT_STEP_HOURS * 60).toFixed(0)}min)`);
	});
});
