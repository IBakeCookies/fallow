/**
 * Is there an "optimal day window" the Lab can recommend, and what is it the
 * argmax of?
 *
 * Three candidate objectives over the budget b, same tasks, same params:
 *
 *   objective(b)  = satiatedOutput + λ₀·(b − work) + terminalBonus   (what the
 *                   optimizer maximizes AT FIXED b)
 *   vvc(b)        = (objective(b) − classicObjective(b)) / classicObjective(b)
 *   net(b)        = objective(b) − λ₀·b
 *                 = satiatedOutput(b) − λ₀·work(b) + terminalBonus(b)
 *
 * net is objective priced against the hours the window CLAIMS: an hour left
 * free inside the window is worth λ₀, and so is the same hour outside it, so
 * the free-time term cancels and only committed work is charged. It is the
 * same λ₀-free work value V the §8.10/§8.11 stop machinery uses, minus λ₀ per
 * worked hour.
 *
 * Usage: npx vitest run --config vitest.probe.config.ts --disableConsoleIntercept <this file>
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

const DAYS = 120;
const SEED = 0x290729;
const MIN_B = 0.75;
const MAX_B = 14;
const STEP = 0.25;

const GRID = Array.from(
	{
		length: Math.round((MAX_B - MIN_B) / STEP) + 1,
	},
	(_, i) => Number((MIN_B + i * STEP).toFixed(2)),
);

function drawDays(count: number, seed: number): Task[][] {
	const random = mulberry32(seed);

	const pick = (min: number, max: number, step: number) =>
		min + Math.round((random() * (max - min)) / step) * step;

	return Array.from(
		{
			length: count,
		},
		() =>
			Array.from(
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
	);
}

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((x, y) => x - y);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const fmt = (x: number) => x.toFixed(2);

const stats = (label: string, xs: number[]) =>
	console.log(
		`  ${label.padEnd(30)} median ${fmt(quantile(xs, 0.5))}  p10 ${fmt(quantile(xs, 0.1))}  ` +
			`p90 ${fmt(quantile(xs, 0.9))}  mean ${fmt(mean(xs))}  min ${fmt(Math.min(...xs))}  max ${fmt(Math.max(...xs))}`,
	);

function classicObjective(tasks: Task[], budget: number, params = DEFAULT_ENERGY_PARAMS) {
	const plan = calculateTaskPlan(
		tasks,
		budget,
		DEFAULT_SWITCH_COST,
		DEFAULT_CAPACITY_POOLS,
		DEFAULT_USER_CONSTANTS,
	);

	const funded = calculateInterleavedOrder(plan.suggestedTasks);

	if (funded.length === 0) return null;

	const blocks: ScheduleBlock[] = [];

	funded.forEach((task, index) => {
		if (index > 0 && DEFAULT_SWITCH_COST > 0)
			blocks.push({
				taskId: null,
				hours: DEFAULT_SWITCH_COST,
			});

		blocks.push({
			taskId: task.id,
			hours: task.suggestedHours,
		});
	});

	return evaluateSchedule(blocks, tasks.map(toEnergyTask), budget, params, DEFAULT_USER_CONSTANTS)
		.objective;
}

/** Smallest b within `tol` of the best — the knee, since net is flat past it. */
function kneeAt(grid: number[], values: number[], tol: number): number {
	const best = Math.max(...values);
	const at = values.findIndex((v) => v >= best - tol);

	return grid[at];
}

describe('an optimal day window', () => {
	it('what each candidate objective picks', () => {
		const days = drawDays(DAYS, SEED);
		const lambda = DEFAULT_ENERGY_PARAMS.freeTimeValue;
		const vvcArgmax: number[] = [];
		const vvcAtEdge: number[] = [];
		const kneeStrict: number[] = [];
		const kneeSlack: number[] = [];
		const objArgmax: number[] = [];
		const workAtKnee: number[] = [];
		const bindingShare: number[] = [];
		let netInversions = 0;
		let netInversionMax = 0;
		let vvcKneeGapHours = 0;
		const vvcMinusKnee: number[] = [];
		const netLostAtVvc: number[] = [];

		for (const tasks of days) {
			const obj: number[] = [];
			const work: number[] = [];
			const vvc: number[] = [];

			for (const b of GRID) {
				const plan = optimizeSchedule(tasks.map(toEnergyTask), b, DEFAULT_ENERGY_PARAMS);
				const e = plan.evaluation;

				obj.push(e.objective);
				work.push(e.workHours);

				const classic = classicObjective(tasks, b);

				vvc.push(classic === null || classic <= 0 ? -Infinity : (e.objective - classic) / classic);
			}

			const net = obj.map((o, i) => o - lambda * GRID[i]);

			for (let i = 1; i < net.length; i++) {
				if (net[i] < net[i - 1] - 1e-9) {
					netInversions++;
					netInversionMax = Math.max(netInversionMax, net[i - 1] - net[i]);
				}
			}

			const bestVvc = vvc.indexOf(Math.max(...vvc));
			const knee = kneeAt(GRID, net, 1e-6);
			const kneeS = kneeAt(GRID, net, 0.01 * Math.abs(Math.max(...net)));

			vvcArgmax.push(GRID[bestVvc]);
			vvcAtEdge.push(bestVvc === 0 || bestVvc === GRID.length - 1 ? 1 : 0);
			kneeStrict.push(knee);
			kneeSlack.push(kneeS);
			objArgmax.push(GRID[obj.indexOf(Math.max(...obj))]);
			workAtKnee.push(work[GRID.indexOf(knee)]);
			bindingShare.push(work[GRID.indexOf(knee)] / knee);
			vvcMinusKnee.push(GRID[bestVvc] - knee);

			if (Math.abs(GRID[bestVvc] - knee) > 0.5) vvcKneeGapHours++;

			const netBest = Math.max(...net);

			netLostAtVvc.push(netBest === 0 ? 0 : ((netBest - net[bestVvc]) / Math.abs(netBest)) * 100);
		}

		console.log(`\n${DAYS} days, budget grid ${MIN_B}–${MAX_B} h @ ${STEP} h, λ₀ = ${lambda}\n`);
		console.log('argmax over the budget of each candidate (hours):');
		stats('vvc  = % vs classic', vvcArgmax);
		stats('objective (unpriced)', objArgmax);
		stats('net  = objective − λ₀·b', kneeStrict);
		stats('net, 1% slack', kneeSlack);

		console.log(
			`\n  vvc argmax sits on a grid edge on ${mean(vvcAtEdge) * 100}% of days ` +
				`(grid is ${MIN_B}–${MAX_B} h)`,
		);

		console.log(
			`  objective argmax = ${MAX_B} h on ${((objArgmax.filter((b) => b === MAX_B).length / DAYS) * 100).toFixed(0)}% of days`,
		);

		console.log(
			`\n  net inversions (heuristic noise): ${netInversions} steps, worst ${fmt(netInversionMax)}`,
		);

		console.log(`  vvc and the knee differ by > 0.5 h on ${vvcKneeGapHours}/${DAYS} days`);
		stats('vvc argmax − knee (hours)', vvcMinusKnee);
		stats('net lost at vvc argmax (%)', netLostAtVvc);
		console.log('');
		stats('work hours at the knee', workAtKnee);
		stats('work / knee (window binding)', bindingShare);
	});

	it('how the knee moves with λ₀', () => {
		const days = drawDays(40, SEED);

		for (const lambda of [0, 0.25, 0.5, 1, 1.5, 2]) {
			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: lambda,
			};

			const knees: number[] = [];
			const works: number[] = [];

			for (const tasks of days) {
				const net: number[] = [];
				const work: number[] = [];

				for (const b of GRID) {
					const e = optimizeSchedule(tasks.map(toEnergyTask), b, params).evaluation;

					net.push(e.objective - lambda * b);
					work.push(e.workHours);
				}

				const knee = kneeAt(GRID, net, 1e-6);

				knees.push(knee);
				works.push(work[GRID.indexOf(knee)]);
			}

			console.log(
				`  λ₀ = ${lambda.toFixed(2)}  knee median ${fmt(quantile(knees, 0.5))} h ` +
					`(p10 ${fmt(quantile(knees, 0.1))}, p90 ${fmt(quantile(knees, 0.9))})  ` +
					`work median ${fmt(quantile(works, 0.5))} h  ` +
					`at ${MAX_B} h on ${((knees.filter((k) => k === MAX_B).length / knees.length) * 100).toFixed(0)}%`,
			);
		}
	});
});
