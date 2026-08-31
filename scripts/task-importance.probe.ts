/**
 * §0 — the task importance weight `v`: where it has reach, and what it moves.
 *
 * ROADMAP item 23 gated itself on a histogram of ONE person's stored
 * `DailySession.availableHours` — kill the item if the day is habitually planned
 * at >= 6 h. That is an audience question answered at n = 1, and it drops the term
 * that decides the answer. This measures the model instead, which needs no users.
 *
 * The reach argument: `v` can only re-rank tasks the allocator currently leaves at
 * zero hours (it cannot move a funded task's stopping time — MATH.md §3). So the
 * item is dead on any day that funds everything, however important its tasks are.
 *
 * ARM A — unfunded share and contested days, by budget × task count. A day is
 * CONTESTED when something is funded and something is not: the only shape of day
 * `v` can act on. Reads 0.0% contested at 6 h with 3 tasks and 3.7% with 8 —
 * which is the hours-only kill rule failing, not the item.
 *
 * ARM B — the same, swept by budget PER TASK, which is what actually governs it.
 * 100% contested at 0.25 and 0.4 h/task at every task count; at 0.5 h/task the
 * count decides — 8.7% (n = 3), 26.0% (n = 5), 55.7% (n = 8), 82.0% (n = 12);
 * 0.3–7.0% at 0.75; and exactly 0.0% at 0.9 h/task and above at every count from
 * 3 to 12. So the item has reach below ~0.9 h per task and none above it, and a
 * 6-hour day is inert at 3 tasks and squarely live at 12.
 *
 * ARM C — what the weight buys, once it exists: on contested days, raise one
 * unfunded task to `high` and re-solve. It funds the raised task on 92.3–100% of
 * contested days. Seven of the twenty cells with any contested day fall short of
 * 100%: 98.0 (n = 3, 1 h), 94.3 / 97.3 (n = 5, 1 and 1.5 h) and 92.3 / 93.7 /
 * 97.0 / 99.3 (n = 8, 1 through 3 h) — the short, crowded end, where the day
 * cannot buy a block even for a doubled task. Every other cell is 100%. So
 * wherever the weight has reach at all, it almost always delivers the promotion
 * the three levels promise.
 */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	IMPORTANCE_WEIGHT,
	calculatePooledAllocations,
	type PooledTaskInput,
} from '$lib/business/model/zenith';

const BUDGETS = [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const PER_TASK = [0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2];
const TASK_COUNTS = [3, 5, 8];
/** n = 12 runs the full 2ⁿ funded-subset enumeration, so it gets fewer days. */
const daysFor = (taskCount: number) => (taskCount >= 12 ? 100 : 300);

/** Deterministic LCG, so every number here is re-runnable rather than re-rollable. */
function makeRandom(seed: number) {
	let state = seed >>> 0;

	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;

		return state / 0x100000000;
	};
}

function makeDay(random: () => number, taskCount: number): PooledTaskInput[] {
	return Array.from(
		{
			length: taskCount,
		},
		(unused, i) => ({
			title: `t${i}`,
			difficulty: 1 + Math.floor(random() * 10),
			enjoyment: 1 + Math.floor(random() * 10),
			cognitiveWeight: random(),
			physicalWeight: random(),
		}),
	);
}

const solve = (tasks: PooledTaskInput[], budget: number) =>
	calculatePooledAllocations(
		tasks,
		budget,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
		DEFAULT_SWITCH_COST,
	).map((allocation) => allocation.allocatedHours);

const percent = (part: number, whole: number) =>
	whole === 0 ? '     —' : ((100 * part) / whole).toFixed(1).padStart(6);

/** One cell: how a random sample of days at this size and budget divides up. */
function sampleCell(taskCount: number, budget: number, seed: number) {
	const random = makeRandom(seed);
	const days = daysFor(taskCount);
	let unfunded = 0;
	let contested = 0;
	let fundedAll = 0;
	let promoted = 0;

	for (let day = 0; day < days; day++) {
		const tasks = makeDay(random, taskCount);
		const hours = solve(tasks, budget);
		const zeroes = hours.filter((h) => h === 0).length;

		unfunded += zeroes;

		if (zeroes === 0) {
			fundedAll++;
			continue;
		}

		if (zeroes === taskCount) continue;

		contested++;

		// ARM C: the first unfunded task, raised to `high` and re-solved.
		const target = hours.indexOf(0);

		const raised = tasks.map((task, i) => ({
			...task,
			importanceWeight: i === target ? IMPORTANCE_WEIGHT.high : IMPORTANCE_WEIGHT.normal,
		}));

		if (solve(raised, budget)[target] > 0) promoted++;
	}

	return {
		days,
		unfundedShare: percent(unfunded, days * taskCount),
		contestedShare: percent(contested, days),
		fundedAllShare: percent(fundedAll, days),
		promotedShare: percent(promoted, contested),
	};
}

describe('§0 — task importance weight', () => {
	it('measures the weight’s reach, and what raising one task buys', () => {
		const out: string[] = [];
		const log = (line: string) => out.push(line);

		log('ARM A/C — by budget. `promoted` is the share of CONTESTED days on which');
		log('raising one unfunded task to `high` funds it.');
		log('   n  budget  unfunded%  contested%  fundedAll%  promoted%');

		for (const taskCount of TASK_COUNTS) {
			for (const budget of BUDGETS) {
				const cell = sampleCell(taskCount, budget, taskCount * 7919 + Math.round(budget * 100));

				log(
					`  ${String(taskCount).padStart(2)}  ${String(budget).padStart(5)}h ${cell.unfundedShare}    ` +
						`${cell.contestedShare}     ${cell.fundedAllShare}    ${cell.promotedShare}`,
				);
			}

			log('');
		}

		log('ARM B — contested% by budget PER TASK, which is what governs reach.');
		log('  h/task     n=3     n=5     n=8    n=12');

		for (const perTask of PER_TASK) {
			const cells = [3, 5, 8, 12].map(
				(taskCount) =>
					sampleCell(
						taskCount,
						perTask * taskCount,
						taskCount * 104729 + Math.round(perTask * 1000),
					).contestedShare,
			);

			log(`  ${String(perTask).padStart(5)}h  ${cells.join('  ')}`);
		}

		writeFileSync(process.env.PROBE_OUT ?? 'task-importance.probe.txt', out.join('\n'));
	});
});
