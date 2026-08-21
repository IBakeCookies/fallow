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
 * The "0.65 appended last vs 0.37 inserted first" step is from a day that was
 * never recorded, so it cannot be reproduced — but §13.4's fallback claim, that
 * inserting reads HIGHER on §8.10's own fixture day, is about a day that still
 * exists, so it is measured here: both midpoints, on the one fixture day whose
 * logged task is last in canonical rank (the rest cannot tell the conventions
 * apart).
 *
 * It also re-runs §13.4's third claim — that the synthetic round-trip recovery
 * is "unchanged" at true λ₀ 0.3/0.5/0.9 — on the only committed synthetic-day
 * generator (the `dayFromPlan` fixture in zenith-energy.test.ts), both ways.
 *
 * Added 2026-08-19: the same question on a TIMESTAMPED day. §8.11 kept
 * canonical placement partly because "`StopObservation` carries no order, so the
 * reconstructed past is itself canonical, not chronological" — which is false
 * once the 🪫 rows' log moments are read (§8.10), so the arm below prices both
 * conventions on a day whose reconstruction carries its real breaks, and the
 * replica gains the same structure so its validation gate still means something.
 * Rest blocks also make the insertion INDEX reachable: `rank` has no entry for a
 * rest block, so counting lower-ranked blocks and indexing into a schedule that
 * contains rest are two different numbers.
 *
 * Added 2026-08-21: the replica takes the shipped clock censor (§8.10), so a
 * TIMED day built from a plan that fills its window now reads `censored` — the
 * plan's own breaks leave no room for another step. That is what moved the timed
 * arm's figures below, not the conventions this file compares.
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
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const rest = recoveredRest(observation, byTask);

	const sched: ScheduleBlock[] =
		loggedStructure(rest, windowHours, total) ??
		canonical
			.filter((t) => byTask.has(t.id))
			.map((t) => ({
				taskId: t.id,
				hours: byTask.get(t.id)!,
			}));

	const step = DEFAULT_STEP_HOURS;

	const lastBlockOf = (taskId: number) =>
		sched.reduce((last, b, i) => (b.taskId === taskId ? i : last), -1);

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, DEFAULT_USER_CONSTANTS);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	const grown = (t: EnergyTaskInput): ScheduleBlock[] => {
		if (byTask.has(t.id)) {
			const last = lastBlockOf(t.id);

			return sched.map((b, i) =>
				i === last
					? {
							...b,
							hours: b.hours + step,
						}
					: b,
			);
		}

		if (appendLast)
			return [
				...sched,
				{
					taskId: t.id,
					hours: step,
				},
			];

		// Count WORK blocks of lower rank, then walk `sched` past that many —
		// rest blocks have no rank and must not shift the index.
		const before = sched.filter(
			(b) => b.taskId !== null && rank.get(b.taskId)! < rank.get(t.id)!,
		).length;

		let at = 0;

		for (let seen = 0; seen < before; at++) if (sched[at].taskId !== null) seen++;

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
		if ((byTask.get(t.id) ?? 0) >= step - 1e-9)
			hi = Math.max(hi ?? -Infinity, (base - workValue(shrinkLast(sched, t.id, step))) / step);

	const stopBound = Math.max(0, lo);

	const censored =
		byTask.size === 0 ||
		isClockCensored(observation, rest, total) ||
		total + step > windowHours + 1e-9 ||
		hi === null ||
		stopBound > hi + 0.25;

	return {
		point: censored ? null : (stopBound + hi!) / 2,
		probes,
	};
}

const ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');

/** `shrinkBy`: `hours` off the END of that task's work, across its blocks. */
function shrinkLast(sched: ScheduleBlock[], taskId: number, hours: number): ScheduleBlock[] {
	const out = [...sched];
	let left = hours;

	for (let i = out.length - 1; i >= 0 && left > 1e-9; i--) {
		if (out[i].taskId !== taskId) continue;

		const take = Math.min(out[i].hours, left);

		out[i] = {
			...out[i],
			hours: out[i].hours - take,
		};

		left -= take;
	}

	return out.filter((b) => b.hours > 1e-9);
}

/** `recoveredRest`: the breaks the rows' own log moments recover, UNCAPPED. */
function recoveredRest(
	observation: StopObservation,
	byTask: Map<number, number>,
): { rows: StopObservation['workedHours']; gaps: number[]; restTotal: number } | null {
	const rows = observation.workedHours.filter((r) => r.hours > 0 && byTask.has(r.taskId));

	if (rows.some((r) => !Number.isFinite(r.endedAt))) return null;

	const sorted = [...rows].sort((x, y) => x.endedAt! - y.endedAt!);

	const gaps = sorted.map((r, i) =>
		i === 0
			? 0
			: Math.max(0, (r.endedAt! - r.hours * 3_600_000 - sorted[i - 1].endedAt!) / 3_600_000),
	);

	const restTotal = gaps.reduce((sum, gap) => sum + gap, 0);

	if (!(restTotal > 1e-9)) return null;

	return {
		rows: sorted,
		gaps,
		restTotal,
	};
}

/**
 * `reconstructStopDay`'s recovered block structure, replicated: rows in log
 * order, the space before each one a break, all rest scaled to leave one step
 * of room. Null on the days the shipped reader falls back on — a row with no
 * moment, or no gap to recover.
 */
function loggedStructure(
	rest: ReturnType<typeof recoveredRest>,
	windowHours: number,
	total: number,
): ScheduleBlock[] | null {
	if (rest === null) return null;

	const { rows, gaps, restTotal } = rest;
	const room = Math.max(0, windowHours - total - DEFAULT_STEP_HOURS);
	const scale = Math.min(1, room / restTotal);

	if (!(restTotal * scale > 1e-9)) return null;

	const sched: ScheduleBlock[] = [];

	rows.forEach((r, i) => {
		if (gaps[i] * scale > 1e-9)
			sched.push({
				taskId: null,
				hours: gaps[i] * scale,
			});

		sched.push({
			taskId: r.taskId,
			hours: r.hours,
		});
	});

	return sched;
}

/**
 * `isClockCensored`: the day's own span — worked hours plus the UNCAPPED
 * recovered breaks — leaves no room for another step, so the stop was the
 * clock's and the day reveals nothing (§8.10, censored since 2026-08-21). A
 * TIMED plan that fills its window is exactly this day, which is why the timed
 * arm below reads `censored` where it used to read a point.
 */
function isClockCensored(
	observation: StopObservation,
	rest: ReturnType<typeof recoveredRest>,
	total: number,
): boolean {
	if (rest === null) return false;

	return total + rest.restTotal + DEFAULT_STEP_HOURS > observation.windowHours + 1e-9;
}

/** The plan's sessions as the 🪫 log holds them: one row each, with its end. */
function sessionRows(blocks: ScheduleBlock[]): StopObservation['workedHours'] {
	const rows: StopObservation['workedHours'] = [];
	let clock = 0;

	for (const b of blocks) {
		clock += b.hours;

		if (b.taskId !== null)
			rows.push({
				taskId: b.taskId,
				hours: b.hours,
				endedAt: ORIGIN + clock * 3_600_000,
			});
	}

	return rows;
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

/**
 * §8.10's own fixture day (zenith-energy.test.ts), amplitude-descending by id,
 * AS THE SLIDERS REACH IT. Aligned 2026-08-20 (ROADMAP M44): the suite moved
 * this day to slider-reachable demands on 2026-08-19 — guitar 0.4/0.3 → 0.6/0
 * and reading 0.5/0.05 → 0.4/0, difficulties held — and until now this probe
 * still declared the old triple, so §13.4's sentence about "§8.10's own fixture
 * day" described a day the repo no longer had.
 */
const DAY = [
	task(1, 'boxing', 10, 10, 0.2, 1.0),
	task(2, 'guitar', 6, 9, 0.6, 0),
	task(3, 'reading', 4, 7, 0.4, 0),
];

/**
 * §8.10's own fixture day that can tell the two conventions apart: 2.25 h of
 * reading — the LOWEST-amplitude task — with boxing and guitar unstarted, so an
 * unlogged task's probe block lands BEFORE the logged session at its canonical
 * rank and AFTER it when appended. (§8.10's other fixture days log the
 * highest-amplitude task, or every task, where the conventions coincide.)
 */
const FIXTURE_DAY: StopObservation = {
	tasks: DAY,
	windowHours: 12,
	workedHours: [
		{
			taskId: 3,
			hours: 2.25,
		},
	],
};

/** `isTimed` logs the plan session by session; otherwise the day reads summed. */
const dayFromPlan = (
	tasks: EnergyTaskInput[],
	trueLambda: number,
	windowHours: number,
	isTimed = false,
): StopObservation => {
	const { blocks } = optimizeSchedule(tasks, windowHours, {
		...DEFAULT_ENERGY_PARAMS,
		freeTimeValue: trueLambda,
	});

	const rows = sessionRows(blocks);

	return {
		tasks,
		windowHours,
		workedHours: isTimed
			? rows
			: rows.map(({ taskId, hours }) => ({
					taskId,
					hours,
				})),
	};
};

describe('MATH.md §13.4 — the insertion convention', () => {
	it('validates the replica against the shipped stopIndifferencePoint', () => {
		const cells = [8, 10, 12].flatMap((windowHours) =>
			[0.5, 0.9, 1.3].flatMap((trueLambda) =>
				[false, true].map((isTimed) => dayFromPlan(DAY, trueLambda, windowHours, isTimed)),
			),
		);

		for (const obs of cells) {
			const mine = reading(obs, DEFAULT_ENERGY_PARAMS, false).point;
			const shipped = stopIndifferencePoint(obs, DEFAULT_ENERGY_PARAMS);

			if (mine === null) expect(shipped).toBeNull();
			else expect(shipped!).toBeCloseTo(mine, 12);
		}
	});

	it('prices both conventions on a day whose reconstruction carries its breaks', () => {
		for (const trueLambda of [0.5, 0.9, 1.3])
			for (const windowHours of [8, 10, 12]) {
				const timed = dayFromPlan(DAY, trueLambda, windowHours, true);
				const summed = dayFromPlan(DAY, trueLambda, windowHours, false);
				const ins = reading(timed, DEFAULT_ENERGY_PARAMS, false);
				const app = reading(timed, DEFAULT_ENERGY_PARAMS, true);
				const flat = reading(summed, DEFAULT_ENERGY_PARAMS, false);
				const show = (p: number | null) => (p === null ? 'censored' : p.toFixed(4));

				console.log(
					`§8.11 append-vs-canonical, true λ₀ ${trueLambda} at ${windowHours}h: ` +
						`timed inserted ${show(ins.point)} appended ${show(app.point)} ` +
						`(summed reading ${show(flat.point)})`,
				);
			}
	});

	it("reads §8.10's own fixture day under both conventions", () => {
		const ins = reading(FIXTURE_DAY, DEFAULT_ENERGY_PARAMS, false);
		const app = reading(FIXTURE_DAY, DEFAULT_ENERGY_PARAMS, true);

		expect(stopIndifferencePoint(FIXTURE_DAY, DEFAULT_ENERGY_PARAMS)!).toBeCloseTo(ins.point!, 12);

		// The day separates the conventions: its one logged task is LAST in
		// canonical rank, so both unlogged probes move and the logged one cannot.
		expect(app.probes.get(1)).not.toBe(ins.probes.get(1));
		expect(app.probes.get(2)).not.toBe(ins.probes.get(2));
		expect(app.probes.get(3)).toBe(ins.probes.get(3));

		// The SIGN §13.4 claims for this day: inserting reads higher.
		expect(ins.point!).toBeGreaterThan(app.point!);

		console.log(
			`§13.4 on §8.10's own fixture day (2.25 h of reading at T=12, boxing and guitar unstarted): indifference midpoint inserted-at-rank ${ins.point!.toFixed(4)} vs appended-last ${app.point!.toFixed(4)} — INSERTING reads higher, by ${(ins.point! - app.point!).toFixed(4)}`,
		);

		console.log(
			`  its lo probes (value per hour of one more step): ${DAY.map((t) => `${t.title} inserted ${ins.probes.get(t.id)!.toFixed(4)} appended ${app.probes.get(t.id)!.toFixed(4)}`).join('; ')}`,
		);
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
		// Timed days: what the app reads once the sessions are logged as they
		// finish. The summed fit beside it is the same days read the pre-2026-08-19
		// way, so the round-trip claim and the reconstruction change are separable.
		for (const trueLambda of [0.3, 0.5, 0.9]) {
			const days = [8, 10, 12].map((T) => dayFromPlan(DAY, trueLambda, T, true));
			const summed = [8, 10, 12].map((T) => dayFromPlan(DAY, trueLambda, T));

			const fit = fitStoppingValue(
				days,
				DEFAULT_ENERGY_PARAMS.freeTimeValue,
				DEFAULT_ENERGY_PARAMS,
			);

			const flat = fitStoppingValue(
				summed,
				DEFAULT_ENERGY_PARAMS.freeTimeValue,
				DEFAULT_ENERGY_PARAMS,
			);

			const points = days.map((d) => reading(d, DEFAULT_ENERGY_PARAMS, false).point);
			const appended = days.map((d) => reading(d, DEFAULT_ENERGY_PARAMS, true).point);

			console.log(
				`true λ₀ ${trueLambda} → fitted ${fit.value.toFixed(4)} (fitted=${fit.fitted}, days used ${fit.usedCount}; summed reading ${flat.value.toFixed(4)} over ${flat.usedCount}); per-day midpoints canonical [${points.map((p) => p?.toFixed(4) ?? 'censored').join(', ')}] append-last [${appended.map((p) => p?.toFixed(4) ?? 'censored').join(', ')}]`,
			);
		}
	});
});
