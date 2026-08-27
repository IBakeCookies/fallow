/**
 * What OBLIGATION does to MATH.md §8.10's λ₀ fit, and whether either repair pays.
 *
 * §8.10 reads a finished day as a leisure CHOICE: the user worked those hours
 * and then preferred free time to every next block. A day whose hours were
 * COMPELLED — a deadline, a promise, a task that had to be finished — breaks
 * that premise, and the model cannot see it: `mustDoToday` never reaches
 * `toEnergyTask`, and none of §8.10's censors is aimed at it. Two repairs are
 * priced here against shipping nothing.
 *
 * A probe, not a test: every number below moves with the curves, the reservoir
 * law and the lattice.
 *
 * WHAT IT REBUILDS, AND WHY. The scope repair excludes the pinned task from
 * both bracket sides, which no shipped signature can express, so the bracket is
 * rebuilt from exported parts only (`workedHoursByTask`, `evaluateSchedule`'s
 * λ₀-free V = satiatedOutput + terminalBonus, the canonical amplitude
 * expression, the unlogged-task insertion at its canonical rank, the structural
 * and clock censors) — the replica pattern `stop-margin-fit-error.probe.ts` and
 * `stop-inversion-margin.probe.ts` already use. Both halves of the chain are
 * gated before any number below is believed: the replica's TWO SIDES against
 * the shipped `stopBracket` (the per-day Δlo/Δhi medians are quoted, so a
 * midpoint-only gate would not cover them), and the closed form against
 * `fitStoppingValue`, which is what the sibling probe gates.
 *
 * THE DAYS. One plan per day from `optimizeSchedule` at the user's OWN true λ₀,
 * every task drawn through `toEnergyTask` from integer sliders, then perturbed
 * into four readings of the same day: `rational` (the plan as logged),
 * `overwork-open` / `overwork-done` (+3 steps of grind APPENDED past the stop on
 * the obligation task, still open / then ticked off) and `early-stop` (the day
 * cut the moment the obligation task is done). The obligation task is the
 * LOWEST-amplitude task the plan funded — the boring thing with a deadline, and
 * the worst case for the scope repair, which prices it on neither side.
 *
 * MEASURED 2026-08-28, 60 users × 10 days, λ₀ ∈ {0.3 … 1.3}; both gates clean
 * (2400 days, 0 mismatched; 60 fits, 0 mismatched). p10/p90 are in the run:
 *
 *   arm             fix              bias    RMSE   kept/day  users with no fit
 *   rational        shipped          0.004   0.073  0.68      4
 *   rational        scope-excluded  -0.113   0.264  0.27      10
 *   overwork-open   shipped         -0.253   0.380  0.40      21
 *   overwork-open   scope-excluded  -0.215   0.362  0.05      37
 *   overwork-done   shipped         -0.259   0.389  0.40      21
 *   overwork-done   scope-excluded  -0.215   0.362  0.05      37
 *   early-stop      shipped         -0.026   0.212  0.78      0
 *   early-stop      scope-excluded  -0.061   0.297  0.33      4
 *
 * `day-censored` is one row for every arm — every day in this population worked
 * its obligation task, so all 60 users fall back to the prior: bias −0.300,
 * RMSE 0.455, kept/day 0.00.
 *
 * Four readings of that table:
 *
 *   1. **The instrument is unbiased on honest days** (+0.004 at RMSE 0.073) and
 *      compelled overwork biases λ₀ **DOWN** by 0.25 — half the 0.5 default,
 *      against a σ₀ of 0.25. Per day, medians: Δlo −0.433, Δhi −0.656,
 *      Δmid −0.537. The grind depletes the reservoirs, so the next step AND the
 *      last worked step are both worth almost nothing, and the estimator reads
 *      "still working when work was nearly worthless" as leisure being nearly
 *      worthless. That direction is the dangerous one: a lower λ₀ plans MORE
 *      work.
 *   2. **Ticking the duty off does not help** (−0.259 against −0.253): §8.10's
 *      fifth category only fires when NOTHING is left open, which no arm here
 *      reaches (see the censor split below).
 *   3. **Stopping early because the duty is done costs variance, not bias** —
 *      −0.026 at RMSE 0.212, three times the honest day's 0.073, p10 −0.283 and
 *      p90 +0.297. Its per-day Δmid median is a systematic −0.116, so the near-zero
 *      bias is the surviving-day mix, not per-day neutrality: this reading keeps
 *      MORE days than the honest one (0.78 against 0.68).
 *   4. **Both repairs lose.** Excluding the pinned task from both bracket sides
 *      buys 0.044 of bias on the grind and costs 0.117 on the honest day, whose
 *      kept-day share falls 0.68 → 0.27 — it throws away the information the fit
 *      runs on. Censoring such a day whole fits nothing at all. Shipping nothing
 *      wins.
 *
 * WHICH CENSOR TAKES A GRIND DAY, as a share of ALL days — the split that turns
 * "no censor is aimed at obligation" from an assertion into a reading:
 *
 *   arm             clock  window-edge  nothing-open  no-whole-step  inversion  kept
 *   rational        0.16   0.16         0.00          0.00           0.00       0.68
 *   overwork-done   0.41   0.17         0.00          0.00           0.01       0.40
 *   early-stop      0.13   0.09         0.00          0.00           0.00       0.78
 *
 * A grind day that IS dropped is dropped by the CLOCK — the appended steps
 * overrun the window — not by the inversion censor (0.01) and never by the
 * fifth category. So censoring is incidental, not protective: it costs the fit
 * 0.28 of its days (0.68 → 0.40) and the survivors still read −0.259.
 *
 * WHAT KEEPS IT SURVIVABLE is not the censors but the SHARE of days that are
 * compelled, together with §8.10's prior:
 *
 *   share of obligation days   0.20    0.30    0.50
 *   overwork-done bias        -0.040  -0.056  -0.103
 *   early-stop bias           +0.003  +0.015   0.000
 *
 * THE OTHER CHANNEL — the 🪫 RATING, which λ₀ never reads directly. Ratings reach
 * λ₀ as the α they fit (§8.7), and λ₀ conditions on α. Rational days only, read
 * under a mis-fitted α:
 *
 *   α scale   0.50    0.75    1.00    1.50    2.00
 *   bias     +0.223  +0.099  +0.004  -0.121  -0.203
 *
 * Over-rating drain under deadline pressure pulls λ₀ down, at the same order as
 * the grind (−0.203 at α×2 against the grind's −0.259); under-rating pushes it
 * up. `valueStd` cannot see any of it — every day is read under the same α, so
 * the error is common-mode (§8.10).
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS as STEP,
	STOP_FIT_MAX,
	STOP_FIT_MIN,
	STOP_INVERSION_MARGIN,
	STOP_PRIOR_STRENGTH,
	evaluateSchedule,
	fitStoppingValue,
	optimizeSchedule,
	stopBracket,
	stopIndifferencePoint,
	workedHoursByTask,
	type EnergyParams,
	type EnergyTaskInput,
	type ScheduleBlock,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import {
	DEFAULT_USER_CONSTANTS,
	mapEffort,
	mapEnjoyability,
	type UserConstants,
} from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

const CONSTANTS: UserConstants = DEFAULT_USER_CONSTANTS;
const FALLBACK = DEFAULT_ENERGY_PARAMS.freeTimeValue;
const ORIGIN = Date.parse('2026-08-27T06:00:00.000Z');
const MS_PER_HOUR = 3_600_000;

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

interface Bracket {
	/** max(0, lo) — the value the shipped censoring test compares */
	stopBound: number;
	hi: number;
}

/**
 * Why a day revealed no indifference, in the order §8.10 tests it. `clock` is
 * the day whose own span left no room; `window-edge` had room on WORKED hours
 * but not on the reading that prices the next step; `nothing-open` is the fifth
 * category; `no-whole-step` is the sliver; `inversion` is past the margin.
 */
type Censor = 'clock' | 'window-edge' | 'nothing-open' | 'no-whole-step' | 'inversion' | 'empty';

type Reading = Bracket | Censor;

const isCensored = (reading: Reading): reading is Censor => typeof reading === 'string';

/**
 * §8.10's bracket, rebuilt from exported parts, or the censor that dropped the
 * day. `pinned` is the repair under test: the obligation task priced on neither
 * side, its hours still in the reconstruction (they drained the reservoirs, like
 * a completed task's).
 */
function bracketOf(observation: StopObservation, params: EnergyParams, pinned?: number): Reading {
	const { tasks, windowHours, openTaskIds } = observation;

	if (windowHours <= 0 || tasks.length === 0) return 'empty';

	const isCompelled = (taskId: number) => taskId === pinned;
	const open = openTaskIds === undefined ? tasks : tasks.filter((t) => openTaskIds.has(t.id));
	const candidates = open.filter((t) => !isCompelled(t.id));
	const byTask = workedHoursByTask(tasks, observation.workedHours);

	if (byTask.size === 0) return 'empty';

	const canonical = [...tasks].sort((x, y) => amplitude(y) - amplitude(x));
	const rank = new Map(canonical.map((t, i) => [t.id, i]));
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const rest = recoveredRest(observation, byTask);

	if (rest !== null && total + rest.restTotal + STEP > windowHours + 1e-9) return 'clock';

	const sched: ScheduleBlock[] =
		loggedStructure(rest, windowHours, total) ??
		canonical
			.filter((t) => byTask.has(t.id))
			.map((t) => ({
				taskId: t.id,
				hours: byTask.get(t.id)!,
			}));

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, CONSTANTS);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	const lastBlockOf = (taskId: number) =>
		sched.reduce((last, b, i) => (b.taskId === taskId ? i : last), -1);

	/** The LAST block of a logged task grows; an unlogged task enters at its rank. */
	const grown = (t: EnergyTaskInput): ScheduleBlock[] => {
		if (byTask.has(t.id)) {
			const last = lastBlockOf(t.id);

			return sched.map((b, i) =>
				i === last
					? {
							...b,
							hours: b.hours + STEP,
						}
					: b,
			);
		}

		const before = sched.filter(
			(b) => b.taskId !== null && rank.get(b.taskId)! < rank.get(t.id)!,
		).length;

		let index = 0;

		for (let seen = 0; seen < before; index++) if (sched[index].taskId !== null) seen++;

		return [
			...sched.slice(0, index),
			{
				taskId: t.id,
				hours: STEP,
			},
			...sched.slice(index),
		];
	};

	/** One step off the END of that task's work, across its blocks. */
	const shrunk = (taskId: number): ScheduleBlock[] => {
		const out = [...sched];
		let left = STEP;

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
	};

	let hi: number | null = null;

	for (const t of tasks)
		if (!isCompelled(t.id) && (byTask.get(t.id) ?? 0) >= STEP - 1e-9)
			hi = Math.max(hi ?? -Infinity, (base - workValue(shrunk(t.id))) / STEP);

	if (hi === null) return 'no-whole-step';

	if (total + STEP > windowHours + 1e-9) return 'window-edge';

	if (candidates.length === 0) return 'nothing-open';

	let lo = -Infinity;

	for (const t of candidates) lo = Math.max(lo, (workValue(grown(t)) - base) / STEP);

	const stopBound = Math.max(0, lo);

	if (stopBound > hi + STOP_INVERSION_MARGIN) return 'inversion';

	return {
		stopBound,
		hi,
	};
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
			: Math.max(0, (r.endedAt! - r.hours * MS_PER_HOUR - sorted[i - 1].endedAt!) / MS_PER_HOUR),
	);

	const restTotal = gaps.reduce((sum, gap) => sum + gap, 0);

	if (!(restTotal > 1e-9)) return null;

	return {
		rows: sorted,
		gaps,
		restTotal,
	};
}

/** `reconstructStopDay`'s recovered structure: rows in log order, gaps as rest. */
function loggedStructure(
	rest: ReturnType<typeof recoveredRest>,
	windowHours: number,
	total: number,
): ScheduleBlock[] | null {
	if (rest === null) return null;

	const { rows, gaps, restTotal } = rest;
	const room = Math.max(0, windowHours - total - STEP);
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

const ARMS = ['rational', 'overwork-open', 'overwork-done', 'early-stop'] as const;

type Arm = (typeof ARMS)[number];

/** Shipping nothing, against the two repairs §8.10 could make. */
const FIXES = ['shipped', 'scope-excluded', 'day-censored'] as const;

type Fix = (typeof FIXES)[number];

/** 2.25 h of forced grind past the rational stop. */
const EXTRA_STEPS = 3;

interface Day {
	tasks: EnergyTaskInput[];
	windowHours: number;
	/** The obligation task: the lowest-amplitude task the plan funded */
	duty: number;
	observations: Record<Arm, StopObservation>;
}

function drawTask(random: () => number, id: number): EnergyTaskInput {
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	const task: Task = {
		id,
		title: `t${id}`,
		mentalDifficulty: slider(0),
		physicalDifficulty: slider(0),
		enjoyment: slider(1),
		createdAt: '2026-08-27',
		completed: false,
	};

	return toEnergyTask(task);
}

const stepsOfPlan = (blocks: ScheduleBlock[]): (number | null)[] =>
	blocks.flatMap((b) =>
		Array.from(
			{
				length: Math.round(b.hours / STEP),
			},
			() => b.taskId,
		),
	);

/**
 * The step list as the 🪫 log would hold it: one row per contiguous session,
 * each carrying the moment it ended, rest steps passing on the clock without a
 * row. That is what carries the day's breaks into the observation.
 */
function observationFrom(
	tasks: EnergyTaskInput[],
	windowHours: number,
	steps: (number | null)[],
	openTaskIds: ReadonlySet<number>,
): StopObservation {
	const workedHours: StopObservation['workedHours'] = [];
	let clock = 0;

	for (const id of steps) {
		clock += STEP;

		if (id === null) continue;

		const last = workedHours[workedHours.length - 1];

		if (
			last &&
			last.taskId === id &&
			Math.abs(last.endedAt! - ORIGIN - (clock - STEP) * MS_PER_HOUR) < 1
		) {
			last.hours += STEP;
			last.endedAt = ORIGIN + clock * MS_PER_HOUR;
			continue;
		}

		workedHours.push({
			taskId: id,
			hours: STEP,
			endedAt: ORIGIN + clock * MS_PER_HOUR,
		});
	}

	return {
		tasks,
		windowHours,
		workedHours,
		openTaskIds,
	};
}

function buildDay(random: () => number, params: EnergyParams): Day | null {
	const tasks = Array.from(
		{
			length: 2 + Math.floor(random() * 3),
		},
		(_, i) => drawTask(random, i + 1),
	);

	const windowHours = 6 + Math.round(random() * 8);
	const steps = stepsOfPlan(optimizeSchedule(tasks, windowHours, params, CONSTANTS).blocks);

	if (steps.filter((id) => id !== null).length < 3) return null;

	const funded = tasks.filter((t) => steps.includes(t.id));

	if (funded.length === 0) return null;

	const duty = [...funded].sort((x, y) => amplitude(x) - amplitude(y))[0].id;
	const allOpen = new Set(tasks.map((t) => t.id));
	const dutyClosed = new Set([...allOpen].filter((id) => id !== duty));

	// The grind is pure EXTENSION past the stop — the day's own breaks are left
	// where they were. Overwriting one would delete recovery as well as adding
	// work, which is a different perturbation from the one under test.
	const grind = [
		...steps,
		...Array.from(
			{
				length: EXTRA_STEPS,
			},
			() => duty,
		),
	];

	const cut = steps.slice(0, steps.lastIndexOf(duty) + 1);

	return {
		tasks,
		windowHours,
		duty,
		observations: {
			rational: observationFrom(tasks, windowHours, steps, allOpen),
			'overwork-open': observationFrom(tasks, windowHours, grind, allOpen),
			'overwork-done': observationFrom(tasks, windowHours, grind, dutyClosed),
			'early-stop': observationFrom(tasks, windowHours, cut, dutyClosed),
		},
	};
}

const LAMBDAS = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
const USERS_PER_LAMBDA = 10;
const DAY_COUNT = 10;

interface SimulatedUser {
	lambda: number;
	params: EnergyParams;
	days: Day[];
}

let cached: SimulatedUser[] | null = null;

/** Built on first use, not at import: the optimizer runs are the whole cost. */
function population(): SimulatedUser[] {
	if (cached !== null) return cached;

	const random = mulberry32(0x0b11a5);

	cached = Array.from(
		{
			length: LAMBDAS.length * USERS_PER_LAMBDA,
		},
		(_, u) => {
			const lambda = LAMBDAS[u % LAMBDAS.length];

			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: lambda,
			};

			const days: Day[] = [];

			for (let attempt = 0; attempt < DAY_COUNT * 6 && days.length < DAY_COUNT; attempt++) {
				const day = buildDay(random, params);

				if (day !== null) days.push(day);
			}

			return {
				lambda,
				params,
				days,
			};
		},
	);

	return cached;
}

/** The day's point under one repair, or null where that repair censors it. */
function pointUnder(day: Day, arm: Arm, fix: Fix, params: EnergyParams): number | null {
	const observation = day.observations[arm];

	if (fix === 'day-censored')
		return observation.workedHours.some((w) => w.taskId === day.duty && w.hours > 0)
			? null
			: pointOf(bracketOf(observation, params));

	return pointOf(bracketOf(observation, params, fix === 'scope-excluded' ? day.duty : undefined));
}

function pointOf(reading: Reading): number | null {
	return isCensored(reading) ? null : (reading.stopBound + reading.hi) / 2;
}

/** `fitStoppingValue`'s closed form over points the replica produced. */
function fitFrom(points: number[]): number {
	if (points.length === 0) return FALLBACK;

	const clamp = (x: number) => Math.min(Math.max(x, STOP_FIT_MIN), STOP_FIT_MAX);

	return clamp(
		(points.reduce((s, p) => s + p, 0) + STOP_PRIOR_STRENGTH * clamp(FALLBACK)) /
			(points.length + STOP_PRIOR_STRENGTH),
	);
}

const fmt = (x: number, digits = 3) => (Number.isFinite(x) ? x.toFixed(digits) : 'n/a');

function stats(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);

	return {
		mean: values.reduce((s, x) => s + x, 0) / values.length,
		rmse: Math.sqrt(values.reduce((s, x) => s + x * x, 0) / values.length),
		p10: sorted[Math.floor(0.1 * values.length)],
		p90: sorted[Math.floor(0.9 * values.length)],
	};
}

interface Cell {
	user: SimulatedUser;
	day: Day;
}

/** Every (user, day) pair, flat — the loops below stay two deep on it. */
const cells = (): Cell[] =>
	population().flatMap((user) =>
		user.days.map((day) => ({
			user,
			day,
		})),
	);

/** One arm read under one repair, over the whole population. */
function score(arm: Arm, fix: Fix) {
	const errors: number[] = [];
	let kept = 0;
	let total = 0;
	let unfitted = 0;

	for (const user of population()) {
		const points = user.days
			.map((day) => pointUnder(day, arm, fix, user.params))
			.filter((p): p is number => p !== null);

		errors.push(fitFrom(points) - user.lambda);
		kept += points.length;
		total += user.days.length;

		if (points.length === 0) unfitted++;
	}

	return {
		...stats(errors),
		keptShare: kept / total,
		unfitted,
	};
}

/**
 * The shipped `StopBracket` as the replica reports it: both sides present, `lo`
 * floored at 0 — or null on a day the shipped reading gives only one side of,
 * which is the same day the replica censors.
 */
function sidesOf(bracket: ReturnType<typeof stopBracket>): Bracket | null {
	if (bracket === null || bracket.lo === null || bracket.hi === null) return null;

	return {
		stopBound: Math.max(0, bracket.lo),
		hi: bracket.hi,
	};
}

const median = (values: number[]) =>
	values.length === 0 ? NaN : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe('obligation and the §8.10 λ₀ fit', () => {
	it('validates the replica against the shipped reading', () => {
		let compared = 0;
		let mismatched = 0;
		let worst = 0;

		for (const { user, day } of cells()) {
			for (const arm of ARMS) {
				const observation = day.observations[arm];
				const shipped = stopBracket(observation, user.params, CONSTANTS);
				const replica = bracketOf(observation, user.params);

				compared++;

				const sides = sidesOf(shipped);
				const mine = isCensored(replica) ? null : replica;

				if (sides === null || mine === null) {
					mismatched += (sides === null) === (mine === null) ? 0 : 1;
					continue;
				}

				const delta = Math.max(
					Math.abs(sides.stopBound - mine.stopBound),
					Math.abs(sides.hi - mine.hi),
				);

				worst = Math.max(worst, delta);

				if (delta > 1e-9) mismatched++;
			}
		}

		console.log(
			`\nreplica vs shipped stopBracket, BOTH sides: ${compared} days compared, ${mismatched} mismatched, worst |Δ| ${worst.toExponential(2)}`,
		);

		console.log('(a nonzero mismatch count invalidates every number below)');
	});

	it('validates the closed form against the shipped fit', () => {
		let compared = 0;
		let mismatched = 0;
		let worst = 0;

		for (const user of population()) {
			const observations = user.days.map((day) => day.observations['overwork-done']);
			const shipped = fitStoppingValue(observations, FALLBACK, user.params, CONSTANTS);

			const replica = fitFrom(
				observations
					.map((observation) => stopIndifferencePoint(observation, user.params, CONSTANTS))
					.filter((p): p is number => p !== null),
			);

			compared++;
			worst = Math.max(worst, Math.abs(shipped.value - replica));

			if (Math.abs(shipped.value - replica) > 1e-9) mismatched++;
		}

		console.log(
			`replica fit vs fitStoppingValue: ${compared} users compared, ${mismatched} mismatched, worst |Δ| ${worst.toExponential(2)}`,
		);
	});

	it('prices the two repairs against shipping nothing', () => {
		const users = population();

		console.log(
			`\n${users.length} users × ${DAY_COUNT} days, λ₀ ∈ ${LAMBDAS.join('/')}, grind = +${EXTRA_STEPS} steps\n`,
		);

		console.log('arm             fix              bias    RMSE    p10     p90    kept/day  no fit');

		for (const arm of ARMS) {
			for (const fix of FIXES) {
				const s = score(arm, fix);

				console.log(
					`${arm.padEnd(15)} ${fix.padEnd(15)} ${fmt(s.mean)}  ${fmt(s.rmse)}  ${fmt(s.p10)}  ` +
						`${fmt(s.p90)}  ${fmt(s.keptShare, 2)}      ${s.unfitted}`,
				);
			}
		}
	});

	it('reports what a partly-compelled history costs', () => {
		const users = population();

		console.log('\nOnly a SHARE of the days compelled, the rest rational:');
		console.log('share  arm             bias    RMSE');

		for (const share of [0.2, 0.3, 0.5]) {
			for (const arm of ['overwork-done', 'early-stop'] as const) {
				const random = mulberry32(0x0b11d1);

				const errors = users.map((user) => {
					const points = user.days
						.map((day) =>
							pointUnder(day, random() < share ? arm : 'rational', 'shipped', user.params),
						)
						.filter((p): p is number => p !== null);

					return fitFrom(points) - user.lambda;
				});

				const s = stats(errors);

				console.log(`${fmt(share, 2)}   ${arm.padEnd(15)} ${fmt(s.mean)}  ${fmt(s.rmse)}`);
			}
		}
	});

	it('reports the 🪫-rating channel: λ₀ read under a mis-fitted α', () => {
		console.log('\nRational days only, read under a mis-fitted α (§8.7 conditions §8.10):');
		console.log('α scale  bias    RMSE');

		for (const scale of [0.5, 0.75, 1, 1.5, 2]) {
			const errors = population().map((user) => {
				const read = {
					...user.params,
					alphaCog: user.params.alphaCog * scale,
					alphaPhys: user.params.alphaPhys * scale,
				};

				const points = user.days
					.map((day) => stopIndifferencePoint(day.observations.rational, read, CONSTANTS))
					.filter((p): p is number => p !== null);

				return fitFrom(points) - user.lambda;
			});

			const s = stats(errors);

			console.log(`${fmt(scale, 2)}     ${fmt(s.mean)}  ${fmt(s.rmse)}`);
		}
	});

	it('reports which censor drops each dropped day', () => {
		const CENSORS = [
			'clock',
			'window-edge',
			'nothing-open',
			'no-whole-step',
			'inversion',
			'empty',
		] as const;

		console.log('\nOf the days each reading loses, which censor took them (share of all days):');
		console.log(`arm             ${CENSORS.map((c) => c.padEnd(13)).join('')}kept`);

		for (const arm of ARMS) {
			const counts = new Map<string, number>();
			let kept = 0;
			let n = 0;

			for (const { user, day } of cells()) {
				const reading = bracketOf(day.observations[arm], user.params);

				n++;

				if (isCensored(reading)) counts.set(reading, (counts.get(reading) ?? 0) + 1);
				else kept++;
			}

			const cells_ = CENSORS.map((c) => fmt((counts.get(c) ?? 0) / n, 2).padEnd(13)).join('');

			console.log(`${arm.padEnd(15)} ${cells_}${fmt(kept / n, 2)}`);
		}
	});

	it('reports how far a compelled day moves its own bracket', () => {
		console.log('\nSame day, compelled reading against its rational one (per-day medians):');
		console.log('arm             Δlo     Δhi     Δmid    censored');

		for (const arm of ARMS) {
			const dLo: number[] = [];
			const dHi: number[] = [];
			const dMid: number[] = [];
			let censored = 0;
			let n = 0;

			for (const { user, day } of cells()) {
				const base = bracketOf(day.observations.rational, user.params);

				if (isCensored(base)) continue;

				const compelled = bracketOf(day.observations[arm], user.params);

				n++;

				if (isCensored(compelled)) {
					censored++;
					continue;
				}

				dLo.push(compelled.stopBound - base.stopBound);
				dHi.push(compelled.hi - base.hi);
				dMid.push((compelled.stopBound + compelled.hi) / 2 - (base.stopBound + base.hi) / 2);
			}

			console.log(
				`${arm.padEnd(15)} ${fmt(median(dLo))}  ${fmt(median(dHi))}  ${fmt(median(dMid))}  ${fmt(censored / n, 2)}`,
			);
		}
	});
});
