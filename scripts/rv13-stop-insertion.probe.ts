/**
 * Measurements behind MATH.md §13.4: what the pre-2026-07-26 append-last
 * convention actually did to §8.10's `lo` bound, and whether the numbers §13.4
 * quotes for it are envelopes or single draws.
 *
 * §13.4 says the old code appended an UNLOGGED task's probe block at the END of
 * the reconstructed day instead of at its own canonical amplitude rank, that
 * "the same probe step scored 0.65 appended last vs 0.37 inserted first", that
 * the convention moved the day's indifference point "by up to 0.087 in λ₀
 * units", and that "appending systematically inflated" `lo`, biasing λ̂₀ up.
 * Three of those four are numbers, and a max-of-one-draw is not a bound (the
 * lesson §13.3 had to learn twice), so this measures the SIGN and the SPREAD
 * over a seeded sweep instead of one day.
 *
 * It also re-runs §13.4's third claim — that the synthetic round-trip recovery
 * is "unchanged" at true λ₀ 0.3/0.5/0.9 — on the only committed synthetic-day
 * generator (the `dayFromPlan` fixture in zenith-energy.test.ts), both ways.
 *
 * A probe, not a test: the sweep prints numbers that move whenever the energy
 * model or the reconstruction changes, and it carries a pre-fix replica that
 * must not exist in shipped code. The suite pins the property instead — that
 * the estimator is a function of the day, i.e. of the canonical rank and not of
 * insertion order.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
 *
 * Usage: npm run probe
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_USER_CONSTANTS, mapEffort, mapEnjoyability } from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	fitStoppingValue,
	optimizeSchedule,
	stopIndifferencePoint,
	workedHoursByTask,
	type EnergyParams,
	type EnergyTaskInput,
	type ScheduleBlock,
	type StopObservation,
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

/** `taskAmplitude` is internal; §8.10's canonical order is this expression. */
function amplitude(t: EnergyTaskInput): number {
	const E = mapEffort(t.difficulty);
	const beta = mapEnjoyability(t.enjoyment);

	return E * beta + beta / E;
}

interface Reading {
	/** The bracket midpoint, or null when §8.10 censors the day. */
	point: number | null;
	/** Per-task `lo` probe marginals, keyed by task id. */
	probes: Map<number, number>;
}

/**
 * §8.10's bracket rebuilt from exported parts, with `appendLast` selecting the
 * PRE-§13.4 convention: an unlogged task's probe block goes at the end of the
 * day rather than at its canonical rank. `appendLast: false` must agree with
 * the shipped `stopIndifferencePoint` — asserted below.
 */
function reading(observation: StopObservation, params: EnergyParams, appendLast: boolean): Reading {
	const { tasks, windowHours } = observation;
	const byTask = workedHoursByTask(tasks, observation.workedHours);
	const probes = new Map<number, number>();
	const canonical = [...tasks].sort((x, y) => amplitude(y) - amplitude(x));
	const rank = new Map(canonical.map((t, i) => [t.id, i]));

	const sched: ScheduleBlock[] = canonical
		.filter((t) => byTask.has(t.id))
		.map((t) => ({
			taskId: t.id,
			hours: byTask.get(t.id)!,
		}));

	const total = sched.reduce((sum, b) => sum + b.hours, 0);
	const step = DEFAULT_STEP_HOURS;

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, DEFAULT_USER_CONSTANTS);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	const grown = (t: EnergyTaskInput): ScheduleBlock[] => {
		if (byTask.has(t.id))
			return sched.map((b) =>
				b.taskId === t.id
					? {
							...b,
							hours: b.hours + step,
						}
					: b,
			);

		if (appendLast)
			return [
				...sched,
				{
					taskId: t.id,
					hours: step,
				},
			];

		const at = sched.filter((b) => rank.get(b.taskId!)! < rank.get(t.id)!).length;

		return [
			...sched.slice(0, at),
			{
				taskId: t.id,
				hours: step,
			},
			...sched.slice(at),
		];
	};

	let lo = -Infinity;

	for (const t of tasks) {
		const m = (workValue(grown(t)) - base) / step;
		probes.set(t.id, m);
		lo = Math.max(lo, m);
	}

	let hi: number | null = null;

	for (const t of tasks)
		if ((byTask.get(t.id) ?? 0) >= step - 1e-9) {
			const shrunk = sched
				.map((b) =>
					b.taskId === t.id
						? {
								...b,
								hours: b.hours - step,
							}
						: b,
				)
				.filter((b) => b.hours > 1e-9);

			hi = Math.max(hi ?? -Infinity, (base - workValue(shrunk)) / step);
		}

	const stopBound = Math.max(0, lo);

	const censored =
		byTask.size === 0 || total + step > windowHours + 1e-9 || hi === null || stopBound > hi + 0.25;

	return {
		point: censored ? null : (stopBound + hi!) / 2,
		probes,
	};
}

const task = (
	id: number,
	title: string,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title,
	difficulty,
	enjoyment,
	cognitiveDemand,
	physicalDemand,
});

/** §8.10's own fixture day (zenith-energy.test.ts), amplitude-descending by id. */
const DAY = [
	task(1, 'boxing', 10, 10, 0.2, 1.0),
	task(2, 'guitar', 6, 9, 0.4, 0.3),
	task(3, 'reading', 4, 7, 0.5, 0.05),
];

const dayFromPlan = (
	tasks: EnergyTaskInput[],
	trueLambda: number,
	windowHours: number,
): StopObservation => {
	const { blocks } = optimizeSchedule(tasks, windowHours, {
		...DEFAULT_ENERGY_PARAMS,
		freeTimeValue: trueLambda,
	});

	const byTask = new Map<number, number>();

	for (const b of blocks)
		if (b.taskId !== null) byTask.set(b.taskId, (byTask.get(b.taskId) ?? 0) + b.hours);

	return {
		tasks,
		windowHours,
		workedHours: [...byTask].map(([taskId, hours]) => ({
			taskId,
			hours,
		})),
	};
};

describe('MATH.md §13.4 — the insertion convention', () => {
	it('validates the replica against the shipped stopIndifferencePoint', () => {
		for (const windowHours of [8, 10, 12])
			for (const trueLambda of [0.5, 0.9, 1.3]) {
				const obs = dayFromPlan(DAY, trueLambda, windowHours);
				const mine = reading(obs, DEFAULT_ENERGY_PARAMS, false).point;
				const shipped = stopIndifferencePoint(obs, DEFAULT_ENERGY_PARAMS);

				if (mine === null) expect(shipped).toBeNull();
				else expect(shipped!).toBeCloseTo(mine, 12);
			}
	});

	it('measures the sign and the spread of the append-last bias', () => {
		const rnd = mulberry32(13);
		let days = 0;
		let probesCompared = 0;
		let appendHigher = 0;
		let worstProbeGap = 0;
		let worstProbeDesc = '';
		let worstPointShift = 0;
		let worstPointDesc = '';
		let loInflatedDays = 0;
		let loDeflatedDays = 0;
		let pointUp = 0;
		let pointDown = 0;
		let signedSum = 0;
		const shifts: number[] = [];

		for (let trial = 0; trial < 4000; trial++) {
			const n = 2 + Math.floor(rnd() * 4);

			const tasks: EnergyTaskInput[] = Array.from(
				{
					length: n,
				},
				(_, i) =>
					task(
						i + 1,
						`t${i}`,
						1 + Math.floor(rnd() * 10),
						1 + Math.floor(rnd() * 10),
						Math.round(rnd() * 10) / 10,
						Math.round(rnd() * 10) / 10,
					),
			);

			const windowHours = 4 + Math.floor(rnd() * 10);
			const byTask = new Map<number, number>();
			// Random composition rather than an optimizer plan: the convention only
			// shows up when a task is UNLOGGED, and an optimizer day at a plausible
			// λ₀ funds nearly everything.
			let left = windowHours - DEFAULT_STEP_HOURS;

			for (const t of tasks) {
				if (rnd() < 0.35) continue;

				const steps = Math.floor(rnd() * 5);
				const hours = steps * DEFAULT_STEP_HOURS;

				if (hours > 0 && hours <= left) {
					byTask.set(t.id, hours);
					left -= hours;
				}
			}

			if (byTask.size === 0 || byTask.size === n) continue;

			const obs: StopObservation = {
				tasks,
				windowHours,
				workedHours: [...byTask].map(([taskId, hours]) => ({
					taskId,
					hours,
				})),
			};

			const ins = reading(obs, DEFAULT_ENERGY_PARAMS, false);
			const app = reading(obs, DEFAULT_ENERGY_PARAMS, true);
			days++;

			let insLo = -Infinity;
			let appLo = -Infinity;

			for (const t of tasks) {
				insLo = Math.max(insLo, ins.probes.get(t.id)!);
				appLo = Math.max(appLo, app.probes.get(t.id)!);

				if (byTask.has(t.id)) continue;

				probesCompared++;
				const gap = app.probes.get(t.id)! - ins.probes.get(t.id)!;

				if (gap > 1e-12) appendHigher++;

				if (Math.abs(gap) > worstProbeGap) {
					worstProbeGap = Math.abs(gap);
					worstProbeDesc = `n=${n} T=${windowHours} task ${t.id}: inserted ${ins.probes.get(t.id)!.toFixed(4)} appended ${app.probes.get(t.id)!.toFixed(4)}`;
				}
			}

			if (appLo > insLo + 1e-12) loInflatedDays++;
			else if (insLo > appLo + 1e-12) loDeflatedDays++;

			if (ins.point === null || app.point === null) continue;

			const shift = Math.abs(app.point - ins.point);
			shifts.push(shift);
			signedSum += app.point - ins.point;

			if (app.point > ins.point + 1e-12) pointUp++;
			else if (ins.point > app.point + 1e-12) pointDown++;

			if (shift > worstPointShift) {
				worstPointShift = shift;
				worstPointDesc = `n=${n} T=${windowHours} inserted ${ins.point.toFixed(4)} appended ${app.point.toFixed(4)}`;
			}
		}

		shifts.sort((a, b) => a - b);

		console.log(
			`§13.4 append-last vs canonical, ${days} days with at least one unlogged task, ${probesCompared} unlogged probes:`,
		);

		console.log(
			`  appended marginal HIGHER on ${((100 * appendHigher) / probesCompared).toFixed(1)}% of probes; worst |gap| ${worstProbeGap.toFixed(4)} (${worstProbeDesc})`,
		);

		console.log(
			`  the day's lo bound: inflated by appending on ${loInflatedDays} days, deflated on ${loDeflatedDays}`,
		);

		console.log(
			`  indifference-point shift over ${shifts.length} two-sided days: median ${shifts[Math.floor(shifts.length / 2)].toFixed(4)}, p99 ${shifts[Math.floor(shifts.length * 0.99)].toFixed(4)}, worst ${worstPointShift.toFixed(4)} (${worstPointDesc})`,
		);

		console.log(
			`  worst shift as a fraction of STOP_INVERSION_MARGIN: ${((100 * worstPointShift) / 0.25).toFixed(0)}%`,
		);

		console.log(
			`  DIRECTION: appending moved the point UP on ${pointUp} days, DOWN on ${pointDown}, mean signed shift ${(signedSum / shifts.length).toFixed(4)}`,
		);
	});

	it('re-runs the synthetic round-trip both ways', () => {
		for (const trueLambda of [0.3, 0.5, 0.9]) {
			const days = [8, 10, 12].map((T) => dayFromPlan(DAY, trueLambda, T));

			const fit = fitStoppingValue(
				days,
				DEFAULT_ENERGY_PARAMS.freeTimeValue,
				DEFAULT_ENERGY_PARAMS,
			);

			const points = days.map((d) => reading(d, DEFAULT_ENERGY_PARAMS, false).point);
			const appended = days.map((d) => reading(d, DEFAULT_ENERGY_PARAMS, true).point);

			console.log(
				`true λ₀ ${trueLambda} → fitted ${fit.value.toFixed(4)} (fitted=${fit.fitted}, days used ${fit.usedCount}); per-day midpoints canonical [${points.map((p) => p?.toFixed(4) ?? 'censored').join(', ')}] append-last [${appended.map((p) => p?.toFixed(4) ?? 'censored').join(', ')}]`,
			);
		}
	});
});
