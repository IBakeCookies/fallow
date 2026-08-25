/**
 * Follow-up to `budget-advisor.probe.ts`: if the budget is to be RECOMMENDED
 * rather than declared, what is the recommendation the argmax of?
 *
 * Two nets, both `objective` priced against the hours the window CLAIMS (an
 * hour left free inside the window is worth λ₀ and so is the same hour outside
 * it, so the free-time term cancels and only committed work is charged):
 *
 *   netA(b) = objective(b) − λ₀·b
 *           = satiatedOutput − λ₀·work + terminalEnergyValue·(endCog+endPhys)/2
 *   netB(b) = satiatedOutput − λ₀·work + terminalEnergyValue·(workEndCog+workEndPhys)/2
 *
 * netA keeps rising after the window stops binding, because a longer window
 * recovers more of the reservoir before the terminal valuation — an
 * artifact of where the window edge is drawn, not a day that got better. netB
 * prices the terminal term at the end of the last WORKED block instead, so it
 * is exactly flat once work stops growing and its argmin-argmax IS the knee.
 *
 *   netC(b) = evaluateSchedule(plan(b).blocks, tasks, W, params).objective, W = max b
 *
 * netC is the one that shipped. It is the OBJECTIVE, unmodified — every budget's
 * plan re-scored on a COMMON horizon W instead of on its own window, which is
 * what removes netA's artifact without netB's rescoring onto a field the
 * optimizer never saw. On a common horizon the free-time term is λ₀·(W − work):
 * a constant minus λ₀ per worked hour, so only committed work is charged, and
 * the terminal term is read at the same clock time for every budget. `plan(b)`
 * maximizes `objective` at its OWN window rather than netC, so netC is not a sup
 * over a nested family and can dip; the two criteria differ only by the
 * trailing-recovery term (0.034/h against λ₀'s 0.5/h), which is why the dip is
 * small and one-directional. This probe measures it — the shipped
 * `suggestBudgetCurve` takes a running max.
 *
 * Usage: npx vitest run --config vitest.probe.config.ts --disableConsoleIntercept scripts/budget-knee.probe.ts
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	optimizeSchedule,
} from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { EnergyParams, EnergyTaskInput } from '$lib/business/model/zenith-energy';
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

const DAYS = 40;
const SEED = 0x290729;
const STEP = 0.75;

const GRID = Array.from(
	{
		length: 19,
	},
	(_, i) => Number((0.75 + i * STEP).toFixed(2)),
);

const MAX_B = GRID[GRID.length - 1];

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
	const sorted = [...values].sort((x, y) => x - y);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const fmt = (x: number) => x.toFixed(2);

/** Smallest b within `tol` of the best — the knee, since the net is flat past it. */
function kneeAt(values: number[], tol: number): number {
	const best = Math.max(...values);

	return GRID[values.findIndex((v) => v >= best - tol)];
}

interface DaySweep {
	netA: number[];
	netB: number[];
	netC: number[];
	work: number[];
}

/** One day solved at every budget on the grid, under all three scorings. */
function sweepDay(energy: EnergyTaskInput[], params: EnergyParams, lambda: number): DaySweep {
	const sweep: DaySweep = {
		netA: [],
		netB: [],
		netC: [],
		work: [],
	};

	for (const b of GRID) {
		const plan = optimizeSchedule(energy, b, params);
		const e = plan.evaluation;
		const base = e.satiatedOutput - lambda * e.workHours;

		sweep.netA.push(base + (params.terminalEnergyValue * (e.endCog + e.endPhys)) / 2);
		sweep.netB.push(base + (params.terminalEnergyValue * (e.workEndCog + e.workEndPhys)) / 2);
		// The shipped reading: this budget's plan, scored on the common horizon
		// rather than on its own window.
		sweep.netC.push(evaluateSchedule(plan.blocks, energy, MAX_B, params).objective);
		sweep.work.push(e.workHours);
	}

	return sweep;
}

interface Dips {
	steps: number;
	worst: number;
	worstShare: number;
}

/** How far netC falls below its own running max — what the shipped floor hides. */
function collectDips(netC: number[], into: Dips): void {
	for (let i = 1; i < netC.length; i++) {
		const dip = Math.max(...netC.slice(0, i)) - netC[i];

		if (dip <= 1e-9) continue;

		into.steps++;
		into.worst = Math.max(into.worst, dip);
		into.worstShare = Math.max(into.worstShare, dip / Math.abs(netC[i]));
	}
}

/** Marginal value of one more block of BUDGET, at three anchor budgets. */
function collectMarginals(netC: number[], into: Record<number, number[]>): void {
	for (const anchor of [3, 6, 9]) {
		const i = GRID.findIndex((b) => b >= anchor);

		if (i > 0 && i < GRID.length) into[anchor].push((netC[i] - netC[i - 1]) / STEP);
	}
}

describe('the knee of the budget curve', () => {
	it('what a recommended window would say, across λ₀', () => {
		const days = drawDays(DAYS, SEED);

		console.log(
			`\n${DAYS} days, budget ${GRID[0]}–${MAX_B} h @ ${STEP} h, common horizon W = ${MAX_B} h\n`,
		);

		console.log(
			'  λ₀     kneeA (h)             kneeB (h)             kneeC (h)             work@kneeC (h)   interior   marginal@3h/6h/9h',
		);

		// How far netC dips below its own running max — the size of the floor the
		// shipped running-max hides, and the whole justification for taking one.
		const dips: Dips = {
			steps: 0,
			worst: 0,
			worstShare: 0,
		};

		for (const lambda of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]) {
			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: lambda,
			};

			const kneesA: number[] = [];
			const kneesB: number[] = [];
			const kneesC: number[] = [];
			const works: number[] = [];

			const marg: Record<number, number[]> = {
				3: [],
				6: [],
				9: [],
			};

			let interior = 0;

			for (const tasks of days) {
				const { netA, netB, netC, work } = sweepDay(tasks.map(toEnergyTask), params, lambda);
				const kC = kneeAt(netC, 1e-6);

				kneesA.push(kneeAt(netA, 1e-6));
				kneesB.push(kneeAt(netB, 1e-6));
				kneesC.push(kC);
				works.push(work[GRID.indexOf(kC)]);
				collectDips(netC, dips);
				collectMarginals(netC, marg);

				if (kC < MAX_B - 1e-9) interior++;
			}

			const q = (xs: number[]) =>
				`${fmt(quantile(xs, 0.5))} [${fmt(quantile(xs, 0.1))}–${fmt(quantile(xs, 0.9))}]`;

			console.log(
				`  ${lambda.toFixed(2)}   ${q(kneesA).padEnd(21)} ${q(kneesB).padEnd(21)} ${q(kneesC).padEnd(21)} ` +
					`${q(works).padEnd(16)} ${String(interior).padStart(2)}/${DAYS}      ` +
					`${[3, 6, 9].map((a) => fmt(quantile(marg[a], 0.5))).join(' / ')}`,
			);
		}

		console.log(
			'\n  marginal = Δ netC per hour of budget; it is the number that must fall to 0 for a knee to exist.',
		);

		console.log(
			`  netC below its own running max on ${dips.steps} of ${7 * DAYS * (GRID.length - 1)} steps ` +
				`(${((dips.steps / (7 * DAYS * (GRID.length - 1))) * 100).toFixed(1)}%), ` +
				`worst ${fmt(dips.worst)} absolute / ${(dips.worstShare * 100).toFixed(2)}% relative — ` +
				'the size of what the shipped running max hides.\n',
		);
	});
});
