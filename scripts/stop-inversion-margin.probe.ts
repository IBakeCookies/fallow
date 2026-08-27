/**
 * The measurements behind MATH.md §8.10's censoring rule and the constant that
 * sets it, `STOP_INVERSION_MARGIN = 0.25`. Three claims, none of them backed:
 *
 *   1. "On arbitrary random compositions about HALF of days invert (89/185)."
 *   2. "optimizer-generated days, and those same days perturbed by ±1 lattice
 *       step of 'mood', produced ZERO inversions on the probe grid" — restated
 *       twice more as "genuinely near-rational days sit nowhere near the
 *       boundary" and "rational and near-rational days never inverted".
 *   3. The margin decomposes as "the hi-side loose-max bias ~+0.1 plus a
 *       lattice bracket half-width ~0.15".
 *
 * Claim 2 is the load-bearing one: it is the entire argument that censoring
 * discards interrupted days and not honest ones. The suite tests the
 * censor/keep BEHAVIOUR on three hand-picked days (`zenith-energy.test.ts`
 * "censors a strongly inverted day … but keeps a mild inversion") and nothing
 * else — not the population rate, not the invariant, not the decomposition.
 *
 * A probe, not a test: every number here moves with the curves, the reservoir
 * law and the lattice.
 *
 * WHAT IT HAS TO REBUILD, AND WHY THAT IS SAFE. `stopIndifferencePoint`
 * returns the bracket MIDPOINT or null; `lo` and `hi` are invisible, and
 * `reconstructStopDay`, `growBy` and `bestNextStep` are all module-private. So
 * the bracket is rebuilt here from exported parts only — `workedHoursByTask`,
 * `evaluateSchedule`'s λ₀-free V = satiatedOutput + terminalBonus, and the
 * canonical amplitude expression — the same replica pattern
 * `stop-advisor.probe.ts` already uses for §8.11.
 *
 * That replica is VALIDATED before any number is believed: on every day the
 * shipped function does NOT censor, the replica's midpoint must equal its
 * return value, and on every day it does censor, the replica must agree the
 * day inverted past the margin. The mismatch count is printed on its own line
 * and a nonzero value invalidates the run — the two would no longer be reading
 * the same bracket.
 *
 * THE OPEN-TASK ARMS. §8.10's `lo` prices the stop against the tasks still
 * OPEN; the margin arms never set `openTaskIds`, the open-task arms below read
 * every day both ways — that difference IS their measurement — and the replica
 * takes the same filter, so the validation gate runs on days carrying
 * completions too. Completion is drawn EXOGENOUSLY: the
 * model has no task size, so "checked off" has no model correlate and the rate
 * is an axis, never a measured frequency.
 *
 * WHAT THE 2026-08-21 RE-RUN CHANGED. `bracketOf` took the shipped
 * `isClockCensored` — a day whose own span, breaks included, leaves no room for
 * another step reveals nothing — and the shipped overhang trim it replicated went
 * with it. The censor gets its own loss category below, read AFTER the
 * worked-hours window edge, so it counts the days lost to their breaks alone.
 *
 * WHAT THE 2026-08-19 RE-RUN CHANGED. `optimizerDay` walks the plan on a WALL
 * CLOCK and emits one row per session with the moment it ended, so a
 * break-carrying day can be expressed at all — it could not before, and that is
 * why the break-omission bias was invisible to this probe. `bracketOf` gained
 * the same recovered structure the shipped `reconstructStopDay` reads, and every
 * inversion figure below is the re-read.
 *
 * EVERY DAY HERE IS A DAY THE APP CAN PRODUCE (2026-08-19). Tasks come from the
 * three integer sliders through the shipped `toEnergyTask`, so `difficulty`
 * carries the 0.3 spillover and the [1, 10] floor `getEffectiveDifficulty`
 * applies and the demands are slider/10 — the hand-built
 * `difficulty: max(mental, physical)` this file drew before understated every
 * mixed task and skipped the floor, and the fixture day carried three values no
 * slider reaches (see `FIXTURE_DAY`). Rows carry the wall-clock moment they
 * ended and `openTaskIds` is the Set `session-history.ts` always builds, because
 * a row without a moment needs corrupt storage and an absent `openTaskIds` is a
 * call the app never makes. The random-composition arms log their sessions BACK
 * TO BACK: an arbitrary composition is not a planned day, no gap recovers from
 * it, and the fallback (summed) reading is what such a day gets — the same
 * reading as before, now from a day the 🪫 form could have written. The
 * `[§8.10 surface]` line below counts what got measured.
 *
 * THE DECOMPOSITION ARM. `hi` is a LOOSE max: it takes the best over all
 * logged tasks of "remove one step from this task", because the real work
 * order is unknown. On an optimizer-generated day the order IS known, so the
 * honest `hi` is the marginal of the step actually worked LAST, and the
 * difference between the two is the loose-max bias. The half-width is
 * (hi − lo)/2 on days that do not invert.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	STOP_INVERSION_MARGIN,
	evaluateSchedule,
	optimizeSchedule,
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

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const CONSTANTS: UserConstants = DEFAULT_USER_CONSTANTS;

/** `taskAmplitude` is internal; §8.10's canonical order is this expression. */
function amplitude(t: EnergyTaskInput): number {
	const E = mapEffort(t.difficulty);
	const beta = mapEnjoyability(t.enjoyment);

	return E * beta + beta / E;
}

const ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');

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
 * order, the space before each one a break, all rest scaled to leave one step of
 * room. Null on the days the shipped reader falls back on.
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
 * clock's (§8.10).
 */
function isClockCensored(
	observation: StopObservation,
	rest: ReturnType<typeof recoveredRest>,
	total: number,
): boolean {
	if (rest === null) return false;

	return total + rest.restTotal + DEFAULT_STEP_HOURS > observation.windowHours + 1e-9;
}

interface Bracket {
	lo: number;
	hi: number;
	/** stopBound = max(0, lo) — the value the shipped censoring test uses. */
	stopBound: number;
	inverted: boolean;
	censored: boolean;
	midpoint: number | null;
	gap: number;
	/** Loose-max hi minus the hi implied by a known last-worked task. */
	looseBias: number | null;
}

/**
 * §8.10's bracket, rebuilt from exported parts. `lastWorkedTaskId`, when the
 * caller knows the real work order, enables the loose-max bias measurement.
 */
function bracketOf(
	observation: StopObservation,
	params: EnergyParams,
	lastWorkedTaskId?: number,
): Bracket | null {
	const { tasks, windowHours, openTaskIds } = observation;

	if (windowHours <= 0 || tasks.length === 0) return null;

	// `reconstructStopDay`'s `candidates` field: omitted means
	// every task was open, and nothing left open leaves no step to decline.
	const candidates = openTaskIds === undefined ? tasks : tasks.filter((t) => openTaskIds.has(t.id));

	if (candidates.length === 0) return null;

	const byTask = workedHoursByTask(tasks, observation.workedHours);

	if (byTask.size === 0) return null;

	const canonical = [...tasks].sort((x, y) => amplitude(y) - amplitude(x));
	const rank = new Map(canonical.map((t, i) => [t.id, i]));
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const rest = recoveredRest(observation, byTask);

	// The shipped `stopBracket`'s first line: a day that ran out of wall clock
	// reveals nothing, before any bound is priced.
	if (isClockCensored(observation, rest, total)) return null;

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
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, CONSTANTS);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	// `growBy`: the LAST block of a logged task grows; an unlogged task enters at
	// ITS canonical rank among the WORK blocks. Nothing trims the overhang: past
	// the clock censor the grown day fits the window, which is why the shipped
	// overhang trim was deleted too (2026-08-21).
	const grown = (t: EnergyTaskInput, hours: number): ScheduleBlock[] => {
		if (byTask.has(t.id)) {
			const last = lastBlockOf(t.id);

			return sched.map((b, i) =>
				i === last
					? {
							...b,
							hours: b.hours + hours,
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
				hours,
			},
			...sched.slice(index),
		];
	};

	/** `shrinkBy`: one step off the END of that task's work, across its blocks. */
	const shrunk = (taskId: number): ScheduleBlock[] => {
		const out = [...sched];
		let left = step;

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

	// lo: no room to extend is a structural censor, not an inversion.
	if (total + step > windowHours + 1e-9) return null;

	let lo = -Infinity;

	for (const t of candidates) lo = Math.max(lo, (workValue(grown(t, step)) - base) / step);

	let hi: number | null = null;

	for (const t of tasks)
		if ((byTask.get(t.id) ?? 0) >= step - 1e-9)
			hi = Math.max(hi ?? -Infinity, (base - workValue(shrunk(t.id))) / step);

	if (hi === null) return null;

	const stopBound = Math.max(0, lo);
	const censored = stopBound > hi + STOP_INVERSION_MARGIN;

	const tightHi =
		lastWorkedTaskId !== undefined && (byTask.get(lastWorkedTaskId) ?? 0) >= step - 1e-9
			? (base - workValue(shrunk(lastWorkedTaskId))) / step
			: null;

	return {
		lo,
		hi,
		stopBound,
		inverted: stopBound > hi,
		censored,
		midpoint: censored ? null : (stopBound + hi) / 2,
		gap: stopBound - hi,
		looseBias: tightHi === null ? null : hi - tightHi,
	};
}

/**
 * One task as the form holds it: the three sliders are integers (difficulty
 * 0–10, enjoyment 1–10) and `toEnergyTask` derives everything the model reads,
 * so nothing here can describe a task the user cannot enter. Drawn the same way
 * `scripts/stop-block-structure.probe.ts` draws its days.
 */
function drawTask(random: () => number, id: number): EnergyTaskInput {
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	const task: Task = {
		id,
		title: `t${id}`,
		mentalDifficulty: slider(0),
		physicalDifficulty: slider(0),
		enjoyment: slider(1),
		createdAt: '2026-08-19',
		completed: false,
	};

	return toEnergyTask(task);
}

/**
 * An arbitrary composition as the 🪫 form would hold it: the sessions logged
 * back to back from the start of the window, each carrying the moment it ended.
 * No gap recovers from that, so the reconstruction falls back to the summed
 * reading — which is the reading an unplanned composition gets either way.
 */
function loggedBackToBack(
	rows: Array<{ taskId: number; hours: number }>,
): StopObservation['workedHours'] {
	let clock = 0;

	return rows.map((row) => {
		clock += row.hours;

		return {
			...row,
			endedAt: ORIGIN + clock * 3_600_000,
		};
	});
}

/**
 * Rows and windows the app cannot hold: a 🪫 row is whole minutes in [1, 960]
 * carrying its log moment, and the budget bar's window is (0, 24].
 */
function offSurfaceRows(observation: StopObservation): number {
	if (!(observation.windowHours > 0 && observation.windowHours <= 24))
		return observation.workedHours.length;

	return observation.workedHours.filter((row) => {
		const minutes = row.hours * 60;

		return (
			!Number.isFinite(row.endedAt) ||
			minutes < 1 ||
			minutes > 960 ||
			Math.abs(minutes - Math.round(minutes)) > 1e-9
		);
	}).length;
}

function drawDay(random: () => number): { tasks: EnergyTaskInput[]; windowHours: number } {
	return {
		tasks: Array.from(
			{
				length: 2 + Math.floor(random() * 3),
			},
			(_, i) => drawTask(random, i + 1),
		),
		windowHours: 6 + Math.round(random() * 8),
	};
}

/**
 * Every ±1-lattice-step "mood" variant of a day: one logged SESSION moved by one
 * step, everything else held — its log moment stands, so the session that moved
 * runs 45 min longer or shorter into the same break. Claim 2's near-rational
 * population.
 */
function moodVariants(
	observation: StopObservation,
): Array<{ moved: StopObservation; label: string }> {
	return observation.workedHours.flatMap((entry, index) =>
		[-DEFAULT_STEP_HOURS, DEFAULT_STEP_HOURS]
			.map((delta) => entry.hours + delta)
			.filter((hours) => hours > 0)
			.map((hours) => ({
				moved: {
					...observation,
					workedHours: observation.workedHours.map((w, i) =>
						i === index
							? {
									...w,
									hours,
								}
							: w,
					),
				},
				label: `task ${entry.taskId} ${entry.hours}h→${hours}h`,
			})),
	);
}

function paramsAt(lambda: number): EnergyParams {
	return {
		...DEFAULT_ENERGY_PARAMS,
		freeTimeValue: lambda,
	};
}

const LAMBDAS = [0.3, 0.5, 0.9, 1.3];
/**
 * The instrument's own resolution: the median bracket half-width claim 3 below
 * measures — 0.125 over 175 non-inverted days, every one of them a day the app
 * can produce, and every one of them past the clock censor (2026-08-21; 0.129
 * over 274 days before it). Re-read it whenever claim 3's median moves.
 */
const BRACKET_HALF_WIDTH = 0.125;

/**
 * §8.10's fixture day — the witness the 2026-08-12 open-task correction was
 * argued on — re-declared from the sliders it takes to enter it, because three
 * of the fields it used to carry by hand had no slider behind them: guitar's
 * difficulty 6 (its demands 0.4/0.3 pin the sliders to 4/3, which
 * `getEffectiveDifficulty` sends to 4.9), reading's difficulty 4 (below the 5.0
 * floor of cognitiveDemand 0.5) and reading's physicalDemand 0.05 (the demands
 * are slider/10, so tenths only). The three DIFFICULTIES are what the day's own
 * findings are stated in — the canonical amplitudes 10.4 / 6.67 / 4.60 and the
 * order they impose — so they are what is held here, and the secondary demands
 * are what moves: guitar 0.4/0.3 → 0.6/0.0 (sliders 6 mental, 0 physical) and
 * reading 0.5/0.05 → 0.4/0.0 (sliders 4 mental, 0 physical). Boxing was already
 * reachable: sliders 2/10 give difficulty min(10, 10 + 0.3·2) = 10 with demands
 * 0.2/1.0 exactly as declared. `zenith-energy.test.ts`'s §8.10 fixture declares
 * the same three tasks field for field.
 */
const FIXTURE_DAY: EnergyTaskInput[] = (
	[
		{
			id: 1,
			title: 'boxing',
			mentalDifficulty: 2,
			physicalDifficulty: 10,
			enjoyment: 10,
		},
		{
			id: 2,
			title: 'guitar',
			mentalDifficulty: 6,
			physicalDifficulty: 0,
			enjoyment: 9,
		},
		{
			id: 3,
			title: 'reading',
			mentalDifficulty: 4,
			physicalDifficulty: 0,
			enjoyment: 7,
		},
	] satisfies Array<Omit<Task, 'createdAt' | 'completed'>>
).map((task) =>
	toEnergyTask({
		...task,
		createdAt: '2026-08-19',
		completed: false,
	}),
);

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function fmt(x: number): string {
	return Number.isFinite(x) ? x.toFixed(3) : 'n/a';
}

function share(n: number, of: number): string {
	return of > 0 ? ((100 * n) / of).toFixed(1) : 'n/a';
}

/**
 * The optimizer's plan for a day, as a §8.10 observation plus its real work
 * order. Each session is one row carrying the wall-clock moment it ended — the
 * plan's rest blocks pass on the clock, so the day's breaks survive into the
 * observation exactly as a user logging each session would have recorded them.
 */
function optimizerDay(
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams,
): { observation: StopObservation; lastWorkedTaskId?: number } | null {
	const plan = optimizeSchedule(tasks, windowHours, params, CONSTANTS);
	const worked = plan.evaluation.blocks.filter((b) => b.taskId !== null);

	if (worked.length === 0) return null;

	const workedHours: StopObservation['workedHours'] = [];
	let clock = 0;

	for (const block of plan.evaluation.blocks) {
		clock += block.hours;

		if (block.taskId !== null)
			workedHours.push({
				taskId: block.taskId,
				hours: block.hours,
				endedAt: ORIGIN + clock * 3_600_000,
			});
	}

	return {
		observation: {
			tasks,
			windowHours,
			workedHours,
			openTaskIds: new Set(tasks.map((t) => t.id)),
		},
		lastWorkedTaskId: worked[worked.length - 1].taskId!,
	};
}

const COMPLETION_RATES = [0, 0.25, 0.5, 0.75];

/** One optimizer day re-read at one completion rate. */
interface CompletionCell {
	observation: StopObservation;
	params: EnergyParams;
	rate: number;
	completed: Set<number>;
	openTaskIds: Set<number>;
}

let cachedCompletionCells: CompletionCell[] | null = null;

/**
 * The open-task population: the same `drawDay`/`optimizerDay` generators the
 * margin arms use, on this arm's own seed like every other arm here, each day
 * re-read at every completion rate with each of its tasks independently ticked
 * at probability q from a second stream.
 */
function completionCells(): CompletionCell[] {
	if (cachedCompletionCells !== null) return cachedCompletionCells;

	const random = mulberry32(0x51a005);
	const ticks = mulberry32(0x51a006);

	cachedCompletionCells = Array.from(
		{
			length: 120,
		},
		() => drawDay(random),
	)
		.flatMap((day) =>
			LAMBDAS.map((lambda) => ({
				...day,
				lambda,
			})),
		)
		.flatMap((cell) => {
			const params = paramsAt(cell.lambda);
			const built = optimizerDay(cell.tasks, cell.windowHours, params);

			if (built === null) return [];

			return COMPLETION_RATES.map((rate) => {
				const completed = new Set(cell.tasks.filter(() => ticks() < rate).map((t) => t.id));

				return {
					observation: built.observation,
					params,
					rate,
					completed,
					openTaskIds: new Set(cell.tasks.filter((t) => !completed.has(t.id)).map((t) => t.id)),
				};
			});
		});

	return cachedCompletionCells;
}

/** Shipped against replica on one day: the verdict disagreement and the distance. */
function replicaCheck(
	observation: StopObservation,
	params: EnergyParams,
): { isMismatch: boolean; difference: number } {
	const shipped = stopIndifferencePoint(observation, params, CONSTANTS);
	const replica = bracketOf(observation, params);

	// Null covers structural censors too, so only a replica that claims a usable
	// midpoint is a real disagreement.
	if (shipped === null)
		return {
			isMismatch: replica?.midpoint != null,
			difference: 0,
		};

	if (replica?.midpoint == null)
		return {
			isMismatch: true,
			difference: 0,
		};

	return {
		isMismatch: false,
		difference: Math.abs(replica.midpoint - shipped),
	};
}

const LOSSES = [
	'all-ticked',
	'nothing-worked',
	'sub-step',
	'window-edge',
	'ran-out-of-clock',
	'past-margin',
] as const;

type Loss = (typeof LOSSES)[number];

/**
 * Why §8.10 keeps no point from this day, or null when it does. Several censors
 * can hold at once, so the precedence is fixed here — a share of the losses is
 * only readable if every lost day counts to exactly one of them.
 */
function lossOf(cell: CompletionCell): Loss | null {
	const { observation, params, openTaskIds } = cell;

	if (openTaskIds.size === 0) return 'all-ticked';

	const byTask = workedHoursByTask(observation.tasks, observation.workedHours);

	if (byTask.size === 0) return 'nothing-worked';

	const hours = [...byTask.values()];

	if (!hours.some((h) => h >= DEFAULT_STEP_HOURS - 1e-9)) return 'sub-step';

	const total = hours.reduce((s, h) => s + h, 0);

	if (total + DEFAULT_STEP_HOURS > observation.windowHours + 1e-9) return 'window-edge';

	// Read AFTER the worked-hours edge, so this counts the days lost to their
	// BREAKS alone — the ones the summed reading could not see (§8.10, 2026-08-21).
	if (isClockCensored(observation, recoveredRest(observation, byTask), total))
		return 'ran-out-of-clock';

	return bracketOf(
		{
			...observation,
			openTaskIds,
		},
		params,
	)?.censored
		? 'past-margin'
		: null;
}

describe('MATH.md §8.10 — the inversion detector and its margin', () => {
	it('validates the replica against the shipped stopIndifferencePoint', () => {
		const random = mulberry32(0x51a001);
		let checked = 0;
		let mismatches = 0;
		let worst = 0;
		let rows = 0;
		let offSurface = 0;

		for (let day = 0; day < 400; day++) {
			const { tasks, windowHours } = drawDay(random);
			const params = paramsAt(LAMBDAS[Math.floor(random() * LAMBDAS.length)]);

			const observation: StopObservation = {
				tasks,
				windowHours,
				workedHours: loggedBackToBack(
					tasks
						.filter(() => random() < 0.8)
						.map((t) => ({
							taskId: t.id,
							hours: Math.round(random() * 8) * DEFAULT_STEP_HOURS,
						}))
						.filter((w) => w.hours > 0),
				),
				openTaskIds: new Set(tasks.map((t) => t.id)),
			};

			const check = replicaCheck(observation, params);

			rows += observation.workedHours.length;
			offSurface += offSurfaceRows(observation);
			checked++;

			if (check.isMismatch) mismatches++;

			worst = Math.max(worst, check.difference);
		}

		let ticked = 0;
		let tickedMismatches = 0;
		let tickedWorst = 0;

		for (const cell of completionCells()) {
			const check = replicaCheck(
				{
					...cell.observation,
					openTaskIds: cell.openTaskIds,
				},
				cell.params,
			);

			rows += cell.observation.workedHours.length;
			offSurface += offSurfaceRows(cell.observation);

			for (const variant of moodVariants(cell.observation)) {
				rows += variant.moved.workedHours.length;
				offSurface += offSurfaceRows(variant.moved);
			}

			ticked++;

			if (check.isMismatch) tickedMismatches++;

			tickedWorst = Math.max(tickedWorst, check.difference);
		}

		console.log(
			`[§8.10 replica] ${checked} random observations: ${mismatches} verdict mismatches, ` +
				`worst midpoint difference ${worst.toExponential(3)}`,
		);

		console.log(
			`[§8.10 replica] ${ticked} observations CARRYING completions: ${tickedMismatches} verdict ` +
				`mismatches, worst midpoint difference ${tickedWorst.toExponential(3)}`,
		);

		console.log(
			mismatches === 0 && worst < 1e-9 && tickedMismatches === 0 && tickedWorst < 1e-9
				? '[§8.10 replica] VALID — every number below reads the same bracket the shipped code does'
				: '[§8.10 replica] INVALID — the arms below are measuring a different estimator',
		);

		console.log(
			`[§8.10 surface] every task drawn from integer sliders through toEnergyTask; ${rows} ` +
				`logged rows across the composition, optimizer and ±1-step days: ${offSurface} the app ` +
				`could not hold (whole minutes in [1, 960] carrying a log moment, window in (0, 24])`,
		);
	});

	it('claim 1: arbitrary random compositions invert about half the time', () => {
		const random = mulberry32(0x51a002);
		let usable = 0;
		let inverted = 0;
		let censored = 0;
		const gaps: number[] = [];

		for (let day = 0; day < 600; day++) {
			const { tasks, windowHours } = drawDay(random);
			const params = paramsAt(LAMBDAS[Math.floor(random() * LAMBDAS.length)]);

			const observation: StopObservation = {
				tasks,
				windowHours,
				workedHours: loggedBackToBack(
					tasks
						.filter(() => random() < 0.75)
						.map((t) => ({
							taskId: t.id,
							hours: (1 + Math.floor(random() * 8)) * DEFAULT_STEP_HOURS,
						})),
				),
				openTaskIds: new Set(tasks.map((t) => t.id)),
			};

			const bracket = bracketOf(observation, params);

			if (!bracket) continue;

			usable++;

			if (bracket.inverted) {
				inverted++;
				gaps.push(bracket.gap);
			}

			if (bracket.censored) censored++;
		}

		console.log(
			`[§8.10 claim 1] random compositions: ${inverted}/${usable} inverted ` +
				`(${((100 * inverted) / usable).toFixed(1)}%), ${censored} censored past the margin`,
		);

		console.log(
			`[§8.10 claim 1] inversion gap: median ${fmt(quantile(gaps, 0.5))}, ` +
				`p90 ${fmt(quantile(gaps, 0.9))}, max ${fmt(Math.max(...gaps))}`,
		);
	});

	it('claim 2: optimizer days and ±1-step "mood" days never invert', () => {
		const random = mulberry32(0x51a003);
		let rationalDays = 0;
		let rationalInverted = 0;
		let moodDays = 0;
		let moodInverted = 0;
		let moodPastMargin = 0;
		let worstMoodGap = -Infinity;
		let worstWitness = '';

		// Flattened into one (day, λ₀) list rather than nested loops, so the body
		// below stays inside `max-depth` — `scripts/**` gets no exemption.
		const cells = Array.from(
			{
				length: 120,
			},
			() => drawDay(random),
		).flatMap((day) =>
			LAMBDAS.map((lambda) => ({
				...day,
				lambda,
			})),
		);

		for (const cell of cells) {
			const params = paramsAt(cell.lambda);
			const built = optimizerDay(cell.tasks, cell.windowHours, params);

			if (!built) continue;

			const rational = bracketOf(built.observation, params, built.lastWorkedTaskId);

			if (rational) {
				rationalDays++;
				rationalInverted += rational.inverted ? 1 : 0;
			}

			for (const variant of moodVariants(built.observation)) {
				const bracket = bracketOf(variant.moved, params);

				if (!bracket) continue;

				moodDays++;

				if (!bracket.inverted) continue;

				moodInverted++;
				moodPastMargin += bracket.censored ? 1 : 0;

				if (bracket.gap <= worstMoodGap) continue;

				worstMoodGap = bracket.gap;

				worstWitness =
					`λ₀=${cell.lambda} window=${cell.windowHours}h ${variant.label} ` +
					`lo=${fmt(bracket.stopBound)} hi=${fmt(bracket.hi)}`;
			}
		}

		console.log(`[§8.10 claim 2] optimizer days: ${rationalInverted}/${rationalDays} inverted`);

		console.log(
			`[§8.10 claim 2] ±1-step mood days: ${moodInverted}/${moodDays} inverted, ` +
				`${moodPastMargin} of them PAST the ${STOP_INVERSION_MARGIN} margin — i.e. censored`,
		);

		console.log(
			`[§8.10 claim 2] worst mood-day gap ${fmt(worstMoodGap)}${worstWitness ? ` @ ${worstWitness}` : ''}`,
		);
	});

	it('claim 3: the margin decomposes as ~0.1 loose-max bias + ~0.15 half-width', () => {
		const random = mulberry32(0x51a004);
		const biases: number[] = [];
		const halfWidths: number[] = [];

		for (let day = 0; day < 120; day++) {
			const { tasks, windowHours } = drawDay(random);

			for (const lambda of LAMBDAS) {
				const params = paramsAt(lambda);
				const built = optimizerDay(tasks, windowHours, params);

				if (!built) continue;

				const bracket = bracketOf(built.observation, params, built.lastWorkedTaskId);

				if (!bracket) continue;

				if (bracket.looseBias !== null) biases.push(bracket.looseBias);

				if (!bracket.inverted) halfWidths.push((bracket.hi - bracket.stopBound) / 2);
			}
		}

		const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

		console.log(
			`[§8.10 claim 3] hi-side loose-max bias over ${biases.length} optimizer days: ` +
				`mean ${fmt(mean(biases))}, median ${fmt(quantile(biases, 0.5))}, ` +
				`p90 ${fmt(quantile(biases, 0.9))}`,
		);

		console.log(
			`[§8.10 claim 3] bracket half-width over ${halfWidths.length} non-inverted days: ` +
				`mean ${fmt(mean(halfWidths))}, median ${fmt(quantile(halfWidths, 0.5))}, ` +
				`p90 ${fmt(quantile(halfWidths, 0.9))}`,
		);

		console.log(
			`[§8.10 claim 3] the two medians sum to ` +
				`${fmt(quantile(biases, 0.5) + quantile(halfWidths, 0.5))} against the shipped ` +
				`STOP_INVERSION_MARGIN = ${STOP_INVERSION_MARGIN}`,
		);
	});

	it('measures the open-task witness the 2026-08-12 correction was argued on', () => {
		const observation: StopObservation = {
			tasks: FIXTURE_DAY,
			windowHours: 12,
			workedHours: [
				{
					taskId: 1,
					hours: 2.25,
					endedAt: ORIGIN + 2.25 * 3_600_000,
				},
			],
			openTaskIds: new Set(FIXTURE_DAY.map((t) => t.id)),
		};

		const allOpen = stopIndifferencePoint(observation, DEFAULT_ENERGY_PARAMS, CONSTANTS);

		const filtered = stopIndifferencePoint(
			{
				...observation,
				openTaskIds: new Set([2, 3]),
			},
			DEFAULT_ENERGY_PARAMS,
			CONSTANTS,
		);

		const shift = allOpen! - filtered!;

		console.log(
			`[§8.10 witness] fixture day, 2.25h on boxing: point over ALL tasks ${fmt(allOpen!)}, ` +
				`over the two left open ${fmt(filtered!)} — shift ${fmt(shift)}, ` +
				`${fmt(shift / BRACKET_HALF_WIDTH)}× the ${BRACKET_HALF_WIDTH} bracket half-width`,
		);
	});

	it('measures how far the open-task filter moves the day’s point', () => {
		console.log(
			'[§8.10 open-task] completion is drawn EXOGENOUSLY — the model has no task size, so ' +
				'"checked off" has no model correlate and q is an axis, never a measured frequency',
		);

		for (const rate of COMPLETION_RATES) {
			const shifts: number[] = [];
			const loggedOnly: number[] = [];
			const unloggedOnly: number[] = [];

			for (const cell of completionCells().filter((c) => c.rate === rate)) {
				const allOpen = stopIndifferencePoint(cell.observation, cell.params, CONSTANTS);

				const filtered = stopIndifferencePoint(
					{
						...cell.observation,
						openTaskIds: cell.openTaskIds,
					},
					cell.params,
					CONSTANTS,
				);

				if (allOpen === null || filtered === null) continue;

				shifts.push(allOpen - filtered);

				const logged = workedHoursByTask(cell.observation.tasks, cell.observation.workedHours);
				const completed = [...cell.completed];

				if (completed.length === 0) continue;

				if (completed.every((id) => logged.has(id))) loggedOnly.push(allOpen - filtered);
				else if (completed.every((id) => !logged.has(id))) unloggedOnly.push(allOpen - filtered);
			}

			const over = shifts.filter((s) => s > BRACKET_HALF_WIDTH).length;
			const exactlyZero = shifts.filter((s) => s <= 1e-9).length;

			console.log(
				`[§8.10 open-task] q=${rate.toFixed(2)}: ${shifts.length} days two-sided under BOTH scopes — ` +
					`shift median ${fmt(quantile(shifts, 0.5))}, p90 ${fmt(quantile(shifts, 0.9))}, ` +
					`max ${fmt(Math.max(...shifts))}; over the ${BRACKET_HALF_WIDTH} half-width ` +
					`${share(over, shifts.length)}%, exactly zero ${share(exactlyZero, shifts.length)}%`,
			);

			console.log(
				`[§8.10 open-task] q=${rate.toFixed(2)}: completions of LOGGED tasks only — median ` +
					`${fmt(quantile(loggedOnly, 0.5))} over ${loggedOnly.length} days; of tasks with NO hours ` +
					`logged — median ${fmt(quantile(unloggedOnly, 0.5))} over ${unloggedOnly.length} days`,
			);
		}
	});

	it('counts how many days the fifth censoring category discards', () => {
		const tasksPerDay = completionCells().map((c) => c.observation.tasks.length);

		console.log(
			`[§8.10 fifth category] the category fires only when EVERY one of a day's tasks is ticked — ` +
				`one task left open, funded or not, keeps the day alive. Days carry ` +
				`${Math.min(...tasksPerDay)}–${Math.max(...tasksPerDay)} tasks, mean ` +
				`${(tasksPerDay.reduce((s, n) => s + n, 0) / tasksPerDay.length).toFixed(2)}`,
		);

		for (const rate of COMPLETION_RATES) {
			const cells = completionCells().filter((c) => c.rate === rate);

			const counts: Record<Loss, number> = {
				'all-ticked': 0,
				'nothing-worked': 0,
				'sub-step': 0,
				'window-edge': 0,
				'ran-out-of-clock': 0,
				'past-margin': 0,
			};

			let kept = 0;
			let shippedKept = 0;

			for (const cell of cells) {
				const loss = lossOf(cell);

				const point = stopIndifferencePoint(
					{
						...cell.observation,
						openTaskIds: cell.openTaskIds,
					},
					cell.params,
					CONSTANTS,
				);

				if (point !== null) shippedKept++;

				if (loss === null) kept++;
				else counts[loss]++;
			}

			const lost = cells.length - kept;

			const breakdown = LOSSES.map(
				(loss) =>
					`${loss} ${counts[loss]} (${share(counts[loss], lost)}% of losses, ${share(counts[loss], cells.length)}% of days)`,
			).join(', ');

			console.log(
				`[§8.10 fifth category] q=${rate.toFixed(2)}: ${cells.length} days, kept ${kept} ` +
					`(${share(kept, cells.length)}%), lost ${lost} — ${breakdown}`,
			);

			console.log(
				`[§8.10 fifth category] q=${rate.toFixed(2)}: cross-check — the shipped ` +
					`stopIndifferencePoint keeps ${shippedKept}, this categorisation keeps ${kept}` +
					`${shippedKept === kept ? '' : ' — MISMATCH, the shares above are fiction'}`,
			);
		}
	});
});
