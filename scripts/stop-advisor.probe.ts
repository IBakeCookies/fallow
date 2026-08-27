/**
 * Measurements behind MATH.md §8.11's one-step-vs-session table — the whole
 * justification for `adviseStop` pricing SESSIONS rather than §8.10's own
 * one-step marginal. The table was quoted from a sweep that was never
 * committed, so this file is that sweep, rebuilt.
 *
 * A probe, not a test: it answers "what is true of the advisor over a large
 * input space" and prints rates, where a test answers "does this still hold"
 * and is binary. Every number below moves whenever the optimizer, the curves
 * or the reservoir law move — legitimately, and without being a regression —
 * which is why this runs on demand (`npm run probe`) and never in `npm test`.
 * What it found is pinned in the suite by two fixtures in
 * `zenith-energy.test.ts` instead: "looks ahead past the warm-up ramp", and
 * the λ₀ = 0.9 mid-day checkpoint where the one-step arm would cry stop.
 *
 * DESIGN. Ground truth is the optimizer's own plan under the day's λ₀, walked
 * chronologically in 45-min steps; at every checkpoint the advisor sees ONLY
 * the day so far (a `StopObservation`, exactly what the store hands it in-day).
 * Truth says "continue" while the plan still has work and "stop" at its last
 * step, so a mid-day `stop` verdict is a FALSE STOP and a `continue` at the
 * plan's end is LATENESS.
 *
 * The walk carries a WALL CLOCK (2026-08-19), which advances across the plan's
 * rest blocks too, so each checkpoint's rows carry the log moment a user who
 * logged each session as it finished would have written — and the advisor
 * reconstructs the day's real breaks from them (§8.10). Without the clock the
 * probe could only express a break-free day, which is why the break-omission
 * bias was invisible here for five audit rounds. Every rate below is reported
 * against the same walk read the pre-2026-08-19 way (`summed`), because the
 * pair is the measurement.
 *
 * EVERY DAY IS ON THE SLIDER SURFACE (ROADMAP M49, 2026-08-27). Both
 * generators — `randomDays` and the `WARMUP_HEAVY` fixture — draw their tasks
 * from the three integer sliders through the shipped `toEnergyTask`, so
 * `difficulty` is never a free knob beside the two demands but
 * `getEffectiveDifficulty`'s dominant + 0.3·secondary. Until this date they
 * were hand-built and off that surface, which is why the rates below are all
 * re-read and none is the pre-2026-08-27 figure. What the re-reading changed:
 * every number moved and no verdict did — the session arm still beats the
 * one-step arm at every λ₀ and by MORE (λ₀ 1.3 goes 19.1% → 0.6% off-surface
 * to 28.1% → 0.0% on it), at-stop agreement is still identical between the two
 * in every row, the day's own breaks still beat the summed reading everywhere,
 * and the candidate filter still helps in the same direction.
 *
 * The one-step arm is the m = 1 slice of the advisor's search. It is not
 * implemented anywhere (the fit's `lo` bound is internal), so it is rebuilt
 * here out of exported parts only — `workedHoursByTask`, the canonical
 * amplitude order, `evaluateSchedule`'s λ₀-free V = satiatedOutput +
 * terminalBonus. That replica is VALIDATED before any rate is believed: its
 * max over all admissible m must equal `adviseStop`'s own `marginalValue` at
 * every checkpoint, and the mismatch count is printed on its own line. A
 * nonzero count invalidates the whole run — the two arms would no longer be
 * the same search at two lookaheads.
 *
 * THE CANDIDATE-FILTER ARM. §8.11 may only RECOMMEND a task still open
 * (`openTaskIds`), and the one-step-vs-session arm never sets the field. The
 * second arm runs the same walk with the filter on and off, deriving completion
 * from the plan itself — a task is checked off exactly when the remaining plan
 * holds no more blocks for it — so the rates above stay a draw with no
 * completions in it.
 *
 * THE CENSOR ARM (ROADMAP M39, 2026-08-27). §8.10 drops a day whose bracket
 * inverts past `STOP_INVERSION_MARGIN`; `adviseStop` reads the same
 * reconstruction and refuses nothing. MATH.md §8.11 argues the censor's
 * premise does not survive the change of direction; this arm prices the
 * proposal anyway — withhold the card wherever `stopBracket` would refuse the
 * day — against the same optimizer ground truth.
 *
 * It found the censor strictly harmful mid-day and unhelpful at the stop. The
 * inverted cell is 8.3–16.4% of every checkpoint the card speaks on, and the
 * advisor's mid-day false-stop count in it is ZERO at all four λ₀ on both
 * populations — 0 of 118, 110, 88 and 23 random-day checkpoints and 0 of 16,
 * 17, 27 and 16 on the warm-up fixture, against 8 of 1,811 and 4 of 587
 * everywhere else. Censoring therefore removes no wrong verdict and silences
 * 339 + 76 correct `continue`s. At the stop moment the signal is real but tiny
 * and split: agreement on the inverted cell is 8/20 against 213/232 elsewhere,
 * so censoring converts 8 right and 12 wrong verdicts into 20 silences without
 * fixing the 12. Nothing shipped moved.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_USER_CONSTANTS,
	mapEffort,
	mapEnjoyability,
	type UserConstants,
} from '$lib/business/model/zenith';
import {
	adviseStop,
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	evaluateSchedule,
	optimizeSchedule,
	stopBracket,
	workedHoursByTask,
	type EnergyParams,
	type EnergyTaskInput,
	type ScheduleBlock,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
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

interface ProbeDay {
	tasks: EnergyTaskInput[];
	windowHours: number;
}

/**
 * One task as the form holds it: the three sliders are integers (mental and
 * physical difficulty 0–10, enjoyment 1–10) and `toEnergyTask` derives
 * everything the model reads, so nothing here describes a task the user cannot
 * enter. `difficulty` is NOT a free knob beside the demands — it is
 * `getEffectiveDifficulty`'s dominant + 0.3·secondary, which is why the
 * high-amplitude fixture below carries values like 9.6.
 */
const draw = (id: number, mental: number, physical: number, enjoyment: number): EnergyTaskInput =>
	toEnergyTask({
		id,
		title: `t${id}`,
		mentalDifficulty: mental,
		physicalDifficulty: physical,
		enjoyment,
		createdAt: '2026-08-19',
		completed: false,
	} as Task);

/** `taskAmplitude` is internal; §8.11's canonical order is this expression. */
const amplitude = (t: EnergyTaskInput): number => {
	const E = mapEffort(t.difficulty);
	const beta = mapEnjoyability(t.enjoyment);

	return E * beta + beta / E;
};

function randomDays(count: number, seed: number): ProbeDay[] {
	const random = mulberry32(seed);
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	return Array.from(
		{
			length: count,
		},
		() => ({
			tasks: Array.from(
				{
					length: 2 + Math.floor(random() * 3),
				},
				(_, index) => draw(index + 1, slider(0), slider(0), slider(1)),
			),
			windowHours: 6 + Math.floor(random() * 25) * 0.25,
		}),
	);
}

/**
 * Where session-lookahead is most exposed: four high-amplitude tasks with long
 * ϕ, so every candidate is mostly warm-up ramp and the one-step arm undersells
 * all of them — on demands heavy enough to drain the day to a stop INSIDE the
 * window, which is what gives the session arm the room to over-continue past
 * the optimizer's stop (the half of the table it could lose).
 */
const WARMUP_HEAVY: EnergyTaskInput[] = [
	draw(1, 9, 2, 10),
	draw(2, 8, 3, 9),
	draw(3, 8, 2, 10),
	draw(4, 7, 4, 8),
];

const LAMBDAS = [0.3, 0.5, 0.9, 1.3];

type Rows = StopObservation['workedHours'];

const ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');
const at = (clockHours: number) => ORIGIN + clockHours * 3_600_000;

/** A checkpoint on the optimizer's plan: the day so far, and what comes next. */
interface Checkpoint {
	/** One row per session, each with the moment it ended — the 🪫 log's shape */
	rows: Rows;
	/** Funded tasks the remaining plan holds no more blocks for */
	finishedTaskIds: Set<number>;
	/** The plan still has work after this point — truth says "continue" */
	moreWork: boolean;
	/** The very next thing in the plan is a rest block */
	restNext: boolean;
}

/** One more worked step at `endedAt`, extending the open session or starting one. */
function logStep(rows: Rows, taskId: number, hours: number, endedAt: number): void {
	const last = rows[rows.length - 1];

	if (
		last &&
		last.taskId === taskId &&
		Math.abs(last.endedAt! - (endedAt - hours * 3_600_000)) < 1
	) {
		last.hours += hours;
		last.endedAt = endedAt;

		return;
	}

	rows.push({
		taskId,
		hours,
		endedAt,
	});
}

function walkPlan(blocks: ScheduleBlock[]): Checkpoint[] {
	const totalWork = blocks.reduce((sum, b) => (b.taskId === null ? sum : sum + b.hours), 0);
	const planned = new Map<number, number>();

	for (const block of blocks)
		if (block.taskId !== null)
			planned.set(block.taskId, (planned.get(block.taskId) ?? 0) + block.hours);

	const worked = new Map<number, number>();
	const rows: Rows = [];
	let done = 0;
	let clock = 0;

	const snapshot = (restNext: boolean): Checkpoint => ({
		rows: rows.map((r) => ({
			...r,
		})),
		finishedTaskIds: new Set(
			[...worked]
				.filter(([taskId, hours]) => hours >= planned.get(taskId)! - 1e-9)
				.map(([taskId]) => taskId),
		),
		moreWork: done < totalWork - 1e-9,
		restNext,
	});

	// The start of the day is a checkpoint too: "nothing logged yet, is any of
	// this worth doing" is exactly the question the card answers at 09:00.
	const out: Checkpoint[] = [snapshot(blocks[0]?.taskId === null)];

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];

		// Rest still passes on the clock — that is the gap the rows record.
		if (block.taskId === null) {
			clock += block.hours;
			continue;
		}

		let left = block.hours;

		while (left > 1e-9) {
			const hours = Math.min(DEFAULT_STEP_HOURS, left);

			clock += hours;
			worked.set(block.taskId, (worked.get(block.taskId) ?? 0) + hours);
			logStep(rows, block.taskId, hours, at(clock));
			left -= hours;
			done += hours;
			out.push(snapshot(left <= 1e-9 && blocks[i + 1]?.taskId === null));
		}
	}

	return out;
}

/**
 * The wall clock the day's own log moments describe: the first session's start to
 * the last one's end. The same quantity `reconstructStopDay` calls the day's
 * span (worked hours plus the UNCAPPED recovered breaks), read straight off the
 * rows because the walk never logs a session out of order.
 */
const spanHours = (rows: Rows): number =>
	rows.length === 0
		? 0
		: (rows[rows.length - 1].endedAt! - (rows[0].endedAt! - rows[0].hours * 3_600_000)) / 3_600_000;

/** The same day read the pre-2026-08-19 way: rows summed, no moments. */
const summed = (rows: Rows): Rows =>
	rows.map(({ taskId, hours }) => ({
		taskId,
		hours,
	}));

/**
 * `reconstructStopDay`'s recovered block structure, replicated: rows in log
 * order, the space before each one a break, all rest scaled to leave one step of
 * room. `restTotal` is the UNCAPPED sum, which is what the day's span is measured
 * from. Null on the days the shipped reader falls back on — a row with no
 * moment, or no gap to recover.
 */
function loggedStructure(
	observation: StopObservation,
	byTask: Map<number, number>,
	total: number,
): { blocks: ScheduleBlock[]; restTotal: number } | null {
	const rows = observation.workedHours.filter((r) => r.hours > 0 && byTask.has(r.taskId));

	if (rows.some((r) => !Number.isFinite(r.endedAt))) return null;

	const sorted = [...rows].sort((x, y) => x.endedAt! - y.endedAt!);

	const gaps = sorted.map((r, i) =>
		i === 0
			? 0
			: Math.max(0, (r.endedAt! - r.hours * 3_600_000 - sorted[i - 1].endedAt!) / 3_600_000),
	);

	const restTotal = gaps.reduce((sum, gap) => sum + gap, 0);
	const room = Math.max(0, observation.windowHours - total - DEFAULT_STEP_HOURS);
	const scale = Math.min(1, room / restTotal);

	if (!(restTotal * scale > 1e-9)) return null;

	const sched: ScheduleBlock[] = [];

	sorted.forEach((r, i) => {
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

	return {
		blocks: sched,
		restTotal,
	};
}

/**
 * The advisor's search, rebuilt from exported parts because the m = 1 arm the
 * table compares against exists nowhere in the code. `bestOverAllM` is here
 * only to be checked against `adviseStop` — if the replica reproduces the
 * shipped verdict's price, its m = 1 slice is the honest one-step arm.
 * Null when no whole step fits (the advisor's `window-full`).
 */
function searchMarginals(
	observation: StopObservation,
	params: EnergyParams,
	constants: UserConstants,
): { oneStepValue: number; oneStepTaskId: number; bestOverAllM: number } | null {
	const { tasks, windowHours, openTaskIds } = observation;
	// `adviseStop` recommends only tasks still OPEN, and checks the empty set
	// before the window (`adviseStop`'s empty-candidate return precedes its `room`
	// test), and a line number here would rot — name the code, not its address.
	const candidates = openTaskIds === undefined ? tasks : tasks.filter((t) => openTaskIds.has(t.id));

	if (candidates.length === 0) return null;

	const byTask = workedHoursByTask(tasks, observation.workedHours);
	const canonical = [...tasks].sort((x, y) => amplitude(y) - amplitude(x));
	const rank = new Map(canonical.map((t, i) => [t.id, i]));
	// WORKED hours, never the schedule's extent: `room` and `window-full` must
	// not turn on recovered structure (§8.10).
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const structure = loggedStructure(observation, byTask, total);

	const sched: ScheduleBlock[] =
		structure?.blocks ??
		canonical
			.filter((t) => byTask.has(t.id))
			.map((t) => ({
				taskId: t.id,
				hours: byTask.get(t.id)!,
			}));

	const room = Math.floor((windowHours - total) / DEFAULT_STEP_HOURS + 1e-9);

	if (room < 1) return null;

	// The session LENGTHS are capped by the day's span — worked hours plus the
	// UNCAPPED recovered breaks — floored at one step, while `room` above keeps
	// the `window-full` gate on worked hours (M42, §8.11).
	const span = total + (structure?.restTotal ?? 0);

	const longest = Math.max(
		1,
		Math.min(room, Math.floor((windowHours - span) / DEFAULT_STEP_HOURS + 1e-9)),
	);

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, constants);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	// `growBy`: the LAST block of a logged task grows, and an unlogged task enters
	// at ITS canonical rank among the WORK blocks rather than appended. No overhang
	// to pay for since M42 — a session inside the day's own clock always fits.
	const grown = (t: EnergyTaskInput, hours: number): ScheduleBlock[] => {
		if (byTask.has(t.id)) {
			const last = sched.reduce((seen, b, i) => (b.taskId === t.id ? i : seen), -1);

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

	let oneStepValue = -Infinity;
	let oneStepTaskId = candidates[0].id;
	let bestOverAllM = -Infinity;

	for (const t of candidates) {
		for (let m = 1; m <= longest; m++) {
			const hours = m * DEFAULT_STEP_HOURS;
			const avg = (workValue(grown(t, hours)) - base) / hours;

			if (avg > bestOverAllM) bestOverAllM = avg;

			if (m === 1 && avg > oneStepValue) {
				oneStepValue = avg;
				oneStepTaskId = t.id;
			}
		}
	}

	return {
		oneStepValue,
		oneStepTaskId,
		bestOverAllM,
	};
}

interface ArmScore {
	falseStops: number;
	restAdjacentFalseStops: number;
	atStopAgree: number;
	maxLateness: number;
}

const emptyScore = (): ArmScore => ({
	falseStops: 0,
	restAdjacentFalseStops: 0,
	atStopAgree: 0,
	maxLateness: 0,
});

const emptyTally = (): Tally => ({
	one: emptyScore(),
	session: emptyScore(),
	summedSession: emptyScore(),
	midCheckpoints: 0,
	atStopDays: 0,
	windowFull: 0,
	mismatches: 0,
	priced: 0,
	overClock: 0,
	overClockPastFloor: 0,
	overClockContinue: 0,
	overClockMidDay: 0,
});

/** The one place `openTaskIds` enters this probe. */
const observe = (day: ProbeDay, workedHours: Rows, openTaskIds?: ReadonlySet<number>) => ({
	tasks: day.tasks,
	windowHours: day.windowHours,
	workedHours,
	openTaskIds,
});

/**
 * How many extra steps the arm keeps recommending past the optimizer's stop:
 * take its own recommendation one step at a time until it finally says stop.
 * Terminates because every added step eats a step of room.
 */
function lateness(
	day: ProbeDay,
	worked: Rows,
	params: EnergyParams,
	oneStep: boolean,
	openTaskIds?: ReadonlySet<number>,
): number {
	const rows: Rows = worked.map((r) => ({
		...r,
	}));

	// The extra steps are worked from here on, back to back, so they open no new
	// gap: the day's recovered structure is the one it already had.
	let clock = rows.reduce((latest, r) => Math.max(latest, r.endedAt ?? -Infinity), -Infinity);
	let steps = 0;

	for (;;) {
		let taskId: number;

		if (oneStep) {
			const marginals = searchMarginals(
				observe(day, rows, openTaskIds),
				params,
				DEFAULT_USER_CONSTANTS,
			);

			if (marginals === null || marginals.oneStepValue <= params.freeTimeValue) return steps;

			taskId = marginals.oneStepTaskId;
		} else {
			const advice = adviseStop(observe(day, rows, openTaskIds), params, DEFAULT_USER_CONSTANTS);

			if (advice === null || advice.verdict !== 'continue') return steps;

			taskId = advice.taskId;
		}

		clock += DEFAULT_STEP_HOURS * 3_600_000;

		if (Number.isFinite(clock)) logStep(rows, taskId, DEFAULT_STEP_HOURS, clock);
		else {
			const last = rows[rows.length - 1];

			if (last && last.taskId === taskId) last.hours += DEFAULT_STEP_HOURS;
			else
				rows.push({
					taskId,
					hours: DEFAULT_STEP_HOURS,
				});
		}

		steps++;
	}
}

interface Tally {
	one: ArmScore;
	session: ArmScore;
	/** The session arm on the SUMMED reading — the day with its breaks thrown away */
	summedSession: ArmScore;
	midCheckpoints: number;
	atStopDays: number;
	/** No whole step fits: the day filled the window, so neither arm has a verdict */
	windowFull: number;
	/** Replica ≠ shipped search — see the file header */
	mismatches: number;
	/** Priced checkpoints at all — the denominator of the two counts below */
	priced: number;
	/** …whose session is longer than the wall clock the day's own log moments leave */
	overClock: number;
	/** …by more than the one-step floor, which is the part the cap removes */
	overClockPastFloor: number;
	/** …and printed under a `continue`, so the card invites a session the day cannot hold */
	overClockContinue: number;
	/** …of them mid-day rather than at the plan's own stop */
	overClockMidDay: number;
}

function scoreMidDay(score: ArmScore, continues: boolean, restNext: boolean): void {
	if (continues) return;

	score.falseStops++;

	if (restNext) score.restAdjacentFalseStops++;
}

function scoreAtStop(score: ArmScore, continues: boolean, late: () => number): void {
	if (!continues) {
		score.atStopAgree++;

		return;
	}

	score.maxLateness = Math.max(score.maxLateness, late());
}

function scoreDay(day: ProbeDay, params: EnergyParams, tally: Tally): void {
	const plan = optimizeSchedule(day.tasks, day.windowHours, params, DEFAULT_USER_CONSTANTS);

	for (const checkpoint of walkPlan(plan.blocks)) {
		const observation = observe(day, checkpoint.rows);
		const advice = adviseStop(observation, params, DEFAULT_USER_CONSTANTS);
		const marginals = searchMarginals(observation, params, DEFAULT_USER_CONSTANTS);
		const flatRows = summed(checkpoint.rows);
		const flat = adviseStop(observe(day, flatRows), params, DEFAULT_USER_CONSTANTS);

		if (
			advice === null ||
			advice.verdict === 'window-full' ||
			marginals === null ||
			flat === null ||
			flat.verdict === 'window-full'
		) {
			tally.windowFull++;
			continue;
		}

		// The two arms are the same search at two lookaheads, or nothing means
		// anything.
		if (Math.abs(marginals.bestOverAllM - advice.marginalValue) > 1e-9) tally.mismatches++;

		const oneContinues = marginals.oneStepValue > params.freeTimeValue;
		const sessionContinues = advice.verdict === 'continue';
		const flatContinues = flat.verdict === 'continue';

		// §8.11's measured cost of pricing sessions out of WORKED hours: the clock
		// the day has left is the window minus its span, and a session longer than
		// that is one the day cannot hold.
		tally.priced++;

		const left = day.windowHours - spanHours(checkpoint.rows);

		if (advice.sessionHours > left + 1e-9) {
			tally.overClock++;

			if (sessionContinues) tally.overClockContinue++;

			if (checkpoint.moreWork) tally.overClockMidDay++;

			// A day with less than a step of clock left is advised on at one step
			// anyway — the deliberate floor (§8.11). Anything past that is what the
			// cap removes.
			if (advice.sessionHours > Math.max(left, DEFAULT_STEP_HOURS) + 1e-9)
				tally.overClockPastFloor++;
		}

		if (checkpoint.moreWork) {
			tally.midCheckpoints++;
			scoreMidDay(tally.one, oneContinues, checkpoint.restNext);
			scoreMidDay(tally.session, sessionContinues, checkpoint.restNext);
			scoreMidDay(tally.summedSession, flatContinues, checkpoint.restNext);
			continue;
		}

		tally.atStopDays++;
		scoreAtStop(tally.one, oneContinues, () => lateness(day, checkpoint.rows, params, true));

		scoreAtStop(tally.session, sessionContinues, () =>
			lateness(day, checkpoint.rows, params, false),
		);

		scoreAtStop(tally.summedSession, flatContinues, () => lateness(day, flatRows, params, false));
	}
}

function measure(label: string, days: ProbeDay[]): void {
	let mismatches = 0;
	let windowFull = 0;

	const overClock = {
		priced: 0,
		total: 0,
		pastFloor: 0,
		continues: 0,
		midDay: 0,
	};

	for (const freeTimeValue of LAMBDAS) {
		const params: EnergyParams = {
			...DEFAULT_ENERGY_PARAMS,
			freeTimeValue,
		};

		const tally = emptyTally();

		for (const day of days) scoreDay(day, params, tally);

		mismatches += tally.mismatches;
		windowFull += tally.windowFull;
		overClock.priced += tally.priced;
		overClock.total += tally.overClock;
		overClock.pastFloor += tally.overClockPastFloor;
		overClock.continues += tally.overClockContinue;
		overClock.midDay += tally.overClockMidDay;

		const rate = (score: ArmScore) =>
			tally.midCheckpoints > 0
				? ((score.falseStops / tally.midCheckpoints) * 100).toFixed(1)
				: 'n/a';

		console.log(
			`${label} λ₀ ${freeTimeValue.toFixed(1)}: mid-day false stops one-step ${rate(tally.one)}% vs session ${rate(tally.session)}% (of ${tally.midCheckpoints} checkpoints), ` +
				`at-stop agreement one-step ${tally.one.atStopAgree}/${tally.atStopDays} vs session ${tally.session.atStopAgree}/${tally.atStopDays}, ` +
				`max lateness one-step ${tally.one.maxLateness} vs session ${tally.session.maxLateness} steps, ` +
				`session false stops immediately before a planned rest ${tally.session.restAdjacentFalseStops}/${tally.session.falseStops}`,
		);

		console.log(
			`${label} λ₀ ${freeTimeValue.toFixed(1)}: the SAME session arm on the summed reading — ` +
				`mid-day false stops ${rate(tally.summedSession)}%, rest-adjacent ` +
				`${tally.summedSession.restAdjacentFalseStops}/${tally.summedSession.falseStops}, ` +
				`at-stop agreement ${tally.summedSession.atStopAgree}/${tally.atStopDays}, ` +
				`max lateness ${tally.summedSession.maxLateness} steps`,
		);
	}

	console.log(
		`${label}: one-step replica vs adviseStop marginalValue — ${mismatches} mismatches (nonzero invalidates every rate above), ${windowFull} window-full checkpoints excluded`,
	);

	console.log(
		`${label}: the advisor prices a session longer than the day's remaining wall clock at ` +
			`${overClock.total} of ${overClock.priced} priced checkpoints ` +
			`(${overClock.midDay} of them mid-day), ${overClock.continues} of them under a ` +
			`\`continue\`; ${overClock.pastFloor} of them by more than the one-step floor, which is ` +
			`the part the cap removes (§8.11)`,
	);
}

interface ScopeTally {
	comparable: number;
	continueToStop: number;
	stopToContinue: number;
	otherTask: number;
	/** Everything the plan funded is done and nothing unfunded is open */
	noCandidate: number;
	noCandidateAtStop: number;
	windowFull: number;
	mismatches: number;
	atStopDays: number;
	filtered: ArmScore;
	unfiltered: ArmScore;
}

/**
 * The same walk as `scoreDay`, with §8.11's candidate filter on and off instead
 * of two lookaheads. Completion is DERIVED, never drawn: a task is checked off
 * exactly when the remaining plan holds no more blocks for it, so a task the
 * plan never funded stays open all day.
 */
function scoreScopeDay(day: ProbeDay, params: EnergyParams, tally: ScopeTally): void {
	const plan = optimizeSchedule(day.tasks, day.windowHours, params, DEFAULT_USER_CONSTANTS);

	for (const checkpoint of walkPlan(plan.blocks)) {
		const open = new Set(
			day.tasks.filter((t) => !checkpoint.finishedTaskIds.has(t.id)).map((t) => t.id),
		);

		const scoped = observe(day, checkpoint.rows, open);
		const filtered = adviseStop(scoped, params, DEFAULT_USER_CONSTANTS);
		const marginals = searchMarginals(scoped, params, DEFAULT_USER_CONSTANTS);
		const unfiltered = adviseStop(observe(day, checkpoint.rows), params, DEFAULT_USER_CONSTANTS);

		if (filtered === null) {
			tally.noCandidate++;
			tally.noCandidateAtStop += checkpoint.moreWork ? 0 : 1;
			continue;
		}

		if (
			unfiltered === null ||
			unfiltered.verdict === 'window-full' ||
			filtered.verdict === 'window-full' ||
			marginals === null
		) {
			tally.windowFull++;
			continue;
		}

		if (Math.abs(marginals.bestOverAllM - filtered.marginalValue) > 1e-9) tally.mismatches++;

		tally.comparable++;

		const unfilteredContinues = unfiltered.verdict === 'continue';
		const filteredContinues = filtered.verdict === 'continue';

		if (unfilteredContinues && !filteredContinues) tally.continueToStop++;
		else if (filteredContinues && !unfilteredContinues) tally.stopToContinue++;
		else if (unfiltered.taskId !== filtered.taskId) tally.otherTask++;

		if (checkpoint.moreWork) continue;

		tally.atStopDays++;

		scoreAtStop(tally.filtered, filteredContinues, () =>
			lateness(day, checkpoint.rows, params, false, open),
		);

		scoreAtStop(tally.unfiltered, unfilteredContinues, () =>
			lateness(day, checkpoint.rows, params, false),
		);
	}
}

function measureScope(label: string, days: ProbeDay[]): void {
	let mismatches = 0;

	for (const freeTimeValue of LAMBDAS) {
		const params: EnergyParams = {
			...DEFAULT_ENERGY_PARAMS,
			freeTimeValue,
		};

		const tally: ScopeTally = {
			comparable: 0,
			continueToStop: 0,
			stopToContinue: 0,
			otherTask: 0,
			noCandidate: 0,
			noCandidateAtStop: 0,
			windowFull: 0,
			mismatches: 0,
			atStopDays: 0,
			filtered: emptyScore(),
			unfiltered: emptyScore(),
		};

		for (const day of days) scoreScopeDay(day, params, tally);

		mismatches += tally.mismatches;

		const share = (n: number) =>
			tally.comparable > 0 ? ((n / tally.comparable) * 100).toFixed(1) : 'n/a';

		console.log(
			`${label} λ₀ ${freeTimeValue.toFixed(1)}: verdict differs continue→stop ${share(tally.continueToStop)}% and stop→continue ${share(tally.stopToContinue)}% (of ${tally.comparable} comparable checkpoints), ` +
				`same verdict different taskId ${share(tally.otherTask)}%, ` +
				`filtered has no candidate left at ${tally.noCandidate} checkpoints (${tally.noCandidateAtStop} of them AT the plan's stop), ` +
				`at-stop agreement filtered ${tally.filtered.atStopAgree}/${tally.atStopDays} vs unfiltered ${tally.unfiltered.atStopAgree}/${tally.atStopDays}, ` +
				`max lateness filtered ${tally.filtered.maxLateness} vs unfiltered ${tally.unfiltered.maxLateness} steps, ` +
				`${tally.windowFull} window-full checkpoints excluded`,
		);
	}

	console.log(
		`${label}: filtered one-step replica vs filtered adviseStop marginalValue — ${mismatches} mismatches (nonzero invalidates every rate above)`,
	);
}

// Windows out to 18h: a fixture worked to the window edge has no stop to agree
// ON (§8.10's censored day), and agreement is half the claim.
const WARMUP_DAYS: ProbeDay[] = Array.from(
	{
		length: 13,
	},
	(_, index) => ({
		tasks: WARMUP_HEAVY,
		windowHours: 6 + index,
	}),
);

/**
 * Why §8.10's censor stops at the fit and the advisor carries none (ROADMAP
 * M39). `stopBracket` refuses a finished day whose own data contradicts a
 * rational stop; `adviseStop` reads the same reconstruction and refuses
 * nothing. The proposal this arm prices is the obvious symmetry — withhold the
 * card wherever the retrospective reader would refuse the day — scored against
 * the same optimizer ground truth as the arms above.
 *
 * The REASON is derived, not exported. `stopBracket` returns one null for four
 * causes, and three of them are structural and computable here from parts this
 * file already replicates: the clock censor (worked hours plus the UNCAPPED
 * recovered breaks leave no room for a step), no `lo` (no room to extend), no
 * `hi` (nothing worked a whole step yet — every day's first checkpoint). What
 * is left over is the inversion M39 names. The arm prints all four, because a
 * censor the advisor "also carries" cannot pick one of its function's refusals
 * and ignore the rest.
 */
interface CensorCell {
	checkpoints: number;
	falseStops: number;
}

interface CensorTally {
	verdicts: number;
	clock: number;
	noLo: number;
	noHi: number;
	inverted: number;
	kept: CensorCell;
	invertedCell: CensorCell;
	atStopKept: number;
	atStopKeptAgree: number;
	atStopInverted: number;
	atStopInvertedAgree: number;
}

const emptyCensorTally = (): CensorTally => ({
	verdicts: 0,
	clock: 0,
	noLo: 0,
	noHi: 0,
	inverted: 0,
	kept: {
		checkpoints: 0,
		falseStops: 0,
	},
	invertedCell: {
		checkpoints: 0,
		falseStops: 0,
	},
	atStopKept: 0,
	atStopKeptAgree: 0,
	atStopInverted: 0,
	atStopInvertedAgree: 0,
});

/** Which of `stopBracket`'s four refusals this checkpoint hit, or null if none. */
function censorReason(
	observation: StopObservation,
	params: EnergyParams,
): 'clock' | 'no-lo' | 'no-hi' | 'inverted' | null {
	if (stopBracket(observation, params, DEFAULT_USER_CONSTANTS) !== null) return null;

	const byTask = workedHoursByTask(observation.tasks, observation.workedHours);
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const rest = loggedStructure(observation, byTask, total)?.restTotal ?? 0;

	if (byTask.size > 0 && total + rest + DEFAULT_STEP_HOURS > observation.windowHours + 1e-9)
		return 'clock';

	if (![...byTask.values()].some((hours) => hours >= DEFAULT_STEP_HOURS - 1e-9)) return 'no-hi';

	if (total + DEFAULT_STEP_HOURS > observation.windowHours + 1e-9) return 'no-lo';

	return 'inverted';
}

function scoreCensorDay(day: ProbeDay, params: EnergyParams, tally: CensorTally): void {
	const plan = optimizeSchedule(day.tasks, day.windowHours, params, DEFAULT_USER_CONSTANTS);

	for (const checkpoint of walkPlan(plan.blocks)) {
		const observation = observe(day, checkpoint.rows);
		const advice = adviseStop(observation, params, DEFAULT_USER_CONSTANTS);

		// Only checkpoints the card would actually speak on: a censor can silence
		// nothing the advisor already declines to say.
		if (advice === null || advice.verdict === 'window-full') continue;

		tally.verdicts++;

		const reason = censorReason(observation, params);

		if (reason === 'clock') tally.clock++;
		else if (reason === 'no-lo') tally.noLo++;
		else if (reason === 'no-hi') tally.noHi++;
		else if (reason === 'inverted') tally.inverted++;

		const continues = advice.verdict === 'continue';

		if (checkpoint.moreWork) {
			const cell = reason === 'inverted' ? tally.invertedCell : tally.kept;

			cell.checkpoints++;

			if (!continues) cell.falseStops++;

			continue;
		}

		if (reason === 'inverted') {
			tally.atStopInverted++;

			if (!continues) tally.atStopInvertedAgree++;

			continue;
		}

		tally.atStopKept++;

		if (!continues) tally.atStopKeptAgree++;
	}
}

function measureCensor(label: string, days: ProbeDay[]): void {
	for (const freeTimeValue of LAMBDAS) {
		const params: EnergyParams = {
			...DEFAULT_ENERGY_PARAMS,
			freeTimeValue,
		};

		const tally = emptyCensorTally();

		for (const day of days) scoreCensorDay(day, params, tally);

		const pct = (n: number, of: number) => (of > 0 ? `${((100 * n) / of).toFixed(1)}%` : 'n/a');

		console.log(
			`${label} λ₀ ${freeTimeValue.toFixed(1)}: of ${tally.verdicts} checkpoints the card speaks on, ` +
				`\`stopBracket\` refuses ${tally.clock + tally.noLo + tally.noHi + tally.inverted} — ` +
				`clock ${tally.clock}, no lo ${tally.noLo}, no hi ${tally.noHi}, ` +
				`INVERTED ${tally.inverted} (${pct(tally.inverted, tally.verdicts)})`,
		);

		console.log(
			`${label} λ₀ ${freeTimeValue.toFixed(1)}: mid-day false stops on the inverted cell ` +
				`${tally.invertedCell.falseStops}/${tally.invertedCell.checkpoints} ` +
				`(${pct(tally.invertedCell.falseStops, tally.invertedCell.checkpoints)}) vs everywhere else ` +
				`${tally.kept.falseStops}/${tally.kept.checkpoints} ` +
				`(${pct(tally.kept.falseStops, tally.kept.checkpoints)}); ` +
				`at-stop agreement inverted ${tally.atStopInvertedAgree}/${tally.atStopInverted} vs ` +
				`else ${tally.atStopKeptAgree}/${tally.atStopKept}`,
		);

		console.log(
			`${label} λ₀ ${freeTimeValue.toFixed(1)}: what the censor would COST — ` +
				`${tally.invertedCell.checkpoints - tally.invertedCell.falseStops} correct mid-day continues ` +
				`and ${tally.atStopInvertedAgree} correct stops silenced`,
		);
	}
}

describe('stop advisor', () => {
	it('measures one-step vs session lookahead (MATH.md §8.11)', () => {
		measure('72 seeded random days', randomDays(72, 42));
		measure('warm-up-heavy fixture, 4 fresh high-amplitude tasks', WARMUP_DAYS);
	});

	it("prices carrying §8.10's inversion censor in the advisor (ROADMAP M39)", () => {
		measureCensor('72 seeded random days', randomDays(72, 42));
		measureCensor('warm-up-heavy fixture, 4 fresh high-amplitude tasks', WARMUP_DAYS);
	});

	it('measures the candidate filter against the unfiltered call (MATH.md §8.11)', () => {
		console.log(
			'[§8.11 scope] completion is DERIVED from the plan, never drawn: a task is checked off ' +
				'exactly when the remaining plan holds no more blocks for it, and a task the plan never ' +
				'funded stays open',
		);

		measureScope('72 seeded random days, plan-derived completions', randomDays(72, 42));
		measureScope('warm-up-heavy fixture, plan-derived completions', WARMUP_DAYS);
	});
});
