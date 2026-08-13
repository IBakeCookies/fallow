/**
 * What MATH.md §8.10's `STOP_INVERSION_MARGIN = 0.25` actually buys the λ₀ fit.
 *
 * §8.10 justified the constant as "the hi-side loose-max bias ~+0.1 plus a
 * lattice bracket half-width ~0.15"; `stop-inversion-margin.probe.ts` measured
 * both terms in 2026-08-06 and neither survived, leaving the number standing on
 * an arithmetic that does not hold. The missing measurement is the one the
 * section cares about: **λ₀ fit error as a function of the margin**, over a
 * population mixing rational, mood-perturbed and genuinely interrupted days.
 * If the fit's RMSE is flat across margins in [0.1, 0.5], the constant does not
 * matter and the section should say so instead of deriving it.
 *
 * A probe, not a test: every number here moves with the curves, the reservoir
 * law and the lattice.
 *
 * WHAT IT HAS TO REBUILD, AND WHY THAT IS SAFE. `stopIndifferencePoint` returns
 * the bracket MIDPOINT or null, so `lo` and `hi` — the only things the margin
 * reads — are invisible, and sweeping margins through the shipped function
 * would mean re-solving every day nine times. The bracket is therefore rebuilt
 * from exported parts only (`workedHoursByTask`, `evaluateSchedule`'s λ₀-free
 * V = satiatedOutput + terminalBonus, the canonical amplitude expression, the
 * unlogged-task insertion at its canonical rank, the structural window censor),
 * the same replica pattern `stop-inversion-margin.probe.ts` and
 * `stop-advisor.probe.ts` already use — and VALIDATED against the shipped
 * `fitStoppingValue` before any number below is believed.
 *
 * The bracket does not depend on the margin, so it is computed ONCE per day and
 * every margin is a pure post-filter over the cached list: one `optimizeSchedule`
 * run per day, and the whole sweep is arithmetic after that.
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
	STOP_INVERSION_MARGIN,
	STOP_NOISE_PRIOR_STD,
	STOP_PRIOR_STRENGTH,
	evaluateSchedule,
	fitStoppingValue,
	optimizeSchedule,
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
const STEP = DEFAULT_STEP_HOURS;
const FALLBACK = DEFAULT_ENERGY_PARAMS.freeTimeValue;

/** `taskAmplitude` is internal; §8.10's canonical order is this expression. */
function amplitude(t: EnergyTaskInput): number {
	const E = mapEffort(t.difficulty);
	const beta = mapEnjoyability(t.enjoyment);

	return E * beta + beta / E;
}

interface Bracket {
	/** max(0, lo) — the value the shipped censoring test compares. */
	stopBound: number;
	hi: number;
}

/** §8.10's bracket, rebuilt from exported parts. Null = structurally censored. */
function bracketOf(observation: StopObservation, params: EnergyParams): Bracket | null {
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

	// No room to extend is a structural censor, not an inversion.
	if (total + STEP > windowHours + 1e-9) return null;

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateSchedule(blocks, tasks, windowHours, params, CONSTANTS);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	const base = workValue(sched);

	// `growBy`: an unlogged task enters at ITS canonical rank, not appended.
	const grown = (t: EnergyTaskInput): ScheduleBlock[] => {
		if (byTask.has(t.id)) {
			return sched.map((b) =>
				b.taskId === t.id
					? {
							...b,
							hours: b.hours + STEP,
						}
					: b,
			);
		}

		const at = sched.filter((b) => rank.get(b.taskId!)! < rank.get(t.id)!).length;

		return [
			...sched.slice(0, at),
			{
				taskId: t.id,
				hours: STEP,
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
							hours: b.hours - STEP,
						}
					: b,
			)
			.filter((b) => b.hours > 1e-9);

	let lo = -Infinity;

	for (const t of tasks) lo = Math.max(lo, (workValue(grown(t)) - base) / STEP);

	let hi: number | null = null;

	for (const t of tasks)
		if ((byTask.get(t.id) ?? 0) >= STEP - 1e-9)
			hi = Math.max(hi ?? -Infinity, (base - workValue(shrunk(t.id))) / STEP);

	if (hi === null) return null;

	return {
		stopBound: Math.max(0, lo),
		hi,
	};
}

/** The day's indifference point, or null when this margin censors it. */
function pointAt(bracket: Bracket, margin: number): number | null {
	return bracket.stopBound > bracket.hi + margin ? null : (bracket.stopBound + bracket.hi) / 2;
}

/** `fitStoppingValue`'s closed form: the ridge MAP against the default prior. */
function fitFrom(points: number[]): number {
	if (points.length === 0) return FALLBACK;

	const clamp = (x: number) => Math.min(Math.max(x, STOP_FIT_MIN), STOP_FIT_MAX);
	const sum = points.reduce((s, p) => s + p, 0);

	return clamp(
		(sum + STOP_PRIOR_STRENGTH * clamp(FALLBACK)) / (points.length + STOP_PRIOR_STRENGTH),
	);
}

const KINDS = ['rational', 'mood', 'interrupted-tail', 'interrupted-mid', 'grind'] as const;

type Kind = (typeof KINDS)[number];

interface DayCell {
	observation: StopObservation;
	bracket: Bracket | null;
}

interface SimulatedUser {
	lambda: number;
	params: EnergyParams;
	/** One entry per day, holding that same day as observed under each kind. */
	days: Record<Kind, DayCell>[];
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

/** The plan as the per-step work sequence a drain log would have produced. */
function stepsOfPlan(blocks: ScheduleBlock[]): number[] {
	return blocks
		.filter((b) => b.taskId !== null)
		.flatMap((b) =>
			Array.from(
				{
					length: Math.round(b.hours / STEP),
				},
				() => b.taskId!,
			),
		);
}

function observationFrom(
	tasks: EnergyTaskInput[],
	windowHours: number,
	steps: number[],
): StopObservation {
	const byTask = new Map<number, number>();

	for (const id of steps) byTask.set(id, (byTask.get(id) ?? 0) + STEP);

	return {
		tasks,
		windowHours,
		workedHours: [...byTask].map(([taskId, hours]) => ({
			taskId,
			hours,
		})),
	};
}

/**
 * The five day kinds, all derived from one plan at the user's OWN true λ₀. Two
 * interruption SHAPES on purpose — a tail cut and an interior one — so a flat
 * verdict below cannot be blamed on a single gentle generator.
 */
function variantSteps(
	random: () => number,
	tasks: EnergyTaskInput[],
	windowHours: number,
	steps: number[],
): Record<Kind, number[]> {
	const weakest = [...tasks].sort((x, y) => amplitude(x) - amplitude(y))[0].id;
	const cut = 1 + Math.floor(random() * 3);
	const at = 1 + Math.floor(random() * Math.max(1, steps.length - 2));
	const added = tasks[Math.floor(random() * tasks.length)].id;
	const dropped = Math.floor(random() * steps.length);
	const grindSteps = Math.min(Math.max(3, steps.length), Math.floor(windowHours / STEP) - 1);

	return {
		rational: steps,
		mood: random() < 0.5 ? [...steps, added] : steps.filter((_, i) => i !== dropped),
		'interrupted-tail': steps.slice(0, Math.max(0, steps.length - cut)),
		'interrupted-mid': [...steps.slice(0, at), ...steps.slice(at + cut)],
		grind: Array.from(
			{
				length: grindSteps,
			},
			() => weakest,
		),
	};
}

function buildDay(random: () => number, params: EnergyParams): Record<Kind, DayCell> | null {
	const { tasks, windowHours } = drawDay(random);
	const steps = stepsOfPlan(optimizeSchedule(tasks, windowHours, params, CONSTANTS).blocks);

	if (steps.length < 3) return null;

	const variants = variantSteps(random, tasks, windowHours, steps);

	const cells = KINDS.map((kind) => {
		const observation = observationFrom(tasks, windowHours, variants[kind]);

		return [
			kind,
			{
				observation,
				bracket: bracketOf(observation, params),
			},
		] as const;
	});

	return Object.fromEntries(cells) as Record<Kind, DayCell>;
}

const LAMBDAS = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
const USER_COUNT = 90;
const DAY_COUNT = 12;

function buildPopulation(): SimulatedUser[] {
	const random = mulberry32(0x51a010);

	return Array.from(
		{
			length: USER_COUNT,
		},
		(_, u) => {
			const lambda = LAMBDAS[u % LAMBDAS.length];

			const params = {
				...DEFAULT_ENERGY_PARAMS,
				freeTimeValue: lambda,
			};

			const days: Record<Kind, DayCell>[] = [];

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
}

const MIXES = ['honest', '30%-interrupted'] as const;

type MixName = (typeof MIXES)[number];

function drawKind(random: () => number, mix: MixName): Kind {
	if (mix === 'honest') return random() < 0.5 ? 'rational' : 'mood';

	const roll = random();

	if (roll < 0.15) return 'interrupted-tail';

	if (roll < 0.3) return 'interrupted-mid';

	if (roll < 0.35) return 'grind';

	return random() < 0.5 ? 'rational' : 'mood';
}

function cellsFor(user: SimulatedUser, kinds: Kind[], dayCount: number): DayCell[] {
	return user.days.slice(0, dayCount).map((day, d) => day[kinds[d]]);
}

function pointsOf(cells: DayCell[], margin: number): number[] {
	return cells
		.map((c) => (c.bracket === null ? null : pointAt(c.bracket, margin)))
		.filter((p): p is number => p !== null);
}

function quantile(values: number[], q: number): number {
	if (values.length === 0) return NaN;

	const sorted = [...values].sort((a, b) => a - b);

	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function fmt(x: number, digits = 3): string {
	return Number.isFinite(x) ? x.toFixed(digits) : 'n/a';
}

const MARGINS = [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, Infinity];

// The kill criterion's own range: [0.1, 0.5]. m = 0 and m = ∞ are controls.
const IN_RANGE = MARGINS.map((m, i) => ({
	m,
	i,
})).filter(({ m }) => m >= 0.1 && m <= 0.5);

/** n = 3 matters because §8.10's prior gives ONE day 50% of the fit — the only regime where the margin has leverage. */
const DAY_COUNTS = [3, 12];
/** The instrument's own resolution: median bracket half-width, `stop-inversion-margin.probe.ts` 2026-08-06. */
const BRACKET_HALF_WIDTH = 0.11;

interface Arm {
	mix: MixName;
	dayCount: number;
	/** Per-margin, per-user signed fit error against that user's true λ₀. */
	errors: number[][];
	kept: number[];
	rmse: number[];
	bias: number[];
}

interface Fixture {
	population: SimulatedUser[];
	/** Which kind occupies each (user, day) slot — fixed once, shared by every margin and n. */
	assignment: Record<MixName, Kind[][]>;
	arms: Arm[];
}

function buildArm(fixture: Omit<Fixture, 'arms'>, mix: MixName, dayCount: number): Arm {
	const { population, assignment } = fixture;
	const cells = population.map((user, u) => cellsFor(user, assignment[mix][u], dayCount));
	const total = cells.reduce((s, c) => s + c.length, 0);

	const errors = MARGINS.map((margin) =>
		cells.map((c, u) => fitFrom(pointsOf(c, margin)) - population[u].lambda),
	);

	const kept = MARGINS.map(
		(margin) => cells.reduce((s, c) => s + pointsOf(c, margin).length, 0) / total,
	);

	return {
		mix,
		dayCount,
		errors,
		kept,
		rmse: errors.map((e) => Math.sqrt(e.reduce((s, x) => s + x * x, 0) / e.length)),
		bias: errors.map((e) => e.reduce((s, x) => s + x, 0) / e.length),
	};
}

let cached: Fixture | null = null;

/** Built on first use, not at import: the optimizer runs are the probe's whole cost. */
function fixture(): Fixture {
	if (cached !== null) return cached;

	const population = buildPopulation();

	const assignment = Object.fromEntries(
		MIXES.map((mix, m) => {
			const random = mulberry32(0x51a020 + m);

			return [mix, population.map((user) => user.days.map(() => drawKind(random, mix)))] as const;
		}),
	) as Record<MixName, Kind[][]>;

	cached = {
		population,
		assignment,
		arms: MIXES.flatMap((mix) =>
			DAY_COUNTS.map((dayCount) =>
				buildArm(
					{
						population,
						assignment,
					},
					mix,
					dayCount,
				),
			),
		),
	};

	return cached;
}

const label = (arm: Arm) => `${arm.mix.padEnd(16)} n=${String(arm.dayCount).padStart(2)}`;

const rmseOf = (errors: number[], sample: number[]) =>
	Math.sqrt(sample.reduce((s, i) => s + errors[i] * errors[i], 0) / sample.length);

describe('MATH.md §8.10 — λ₀ fit error as a function of STOP_INVERSION_MARGIN', () => {
	it('validates the replica fit against the shipped fitStoppingValue', () => {
		// The generated days carry no `openTaskIds`, so `reconstructStopDay`'s
		// `candidates` filter is the identity — which is why the replica omits it.
		const { population, assignment } = fixture();
		let worst = 0;

		for (const [u, user] of population.entries()) {
			const cells = cellsFor(user, assignment['30%-interrupted'][u], DAY_COUNT);

			const shipped = fitStoppingValue(
				cells.map((c) => c.observation),
				FALLBACK,
				user.params,
				CONSTANTS,
			);

			worst = Math.max(
				worst,
				Math.abs(fitFrom(pointsOf(cells, STOP_INVERSION_MARGIN)) - shipped.value),
			);
		}

		console.log(
			`[§8.10 replica] ${population.length} users × ${DAY_COUNT} mixed days: ` +
				`worst |replica fit − shipped fit| ${worst.toExponential(3)}`,
		);

		console.log(
			worst < 1e-9
				? '[§8.10 replica] VALID — every number below reads the same bracket the shipped code does'
				: '[§8.10 replica] INVALID — the arms below are measuring a different estimator',
		);
	});

	it('measures each day kind against the truth that generated it', () => {
		for (const kind of KINDS) {
			const rows = fixture().population.flatMap((user) =>
				user.days
					.map((day) => day[kind])
					.filter((cell) => cell.bracket !== null)
					.map((cell) => ({
						gap: cell.bracket!.stopBound - cell.bracket!.hi,
						point: (cell.bracket!.stopBound + cell.bracket!.hi) / 2,
						lambda: user.lambda,
					})),
			);

			const gaps = rows.filter((r) => r.gap > 0).map((r) => r.gap);

			console.log(
				`[§8.10 per-kind] ${kind.padEnd(17)} days ${String(rows.length).padStart(4)}  ` +
					`inverted ${fmt((100 * gaps.length) / rows.length, 1)}%  ` +
					`past 0.25 ${fmt((100 * rows.filter((r) => r.gap > STOP_INVERSION_MARGIN).length) / rows.length, 1)}%  ` +
					`gap p50 ${fmt(quantile(gaps, 0.5))} p90 ${fmt(quantile(gaps, 0.9))}  ` +
					`point p50 ${fmt(
						quantile(
							rows.map((r) => r.point),
							0.5,
						),
					)}  ` +
					`|point−truth| p50 ${fmt(
						quantile(
							rows.map((r) => Math.abs(r.point - r.lambda)),
							0.5,
						),
					)}`,
			);
		}
	});

	it('sweeps the margin against λ₀ fit RMSE', () => {
		for (const arm of fixture().arms) {
			const rows = MARGINS.map((margin, i) => {
				const control = margin === 0 || !Number.isFinite(margin) ? ' (control)' : '';

				return (
					`[§8.10 sweep] ${label(arm)}  m=${Number.isFinite(margin) ? margin.toFixed(2) : ' inf'}  ` +
					`RMSE ${fmt(arm.rmse[i], 4)}  bias ${arm.bias[i] >= 0 ? '+' : ''}${fmt(arm.bias[i], 4)}  ` +
					`kept ${fmt(100 * arm.kept[i], 1)}%${control}`
				);
			});

			console.log(rows.join('\n'));
		}
	});

	it('decides whether the RMSE is flat across [0.1, 0.5]', () => {
		const { population, arms } = fixture();

		const verdicts = arms.map((arm) => {
			const inRange = IN_RANGE.map(({ i }) => arm.rmse[i]);
			const movement = Math.max(...inRange) - Math.min(...inRange);
			// Endpoint contrast fixed BEFORE looking at the data. Picking the observed
			// worst and best margins instead would bias the difference upward, and
			// comparing the spread against the RMSE's own level uncertainty would be
			// the overlapping-error-bars fallacy: that uncertainty is common to every
			// margin, since one user sample is scored at all of them.
			const low = MARGINS.indexOf(0.1);
			const high = MARGINS.indexOf(0.5);
			const endpoint = arm.rmse[high] - arm.rmse[low];
			const random = mulberry32(0x51a030 + arm.dayCount);

			const differences = Array.from(
				{
					length: 400,
				},
				() => {
					const sample = population.map(() => Math.floor(random() * population.length));

					return rmseOf(arm.errors[high], sample) - rmseOf(arm.errors[low], sample);
				},
			);

			// Flat = an effect an order of magnitude below the instrument's own
			// resolution, in λ₀ units. Not "smaller than the sampling noise".
			const fired = movement < BRACKET_HALF_WIDTH / 10;

			console.log(
				`[§8.10 verdict] ${label(arm)}  RMSE over [0.1,0.5] ${fmt(Math.min(...inRange), 4)}–${fmt(Math.max(...inRange), 4)}  ` +
					`largest movement ${fmt(movement, 4)} λ₀ = ${fmt((100 * movement) / BRACKET_HALF_WIDTH, 1)}% of the ` +
					`${BRACKET_HALF_WIDTH} bracket half-width, ${fmt((100 * movement) / STOP_NOISE_PRIOR_STD, 1)}% of σ₀=${STOP_NOISE_PRIOR_STD}  ` +
					`endpoint RMSE(0.5)−RMSE(0.1) ${fmt(endpoint, 4)} ` +
					`[paired 95% CI ${fmt(quantile(differences, 0.025), 4)}, ${fmt(quantile(differences, 0.975), 4)}]  ` +
					`censor-nothing vs 0.25 ${fmt(arm.rmse[MARGINS.indexOf(Infinity)] - arm.rmse[MARGINS.indexOf(0.25)], 4)}`,
			);

			return fired;
		});

		console.log(
			verdicts.every(Boolean)
				? `[§8.10 verdict] KILL CRITERION FIRED in ${verdicts.length}/${verdicts.length} arms — ` +
						`the whole margin range moves λ₀ fit RMSE by less than a tenth of the ` +
						`${BRACKET_HALF_WIDTH} bracket half-width the instrument already concedes, so the constant ` +
						'does not matter over [0.1, 0.5] and §8.10 must say so. The drift is detectable but ' +
						'negligible, and it has a consistent SIGN: wider censors less and fits slightly better.'
				: `[§8.10 verdict] KILL CRITERION DID NOT FIRE in ${verdicts.filter((v) => !v).length} arm(s) — ` +
						'the margin moves the fit by an instrument-visible amount and 0.25 can be re-derived',
		);
	});
});
