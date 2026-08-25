/**
 * What is true of Time Scarcity (`calculateTimeScarcity`) over a
 * day space the allocator actually produces, and what moving its switch bill
 * from the LISTED tasks to the FUNDED ones changed.
 *
 * The row reads `max(0, (Σϕ − max(0, budget − (m−1)·s)) / Σϕ) × 100`: demand
 * over the whole list, switches over the m tasks the plan funds. Billing
 * (n−1)·s instead priced a schedule the plan does not merely leave unplanned
 * but cannot run — the defect already removed from the gain's naive
 * baseline. Five questions:
 *
 * A  How far apart are the two bills on a day the allocator produced?
 * B  How much of the listed bill's range was the 100 it pinned at as soon as
 *    (n−1)·s reached the budget, making a 20-minute day and a 90-minute one
 *    indistinguishable?
 * C  Monotonicity in the declared budget, over every switch cost the field can
 *    declare. A budget step that seats Δm more tasks bills Δm·s against a budget
 *    that grew by one BLOCK_HOURS, so a rise needs Δm·s > BLOCK_HOURS: the rate
 *    is neither constant in `s` nor monotone in it, and it fires BELOW the block.
 *    Printed with the Δm distribution of the rising steps, which is why the
 *    default 15m reads 0 here — a rise needs Δm ≥ 2 at that cost and this sample
 *    drew none, so the default is unprotected, not immune. Deliberate, following
 *    Burnout Risk (`business/model/AGENTS.md`) — measured here, not judged.
 * D  Monotonicity in the task count: one more task asks for one more ϕ against
 *    the same clock, so the reading must not fall.
 * E  What the phantom switch was worth to ONE defer: the highest-priority
 *    unfunded task dropped from the input and re-solved. Under the listed bill
 *    that freed a switch nobody was making, which is the axis bias the fix
 *    removes. Not the advice lever, which emits a candidate per active
 *    non-`mustDoToday` task — funded ones included — and reports a Pareto
 *    frontier; this arm prices a single candidate.
 *
 * Parameters, since the rates are read off them: seed 20260825; 1200 days for
 * arms A, B, D and E, the first 200 of them for arm C's lattice walk; n ∈ [2, 8]
 * tasks with integer 1–10 sliders; the declared budget on `BUDGET_BOUNDS.step`
 * but capped at 16h, NOT the 24h `BUDGET_BOUNDS.max` allows, because the space is
 * days a person declares; switch cost on the field's own 5-minute step.
 *
 * A probe, not a test: every rate below moves whenever the allocator moves.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	calculateSuggestedTasks,
	calculateTimeScarcity,
	type SuggestedTask,
} from '$lib/business/model/metric/calculation';
import { BUDGET_BOUNDS } from '$lib/presentation/utils/budget-bounds';
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

const SEED = 20260825;
const CELL_COUNT = 1200;
/** Arm C costs 97 budgets × 12 switch costs of 2ⁿ solves per day, so it draws fewer. */
const LATTICE_DAY_COUNT = 200;

/**
 * The switch-cost field is 0–60 minutes in 5-minute steps
 * (`presentation/component/day-constraints-bar.svelte`), and a declared 0 is no
 * switching at all, so the ladder arm C sweeps is every cost that bills one.
 */
const SWITCH_COST_MINUTES = Array.from(
	{
		length: 12,
	},
	(_, step) => 5 * (step + 1),
);

interface Day {
	tasks: Task[];
	budget: number;
	switchCost: number;
}

const percent = (share: number, digits = 1) => `${(100 * share).toFixed(digits)}%`;

const quantile = (sorted: number[], fraction: number) =>
	sorted[Math.floor(fraction * (sorted.length - 1))];

const dump = (tasks: Task[], budget: number, switchCost: number): string =>
	`m/p/e ${tasks.map((t) => `${t.mentalDifficulty}/${t.physicalDifficulty}/${t.enjoyment}`).join(' ')} | ` +
	`${budget}h | s=${Math.round(switchCost * 60)}m`;

const solve = (tasks: Task[], budget: number, switchCost: number): SuggestedTask[] =>
	calculateSuggestedTasks(tasks, budget, switchCost);

const fundedCount = (plan: SuggestedTask[]) =>
	plan.filter((task) => task.suggestedHours > 0).length;

/**
 * The pre-2026-08-25 accounting, over the same plan: the bill was (n − 1)·s
 * across every LISTED task, funded or not. Reproduced here rather than left in
 * `src/` — nothing ships it any more.
 */
function listedScarcity(plan: SuggestedTask[], budget: number, switchCost: number): number {
	const demand = plan.reduce((sum, task) => sum + task.flowStateTime, 0);
	const overhead = plan.length > 1 ? (plan.length - 1) * switchCost : 0;
	const deficit = demand - Math.max(0, budget - overhead);

	return Math.min(100, Math.max(0, Math.round(deficit > 0 ? (deficit / demand) * 100 : 0)));
}

/**
 * Integer sliders 1–10 (a 0 enjoyment is a division by zero, §2), budget on the
 * lattice `BUDGET_BOUNDS` steps by but capped at 16h — a declared day, not the
 * 24 the field allows — and switch cost on the field's own 5-minute step.
 */
function randomDays(count: number, seed: number): Day[] {
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
					length: pick(2, 8, 1),
				},
				(_, index) => ({
					id: index + 1,
					title: `t${index + 1}`,
					mentalDifficulty: pick(1, 10, 1),
					physicalDifficulty: pick(1, 10, 1),
					enjoyment: pick(1, 10, 1),
					createdAt: '2026-08-25',
					completed: false,
				}),
			),
			budget: pick(BUDGET_BOUNDS.step, 16, BUDGET_BOUNDS.step),
			switchCost: pick(0, 60, 5) / 60,
		}),
	);
}

/**
 * One day's walk up the budget lattice at a fixed switch cost, and where the
 * reading RISES as the budget grows — what seating Δm more tasks costs when Δm·s
 * exceeds the block the budget grew by (arm C). `riseDeltas` carries that Δm for
 * each rising step, so the rate can be read as the mechanism.
 */
function budgetWalk(tasks: Task[], switchCost: number, budgets: number[]) {
	const readings = budgets.map((budget) => {
		const plan = solve(tasks, budget, switchCost);

		return {
			budget,
			scarcity: calculateTimeScarcity(plan, budget, switchCost),
			funded: fundedCount(plan),
		};
	});

	const riseDeltas: number[] = [];
	let worstRise = 0;
	let witness = '';

	for (let i = 1; i < readings.length; i++) {
		const rise = readings[i].scarcity - readings[i - 1].scarcity;

		if (rise <= 0) continue;

		riseDeltas.push(readings[i].funded - readings[i - 1].funded);

		if (rise > worstRise) {
			worstRise = rise;

			witness =
				`${dump(tasks, readings[i - 1].budget, switchCost)} reads ${readings[i - 1].scarcity} at ` +
				`m=${readings[i - 1].funded}, and ${readings[i].budget}h reads ${readings[i].scarcity} at m=${readings[i].funded}`;
		}
	}

	return {
		riseDeltas,
		worstRise,
		witness,
	};
}

const CELLS = randomDays(CELL_COUNT, SEED);

/** One solve per (day, budget, switchCost) cell; arms A, B and E all read it. */
const SWEEP = CELLS.map((day) => {
	const plan = solve(day.tasks, day.budget, day.switchCost);

	return {
		day,
		plan,
		funded: fundedCount(plan),
		fundedBill: calculateTimeScarcity(plan, day.budget, day.switchCost),
		listedBill: listedScarcity(plan, day.budget, day.switchCost),
	};
});

describe('Time Scarcity bills the switches the plan makes', () => {
	it('A — the listed bill against the funded one', () => {
		const gaps = SWEEP.map((cell) => cell.listedBill - cell.fundedBill);
		const differing = gaps.filter((gap) => gap !== 0).length;
		const sorted = [...gaps].sort((a, b) => a - b);

		console.log(
			`[A] ${CELL_COUNT} days, seed ${SEED}: the two readings differ on ${percent(differing / CELL_COUNT)} of days; ` +
				`listed − funded over all days p50 ${quantile(sorted, 0.5)} p90 ${quantile(sorted, 0.9)} ` +
				`p99 ${quantile(sorted, 0.99)} max ${sorted.at(-1)} pts`,
		);
	});

	it('B — the saturation the listed bill invented', () => {
		const pinned = SWEEP.filter((cell) => cell.listedBill === 100);
		const below = pinned.filter((cell) => cell.fundedBill < 100);
		const worst = [...below].sort((a, b) => a.fundedBill - b.fundedBill)[0];

		console.log(
			`[B] the listed reading pinned at exactly 100 on ${pinned.length}/${CELL_COUNT} days ` +
				`(${percent(pinned.length / CELL_COUNT)}); the funded reading is below 100 on ${below.length} of them ` +
				`(${percent(below.length / pinned.length)})`,
		);

		console.log(
			`[B] worst witness: funded reads ${worst.fundedBill} where listed read 100 — ` +
				`${dump(worst.day.tasks, worst.day.budget, worst.day.switchCost)}, m=${worst.funded} of n=${worst.day.tasks.length}`,
		);
	});

	it('C — monotonicity in the declared budget, over the switch-cost ladder', () => {
		const budgets = Array.from(
			{
				length: (BUDGET_BOUNDS.max - BUDGET_BOUNDS.min) / BUDGET_BOUNDS.step + 1,
			},
			(_, step) => BUDGET_BOUNDS.min + step * BUDGET_BOUNDS.step,
		);

		const days = CELLS.slice(0, LATTICE_DAY_COUNT);
		const steps = days.length * (budgets.length - 1);

		for (const minutes of SWITCH_COST_MINUTES) {
			const switchCost = minutes / 60;
			const walks = days.map((day) => budgetWalk(day.tasks, switchCost, budgets));
			const deltas = walks.flatMap((walk) => walk.riseDeltas);
			const touched = walks.filter((walk) => walk.riseDeltas.length > 0).length;
			const worst = walks.reduce((best, walk) => (walk.worstRise > best.worstRise ? walk : best));

			console.log(
				`[C] s=${minutes}m: the reading RISES on ${deltas.length}/${steps} budget steps ` +
					`(${percent(deltas.length / steps, 2)}), touching ${percent(touched / days.length)} of ${days.length} days, ` +
					`worst rise +${worst.worstRise} pts; Δm on the rising steps: ` +
					`1 on ${deltas.filter((delta) => delta === 1).length}, 2 on ${deltas.filter((delta) => delta === 2).length}, ` +
					`3+ on ${deltas.filter((delta) => delta >= 3).length}`,
			);

			if (worst.witness) console.log(`[C] s=${minutes}m witness: ${worst.witness}`);
		}
	});

	it('D — monotonicity in the task count', () => {
		let steps = 0;
		let falls = 0;
		let worstFall = 0;
		let witness = '';

		for (const day of CELLS) {
			const readings = day.tasks.map((_, index) => {
				const plan = solve(day.tasks.slice(0, index + 1), day.budget, day.switchCost);

				return {
					scarcity: calculateTimeScarcity(plan, day.budget, day.switchCost),
					funded: fundedCount(plan),
				};
			});

			for (let i = 1; i < readings.length; i++) {
				const fall = readings[i].scarcity - readings[i - 1].scarcity;

				steps++;

				if (fall >= 0) continue;

				falls++;

				if (fall < worstFall) {
					worstFall = fall;

					witness =
						`${dump(day.tasks.slice(0, i + 1), day.budget, day.switchCost)}: ` +
						`${i} tasks read ${readings[i - 1].scarcity} at m=${readings[i - 1].funded}, ` +
						`${i + 1} read ${readings[i].scarcity} at m=${readings[i].funded}`;
				}
			}
		}

		console.log(
			`[D] ${steps} add-a-task steps over ${CELL_COUNT} days: the reading FALLS on ${falls} ` +
				`(${percent(falls / steps, 2)}), worst fall ${worstFall} pts`,
		);

		if (witness) console.log(`[D] witness: ${witness}`);
	});

	it('E — what the phantom switch was worth to one highest-priority-unfunded defer', () => {
		// The plan comes back priority-sorted, so its first `suggestedHours <= 0` is
		// the highest-priority unfunded task — the one the listed bill charged a
		// switch it never made. ONE candidate, not the advice lever.
		const cells = SWEEP.filter((cell) => cell.funded < cell.day.tasks.length);
		const fundedGains: number[] = [];
		const listedGains: number[] = [];

		for (const cell of cells) {
			const deferred = cell.plan.find((task) => task.suggestedHours <= 0)!;
			const kept = cell.day.tasks.filter((task) => task.id !== deferred.id);
			const plan = solve(kept, cell.day.budget, cell.day.switchCost);

			fundedGains.push(
				cell.fundedBill - calculateTimeScarcity(plan, cell.day.budget, cell.day.switchCost),
			);

			listedGains.push(
				cell.listedBill - listedScarcity(plan, cell.day.budget, cell.day.switchCost),
			);
		}

		const stats = (gains: number[]) => {
			const sorted = [...gains].sort((a, b) => a - b);
			const moved = gains.filter((gain) => gain !== 0).length;
			const still = gains.length - moved;

			return (
				`p50 ${quantile(sorted, 0.5)} p90 ${quantile(sorted, 0.9)} max ${sorted.at(-1)} pts, ` +
				`moves the reading at all on ${percent(moved / gains.length)} and leaves it exactly where it was on ` +
				`${still}/${gains.length} days (${percent(still / gains.length)})`
			);
		};

		console.log(
			`[E] ${cells.length}/${CELL_COUNT} days (${percent(cells.length / CELL_COUNT)}) hold at least one unfunded task; ` +
				`deferring the HIGHEST-PRIORITY UNFUNDED one — one candidate, not the advice lever, which emits a candidate per ` +
				`active non-mustDoToday task, funded ones included, and reports a Pareto frontier — improves the FUNDED ` +
				`reading by ${stats(fundedGains)}`,
		);

		console.log(`[E] the same defer improves the LISTED reading by ${stats(listedGains)}`);
	});
});
