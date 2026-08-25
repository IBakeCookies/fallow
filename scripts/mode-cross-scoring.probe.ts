/**
 * The measurement behind MATH.md's "two objectives, two modes": each model
 * beating the other by tens of percent on its own scale, which is the whole
 * reason the energy plan was NOT promoted to the main page (ROADMAP item, and
 * business/AGENTS.md's "neither mode is the better one, so neither owns the day's
 * hours").
 *
 * MATH.md quotes a cross-scoring probe run on 2026-07-29 that was never
 * committed, so none of its numbers could be re-checked. This rebuild follows
 * the description exactly (300 random days, 2–6 tasks, budget 3–11 h, default
 * pools/switch cost/energy params, both plans scored under both objectives)
 * with one thing the text does not give: the seed. The numbers therefore
 * reproduce from here on, and the 2026-07-29 figures cannot be reproduced at
 * all.
 *
 * The two scorings, each through the shipped entry point for its own side:
 *
 *   - classic `Σ P̄`: `calculateTotalProductivity(tasks, hours)`, hours paired
 *     to tasks BY INDEX (business/model/AGENTS.md) — the classic plan's own
 *     `allocatedHours`, and the energy plan's per-task totals in the same
 *     order;
 *   - energy `objective`: `optimizeSchedule().evaluation` for the energy plan,
 *     and for the classic plan the conversion the Lab itself uses
 *     (`EnergyLabStore.#classicEvaluation`): funded tasks in
 *     `calculateInterleavedOrder`, switch costs as rest gaps, one
 *     `evaluateSchedule` over the day window.
 *
 * A probe, not a test: every number moves when either allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	calculateTotalProductivity,
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
	getEffectiveDifficulty,
	toEnergyTask,
} from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

/**
 * The classic objective's own view of a task — the same `difficulty` the
 * allocator plans on (`toPooledInputs`), so `Σ P̄` scores both plans on
 * identical curves.
 */
const toCurveInput = (task: Task) => ({
	title: task.title,
	difficulty: getEffectiveDifficulty(task),
	enjoyment: task.enjoyment,
});

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
		() => {
			const tasks = Array.from(
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
			);

			return {
				tasks,
				budget: pick(3, 11, 0.25),
			};
		},
	);
}

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((x, y) => x - y);
	const index = Math.min(sorted.length - 1, Math.floor(q * sorted.length));

	return sorted[index];
}

const percent = (value: number, base: number) => (base > 0 ? ((value - base) / base) * 100 : NaN);

/** Hours per task from a block schedule, in the day's INPUT task order. */
function hoursByIndex(tasks: Task[], blocks: ScheduleBlock[]): number[] {
	return tasks.map((task) =>
		blocks.reduce((sum, block) => (block.taskId === task.id ? sum + block.hours : sum), 0),
	);
}

/** The Lab's conversion of a classic plan: interleaved order, switches as rest. */
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

interface Scored {
	classicUnderClassic: number;
	energyUnderClassic: number;
	classicUnderEnergy: number;
	energyUnderEnergy: number;
	classicFunded: number;
	energyFunded: number;
	classicWork: number;
	energyWork: number;
	overlap: number;
	isSameSet: boolean;
	/** The energy plan's draw on each pool, in pool-hours. */
	energyCognitiveHours: number;
	energyPhysicalHours: number;
}

function score(day: ProbeDay): Scored {
	const energyTasks = day.tasks.map(toEnergyTask);
	const curveInputs = day.tasks.map(toCurveInput);

	const plan = calculateTaskPlan(
		day.tasks,
		day.budget,
		DEFAULT_SWITCH_COST,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

	const energy = optimizeSchedule(
		energyTasks,
		day.budget,
		DEFAULT_ENERGY_PARAMS,
		DEFAULT_USER_CONSTANTS,
	);

	const energyHours = hoursByIndex(day.tasks, energy.blocks);
	const funded = calculateInterleavedOrder(plan.suggestedTasks);

	const classicEvaluation = evaluateSchedule(
		classicBlocks(funded, DEFAULT_SWITCH_COST),
		energyTasks,
		day.budget,
		DEFAULT_ENERGY_PARAMS,
		DEFAULT_USER_CONSTANTS,
	);

	const classicWork = plan.allocatedHours.reduce((sum, hours) => sum + hours, 0);
	const energyWork = energyHours.reduce((sum, hours) => sum + hours, 0);

	// Composition overlap: Σ min(share of work), 1 = identical distribution.
	const overlap = day.tasks.reduce((sum, _task, index) => {
		const classicShare = classicWork > 0 ? plan.allocatedHours[index] / classicWork : 0;
		const energyShare = energyWork > 0 ? energyHours[index] / energyWork : 0;

		return sum + Math.min(classicShare, energyShare);
	}, 0);

	return {
		classicUnderClassic: calculateTotalProductivity(
			curveInputs,
			plan.allocatedHours,
			DEFAULT_USER_CONSTANTS,
		),
		energyUnderClassic: calculateTotalProductivity(
			curveInputs,
			energyHours,
			DEFAULT_USER_CONSTANTS,
		),
		classicUnderEnergy: classicEvaluation.objective,
		energyUnderEnergy: energy.evaluation.objective,
		classicFunded: plan.allocatedHours.filter((hours) => hours > 0).length,
		energyFunded: energyHours.filter((hours) => hours > 0).length,
		classicWork,
		energyWork,
		overlap,
		isSameSet: day.tasks.every(
			(_task, index) => plan.allocatedHours[index] > 0 === energyHours[index] > 0,
		),
		energyCognitiveHours: day.tasks.reduce(
			(sum, task, index) => sum + energyHours[index] * (task.mentalDifficulty / 10),
			0,
		),
		energyPhysicalHours: day.tasks.reduce(
			(sum, task, index) => sum + energyHours[index] * (task.physicalDifficulty / 10),
			0,
		),
	};
}

describe('two objectives, two modes', () => {
	it('cross-scores both plans under both objectives', () => {
		const days = drawDays(DAYS, 0x2907_29);
		const scored = days.map(score);

		const classicAdvantage = scored.map((s) =>
			percent(s.classicUnderClassic, s.energyUnderClassic),
		);

		const energyAdvantage = scored.map((s) => percent(s.energyUnderEnergy, s.classicUnderEnergy));

		const classicWinsOwn = scored.filter(
			(s) => s.classicUnderClassic > s.energyUnderClassic,
		).length;

		const energyWinsOwn = scored.filter((s) => s.energyUnderEnergy > s.classicUnderEnergy).length;

		console.log(`${DAYS} seeded days, 2–6 tasks, budget 3–11h, default pools/switch/energy params`);

		console.log(
			`[classic plan] under Σ P̄: wins ${classicWinsOwn}/${DAYS}, ` +
				`median ${quantile(classicAdvantage, 0.5).toFixed(1)}%, p90 ${quantile(classicAdvantage, 0.9).toFixed(0)}% | ` +
				`under energy objective: wins ${DAYS - energyWinsOwn}/${DAYS}`,
		);

		console.log(
			`[energy plan] under Σ P̄: wins ${DAYS - classicWinsOwn}/${DAYS} | ` +
				`under energy objective: wins ${energyWinsOwn}/${DAYS}, ` +
				`median ${quantile(energyAdvantage, 0.5).toFixed(1)}%, p90 ${quantile(energyAdvantage, 0.9).toFixed(0)}%`,
		);

		const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
		const overlaps = scored.map((s) => s.overlap);

		console.log(
			`[concentration] funded/day energy ${mean(scored.map((s) => s.energyFunded)).toFixed(2)} ` +
				`vs classic ${mean(scored.map((s) => s.classicFunded)).toFixed(2)}; ` +
				`energy funds MORE on ${scored.filter((s) => s.energyFunded > s.classicFunded).length}/${DAYS} days`,
		);

		console.log(
			`[overlap] Σ min(share) mean ${mean(overlaps).toFixed(2)}, median ${quantile(overlaps, 0.5).toFixed(2)}, ` +
				`p10 ${quantile(overlaps, 0.1).toFixed(2)}; identical funded set on ` +
				`${scored.filter((s) => s.isSameSet).length}/${DAYS} days`,
		);

		const share = (work: (s: Scored) => number) =>
			scored.map((s, index) => (work(s) / days[index].budget) * 100);

		console.log(
			`[work planned] energy ${mean(share((s) => s.energyWork)).toFixed(0)}% of budget ` +
				`(median ${quantile(
					share((s) => s.energyWork),
					0.5,
				).toFixed(0)}%) vs classic ` +
				`${mean(share((s) => s.classicWork)).toFixed(0)}% (median ${quantile(
					share((s) => s.classicWork),
					0.5,
				).toFixed(0)}%)`,
		);

		// The exceptions MATH.md controls for: days the energy plan wins Σ P̄.
		// Re-solve the classic allocator with a budget that hands it exactly the
		// energy plan's work hours plus its own switch overhead, then ask whether
		// the remaining losses are days the pooled allocator was FORBIDDEN to plan.
		const exceptions = days.filter(
			(_day, index) => !(scored[index].classicUnderClassic > scored[index].energyUnderClassic),
		);

		let stillBelow = 0;
		let infeasible = 0;
		const cognitiveLoads: number[] = [];
		const physicalLoads: number[] = [];

		exceptions.forEach((day) => {
			const index = days.indexOf(day);
			const s = scored[index];
			const overhead = s.energyFunded > 1 ? (s.energyFunded - 1) * DEFAULT_SWITCH_COST : 0;

			const rematched = calculateTaskPlan(
				day.tasks,
				s.energyWork + overhead,
				DEFAULT_SWITCH_COST,
				DEFAULT_CAPACITY_POOLS,
				DEFAULT_USER_CONSTANTS,
			);

			const value = calculateTotalProductivity(
				day.tasks.map(toCurveInput),
				rematched.allocatedHours,
				DEFAULT_USER_CONSTANTS,
			);

			if (value >= s.energyUnderClassic) return;

			stillBelow++;

			const isInfeasible =
				s.energyCognitiveHours > DEFAULT_CAPACITY_POOLS.cognitiveHours + 1e-9 ||
				s.energyPhysicalHours > DEFAULT_CAPACITY_POOLS.physicalHours + 1e-9;

			if (isInfeasible) infeasible++;

			cognitiveLoads.push(s.energyCognitiveHours);
			physicalLoads.push(s.energyPhysicalHours);
		});

		console.log(
			`[exceptions] ${exceptions.length} days the energy plan is not beaten under Σ P̄; ` +
				`after the work-hour rematch ${stillBelow} still below, ${infeasible} of those infeasible for the ` +
				`pooled allocator (cognitive ${Math.min(...cognitiveLoads).toFixed(2)}–${Math.max(...cognitiveLoads).toFixed(2)}h ` +
				`vs ${DEFAULT_CAPACITY_POOLS.cognitiveHours}h pool, physical max ${Math.max(...physicalLoads).toFixed(2)}h ` +
				`vs ${DEFAULT_CAPACITY_POOLS.physicalHours}h)`,
		);
	});
});
