/**
 * The measurement behind MATH.md §30 — what the `/energy` comparison tile
 * reports, against the objective the plan above it was chosen to maximize.
 *
 * The tile divided `totalOutput` — raw Σ block output, the ONE field of
 * `ScheduleEvaluation` the optimizer does not maximize (§8.4: it maximizes
 * `satiatedOutput + freeTimeBonus + terminalBonus`). This probe measures the
 * gap: how often the two disagree in sign, and by how much. It reads +61%
 * median against the objective's +17%, which is why `valueVsClassic` now
 * divides `objective`; the `totalOutput` row stays here as the before.
 *
 * Also checks the conversion itself: that the Lab's blocks (interleaved order,
 * switch costs as rest gaps) fit the window, so `normalizeSchedule` never clips
 * work off the classic side.
 *
 * Same draw as `mode-cross-scoring.probe.ts` (seed 0x290729, 300 days, 2–6
 * tasks, 3–11 h) so the two are comparable line for line.
 *
 * A probe, not a test. Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
} from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	type ScheduleBlock,
	evaluateSchedule,
	optimizeSchedule,
} from '$lib/business/model/zenith-energy';
import {
	calculateInterleavedOrder,
	calculateTaskPlan,
	toEnergyTask,
} from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

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
const SEED = 0x290729;

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
					length: pick(2, 6, 1),
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
			budget: pick(3, 11, 0.25),
		}),
	);
}

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((x, y) => x - y);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const percent = (value: number, base: number) => ((value - base) / base) * 100;
const fmt = (x: number) => x.toFixed(2);

/** Exactly `EnergyLabStore.#classicEvaluation`'s block construction. */
function classicBlocks(
	funded: { id: number; suggestedHours: number }[],
	switchCost: number,
): ScheduleBlock[] {
	const blocks: ScheduleBlock[] = [];

	funded.forEach((task, index) => {
		if (index > 0 && switchCost > 0)
			blocks.push({
				taskId: null,
				hours: switchCost,
			});

		blocks.push({
			taskId: task.id,
			hours: task.suggestedHours,
		});
	});

	return blocks;
}

describe('output vs the classic plan (the /energy summary tile)', () => {
	it('raw output vs the objective the plan maximizes', () => {
		const days = drawDays(DAYS, SEED);
		const tileValues: number[] = [];
		const rawGaps: number[] = [];
		const satiatedGaps: number[] = [];
		const objectiveGaps: number[] = [];
		const perHourGaps: number[] = [];
		const workGaps: number[] = [];
		let tileNegativeButObjectiveWins = 0;
		let tilePositiveButObjectiveLoses = 0;
		let objectiveLosses = 0;
		let negativeZeroDisplays = 0;
		let clipped = 0;
		let maxOverflow = 0;
		let nullTiles = 0;

		for (const day of days) {
			const energyTasks = day.tasks.map(toEnergyTask);

			const plan = calculateTaskPlan(
				day.tasks,
				day.budget,
				DEFAULT_SWITCH_COST,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
			);

			const funded = calculateInterleavedOrder(plan.suggestedTasks);
			const blocks = classicBlocks(funded, DEFAULT_SWITCH_COST);
			const demanded = blocks.reduce((sum, b) => sum + b.hours, 0);

			if (demanded > day.budget + 1e-9) {
				clipped++;
				maxOverflow = Math.max(maxOverflow, demanded - day.budget);
			}

			const energy = optimizeSchedule(
				energyTasks,
				day.budget,
				DEFAULT_ENERGY_PARAMS,
				DEFAULT_USER_CONSTANTS,
			);

			const classic = evaluateSchedule(
				blocks,
				energyTasks,
				day.budget,
				DEFAULT_ENERGY_PARAMS,
				DEFAULT_USER_CONSTANTS,
			);

			if (funded.length === 0 || classic.totalOutput <= 0) {
				nullTiles++;

				continue;
			}

			const rawGap = percent(energy.evaluation.totalOutput, classic.totalOutput);
			const satiatedGap = percent(energy.evaluation.satiatedOutput, classic.satiatedOutput);
			const objectiveGap = percent(energy.evaluation.objective, classic.objective);

			// The tile compares two plans that work different amounts of the same
			// window (§15: 92% vs 81% of budget). Per worked hour separates "works
			// better" from "works more".
			perHourGaps.push(
				percent(
					energy.evaluation.totalOutput / energy.evaluation.workHours,
					classic.totalOutput / classic.workHours,
				),
			);

			workGaps.push(percent(energy.evaluation.workHours, classic.workHours));
			const tile = Math.round(rawGap);

			tileValues.push(tile);
			rawGaps.push(rawGap);
			satiatedGaps.push(satiatedGap);
			objectiveGaps.push(objectiveGap);

			if (objectiveGap < 0) objectiveLosses++;

			if (tile < 0 && objectiveGap > 0) tileNegativeButObjectiveWins++;

			if (tile >= 0 && objectiveGap < 0) tilePositiveButObjectiveLoses++;

			// `Math.round(-0.4)` is -0: `-0 >= 0` is true, so the tile renders "+0%"
			// in the success colour for a plan that lost.
			if (Object.is(tile, -0)) negativeZeroDisplays++;
		}

		const dist = (label: string, xs: number[]) =>
			console.log(
				`${label.padEnd(22)} mean ${fmt(mean(xs)).padStart(7)}%  p10 ${fmt(quantile(xs, 0.1)).padStart(7)}%` +
					`  median ${fmt(quantile(xs, 0.5)).padStart(7)}%  p90 ${fmt(quantile(xs, 0.9)).padStart(7)}%` +
					`  wins ${xs.filter((x) => x > 0).length}/${xs.length}`,
			);

		console.log(`\n${DAYS} days, seed 0x${SEED.toString(16)}; null tiles: ${nullTiles}\n`);
		console.log('energy plan vs classic plan, per scoring:');
		dist('  totalOutput (TILE)', rawGaps);
		dist('  satiatedOutput', satiatedGaps);
		dist('  objective', objectiveGaps);
		dist('  output per worked h', perHourGaps);
		dist('  worked hours', workGaps);

		console.log("\ntile vs the optimizer's own verdict:");

		console.log(
			`  objective losses (lattice, §15):        ${objectiveLosses}/${tileValues.length}`,
		);

		console.log(`  tile shows ≤ −1% while objective wins:  ${tileNegativeButObjectiveWins}`);
		console.log(`  tile shows ≥ 0% while objective loses:  ${tilePositiveButObjectiveLoses}`);
		console.log(`  tile renders "+0%" green for a loss:    ${negativeZeroDisplays}`);

		console.log(
			`  tile ≤ 0 (reads as "no gain"):          ${tileValues.filter((t) => t <= 0).length}/${tileValues.length}`,
		);

		console.log('\nclassic conversion fits the window:');
		console.log(`  days clipped by normalizeSchedule:      ${clipped}/${DAYS}`);
		console.log(`  worst overflow:                         ${fmt(maxOverflow)} h`);
	});
});
