/**
 * What MATH.md §8.10's censored likelihood buys over dropping the one-sided days
 * (ROADMAP item 4).
 *
 * §8.10 dropped every day that reveals only an inequality — worked to the window
 * edge, ended with every task ticked, or logged less than one step on anything —
 * and called the cleverer fit "open work rather than a settled no". The missing
 * measurement is the only one that decides it: **λ₀ recovery error with those
 * days entering as one-sided terms, against the same population with them
 * dropped.**
 *
 * A probe, not a test: every number here moves with the curves, the reservoir
 * law and the lattice.
 *
 * WHAT IT DOES NOT REBUILD, AND WHY. `stopBracket` is exported, so the bounds
 * both arms read are the shipped ones — no bracket replica, unlike
 * `stop-margin-fit-error.probe.ts`, which had to sweep a margin the midpoint
 * hides. Both FITS are local, and they have to be: the censored one is not
 * shipped, and after the refusal the shipped `fitStoppingValue` is the dropped
 * arm, so calling it for the censored side would compare an estimator with
 * itself. Each is validated against the shipped fit instead — the dropped arm on
 * every history, the censored arm wherever nothing is censored, where the two are
 * the same formula by construction.
 *
 * THE KILL CRITERION is the feature spec's, fixed before the run: the mixed cell
 * must improve RMSE by more than **0.110** λ₀ — the bracket half-width §8.10 read
 * on 2026-08-06, against σ₀ = 0.25. The second gate printed beside it is 0.129,
 * §8.10's 2026-08-19 reading with the days' own breaks in the reconstruction;
 * §8.10 has since read 0.125 (2026-08-21, past the clock censor), so the printed
 * 0.129 is one reading stale and both it and 0.125 are stricter than the spec
 * gate that decides. Only `SPEC_GATE` fires the kill criterion.
 *
 * WHAT THE 2026-08-25 RE-RUN CHANGED, and why every number below moved. Every
 * task now comes from integer sliders through `toEnergyTask`, so the day is on
 * the app's own constraint surface. It was not: `difficulty` was set to
 * `max(mental, physical)` directly, skipping the 0.3 spillover the app applies,
 * so no day this probe generated was one a user could have declared and no
 * figure below was quotable in either direction — including the refusal
 * (ROADMAP M40, item 4). The gate is untouched, so the verdict is re-decided at
 * the level rather than re-explained.
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
	STOP_FIT_MAX,
	STOP_FIT_MIN,
	STOP_NOISE_PRIOR_STD,
	STOP_PRIOR_STRENGTH,
	fitStoppingValue,
	optimizeSchedule,
	stopBracket,
	type EnergyParams,
	type EnergyTaskInput,
	type ScheduleBlock,
	type StopBracket,
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
const STEP = DEFAULT_STEP_HOURS;
const FALLBACK = DEFAULT_ENERGY_PARAMS.freeTimeValue;
const ORIGIN = Date.parse('2026-08-21T08:00:00.000Z');
const MS_PER_HOUR = 3_600_000;

/** `taskAmplitude` is internal; §8.10's canonical order is this expression. */
function amplitude(t: EnergyTaskInput): number {
	const effort = mapEffort(t.difficulty);
	const beta = mapEnjoyability(t.enjoyment);

	return effort * beta + beta / effort;
}

function drawTask(random: () => number, id: number): EnergyTaskInput {
	const slider = (min: number) => min + Math.floor(random() * (11 - min));

	const task: Task = {
		id,
		title: `t${id}`,
		mentalDifficulty: slider(0),
		physicalDifficulty: slider(0),
		enjoyment: slider(1),
		createdAt: '2026-08-25',
		completed: false,
	};

	return toEnergyTask(task);
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

/** The plan as the per-step sequence a drain log would produce, rest included. */
function stepsOfPlan(blocks: ScheduleBlock[]): (number | null)[] {
	return blocks.flatMap((b) =>
		Array.from(
			{
				length: Math.round(b.hours / STEP),
			},
			() => b.taskId,
		),
	);
}

/**
 * The step sequence as the 🪫 log holds it: one row per contiguous session
 * carrying the wall-clock moment it ended, the rest steps passing on the clock
 * without a row. That is what carries the day's breaks into the observation.
 */
function observationFrom(
	tasks: EnergyTaskInput[],
	windowHours: number,
	steps: (number | null)[],
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
	};
}

const KINDS = [
	'rational',
	'mood',
	'interrupted-tail',
	'interrupted-mid',
	'grind',
	'window-filled',
	'all-completed',
	'sliver-only',
] as const;

type Kind = (typeof KINDS)[number];

/**
 * The three categories §8.10 drops that a censored likelihood could read. Only
 * `all-completed` and `sliver-only` are one-sided by construction —
 * `window-filled` is one-sided only when its re-plan fills the shorter window.
 */
const CENSORED_KINDS: Kind[] = ['window-filled', 'all-completed', 'sliver-only'];

/**
 * The eight day kinds, all derived from one plan at the user's OWN true λ₀. The
 * first five are `stop-margin-fit-error.probe.ts`'s; the three censored ones are
 * the reachable ones — a zero-work day never becomes an observation
 * (`readFinishedDays` needs `hours > 0`), and an inverted day stays dropped on
 * purpose.
 */
function variantsOf(
	random: () => number,
	params: EnergyParams,
	tasks: EnergyTaskInput[],
	windowHours: number,
	steps: (number | null)[],
): Record<Kind, StopObservation> {
	const weakest = [...tasks].sort((x, y) => amplitude(x) - amplitude(y))[0].id;
	const cut = 1 + Math.floor(random() * 3);
	const at = 1 + Math.floor(random() * Math.max(1, steps.length - 2));
	const added = tasks[Math.floor(random() * tasks.length)].id;
	const workIndices = steps.map((id, i) => (id === null ? -1 : i)).filter((i) => i >= 0);
	const dropped = workIndices[Math.floor(random() * workIndices.length)];
	const grindSteps = Math.min(Math.max(3, workIndices.length), Math.floor(windowHours / STEP) - 1);
	const of = (variant: (number | null)[]) => observationFrom(tasks, windowHours, variant);
	const rational = of(steps);

	// One row per task, each under one step: nothing can be undone, so no `hi`.
	const firstPerTask = new Map(
		[...rational.workedHours].reverse().map((row) => [row.taskId, row.endedAt!]),
	);

	// Worked to the edge HONESTLY: a window one step shorter than this λ₀ wanted,
	// re-planned against it, so the day fills a window the user really declared.
	// Re-labelling the longer day's log instead hands the fit a reconstruction the
	// window arithmetic then discards — §8.10's own low-reading bias, charged to
	// the category rather than to the generator. The price of honesty is that this
	// kind is only SOMETIMES one-sided: the re-plan is free to rest, and the
	// bound table below reports how often it actually censored.
	const shortWindow = Math.max(
		STEP,
		rational.workedHours.reduce((sum, row) => sum + row.hours, 0) - STEP,
	);

	const windowFilled = observationFrom(
		tasks,
		shortWindow,
		stepsOfPlan(optimizeSchedule(tasks, shortWindow, params, CONSTANTS).blocks),
	);

	return {
		rational,
		mood: of(random() < 0.5 ? [...steps, added] : steps.filter((_, i) => i !== dropped)),
		'interrupted-tail': of(steps.slice(0, Math.max(0, steps.length - cut))),
		'interrupted-mid': of([...steps.slice(0, at), ...steps.slice(at + cut)]),
		grind: of(
			Array.from(
				{
					length: grindSteps,
				},
				() => weakest,
			),
		),
		'window-filled': windowFilled,
		'all-completed': {
			...rational,
			openTaskIds: new Set(),
		},
		'sliver-only': {
			...rational,
			workedHours: [...firstPerTask].map(([taskId, endedAt]) => ({
				taskId,
				hours: 0.5,
				endedAt,
			})),
		},
	};
}

interface SimulatedUser {
	lambda: number;
	params: EnergyParams;
	/** One entry per day, holding that same day as observed under each kind. */
	days: Record<Kind, { observation: StopObservation; bracket: StopBracket | null }>[];
}

const LAMBDAS = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
const USER_COUNT = 90;
const DAY_COUNT = 12;
const DAY_COUNTS = [3, 12];

function buildDay(
	random: () => number,
	params: EnergyParams,
): SimulatedUser['days'][number] | null {
	const { tasks, windowHours } = drawDay(random);
	const steps = stepsOfPlan(optimizeSchedule(tasks, windowHours, params, CONSTANTS).blocks);

	if (steps.filter((id) => id !== null).length < 3) return null;

	const variants = variantsOf(random, params, tasks, windowHours, steps);

	return Object.fromEntries(
		KINDS.map((kind) => [
			kind,
			{
				observation: variants[kind],
				bracket: stopBracket(variants[kind], params, CONSTANTS),
			},
		]),
	) as SimulatedUser['days'][number];
}

const MIXES = ['honest', 'mixed', 'completed-only', 'all-censored'] as const;

type MixName = (typeof MIXES)[number];

function drawKind(random: () => number, mix: MixName): Kind {
	if (mix === 'honest') return random() < 0.5 ? 'rational' : 'mood';

	if (mix === 'all-censored') return CENSORED_KINDS[Math.floor(random() * CENSORED_KINDS.length)];

	// The censored category §8.10 calls an ordinary good day, alone: the narrower
	// feature the spec anticipates if the mixed gate does not clear.
	if (mix === 'completed-only') return random() < 0.5 ? 'all-completed' : 'rational';

	const roll = random();

	if (roll < 0.1) return 'interrupted-tail';

	if (roll < 0.2) return 'interrupted-mid';

	if (roll < 0.25) return 'grind';

	if (roll < 0.4) return 'window-filled';

	if (roll < 0.55) return 'all-completed';

	if (roll < 0.62) return 'sliver-only';

	return random() < 0.5 ? 'rational' : 'mood';
}

interface Arm {
	value: number;
	used: number;
}

const clampToFitBounds = (x: number) => Math.min(Math.max(x, STOP_FIT_MIN), STOP_FIT_MAX);

const twoSidedPoints = (brackets: (StopBracket | null)[]) =>
	brackets
		.filter((b): b is StopBracket => b !== null && b.lo !== null && b.hi !== null)
		.map((b) => (b.lo! + b.hi!) / 2);

/**
 * §8.10's shipped fit: the ridge MAP over two-sided days alone, every one-sided
 * day discarded. This IS `fitStoppingValue`, and the run below checks that.
 */
function dropCensoredFit(brackets: (StopBracket | null)[]): Arm {
	const points = twoSidedPoints(brackets);

	if (points.length === 0)
		return {
			value: FALLBACK,
			used: 0,
		};

	const sum = points.reduce((s, p) => s + p, 0);

	return {
		value: clampToFitBounds(
			(sum + STOP_PRIOR_STRENGTH * clampToFitBounds(FALLBACK)) /
				(points.length + STOP_PRIOR_STRENGTH),
		),
		used: points.length,
	};
}

/**
 * log Φ(z) from Numerical Recipes' Chebyshev-fitted erfc (fractional error
 * < 1.2e-7), in log form so the left tail cannot underflow. The repo has no
 * statistics dependency and this arm is the only thing that needs one.
 */
function logNormalCumulative(z: number): number {
	const x = -z / Math.SQRT2;
	const t = 2 / (2 + Math.abs(x));

	const logErfc =
		Math.log(t) -
		x * x -
		1.26551223 +
		t *
			(1.00002368 +
				t *
					(0.37409196 +
						t *
							(0.09678418 +
								t *
									(-0.18628806 +
										t *
											(0.27886807 +
												t *
													(-1.13520398 +
														t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));

	return x >= 0 ? logErfc - Math.LN2 : Math.log1p(-Math.exp(logErfc) / 2);
}

/** The inverse Mills ratio φ/Φ: a one-sided term's own pull on λ₀. */
function normalHazard(z: number): number {
	return Math.exp(-(z * z) / 2 - Math.log(2 * Math.PI) / 2 - logNormalCumulative(z));
}

/**
 * The candidate this probe exists to price, kept HERE because it is not shipped:
 * a Tobit-style one-sided term per censored day, σ fixed at σ₀, minimizing
 *
 *   J(λ) = [Σ_two (mᵢ − λ)² + λ_p(λ − λ₀_default)²]/(2σ₀²)
 *          − Σ_upper log Φ((hiᵢ − λ)/σ₀) − Σ_lower log Φ((λ − loᵢ)/σ₀)
 *
 * over [STOP_FIT_MIN, STOP_FIT_MAX] by bisection on σ₀²·J′ — J is strictly
 * convex, so the root is unique. `λ₀ ≥ STOP_FIT_MIN` is vacuous, so a lower
 * bound at the floor carries nothing. The scaling keeps σ₀ out of the two-sided
 * part, so a history with nothing censored reproduces the shipped closed form
 * bit for bit, which is what the validation below checks.
 */
function censoredFit(brackets: (StopBracket | null)[]): Arm {
	const kept = brackets.filter((b): b is StopBracket => b !== null);
	const points = twoSidedPoints(kept);
	const uppers = kept.filter((b) => b.lo === null).map((b) => b.hi!);

	const lowers = kept
		.filter((b) => b.hi === null)
		.map((b) => b.lo!)
		.filter((lo) => lo > STOP_FIT_MIN);

	const used = points.length + uppers.length + lowers.length;

	if (used === 0)
		return {
			value: FALLBACK,
			used: 0,
		};

	const sigma = STOP_NOISE_PRIOR_STD;
	const value0 = clampToFitBounds(FALLBACK);
	const sum = points.reduce((s, p) => s + p, 0);

	if (uppers.length + lowers.length === 0)
		return {
			value: clampToFitBounds(
				(sum + STOP_PRIOR_STRENGTH * value0) / (points.length + STOP_PRIOR_STRENGTH),
			),
			used,
		};

	const gradient = (lambda: number) =>
		(points.length + STOP_PRIOR_STRENGTH) * lambda -
		sum -
		STOP_PRIOR_STRENGTH * value0 +
		sigma *
			(uppers.reduce((s, hi) => s + normalHazard((hi - lambda) / sigma), 0) -
				lowers.reduce((s, lo) => s + normalHazard((lambda - lo) / sigma), 0));

	if (gradient(STOP_FIT_MIN) >= 0)
		return {
			value: STOP_FIT_MIN,
			used,
		};

	if (gradient(STOP_FIT_MAX) <= 0)
		return {
			value: STOP_FIT_MAX,
			used,
		};

	let low = STOP_FIT_MIN;
	let high = STOP_FIT_MAX;

	for (let step = 0; step < 60; step++) {
		const middle = (low + high) / 2;

		if (gradient(middle) > 0) high = middle;
		else low = middle;
	}

	return {
		value: (low + high) / 2,
		used,
	};
}

interface Fixture {
	population: SimulatedUser[];
	assignment: Record<MixName, Kind[][]>;
}

let cached: Fixture | null = null;

/** Built on first use, not at import: the optimizer runs are the probe's cost. */
function fixture(): Fixture {
	if (cached !== null) return cached;

	const random = mulberry32(0xce5010);

	const population = Array.from(
		{
			length: USER_COUNT,
		},
		(_, u) => {
			const lambda = LAMBDAS[u % LAMBDAS.length];

			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: lambda,
			};

			const days: SimulatedUser['days'] = [];

			for (let attempt = 0; attempt < DAY_COUNT * 8 && days.length < DAY_COUNT; attempt++) {
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

	const assignment = Object.fromEntries(
		MIXES.map((mix, m) => {
			const draw = mulberry32(0xce5020 + m);

			return [mix, population.map((user) => user.days.map(() => drawKind(draw, mix)))] as const;
		}),
	) as Record<MixName, Kind[][]>;

	cached = {
		population,
		assignment,
	};

	return cached;
}

interface Side {
	rmse: number;
	bias: number;
	/** Share of the cell's simulated days that contributed a term */
	usedShare: number;
	/** Share of users the arm fits at all */
	fittedShare: number;
}

interface Cell {
	mix: MixName;
	dayCount: number;
	dropped: Side;
	censored: Side;
}

function summarize(errors: number[], used: number, total: number, fitted: number): Side {
	return {
		rmse: Math.sqrt(errors.reduce((s, x) => s + x * x, 0) / errors.length),
		bias: errors.reduce((s, x) => s + x, 0) / errors.length,
		usedShare: used / total,
		fittedShare: fitted / errors.length,
	};
}

function buildCell(mix: MixName, dayCount: number): Cell {
	const { population, assignment } = fixture();

	const rows = population.map((user, u) =>
		user.days.slice(0, dayCount).map((day, d) => day[assignment[mix][u][d]]),
	);

	const total = rows.reduce((s, row) => s + row.length, 0);
	const droppedFits = rows.map((row) => dropCensoredFit(row.map((c) => c.bracket)));
	const censoredFits = rows.map((row) => censoredFit(row.map((c) => c.bracket)));

	return {
		mix,
		dayCount,
		dropped: summarize(
			droppedFits.map((fit, u) => fit.value - population[u].lambda),
			droppedFits.reduce((s, fit) => s + fit.used, 0),
			total,
			droppedFits.filter((fit) => fit.used > 0).length,
		),
		censored: summarize(
			censoredFits.map((fit, u) => fit.value - population[u].lambda),
			censoredFits.reduce((s, fit) => s + fit.used, 0),
			total,
			censoredFits.filter((fit) => fit.used > 0).length,
		),
	};
}

/**
 * One category's one-sided readings, and how often the λ₀ that GENERATED the day
 * breaks the bound the day reveals — the reconstruction's own error rate here,
 * which the two-sided bracket-coverage reading never measured.
 */
function boundsOf(kind: Kind) {
	const readings = fixture().population.flatMap((user) =>
		user.days.map((day) => ({
			lambda: user.lambda,
			bracket: day[kind].bracket,
		})),
	);

	// `stopBracket` never returns both sides null, so one side null names the other.
	const uppers = readings.filter((r) => r.bracket !== null && r.bracket.lo === null);
	const lowers = readings.filter((r) => r.bracket !== null && r.bracket.hi === null);

	return {
		uppers: uppers.length,
		upperViolations: uppers.filter((r) => r.lambda > r.bracket!.hi!).length,
		lowers: lowers.length,
		lowerViolations: lowers.filter((r) => r.lambda < r.bracket!.lo!).length,
		notOneSided: readings.length - uppers.length - lowers.length,
	};
}

const format = (x: number, digits = 4) => (Number.isFinite(x) ? x.toFixed(digits) : 'n/a');
const signed = (x: number) => `${x >= 0 ? '+' : ''}${format(x)}`;
const percent = (x: number) => `${(100 * x).toFixed(1)}%`;
/** The feature spec's gate, and the half-width §8.10 carries today. */
const SPEC_GATE = 0.11;
const CURRENT_HALF_WIDTH = 0.129;

describe('MATH.md §8.10 — the censored likelihood against dropping the one-sided days', () => {
	it('validates both arms against the shipped fit', () => {
		const { population, assignment } = fixture();
		let worstDropped = 0;
		let worstCensored = 0;
		let twoSidedDays = 0;

		for (const [u, user] of population.entries()) {
			const mixed = user.days.map((day, d) => day[assignment.mixed[u][d]]);

			const shippedMixed = fitStoppingValue(
				mixed.map((c) => c.observation),
				FALLBACK,
				user.params,
				CONSTANTS,
			);

			// The dropped arm IS the shipped estimator, censored days included.
			worstDropped = Math.max(
				worstDropped,
				Math.abs(dropCensoredFit(mixed.map((c) => c.bracket)).value - shippedMixed.value),
			);

			// Days that really are two-sided, which an honest day is NOT always: a
			// plan can fill its own window, and then even a rational day is one-sided.
			// There the censored arm must reproduce the closed form bit for bit.
			const twoSided = user.days
				.map((day) => day.rational)
				.filter((c) => c.bracket !== null && c.bracket.lo !== null && c.bracket.hi !== null);

			twoSidedDays += twoSided.length;

			const shippedTwoSided = fitStoppingValue(
				twoSided.map((c) => c.observation),
				FALLBACK,
				user.params,
				CONSTANTS,
			);

			worstCensored = Math.max(
				worstCensored,
				Math.abs(censoredFit(twoSided.map((c) => c.bracket)).value - shippedTwoSided.value),
			);
		}

		console.log(
			`[§8.10 censored replica] ${population.length} users: dropped arm over ${DAY_COUNT} mixed days ` +
				`worst |arm − shipped| ${worstDropped.toExponential(3)}; censored arm over ${twoSidedDays} ` +
				`two-sided days worst |arm − shipped| ${worstCensored.toExponential(3)}`,
		);

		console.log(
			worstDropped < 1e-12 && worstCensored < 1e-12
				? '[§8.10 censored replica] VALID — the dropped arm reproduces the shipped fit everywhere, ' +
						'and the censored arm reproduces it wherever nothing is censored, so the gap below is the ' +
						'one-sided terms and nothing else'
				: '[§8.10 censored replica] INVALID — an arm is not the estimator it claims to be',
		);
	});

	it('measures λ₀ recovery with the one-sided days used against dropped', () => {
		for (const mix of MIXES)
			for (const dayCount of DAY_COUNTS) {
				const cell = buildCell(mix, dayCount);

				console.log(
					`[§8.10 censored] ${mix.padEnd(13)} n=${String(dayCount).padStart(2)}  ` +
						`dropped RMSE ${format(cell.dropped.rmse)} bias ${signed(cell.dropped.bias)} ` +
						`days ${percent(cell.dropped.usedShare)} users ${percent(cell.dropped.fittedShare)}  ` +
						`censored RMSE ${format(cell.censored.rmse)} bias ${signed(cell.censored.bias)} ` +
						`days ${percent(cell.censored.usedShare)} users ${percent(cell.censored.fittedShare)}  ` +
						`RMSE gain ${signed(cell.dropped.rmse - cell.censored.rmse)}`,
				);
			}

		console.log(
			'[§8.10 censored] the all-censored cell has no fit to compare on the dropped arm — it returns ' +
				'the prior for every user, so its "RMSE" there is the prior’s own error and the gain is not a ' +
				'like-for-like contrast.',
		);
	});

	it('decides the feature on the mixed cell', () => {
		const gains = DAY_COUNTS.map((dayCount) => {
			const cell = buildCell('mixed', dayCount);

			return {
				dayCount,
				gain: cell.dropped.rmse - cell.censored.rmse,
			};
		});

		const best = Math.max(...gains.map((g) => g.gain));

		for (const { dayCount, gain } of gains)
			console.log(
				`[§8.10 censored verdict] mixed n=${String(dayCount).padStart(2)}  RMSE gain ${signed(gain)} λ₀ = ` +
					`${format((100 * gain) / SPEC_GATE, 1)}% of the ${SPEC_GATE} spec gate, ` +
					`${format((100 * gain) / CURRENT_HALF_WIDTH, 1)}% of the ${CURRENT_HALF_WIDTH} half-width §8.10 carries today`,
			);

		console.log(
			best > SPEC_GATE
				? `[§8.10 censored verdict] SHIPS — the mixed cell improves λ₀ RMSE by ${format(best)}, past the ` +
						`${SPEC_GATE} bracket half-width the gate was set at`
				: `[§8.10 censored verdict] KILL CRITERION FIRED — the mixed cell's best RMSE gain is ` +
						`${format(best)} λ₀, inside the ${SPEC_GATE} bracket half-width the gate was set at, so the ` +
						'censored likelihood does not recover λ₀ better than dropping the days on this population. ' +
						'Read the all-censored cell above before concluding it buys nothing: there the dropped arm ' +
						'has no fit at all.',
		);
	});

	it('measures how often a one-sided day’s bound is violated by the truth', () => {
		for (const kind of CENSORED_KINDS) {
			const bounds = boundsOf(kind);

			console.log(
				`[§8.10 bound] ${kind.padEnd(14)} λ₀ ≤ hi on ${String(bounds.uppers).padStart(4)} days, violated ` +
					`${bounds.uppers > 0 ? percent(bounds.upperViolations / bounds.uppers) : 'n/a'}  ` +
					`λ₀ ≥ lo on ${String(bounds.lowers).padStart(4)} days, violated ` +
					`${bounds.lowers > 0 ? percent(bounds.lowerViolations / bounds.lowers) : 'n/a'}  ` +
					`not one-sided ${bounds.notOneSided}`,
			);
		}

		console.log(
			'[§8.10 bound] a violation is the RECONSTRUCTION’s error on this category, not the truth’s: the ' +
				'day was generated at the user’s own λ₀, so a bound the truth breaks is a bound the estimator ' +
				'should not have believed. The two-sided bracket-coverage reading never measured these days.',
		);
	});
});
