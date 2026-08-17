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
 * the composition worked so far (a `StopObservation`, exactly what the store
 * hands it in-day). Truth says "continue" while the plan still has work and
 * "stop" at its last step, so a mid-day `stop` verdict is a FALSE STOP and a
 * `continue` at the plan's end is LATENESS.
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
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
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

interface ProbeDay {
	tasks: EnergyTaskInput[];
	windowHours: number;
}

const task = (
	id: number,
	difficulty: number,
	enjoyment: number,
	cognitiveDemand: number,
	physicalDemand: number,
): EnergyTaskInput => ({
	id,
	title: `t${id}`,
	difficulty,
	enjoyment,
	cognitiveDemand,
	physicalDemand,
});

/** `taskAmplitude` is internal; §8.11's canonical order is this expression. */
const amplitude = (t: EnergyTaskInput): number => {
	const E = mapEffort(t.difficulty);
	const beta = mapEnjoyability(t.enjoyment);

	return E * beta + beta / E;
};

function randomDays(count: number, seed: number): ProbeDay[] {
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
					length: pick(2, 4, 1),
				},
				(_, index) =>
					task(index + 1, pick(1, 10, 1), pick(1, 10, 1), pick(0, 10, 1) / 10, pick(0, 10, 1) / 10),
			),
			windowHours: pick(6, 12, 0.25),
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
	task(1, 9, 10, 0.9, 0.2),
	task(2, 10, 9, 0.8, 0.3),
	task(3, 8, 10, 0.85, 0.25),
	task(4, 9, 8, 0.75, 0.35),
];

const LAMBDAS = [0.3, 0.5, 0.9, 1.3];

/** A checkpoint on the optimizer's plan: the day so far, and what comes next. */
interface Checkpoint {
	workedHours: { taskId: number; hours: number }[];
	/** Funded tasks the remaining plan holds no more blocks for */
	finishedTaskIds: Set<number>;
	/** The plan still has work after this point — truth says "continue" */
	moreWork: boolean;
	/** The very next thing in the plan is a rest block */
	restNext: boolean;
}

function walkPlan(blocks: ScheduleBlock[]): Checkpoint[] {
	const totalWork = blocks.reduce((sum, b) => (b.taskId === null ? sum : sum + b.hours), 0);
	const planned = new Map<number, number>();

	for (const block of blocks)
		if (block.taskId !== null)
			planned.set(block.taskId, (planned.get(block.taskId) ?? 0) + block.hours);

	const worked = new Map<number, number>();
	let done = 0;

	const snapshot = (restNext: boolean): Checkpoint => ({
		workedHours: [...worked].map(([taskId, hours]) => ({
			taskId,
			hours,
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

		if (block.taskId === null) continue;

		let left = block.hours;

		while (left > 1e-9) {
			const hours = Math.min(DEFAULT_STEP_HOURS, left);

			worked.set(block.taskId, (worked.get(block.taskId) ?? 0) + hours);
			left -= hours;
			done += hours;
			out.push(snapshot(left <= 1e-9 && blocks[i + 1]?.taskId === null));
		}
	}

	return out;
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
	// before the window (`zenith-energy.ts:2136`).
	const candidates = openTaskIds === undefined ? tasks : tasks.filter((t) => openTaskIds.has(t.id));

	if (candidates.length === 0) return null;

	const byTask = workedHoursByTask(tasks, observation.workedHours);
	const canonical = [...tasks].sort((x, y) => amplitude(y) - amplitude(x));
	const rank = new Map(canonical.map((t, i) => [t.id, i]));

	const sched: ScheduleBlock[] = canonical
		.filter((t) => byTask.has(t.id))
		.map((t) => ({
			taskId: t.id,
			hours: byTask.get(t.id)!,
		}));

	const total = sched.reduce((sum, b) => sum + b.hours, 0);
	const room = Math.floor((windowHours - total) / DEFAULT_STEP_HOURS + 1e-9);

	if (room < 1) return null;

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, constants);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	// `growBy`: an unlogged task enters at ITS canonical rank, not appended.
	const grown = (t: EnergyTaskInput, hours: number): ScheduleBlock[] => {
		if (byTask.has(t.id)) {
			return sched.map((b) =>
				b.taskId === t.id
					? {
							...b,
							hours: b.hours + hours,
						}
					: b,
			);
		}

		const at = sched.filter((b) => rank.get(b.taskId!)! < rank.get(t.id)!).length;

		return [
			...sched.slice(0, at),
			{
				taskId: t.id,
				hours,
			},
			...sched.slice(at),
		];
	};

	let oneStepValue = -Infinity;
	let oneStepTaskId = candidates[0].id;
	let bestOverAllM = -Infinity;

	for (const t of candidates) {
		for (let m = 1; m <= room; m++) {
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

/** The one place `openTaskIds` enters this probe. */
const observe = (
	day: ProbeDay,
	workedHours: { taskId: number; hours: number }[],
	openTaskIds?: ReadonlySet<number>,
) => ({
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
	worked: { taskId: number; hours: number }[],
	params: EnergyParams,
	oneStep: boolean,
	openTaskIds?: ReadonlySet<number>,
): number {
	const hours = new Map(worked.map((w) => [w.taskId, w.hours]));
	let steps = 0;

	for (;;) {
		const list = [...hours].map(([taskId, h]) => ({
			taskId,
			hours: h,
		}));

		let taskId: number;

		if (oneStep) {
			const marginals = searchMarginals(
				observe(day, list, openTaskIds),
				params,
				DEFAULT_USER_CONSTANTS,
			);

			if (marginals === null || marginals.oneStepValue <= params.freeTimeValue) return steps;

			taskId = marginals.oneStepTaskId;
		} else {
			const advice = adviseStop(observe(day, list, openTaskIds), params, DEFAULT_USER_CONSTANTS);

			if (advice === null || advice.verdict !== 'continue') return steps;

			taskId = advice.taskId;
		}

		hours.set(taskId, (hours.get(taskId) ?? 0) + DEFAULT_STEP_HOURS);
		steps++;
	}
}

interface Tally {
	one: ArmScore;
	session: ArmScore;
	midCheckpoints: number;
	atStopDays: number;
	/** No whole step fits: the day filled the window, so neither arm has a verdict */
	windowFull: number;
	/** Replica ≠ shipped search — see the file header */
	mismatches: number;
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
		const observation = observe(day, checkpoint.workedHours);
		const advice = adviseStop(observation, params, DEFAULT_USER_CONSTANTS);
		const marginals = searchMarginals(observation, params, DEFAULT_USER_CONSTANTS);

		if (advice === null || advice.verdict === 'window-full' || marginals === null) {
			tally.windowFull++;
			continue;
		}

		// The two arms are the same search at two lookaheads, or nothing means
		// anything.
		if (Math.abs(marginals.bestOverAllM - advice.marginalValue) > 1e-9) tally.mismatches++;

		const oneContinues = marginals.oneStepValue > params.freeTimeValue;
		const sessionContinues = advice.verdict === 'continue';

		if (checkpoint.moreWork) {
			tally.midCheckpoints++;
			scoreMidDay(tally.one, oneContinues, checkpoint.restNext);
			scoreMidDay(tally.session, sessionContinues, checkpoint.restNext);
			continue;
		}

		tally.atStopDays++;
		scoreAtStop(tally.one, oneContinues, () => lateness(day, checkpoint.workedHours, params, true));

		scoreAtStop(tally.session, sessionContinues, () =>
			lateness(day, checkpoint.workedHours, params, false),
		);
	}
}

function measure(label: string, days: ProbeDay[]): void {
	let mismatches = 0;
	let windowFull = 0;

	for (const freeTimeValue of LAMBDAS) {
		const params: EnergyParams = {
			...DEFAULT_ENERGY_PARAMS,
			freeTimeValue,
		};

		const tally: Tally = {
			one: emptyScore(),
			session: emptyScore(),
			midCheckpoints: 0,
			atStopDays: 0,
			windowFull: 0,
			mismatches: 0,
		};

		for (const day of days) scoreDay(day, params, tally);

		mismatches += tally.mismatches;
		windowFull += tally.windowFull;

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
	}

	console.log(
		`${label}: one-step replica vs adviseStop marginalValue — ${mismatches} mismatches (nonzero invalidates every rate above), ${windowFull} window-full checkpoints excluded`,
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

		const scoped = observe(day, checkpoint.workedHours, open);
		const filtered = adviseStop(scoped, params, DEFAULT_USER_CONSTANTS);
		const marginals = searchMarginals(scoped, params, DEFAULT_USER_CONSTANTS);

		const unfiltered = adviseStop(
			observe(day, checkpoint.workedHours),
			params,
			DEFAULT_USER_CONSTANTS,
		);

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
			lateness(day, checkpoint.workedHours, params, false, open),
		);

		scoreAtStop(tally.unfiltered, unfilteredContinues, () =>
			lateness(day, checkpoint.workedHours, params, false),
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

describe('stop advisor', () => {
	it('measures one-step vs session lookahead (MATH.md §8.11)', () => {
		measure('72 seeded random days', randomDays(72, 42));
		measure('warm-up-heavy fixture, 4 fresh high-amplitude tasks', WARMUP_DAYS);
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
