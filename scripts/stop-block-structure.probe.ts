/**
 * The regression instrument for MATH.md §8.10's reconstruction: does the day's
 * own block structure reach the estimator, and is the break-omission bias gone?
 *
 * WHY THIS FILE EXISTS. §8.10 listed "breaks are omitted from the reconstruction
 * … absorbed as noise" among its deliberate approximations for a year, and no
 * committed probe could contradict it, because no committed probe generated a
 * day the way the app does. `stop-inversion-margin` and `stop-margin-fit-error`
 * both built `EnergyTaskInput`s by hand — one of them without the difficulty
 * spillover `toEnergyTask` applies — and `stop-margin-fit-error` flattened the
 * plan to a work-step sequence that DROPPED rest, so a break-carrying day was
 * not expressible. Measured, break omission was not noise: it was the dominant
 * error term, and one-signed. This probe closes that hole by construction —
 * every task here comes from integer sliders through `toEnergyTask`, every day
 * is the plan the app itself would have drawn, and every reading goes through
 * the shipped `stopIndifferencePoint` with no replica in between.
 *
 * THE ARMS, all the same day read five ways:
 *
 *   logged     — one 🪫 row per session with the moment it ended (what the app
 *                stores today), so the reconstruction recovers the breaks
 *   summed      — the rows with no moments: the pre-2026-08-19 reading
 *   order-only  — the rows in their real order, logged back to back, so the
 *                gaps recover to nothing. This is the arm that decides WHICH
 *                half of the structure carries the fix: if order alone were
 *                enough it would score like `logged`, and it does not
 *   jitter      — ±15 min on every log moment: `createdAt` is the LOG moment,
 *                not the session end, and this is the price of that
 *   batch       — every row logged at day's end. Must be bit-identical to
 *                `summed`: it is the case where the fix silently does not apply
 *
 * THE GRID reaches the LOW end of the Lab's own freeTimeValue range (slider
 * [0, 3] step 0.1): the residual is worst where λ₀ is small, and a grid that
 * starts at 0.5 samples none of it — which is how §8.10's headline came to be
 * scoped to mid-range users without saying so. Every arm is reported per λ₀ as
 * well as pooled, because the error is strongly λ₀-dependent and a pooled
 * figure quoted without its scope is the defect this grid was widened to fix.
 *
 * THE ORACLE ARM is the accuracy reference the bracket cannot be its own judge
 * of: the λ set on which the optimizer's plan for the day's own inputs works
 * exactly the observed hours (the envelope-theorem object §8.10 says it "cannot
 * know"). It costs ~16 optimizer solves per day, which is why it is an oracle
 * here and not the shipped estimator — the fit runs in a `$derived` over the
 * whole history.
 *
 * GATES. This is a probe, so its numbers move with the curves and the lattice —
 * but the FINDING must not come back, so the arms carry assertions on their
 * relative sizes rather than on any absolute value. A red gate here means the
 * day's structure stopped reaching the estimator.
 *
 * Usage: npm run probe
 */

import { describe, it, expect } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	DEFAULT_STEP_HOURS,
	adviseStop,
	fitStoppingValue,
	optimizeSchedule,
	stopBracket,
	stopIndifferencePoint,
	type EnergyParams,
	type EnergyTaskInput,
	type ScheduleBlock,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
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

const CONSTANTS = DEFAULT_USER_CONSTANTS;
const STEP = DEFAULT_STEP_HOURS;
const ORIGIN = Date.parse('2026-08-19T08:00:00.000Z');
const LAMBDAS = [0.1, 0.3, 0.5, 0.7, 0.9, 1.1];
const DAY_COUNT = 120;
const SEED = 0x8_1019;
/** The instrument's own resolution — `stop-inversion-margin`'s measured median. */
const BRACKET_HALF_WIDTH = 0.134;

type Rows = StopObservation['workedHours'];

const paramsAt = (freeTimeValue: number): EnergyParams => ({
	...DEFAULT_ENERGY_PARAMS,
	freeTimeValue,
});

interface ProbeDay {
	tasks: EnergyTaskInput[];
	windowHours: number;
}

/**
 * A day the app could actually hold: integer sliders through `toEnergyTask`, so
 * `difficulty` carries the 0.3 spillover and the demands are slider/10. Nothing
 * here can describe a task the user cannot enter.
 */
function drawDay(random: () => number): ProbeDay {
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	const tasks = Array.from(
		{
			length: 2 + Math.floor(random() * 3),
		},
		(_, i): Task => ({
			id: i + 1,
			title: `t${i + 1}`,
			mentalDifficulty: slider(0),
			physicalDifficulty: slider(0),
			enjoyment: slider(1),
			createdAt: '2026-08-19',
			completed: false,
		}),
	);

	return {
		tasks: tasks.map(toEnergyTask),
		windowHours: 6 + Math.round(random() * 16) / 2,
	};
}

/**
 * The plan as the 🪫 log would hold it: one row per contiguous session, each
 * carrying the wall-clock moment it ended. Rest blocks pass on the clock without
 * producing a row — that space is the break the reconstruction recovers.
 */
function sessionRows(blocks: ScheduleBlock[]): Rows {
	const rows: Rows = [];
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

const summed = (rows: Rows): Rows =>
	rows.map(({ taskId, hours }) => ({
		taskId,
		hours,
	}));

/**
 * The rows in their real order with the breaks squeezed to a second: ORDER
 * without the gaps. A day logged truly back to back recovers no gap at all and
 * falls back to the summed reading, which would make this arm a duplicate — the
 * second keeps the structure and prices the order alone.
 */
function orderOnly(rows: Rows): Rows {
	let clock = 0;

	return rows.map((r, i) => {
		clock += r.hours + (i === 0 ? 0 : 1 / 3600);

		return {
			...r,
			endedAt: ORIGIN + clock * 3_600_000,
		};
	});
}

/** Every row logged at day's end — the moments collapse and no gap survives. */
const batched = (rows: Rows): Rows =>
	rows.map((r) => ({
		...r,
		endedAt: ORIGIN + 24 * 3_600_000,
	}));

/** ±15 min on each log moment: `createdAt` is when it was written down. */
const jittered = (rows: Rows, random: () => number): Rows =>
	rows.map((r) => ({
		...r,
		endedAt: r.endedAt! + (random() - 0.5) * 0.5 * 3_600_000,
	}));

const ARMS = ['logged', 'summed', 'order-only', 'jitter', 'batch'] as const;

type Arm = (typeof ARMS)[number];

interface Tally {
	errors: number[];
	censored: number;
}

const emptyTally = (): Tally => ({
	errors: [],
	censored: 0,
});

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const mean = (values: number[]) => values.reduce((s, x) => s + x, 0) / values.length;

const share = (values: number[], over: number) =>
	(100 * values.filter((x) => Math.abs(x) > over).length) / values.length;

/** One cell's readings into whichever tallies were handed in: an error, or a censored day. */
function record(
	tallies: Partial<Record<Arm, Tally>>,
	points: Record<Arm, number | null>,
	lambda: number,
): void {
	for (const [arm, tally] of Object.entries(tallies) as [Arm, Tally][]) {
		const point = points[arm];

		if (point === null) tally.censored++;
		else tally.errors.push(point - lambda);
	}
}

function report(arm: string, tally: Tally): void {
	const abs = tally.errors.map(Math.abs);

	console.log(
		`[§8.10 structure] ${arm.padEnd(11)} n=${String(abs.length).padStart(4)} ` +
			`|err| mean ${mean(abs).toFixed(3)} p50 ${quantile(abs, 0.5).toFixed(3)} ` +
			`p90 ${quantile(abs, 0.9).toFixed(3)} max ${Math.max(...abs).toFixed(3)}  ` +
			`signed mean ${mean(tally.errors) >= 0 ? '+' : ''}${mean(tally.errors).toFixed(3)}  ` +
			`|err| > ${BRACKET_HALF_WIDTH} on ${share(abs, BRACKET_HALF_WIDTH).toFixed(1)}%  ` +
			`censored ${tally.censored}`,
	);
}

/**
 * One optimizer-planned day per (day, λ₀) cell, as the five arms read it. Days
 * whose plan works fewer than three steps are skipped: there is no stop to read
 * off a day that barely started.
 */
function measurePopulation(): Record<Arm, Tally> {
	const random = mulberry32(SEED);
	const jitter = mulberry32(SEED + 1);

	const days = Array.from(
		{
			length: DAY_COUNT,
		},
		() => drawDay(random),
	);

	const tallies = Object.fromEntries(ARMS.map((arm) => [arm, emptyTally()])) as Record<Arm, Tally>;
	const byLambda = new Map<number, Partial<Record<Arm, Tally>>>();
	let cells = 0;
	let withBreaks = 0;
	let batchMismatches = 0;

	for (const lambda of LAMBDAS) {
		const params = paramsAt(lambda);

		const scoped: Partial<Record<Arm, Tally>> = {
			logged: emptyTally(),
			summed: emptyTally(),
		};

		byLambda.set(lambda, scoped);

		for (const day of days) {
			const plan = optimizeSchedule(day.tasks, day.windowHours, params, CONSTANTS).blocks;
			const rows = sessionRows(plan);

			if (rows.reduce((sum, r) => sum + r.hours, 0) < 3 * STEP - 1e-9) continue;

			cells++;

			if (plan.some((b) => b.taskId === null)) withBreaks++;

			const read = (workedHours: Rows) =>
				stopIndifferencePoint(
					{
						tasks: day.tasks,
						windowHours: day.windowHours,
						workedHours,
					},
					params,
					CONSTANTS,
				);

			const points: Record<Arm, number | null> = {
				logged: read(rows),
				summed: read(summed(rows)),
				'order-only': read(orderOnly(rows)),
				jitter: read(jittered(rows, jitter)),
				batch: read(batched(rows)),
			};

			if (points.batch !== points.summed) batchMismatches++;

			record(tallies, points, lambda);
			record(scoped, points, lambda);
		}
	}

	console.log(
		`[§8.10 structure] ${DAY_COUNT} slider-drawn days × λ₀ ${LAMBDAS.join('/')} = ${cells} ` +
			`optimizer-funded cells, ${((100 * withBreaks) / cells).toFixed(1)}% of the plans carrying ` +
			`an interior break (seed ${SEED.toString(16)})`,
	);

	for (const arm of ARMS) report(arm, tallies[arm]);

	// Pooled hides the shape: the error is strongly λ₀-dependent, so a §8.10
	// figure has to carry the λ₀ it was read at.
	for (const [lambda, scoped] of byLambda)
		for (const arm of ['logged', 'summed'] as const)
			report(`λ₀ ${lambda.toFixed(1)} ${arm}`, scoped[arm]!);

	console.log(
		`[§8.10 structure] batch-logged vs summed: ${batchMismatches} days differ ` +
			`(nonzero means a day with no recoverable gap stopped falling back); the logged reading ` +
			`prices ${tallies.summed.errors.length - tallies.logged.errors.length} fewer cells than ` +
			`the summed one, which is the clock censor: only a day whose span is recovered can run ` +
			`out of it`,
	);

	// The finding, as gates. Absolute sizes move with the model; these do not.
	const absOf = (arm: Arm) => tallies[arm].errors.map(Math.abs);

	expect(batchMismatches).toBe(0);
	// The logged reading prices FEWER days than the summed one since 2026-08-21 —
	// the clock censor needs a recovered span to fire, so it fires on this arm
	// alone. The arm below prices what that costs; what must hold here is that the
	// days it does price are read better, which is why the fix landed at all.
	expect(mean(absOf('logged'))).toBeLessThan(0.75 * mean(absOf('summed')));

	expect(share(absOf('logged'), BRACKET_HALF_WIDTH)).toBeLessThan(
		0.6 * share(absOf('summed'), BRACKET_HALF_WIDTH),
	);

	// Order is NOT the mechanism: the real order with no breaks scores like the
	// summed reading, which is what makes "keep the breaks" the fix.
	expect(Math.abs(mean(absOf('order-only')) - mean(absOf('summed')))).toBeLessThan(0.03);
	// Logging promptness is a real dependency, and a bounded one.
	expect(mean(absOf('jitter'))).toBeLessThan(mean(absOf('summed')));

	return tallies;
}

/**
 * The λ set on which the optimizer's plan for this day's own inputs works
 * exactly `workedHours` — the accuracy reference the bracket cannot supply for
 * itself. Null when the observed hours lie outside what any λ₀ in the fit range
 * would have planned (a one-sided reading, which §8.10 censors anyway).
 */
function identifiedSet(day: ProbeDay, workedHours: number): { lo: number; hi: number } | null {
	const cache = new Map<number, number>();

	const planned = (lambda: number): number => {
		const hit = cache.get(lambda);

		if (hit !== undefined) return hit;

		const hours = optimizeSchedule(day.tasks, day.windowHours, paramsAt(lambda), CONSTANTS)
			.evaluation.workHours;

		cache.set(lambda, hours);

		return hours;
	};

	if (planned(0) < workedHours - 1e-9 || planned(3) > workedHours + 1e-9) return null;

	const bisect = (isBelow: (lambda: number) => boolean): number => {
		let low = 0;
		let high = 3;

		while (high - low > 0.02) {
			const mid = (low + high) / 2;

			if (isBelow(mid)) low = mid;
			else high = mid;
		}

		return (low + high) / 2;
	};

	return {
		lo: bisect((lambda) => planned(lambda) > workedHours + 1e-9),
		hi: bisect((lambda) => planned(lambda) >= workedHours - 1e-9),
	};
}

/**
 * The wall clock the day's own log moments describe: the first session's start to
 * the last one's end — `reconstructStopDay`'s span (worked hours plus the
 * UNCAPPED recovered breaks), read straight off the rows, which the generator
 * never writes out of order.
 */
const spanHours = (rows: Rows): number =>
	rows.length === 0
		? 0
		: (rows[rows.length - 1].endedAt! - (rows[0].endedAt! - rows[0].hours * 3_600_000)) / 3_600_000;

/**
 * `isClockCensored`'s class, from the probe's side: no room for another step
 * inside the day's own span, AND a break recovered to read that span from. The
 * second half separates this class from the window-edge censor the fit always
 * had — a contiguous day worked to the edge is dropped by that one, not by this.
 */
const isOutOfClock = (rows: Rows, windowHours: number): boolean => {
	const worked = rows.reduce((sum, r) => sum + r.hours, 0);
	const span = spanHours(rows);

	return span > worked + 1e-9 && span + STEP > windowHours + 1e-9;
};

describe('MATH.md §8.10 — the day’s block structure reaches the estimator', () => {
	it('reads the same slider-drawn days five ways', () => {
		measurePopulation();
	});

	/**
	 * §8.10's clock censor (M42): the class is the day whose own span leaves no
	 * room for another step, and the question is what censoring it buys and what
	 * it costs. Class membership is the PROBE's own span test, so it is the same
	 * set of cells whether or not the shipped reader censors them — which is what
	 * makes the two runs of this arm comparable.
	 *
	 * Read it as a PAIR of runs, one before the censor and one after: what the
	 * censor costs is the class's share of the priced cells, which only a run with
	 * the censor off can print (with it on, the class prices nothing by
	 * construction and the same cells return null instead) — and what it buys is
	 * the containment line, which both runs print. Truth is the λ₀ each day was
	 * PLANNED at, so containment is `lo ≤ λ₀ ≤ hi` on the shipped bracket.
	 */
	it('prices the clock censor: the class, containment, and the signed error it carries', () => {
		const random = mulberry32(SEED);

		const days = Array.from(
			{
				length: DAY_COUNT,
			},
			() => drawDay(random),
		);

		let cells = 0;
		let priced = 0;
		let inClass = 0;
		let pricedInClass = 0;
		let containmentFailures = 0;
		const classErrors = new Map<number, number[]>();

		for (const lambda of LAMBDAS) {
			const params = paramsAt(lambda);
			classErrors.set(lambda, []);

			for (const day of days) {
				const plan = optimizeSchedule(day.tasks, day.windowHours, params, CONSTANTS).blocks;
				const rows = sessionRows(plan);

				if (rows.reduce((sum, r) => sum + r.hours, 0) < 3 * STEP - 1e-9) continue;

				cells++;
				const isInClass = isOutOfClock(rows, day.windowHours);

				if (isInClass) inClass++;

				const observation: StopObservation = {
					tasks: day.tasks,
					windowHours: day.windowHours,
					workedHours: rows,
				};

				const bracket = stopBracket(observation, params, CONSTANTS);

				if (bracket === null || bracket.lo === null || bracket.hi === null) continue;

				priced++;

				if (bracket.lo > lambda + 1e-9 || bracket.hi < lambda - 1e-9) containmentFailures++;

				if (isInClass) {
					pricedInClass++;
					classErrors.get(lambda)!.push((bracket.lo + bracket.hi) / 2 - lambda);
				}
			}
		}

		const pooled = [...classErrors.values()].flat();

		console.log(
			`[§8.10 clock censor] ${cells} optimizer-funded cells, ${inClass} of them in the class — a ` +
				`day whose own span leaves no room for another step. The shipped reader prices ` +
				`${priced} cells, ${pricedInClass} of them in the class ` +
				`(${((100 * pricedInClass) / priced).toFixed(1)}% — what censoring the class costs, and ` +
				`0 once it is censored)`,
		);

		console.log(
			`[§8.10 clock censor] the bracket excludes the day's own λ₀ on ${containmentFailures} of ` +
				`${priced} priced cells (${((100 * containmentFailures) / priced).toFixed(1)}%)`,
		);

		console.log(
			`[§8.10 clock censor] signed error on the class, pooled ` +
				`${pooled.length === 0 ? 'n/a (censored)' : `${mean(pooled) >= 0 ? '+' : ''}${mean(pooled).toFixed(3)} (n=${pooled.length})`}` +
				`; per λ₀ ${[...classErrors]
					.map(
						([lambda, errors]) =>
							`${lambda.toFixed(1)}: ${errors.length === 0 ? 'n/a' : `${mean(errors) >= 0 ? '+' : ''}${mean(errors).toFixed(3)} (n=${errors.length})`}`,
					)
					.join(' ')}`,
		);

		// The finding, as a gate: the class is censored, so none of it prices. What
		// censoring costs is read off a run with the censor off, not from here.
		expect(pricedInClass).toBe(0);
	});

	it('scores both readings against the identified set (oracle arm)', () => {
		const random = mulberry32(SEED + 2);

		const days = Array.from(
			{
				length: 8,
			},
			() => drawDay(random),
		);

		const covered = {
			logged: 0,
			summed: 0,
		};

		const distance = {
			logged: [] as number[],
			summed: [] as number[],
		};

		let priced = 0;

		for (const lambda of LAMBDAS) {
			const params = paramsAt(lambda);

			for (const day of days) {
				const plan = optimizeSchedule(day.tasks, day.windowHours, params, CONSTANTS).blocks;
				const rows = sessionRows(plan);
				const worked = rows.reduce((sum, r) => sum + r.hours, 0);

				if (worked < 3 * STEP - 1e-9) continue;

				const set = identifiedSet(day, worked);

				if (set === null) continue;

				const read = (workedHours: Rows) =>
					stopIndifferencePoint(
						{
							tasks: day.tasks,
							windowHours: day.windowHours,
							workedHours,
						},
						params,
						CONSTANTS,
					);

				const logged = read(rows);
				const flat = read(summed(rows));

				if (logged === null || flat === null) continue;

				priced++;
				const middle = (set.lo + set.hi) / 2;

				if (logged >= set.lo - 1e-9 && logged <= set.hi + 1e-9) covered.logged++;

				if (flat >= set.lo - 1e-9 && flat <= set.hi + 1e-9) covered.summed++;

				distance.logged.push(Math.abs(logged - middle));
				distance.summed.push(Math.abs(flat - middle));
			}
		}

		console.log(
			`[§8.10 oracle] the λ set that reproduces the day's own worked hours, over ${priced} ` +
				`priced cells: the bracket midpoint lands INSIDE it on ${covered.logged} days read ` +
				`session-by-session against ${covered.summed} read summed`,
		);

		console.log(
			`[§8.10 oracle] distance to the set's middle: logged mean ` +
				`${mean(distance.logged).toFixed(3)} p90 ${quantile(distance.logged, 0.9).toFixed(3)}, ` +
				`summed mean ${mean(distance.summed).toFixed(3)} p90 ` +
				`${quantile(distance.summed, 0.9).toFixed(3)}`,
		);

		expect(mean(distance.logged)).toBeLessThan(mean(distance.summed));
	});

	it('fits a repeating-day user, and walks the advisor along that day', () => {
		// The witness the ruling was argued on, built from sliders rather than
		// asserted: mental 8 / physical 3 / enjoyment 8 beside mental 0 /
		// physical 3 / enjoyment 2, a 14 h window, true λ₀ 0.7.
		const day: ProbeDay = {
			tasks: [
				{
					id: 1,
					title: 'deep work',
					mentalDifficulty: 8,
					physicalDifficulty: 3,
					enjoyment: 8,
					createdAt: '2026-08-19',
					completed: false,
				},
				{
					id: 2,
					title: 'errand',
					mentalDifficulty: 0,
					physicalDifficulty: 3,
					enjoyment: 2,
					createdAt: '2026-08-19',
					completed: false,
				},
			].map(toEnergyTask),
			windowHours: 14,
		};

		const lambda = 0.7;
		const params = paramsAt(lambda);
		const plan = optimizeSchedule(day.tasks, day.windowHours, params, CONSTANTS).blocks;
		const rows = sessionRows(plan);

		console.log(
			`[§8.10 witness] the app's own plan at λ₀ ${lambda}: ${plan
				.map((b) => `${b.taskId === null ? 'rest' : `t${b.taskId}`} ${b.hours.toFixed(2)}h`)
				.join(' / ')}`,
		);

		for (const [label, workedHours] of [
			['logged', rows],
			['summed', summed(rows)],
		] as const) {
			const observation: StopObservation = {
				tasks: day.tasks,
				windowHours: day.windowHours,
				workedHours,
			};

			const point = stopIndifferencePoint(observation, params, CONSTANTS)!;

			const fits = [1, 3, 10].map((n) =>
				fitStoppingValue(
					Array.from(
						{
							length: n,
						},
						() => observation,
					),
					DEFAULT_ENERGY_PARAMS.freeTimeValue,
					params,
					CONSTANTS,
				).value.toFixed(3),
			);

			console.log(
				`[§8.10 witness] ${label}: point ${point.toFixed(3)} (err ` +
					`${point - lambda >= 0 ? '+' : ''}${(point - lambda).toFixed(3)}), ` +
					`a repeating-day user's λ̂₀ at n=1/3/10 ${fits.join(' → ')}`,
			);
		}

		// §8.11 on the same day: the advisor shares the reconstruction, and it
		// applies no censor, so it is the more exposed of the two readings.
		const steps = plan.flatMap((b) =>
			Array.from(
				{
					length: Math.round(b.hours / STEP),
				},
				() => b.taskId,
			),
		);

		const openTaskIds = new Set(day.tasks.map((t) => t.id));
		const walked: Rows = [];
		let clock = 0;
		let verdictDiffers = 0;
		let taskDiffers = 0;
		let checkpoints = 0;

		for (const id of steps) {
			clock += STEP;

			if (id === null) continue;

			const last = walked[walked.length - 1];

			if (
				last &&
				last.taskId === id &&
				Math.abs(last.endedAt! - ORIGIN - (clock - STEP) * 3_600_000) < 1
			) {
				last.hours += STEP;
				last.endedAt = ORIGIN + clock * 3_600_000;
			} else
				walked.push({
					taskId: id,
					hours: STEP,
					endedAt: ORIGIN + clock * 3_600_000,
				});

			const advise = (workedHours: Rows) =>
				adviseStop(
					{
						tasks: day.tasks,
						windowHours: day.windowHours,
						workedHours,
						openTaskIds,
					},
					params,
					CONSTANTS,
				)!;

			const logged = advise(
				walked.map((r) => ({
					...r,
				})),
			);

			const flat = advise(summed(walked));

			if (logged.verdict === 'window-full' || flat.verdict === 'window-full') continue;

			checkpoints++;

			if (logged.verdict !== flat.verdict) verdictDiffers++;

			if (logged.taskId !== flat.taskId) taskDiffers++;

			console.log(
				`[§8.11 witness] t=${clock.toFixed(2)}h  logged ${logged.verdict} t${logged.taskId} ` +
					`${logged.sessionHours.toFixed(2)}h at ${logged.marginalValue.toFixed(3)}  |  ` +
					`summed ${flat.verdict} t${flat.taskId} ${flat.sessionHours.toFixed(2)}h at ` +
					`${flat.marginalValue.toFixed(3)}`,
			);
		}

		console.log(
			`[§8.11 witness] over ${checkpoints} checkpoints the verdict differs on ${verdictDiffers} ` +
				`and the task named on ${taskDiffers}`,
		);

		expect(verdictDiffers).toBeGreaterThan(0);
	});
});
