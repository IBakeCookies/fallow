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
 * THE DECOMPOSITION ARM. `hi` is a LOOSE max: it takes the best over all
 * logged tasks of "remove one step from this task", because the real work
 * order is unknown. On an optimizer-generated day the order IS known, so the
 * honest `hi` is the marginal of the step actually worked LAST, and the
 * difference between the two is the "~+0.1" bias §8.10 claims. The half-width
 * is (hi − lo)/2 on days that do not invert.
 *
 * Whatever it prints belongs in MATH.md WITH ITS DATE, beside the claim it
 * supports.
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
	const { tasks, windowHours } = observation;

	if (windowHours <= 0 || tasks.length === 0) return null;

	const byTask = workedHoursByTask(tasks, observation.workedHours);

	if (byTask.size === 0) return null;

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
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, CONSTANTS);

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

	const shrunk = (taskId: number): ScheduleBlock[] =>
		sched
			.map((b) =>
				b.taskId === taskId
					? {
							...b,
							hours: b.hours - step,
						}
					: b,
			)
			.filter((b) => b.hours > 1e-9);

	// lo: no room to extend is a structural censor, not an inversion.
	if (total + step > windowHours + 1e-9) return null;

	let lo = -Infinity;

	for (const t of tasks) lo = Math.max(lo, (workValue(grown(t, step)) - base) / step);

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

function drawTask(random: () => number, id: number): EnergyTaskInput {
	const mental = 1 + Math.floor(random() * 10);
	const physical = 1 + Math.floor(random() * 10);

	return {
		id,
		title: `t${id}`,
		difficulty: Math.max(mental, physical),
		enjoyment: 1 + Math.floor(random() * 10),
		cognitiveDemand: mental / 10,
		physicalDemand: physical / 10,
	};
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
 * Every ±1-lattice-step "mood" variant of a day: one logged task moved by one
 * step, everything else held. This is §8.10's own phrase for a near-rational
 * day — someone who worked 15 minutes more or less than the optimum would have
 * — and the population the doc claims never inverts.
 */
function moodVariants(
	observation: StopObservation,
): Array<{ moved: StopObservation; label: string }> {
	return observation.workedHours.flatMap((entry) =>
		[-DEFAULT_STEP_HOURS, DEFAULT_STEP_HOURS]
			.map((delta) => entry.hours + delta)
			.filter((hours) => hours > 0)
			.map((hours) => ({
				moved: {
					...observation,
					workedHours: observation.workedHours.map((w) =>
						w.taskId === entry.taskId
							? {
									taskId: w.taskId,
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

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function fmt(x: number): string {
	return Number.isFinite(x) ? x.toFixed(3) : 'n/a';
}

/** The optimizer's plan for a day, as a §8.10 observation plus its real work order. */
function optimizerDay(
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams,
): { observation: StopObservation; lastWorkedTaskId?: number } | null {
	const plan = optimizeSchedule(tasks, windowHours, params, CONSTANTS);
	const worked = plan.evaluation.blocks.filter((b) => b.taskId !== null);

	if (worked.length === 0) return null;

	const byTask = new Map<number, number>();

	for (const block of worked)
		byTask.set(block.taskId!, (byTask.get(block.taskId!) ?? 0) + block.hours);

	return {
		observation: {
			tasks,
			windowHours,
			workedHours: [...byTask].map(([taskId, hours]) => ({
				taskId,
				hours,
			})),
		},
		lastWorkedTaskId: worked[worked.length - 1].taskId!,
	};
}

describe('MATH.md §8.10 — the inversion detector and its margin', () => {
	it('validates the replica against the shipped stopIndifferencePoint', () => {
		const random = mulberry32(0x51a001);
		let checked = 0;
		let mismatches = 0;
		let worst = 0;

		for (let day = 0; day < 400; day++) {
			const { tasks, windowHours } = drawDay(random);
			const params = paramsAt(LAMBDAS[Math.floor(random() * LAMBDAS.length)]);

			const observation: StopObservation = {
				tasks,
				windowHours,
				workedHours: tasks
					.filter(() => random() < 0.8)
					.map((t) => ({
						taskId: t.id,
						hours: Math.round(random() * 8) * DEFAULT_STEP_HOURS,
					}))
					.filter((w) => w.hours > 0),
			};

			const shipped = stopIndifferencePoint(observation, params, CONSTANTS);
			const replica = bracketOf(observation, params);

			checked++;

			if (shipped === null) {
				// Null covers structural censors too, so only a replica that claims a
				// usable midpoint is a real disagreement.
				if (replica?.midpoint != null) mismatches++;

				continue;
			}

			if (replica?.midpoint == null) {
				mismatches++;

				continue;
			}

			worst = Math.max(worst, Math.abs(replica.midpoint - shipped));
		}

		console.log(
			`[§8.10 replica] ${checked} random observations: ${mismatches} verdict mismatches, ` +
				`worst midpoint difference ${worst.toExponential(3)}`,
		);

		console.log(
			mismatches === 0 && worst < 1e-9
				? '[§8.10 replica] VALID — every number below reads the same bracket the shipped code does'
				: '[§8.10 replica] INVALID — the arms below are measuring a different estimator',
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
				workedHours: tasks
					.filter(() => random() < 0.75)
					.map((t) => ({
						taskId: t.id,
						hours: (1 + Math.floor(random() * 8)) * DEFAULT_STEP_HOURS,
					})),
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

		console.log(
			`[§8.10 claim 2] optimizer days: ${rationalInverted}/${rationalDays} inverted ` +
				`(MATH.md said zero until 2026-08-06)`,
		);

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
				`p90 ${fmt(quantile(biases, 0.9))} (MATH.md said ~+0.1 until 2026-08-06)`,
		);

		console.log(
			`[§8.10 claim 3] bracket half-width over ${halfWidths.length} non-inverted days: ` +
				`mean ${fmt(mean(halfWidths))}, median ${fmt(quantile(halfWidths, 0.5))}, ` +
				`p90 ${fmt(quantile(halfWidths, 0.9))} (MATH.md said ~0.15 until 2026-08-06)`,
		);

		console.log(
			`[§8.10 claim 3] the two medians sum to ` +
				`${fmt(quantile(biases, 0.5) + quantile(halfWidths, 0.5))} against the shipped ` +
				`STOP_INVERSION_MARGIN = ${STOP_INVERSION_MARGIN}`,
		);
	});
});
