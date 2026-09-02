/**
 * §0 — the task importance weight `v`: where it has reach, what leaving it
 * undeclared costs, and what a remembered-but-wrong one costs instead.
 *
 * ROADMAP item 23 gated itself on a histogram of ONE person's stored
 * `DailySession.availableHours` — kill the item if the day is habitually planned
 * at >= 6 h. That is an audience question answered at n = 1, and it drops the term
 * that decides the answer. This measures the model instead, which needs no users.
 *
 * Every day below is drawn ON SURFACE: the two 0-10 difficulty sliders and the
 * 1-10 enjoyment slider the form collects, through `toPooledInputs`, so
 * `difficulty` and the two pool weights are coupled the way the app couples them.
 * Days drawn with the three independent are not reachable, so the figures this
 * file used to carry are not comparable to these and are gone. The draw is 1-10
 * on all three, which leaves out the reachable 0 row on the two difficulties —
 * the region `getEffectiveDifficulty`'s clamp to [1,10] and a zero pool weight
 * govern. That is the range every §17-style generator in this repo uses, and
 * comparability with ROADMAP Phase 2's figures is what ARM D-ref is for.
 *
 * ARM A — unfunded share and contested days, by budget x task count. A day is
 * CONTESTED when something is funded and something is not: the shape of day on
 * which `v` can PROMOTE. Reads 0.0% contested at 6 h with 3 tasks and 40.7% with
 * 8 — which is the hours-only kill rule failing, not the item.
 *
 * ARM B — the same, swept by budget PER TASK, which is what governs promotion.
 * 100% contested at 0.25 and 0.4 h/task at every task count; at 0.5 h/task the
 * count decides — 33.3% (n = 3), 70.7% (n = 5), 95.7% (n = 8), 100% (n = 12);
 * 5.7-38.0% at 0.75. It does not then reach zero and stay there: 0.9 h/task reads
 * 5.3 / 4.7 / 12.3 / 1.0%, and contested days survive at 1 h (up to 2.3%), at
 * 1.25 h (up to 2.0%) and at 2 h (1.0% at n = 12). Only 1.5 h/task is 0.0% at all
 * four counts, and 2 h is not, so there is no budget above which promotion stops.
 *
 * ARM C — what the weight buys where it can promote: on contested days, raise one
 * unfunded task to `high` and re-solve. It funds the raised task on 94.3-100% of
 * contested days. Six of the nineteen cells with any contested day fall short of
 * 100%: 99.3 (n = 3, 1 h), 98.3 / 99.7 (n = 5, 1 and 1.5 h) and 94.3 / 99.3 / 99.7
 * (n = 8, 1, 1.5 and 3 h) — the short, crowded end, where the day cannot buy a
 * block even for a doubled task. Every other cell is 100%. So wherever the weight
 * can promote at all it almost always delivers the promotion the three levels
 * promise, and on this surface it does so more reliably than the old figures read.
 *
 * ARM D — what an UNDECLARED importance costs in the objective rather than in
 * funded sets: plan with every task `normal`, score both plans under the day's
 * true `v`. At the Phase-2-comparable scope (400 days, 3-7 tasks, budget drawn
 * from {2,4,4,6,8}) one `high` in the day costs 4.45% mean / 3.69% median /
 * 8.87% p90 and moves 95.5% of days; one `low` 2.83 / 2.38 / 6.02 and 84.5%;
 * both together 8.08 / 6.83 / 14.99 and 99.3%; half the day `high`
 * 5.39 / 4.51 / 9.87 and 96.5%; every task declared 10.08 / 8.00 / 22.19 and
 * 94.8%. Across the grid the loss falls with budget per task and never to
 * nothing: `1 high` runs 13.95% (0.25 h/task, n = 3) down to 1.64% (2 h, n = 3),
 * `all declared` 21.48% (0.25 h/task, n = 8) down to 2.41% (2 h, n = 3). Not
 * monotonically, though: at n = 8, `1 low`, `half high` and `all declared` all
 * turn back up on the last rung, so there is no budget per task to plan past.
 * `helped` — days the flat plan scores HIGHER on under the true `v` — is 0 in
 * most cells and never above 12 of 300 (2 h/task, n = 8, `1 low`). That is the
 * block-greedy allocator's inexactness, priced; it is not a case for silence.
 *
 * ARM E — what a STALE importance costs instead: `high` remembered on task k when
 * task j is the important one this week, planned under that and scored under the
 * truth, on ARM D's own `1 high` days. It costs MORE than declaring nothing in
 * ALL EIGHTEEN cells, by 1.96x-2.97x on the mean — 33.67% against 13.95% at
 * 0.25 h/task (n = 3), 4.10% against 2.02% at 2 h (n = 8) — and it moves the plan
 * on 96.3-100% of days against the flat arm's 78.3-98.3%. So a remembered weight
 * is worse than no weight wherever it is wrong, and importance is not a field a
 * title may carry forward on its own.
 *
 * ARM F — where the weight actually reaches. On the days the FLAT plan already
 * funds EVERY task, at 0.9 h/task and above — the rungs ARM B USED to read as
 * inert, before the generator went on surface — the two plans still allocate
 * differently on 83.3-100% of them, for 1.00-12.34% of the day's value on the mean
 * and 2.28-19.62% at p90. So the item has reach at every budget measured, and the
 * contested share is a lower bound on that reach rather than a measure of it: at
 * 1.5 h/task, where no day is contested at any count, the flat plan still gives up
 * 1.00-6.68% of the day. A 6-hour day at 3 tasks funds everything and is not inert
 * either — at 2 h/task with one `high` in the day the plans differ on 98.3% of
 * days for 1.64% of the value.
 */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { toPooledInputs } from '$lib/business/model/metric/calculation';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_SWITCH_COST,
	DEFAULT_USER_CONSTANTS,
	IMPORTANCE_WEIGHT,
	calculatePooledAllocations,
	calculateTotalProductivity,
	type PooledTaskInput,
} from '$lib/business/model/zenith';
import type { Task, TaskImportance } from '$lib/data/type';

const BUDGETS = [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const PER_TASK = [0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2];
/** ARMS D/E: a subset, because every day there costs two full solves. */
const LOSS_PER_TASK = [0.25, 0.5, 0.75, 1, 1.5, 2];
/** ARM F: 0.9 h/task and up — what ARM B read as inert before the surface fix. */
const INERT_PER_TASK = [0.9, 1, 1.25, 1.5, 2];
const TASK_COUNTS = [3, 5, 8];
/** ARM D-ref: the scope ROADMAP Phase 2's framing paragraph was measured at. */
const REF_DAYS = 400;
const REF_BUDGETS = [2, 4, 4, 6, 8];
const MIXES = ['1 high', '1 low', '1 high + 1 low', 'half high', 'all declared'] as const;
const LEVELS: TaskImportance[] = ['low', 'normal', 'high'];

type Mix = (typeof MIXES)[number];
type Draw = {
	tasks: Task[];
	budget: number;
};

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

/**
 * A day drawn ON SURFACE: three integer sliders per task, which is the only thing
 * the app collects. `difficulty` and the two pool weights are then whatever
 * `toPooledInputs`/`getEffectiveDifficulty` make of them, never independent draws
 * — the coupling is the surface, and a day off it is not reachable. Drawn 1–10;
 * the form's two difficulties admit 0 as well, and the header says what that
 * leaves out.
 */
function makeTasks(random: () => number, taskCount: number): Task[] {
	return Array.from(
		{
			length: taskCount,
		},
		(unused, i) => ({
			id: i,
			title: `t${i}`,
			physicalDifficulty: 1 + Math.floor(random() * 10),
			mentalDifficulty: 1 + Math.floor(random() * 10),
			enjoyment: 1 + Math.floor(random() * 10),
			createdAt: '2026-09-03',
			completed: false,
		}),
	);
}

const makeDay = (random: () => number, taskCount: number): PooledTaskInput[] =>
	toPooledInputs(makeTasks(random, taskCount));

const withImportance = (tasks: Task[], levels: TaskImportance[]): Task[] =>
	tasks.map((task, i) => ({
		...task,
		importance: levels[i],
	}));

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

/**
 * The day's TRUE `v`, under one mix. Every cell has its own seed (`lossSeed`), so
 * two mixes are two samples of days rather than one sample read twice.
 */
function trueLevels(mix: Mix, random: () => number, taskCount: number): TaskImportance[] {
	const levels: TaskImportance[] = Array.from(
		{
			length: taskCount,
		},
		() => 'normal',
	);

	// Drawn before the branch, and unconditionally: two of the mixes below ignore
	// it, and moving it inside the branch would move their days.
	const j = Math.floor(random() * taskCount);

	if (mix === 'all declared') return levels.map(() => LEVELS[Math.floor(random() * 3)]);

	if (mix === 'half high')
		return levels.map((level, i) => (i < Math.ceil(taskCount / 2) ? 'high' : level));

	levels[j] = mix === '1 low' ? 'low' : 'high';

	if (mix === '1 high + 1 low') levels[(j + 1) % taskCount] = 'low';

	return levels;
}

/**
 * What the PLANNER believes. Flat is every task undeclared; stale keeps one `high`
 * but on the neighbouring task — a weight remembered from a week when THAT one was
 * the important task, not a weight graded one step wrong.
 */
function planLevels(levels: TaskImportance[], stale: boolean): TaskImportance[] {
	const flat: TaskImportance[] = levels.map(() => 'normal');

	if (!stale) return flat;

	flat[(levels.indexOf('high') + 1) % levels.length] = 'high';

	return flat;
}

type LossStats = {
	days: number;
	mean: number;
	median: number;
	p90: number;
	moved: number;
	helped: number;
};

function summarize(losses: number[], moved: number, helped: number): LossStats {
	const sorted = [...losses].sort((a, b) => a - b);

	return {
		days: losses.length,
		mean: losses.length === 0 ? 0 : losses.reduce((sum, loss) => sum + loss, 0) / losses.length,
		median: sorted[Math.floor(sorted.length / 2)] ?? 0,
		p90: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
		moved,
		helped,
	};
}

/**
 * One cell of ARMS D/E/F: plan each day under `planLevels`, score it under the
 * true `v` with `calculateTotalProductivity`, and report the relative loss against
 * the plan that knew the truth. `fundedPlan` is the same reading restricted to the
 * days on which the PLAN funds every task — ARM F's population, where the weight
 * cannot act by promoting anything.
 */
function lossCell(
	days: number,
	seed: number,
	mix: Mix,
	stale: boolean,
	drawDay: (random: () => number) => Draw,
) {
	const random = makeRandom(seed);
	const losses: number[] = [];
	const fundedLosses: number[] = [];
	let moved = 0;
	let helped = 0;
	let fundedMoved = 0;
	let fundedHelped = 0;

	for (let day = 0; day < days; day++) {
		const { tasks, budget } = drawDay(random);
		const levels = trueLevels(mix, random, tasks.length);
		const scored = toPooledInputs(withImportance(tasks, levels));
		const planned = toPooledInputs(withImportance(tasks, planLevels(levels, stale)));
		const bestHours = solve(scored, budget);
		const planHours = solve(planned, budget);
		const best = calculateTotalProductivity(scored, bestHours);
		const loss = best > 0 ? (best - calculateTotalProductivity(scored, planHours)) / best : 0;
		const differs = bestHours.some((hours, i) => hours !== planHours[i]) ? 1 : 0;

		losses.push(loss);
		moved += differs;
		helped += loss < 0 ? 1 : 0;

		if (planHours.includes(0)) continue;

		fundedLosses.push(loss);
		fundedMoved += differs;
		fundedHelped += loss < 0 ? 1 : 0;
	}

	return {
		all: summarize(losses, moved, helped),
		fundedPlan: summarize(fundedLosses, fundedMoved, fundedHelped),
	};
}

const lossSeed = (taskCount: number, perTask: number, mix: Mix) =>
	taskCount * 7919 + Math.round(perTask * 1000) + MIXES.indexOf(mix) * 131;

const gridDay = (taskCount: number, perTask: number) => (random: () => number) => ({
	tasks: makeTasks(random, taskCount),
	budget: perTask * taskCount,
});

/** ARM D-ref's day: 3–7 tasks, budget from {2,4,4,6,8} — Phase 2's own generator. */
const refDay = (random: () => number) => {
	const taskCount = 3 + Math.floor(random() * 5);
	const tasks = makeTasks(random, taskCount);

	return {
		tasks,
		budget: REF_BUDGETS[Math.floor(random() * REF_BUDGETS.length)],
	};
};

const pct = (value: number) => `${(100 * value).toFixed(2)}%`.padStart(8);

const movedPct = (part: number, whole: number) =>
	whole === 0 ? '      —' : `${((100 * part) / whole).toFixed(1)}%`.padStart(7);

const FIVE_HEAD = '    mean   median      p90    moved      helped';

const fiveColumns = (stats: LossStats) =>
	`${pct(stats.mean)} ${pct(stats.median)} ${pct(stats.p90)}  ` +
	`${movedPct(stats.moved, stats.days)}  ${`${stats.helped} of ${stats.days}`.padStart(10)}`;

describe('§0 — task importance weight', () => {
	it('measures the weight’s reach, and what a missing or stale one costs', () => {
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

		log('');
		log('ARM D — what an UNDECLARED importance costs: every task planned `normal`,');
		log('scored under the day’s true `v`. loss = (V_true − V_flat) / V_true.');
		log(`  h/task   n  mix            ${FIVE_HEAD}`);

		const flatCells = new Map<string, ReturnType<typeof lossCell>>();

		for (const perTask of LOSS_PER_TASK) {
			for (const taskCount of TASK_COUNTS) {
				for (const mix of MIXES) {
					const cell = lossCell(
						daysFor(taskCount),
						lossSeed(taskCount, perTask, mix),
						mix,
						false,
						gridDay(taskCount, perTask),
					);

					flatCells.set(`${taskCount}|${perTask}|${mix}`, cell);

					log(
						`  ${String(perTask).padStart(5)}h  ${String(taskCount).padStart(2)}  ` +
							`${mix.padEnd(14)} ${fiveColumns(cell.all)}`,
					);
				}
			}
		}

		log('');
		log(`ARM D-ref — the Phase-2-comparable cell: ${REF_DAYS} days, 3–7 tasks per day,`);
		log('budget drawn from {2,4,4,6,8}, sliders on surface.');
		log(`  mix            ${FIVE_HEAD}`);

		for (const mix of MIXES) {
			const cell = lossCell(REF_DAYS, 0x5eed + MIXES.indexOf(mix) * 977, mix, false, refDay);

			log(`  ${mix.padEnd(14)} ${fiveColumns(cell.all)}`);
		}

		log('');
		log('ARM E — what a STALE importance costs: `high` remembered on task k ≠ j, the');
		log('same days as ARM D’s `1 high` cell. `larger` names the costlier of the two.');
		log(`  h/task   n ${FIVE_HEAD}   flat mean  larger`);

		for (const perTask of LOSS_PER_TASK) {
			for (const taskCount of TASK_COUNTS) {
				const stale = lossCell(
					daysFor(taskCount),
					lossSeed(taskCount, perTask, '1 high'),
					'1 high',
					true,
					gridDay(taskCount, perTask),
				).all;

				const flat = flatCells.get(`${taskCount}|${perTask}|1 high`)!.all;

				log(
					`  ${String(perTask).padStart(5)}h  ${String(taskCount).padStart(2)} ` +
						`${fiveColumns(stale)}  ${pct(flat.mean)}  ` +
						`${stale.mean > flat.mean ? 'STALE' : 'flat '}`,
				);
			}
		}

		log('');
		log('ARM F — reach on the days the FLAT plan funds EVERY task, at the rungs ARM B');
		log('reads inert. `differ%` is the share of those days whose allocation vectors');
		log('move between the flat and the true plan.');
		log('  h/task   n  mix            fundedAll   differ%      mean       p90');

		for (const perTask of INERT_PER_TASK) {
			for (const taskCount of TASK_COUNTS) {
				for (const mix of MIXES) {
					const key = `${taskCount}|${perTask}|${mix}`;

					// The ARM D grid overlaps this one on three rungs; those cells are
					// the same days under the same seed, so they are read, not re-solved.
					const { fundedPlan } =
						flatCells.get(key) ??
						lossCell(
							daysFor(taskCount),
							lossSeed(taskCount, perTask, mix),
							mix,
							false,
							gridDay(taskCount, perTask),
						);

					log(
						`  ${String(perTask).padStart(5)}h  ${String(taskCount).padStart(2)}  ` +
							`${mix.padEnd(14)} ${String(fundedPlan.days).padStart(9)}  ` +
							`${movedPct(fundedPlan.moved, fundedPlan.days)}  ${pct(fundedPlan.mean)}  ${pct(fundedPlan.p90)}`,
					);
				}
			}
		}

		writeFileSync(process.env.PROBE_OUT ?? 'task-importance.probe.txt', out.join('\n'));
	});
});
