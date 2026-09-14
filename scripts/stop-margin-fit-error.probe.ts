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
 * It carries a second question the same population answers: what the fit's own
 * λ₀ error is made of — how far a day's indifference point sits from the truth
 * that generated it, and how the ridge turns that into a fit bias that grows
 * with the number of days (ROADMAP M106).
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
 * THE OPEN-TASK SCOPE ARM. §8.10's `lo` prices the stop against the tasks still
 * OPEN, and the replica takes that filter too. Completion there is drawn
 * CAUSALLY — only tasks the day's own plan funded, at exactly the hours it gave
 * them — so the generated day stays the true rational day and the shipped scope
 * can be scored against the pre-correction all-tasks scope on a known λ₀.
 *
 * The bracket does not depend on the margin, so it is computed ONCE per day and
 * every margin is a pure post-filter over the cached list: one `optimizeSchedule`
 * run per day, and the whole sweep is arithmetic after that.
 *
 * WHAT THE 2026-09-14 ARMS ADD (ROADMAP M106), and what they move: nothing. The
 * honest arm's λ₀ bias grows with n — +0.0111 at n = 3, +0.0917 at n = 12 — and
 * the sweep cannot say why, because no arm printed a per-day error with its
 * SIGN. `[§8.10 signed]` does: over 794 kept honest days the indifference point
 * sits +0.0925 ABOVE the truth that generated the day (p50 +0.0584, 69.4% of
 * days above it), and that bias is a function of the truth — +0.4175 at
 * λ₀ = 0.3 on 56 kept days against +0.0394 at λ₀ = 1.1 on 179, and it falls with
 * the truth without being monotone in it (+0.0562 at λ₀ = 1.3). `[§8.10 prior]`
 * prints the other half: the fit's default is 0.5 while the truths are drawn
 * from a grid whose mean is 0.80, so the ridge pulls every user's fit -0.3000
 * from the mean truth. Both halves M106 left untested hold.
 *
 * `[§8.10 bias-by-n]` splits each n's bias into the ridge's two terms,
 * fit − λ = (k·ē + strength·(default − λ))/(k + strength) per user. The split
 * closes to 9.714e-17 over 24 rows, and across the n = 3 → 12 window the finding
 * names, the measured growth +0.0806 is the prior term weakening by +0.0475
 * (58.9%) plus the data term's +0.0331 — and the per-user bias that data term
 * multiplies stays in +0.1331–+0.1499 over the same window, so what grew there
 * is the weight k/(k+1), not the bias. The per-day bias the whole split rests on
 * holds at +0.0925–+0.1023 across that window, a movement of 0.0098, 8.0% of the
 * 0.122 half-width. So the growth is the ridge on both sides: a per-day bias the
 * days carried all along, uncovered as the prior's pull weakens. The n = 3 arm's
 * near-zero bias is two errors of opposite sign, not accuracy.
 *
 * THE WHOLE SWEEP IS WIDER THAN ITS WINDOW, and the arm prints both because the
 * difference is where a reader would be misled. Over n ∈ [1, 12] the per-day
 * bias reads +0.0925–+0.1143, movement 0.0218, 17.8% of the half-width — but
 * that n = 1 → 12 contrast is -0.0218 with a paired 95% CI over users of
 * [-0.0636, 0.0181], and the n = 1 cell is one kept day per user, 69 users of 90,
 * against 794 kept days at n = 12. The movement is not distinguishable from zero,
 * and the criterion reads the window the finding names rather than the sweep, so
 * that its three clauses are all about one claim.
 *
 * Read on 1c3bfbc, in a worktree at that commit: M104's compound-move build was
 * in flight in another session and changes `neighbors`, which moves every day
 * this file generates and every figure in it. Every line the 2026-09-12 run
 * printed reproduces byte-for-byte — these arms only add lines.
 *
 * WHAT THE 2026-09-12 RE-RUN CHANGED, and what it did not. The half-width is
 * MEASURED here now instead of transcribed from `stop-inversion-margin.probe.ts`
 * — see `bracketHalfWidth`. On this probe's own population it reads 0.122 over
 * 721 non-inverted rational logged days, against the 0.125 the sister probe
 * reads over 197 optimizer days and the 0.134 this file had carried since
 * 2026-08-19 (ROADMAP M105). Six printed lines move against the 2026-09-11 run
 * and no others: the new `[§8.10 resolution]` line, the four per-arm
 * `[§8.10 verdict]` lines and the `[§8.10 scope]` kill line. On those, only the
 * half-width literal and the percentages taken of it change — three values
 * move, 0.2% → 0.3%, 13.8% → 15.2% and 1.8% → 2.0%, while the honest n = 12 arm
 * stays 0.0%. Every RMSE, bias, kept share, endpoint contrast, confidence
 * interval and censor-nothing delta, and the whole scope table, reproduce
 * byte-for-byte, and every CONCLUSION holds: the kill criterion still does not
 * fire in the 30%-interrupted n = 3 arm (0.0185 clears a tenth of the
 * half-width at any of the three values), and the scope kill line still fires.
 * The comparison ROADMAP M105 asked for therefore lands on a resolution this
 * probe measured over its own rational days: the honest n = 12 RMSE of
 * 0.1700 is outside it.
 *
 * WHAT THE 2026-09-11 RE-RUN CHANGED, and why every number below moved again.
 * The energy model now runs the classic model's v2 curve `(a·k·s+p₀)·e^(−ks)`
 * (docs/features/the-curve-nobody-chose.md), so every day generated, bracketed
 * and fitted here is on that curve; the replica held to 0.000e+0 against the
 * shipped fit without an edit. Two readings moved past their v1 verdicts. The
 * honest n = 12 λ₀ fit reads RMSE 0.1700 with bias +0.0917 (0.110 on the
 * 2026-08-25 v1 re-read), OUTSIDE the bracket half-width — the spec expected
 * the cell inside a v2 half-width, and this file measured none until
 * 2026-09-12 (ROADMAP M105). And the margin sweep is flat in three arms (largest
 * movement ≤ 0.0025) but not in the 30%-interrupted n = 3 arm: 0.2044–0.2229
 * over [0.1, 0.5], movement 0.0185 λ₀, endpoint contrast −0.0173 with paired
 * 95% CI [−0.0308, −0.0053], so the kill criterion
 * fires in 3 of 4 arms where v1 fired all four. The sign is v1's: wider
 * censors less and fits better, and censoring nothing beats 0.25 in both
 * contaminated arms (−0.0197, −0.0116) and ties the honest ones. The scope
 * arm's best gain over 12 arms is 0.0198, inside the half-width, so its kill
 * line still fires.
 *
 * WHAT THE 2026-08-25 RE-RUN CHANGED, and why every number below moved again.
 * Every task now comes from integer sliders through `toEnergyTask`, so the day
 * is on the app's own constraint surface. It was not: `difficulty` was set to
 * `max(mental, physical)` directly, skipping the 0.3 spillover the app applies,
 * so no day this probe generated was one a user could have declared and no
 * figure below was quotable in either direction (ROADMAP M40).
 *
 * WHAT THE 2026-08-21 RE-RUN CHANGED. The replica took the shipped
 * `isClockCensored` — a day whose own span, breaks included, leaves no room for
 * another step is censored before either bound is priced, so no margin can reach
 * it — and the shipped overhang trim it replicated went with it.
 *
 * WHAT THE 2026-08-19 RE-RUN CHANGED, and why every number below moved. The step
 * sequence used to DROP the plan's rest blocks, so no day this probe generated
 * could carry a break and the whole sweep was computed on break-free
 * reconstructions — which is how the break-omission bias stayed invisible to it.
 * The sequence now keeps rest as a `null` step, `observationFrom` walks it on a
 * wall clock and emits one row per session with the moment it ended, and the
 * replica reads the structure back out of those moments exactly as the shipped
 * `reconstructStopDay` does.
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
	// WORKED hours, never the schedule's extent: the window censor must not turn
	// on recovered structure (§8.10).
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const rest = recoveredRest(observation, byTask);

	// No room to extend is a structural censor, not an inversion — on worked hours
	// for the bound, and on the day's whole SPAN for the clock (§8.10).
	if (total + STEP > windowHours + 1e-9) return null;

	if (isClockCensored(observation, rest, total)) return null;

	const sched: ScheduleBlock[] =
		loggedStructure(rest, windowHours, total) ??
		canonical
			.filter((t) => byTask.has(t.id))
			.map((t) => ({
				taskId: t.id,
				hours: byTask.get(t.id)!,
			}));

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

	/** `shrinkBy`: one step off the END of that task's work, across its blocks. */
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

	let lo = -Infinity;

	for (const t of candidates) lo = Math.max(lo, (workValue(grown(t)) - base) / STEP);

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

/**
 * `isClockCensored`: the day's own span — worked hours plus the UNCAPPED
 * recovered breaks — leaves no room for another step (§8.10, 2026-08-21). The
 * margin below cannot reach such a day: it is censored before any bound exists.
 */
function isClockCensored(
	observation: StopObservation,
	rest: ReturnType<typeof recoveredRest>,
	total: number,
): boolean {
	if (rest === null) return false;

	return total + rest.restTotal + STEP > observation.windowHours + 1e-9;
}

/** The day's indifference point, or null when this margin censors it. */
function pointAt(bracket: Bracket, margin: number): number | null {
	return bracket.stopBound > bracket.hi + margin ? null : (bracket.stopBound + bracket.hi) / 2;
}

/**
 * `fitStoppingValue`'s closed form: the ridge MAP against the default prior.
 * The strength is a parameter for the bias-by-n arm alone, which needs the same
 * estimator with the prior switched OFF to separate the ridge's pull from the
 * per-day point it pulls on; every other caller takes the shipped value.
 */
function fitFrom(points: number[], strength: number = STOP_PRIOR_STRENGTH): number {
	if (points.length === 0) return FALLBACK;

	const clamp = (x: number) => Math.min(Math.max(x, STOP_FIT_MIN), STOP_FIT_MAX);
	const sum = points.reduce((s, p) => s + p, 0);

	return clamp((sum + strength * clamp(FALLBACK)) / (points.length + strength));
}

const KINDS = ['rational', 'mood', 'interrupted-tail', 'interrupted-mid', 'grind'] as const;

type Kind = (typeof KINDS)[number];

interface DayCell {
	observation: StopObservation;
	bracket: Bracket | null;
	/** The same day read the pre-2026-08-19 way — rows summed, breaks discarded */
	summedBracket: Bracket | null;
}

interface SimulatedUser {
	lambda: number;
	params: EnergyParams;
	/** One entry per day, holding that same day as observed under each kind. */
	days: Record<Kind, DayCell>[];
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

/**
 * The plan as the per-step sequence a drain log would have produced — REST
 * INCLUDED, as a `null` step. Dropping it is what made every day this probe
 * generated break-free, and with it the whole sweep below.
 */
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
 * The step sequence as the 🪫 log would hold it: one row per contiguous session,
 * each carrying the wall-clock moment it ended, the rest steps passing on the
 * clock without producing a row. That is what carries the day's breaks into the
 * observation.
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
			Math.abs(last.endedAt! - ORIGIN - (clock - STEP) * 3_600_000) < 1
		) {
			last.hours += STEP;
			last.endedAt = ORIGIN + clock * 3_600_000;
			continue;
		}

		workedHours.push({
			taskId: id,
			hours: STEP,
			endedAt: ORIGIN + clock * 3_600_000,
		});
	}

	return {
		tasks,
		windowHours,
		workedHours,
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
	steps: (number | null)[],
): Record<Kind, (number | null)[]> {
	const weakest = [...tasks].sort((x, y) => amplitude(x) - amplitude(y))[0].id;
	const cut = 1 + Math.floor(random() * 3);
	const at = 1 + Math.floor(random() * Math.max(1, steps.length - 2));
	const added = tasks[Math.floor(random() * tasks.length)].id;
	// A mood day works 45 min more or less, so the dropped step is a WORK step.
	const workIndices = steps.map((id, i) => (id === null ? -1 : i)).filter((i) => i >= 0);
	const dropped = workIndices[Math.floor(random() * workIndices.length)];
	const grindSteps = Math.min(Math.max(3, workIndices.length), Math.floor(windowHours / STEP) - 1);

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

	if (steps.filter((id) => id !== null).length < 3) return null;

	const variants = variantSteps(random, tasks, windowHours, steps);

	const cells = KINDS.map((kind) => {
		const observation = observationFrom(tasks, windowHours, variants[kind]);

		return [
			kind,
			{
				observation,
				bracket: bracketOf(observation, params),
				summedBracket: bracketOf(
					{
						...observation,
						workedHours: observation.workedHours.map(({ taskId, hours }) => ({
							taskId,
							hours,
						})),
					},
					params,
				),
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

function pointsOf(brackets: (Bracket | null)[], margin: number): number[] {
	return brackets
		.map((b) => (b === null ? null : pointAt(b, margin)))
		.filter((p): p is number => p !== null);
}

const bracketsOf = (cells: DayCell[]): (Bracket | null)[] => cells.map((c) => c.bracket);

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
let cachedHalfWidth: number | null = null;

/**
 * The instrument's own resolution, measured HERE: the median half-width of this
 * probe's own non-inverted rational days, on the logged reading the fit uses.
 * It used to be a literal copied from `stop-inversion-margin.probe.ts`, which
 * measures the same quantity over a DIFFERENT population — its optimizer days
 * on a 4-value λ₀ grid, against the mixed arms on a 6-value grid judged here —
 * and the copy went three readings stale while every verdict below priced
 * against it (ROADMAP M105). A number two probes must agree on is measured by
 * each of them or exported by one; it cannot be transcribed.
 */
function halfWidths(): number[] {
	return fixture()
		.population.flatMap((user) => user.days.map((day) => day.rational.bracket))
		.filter((bracket): bracket is Bracket => bracket !== null)
		.filter((bracket) => bracket.stopBound <= bracket.hi)
		.map((bracket) => (bracket.hi - bracket.stopBound) / 2);
}

function halfWidthDayCount(): number {
	return halfWidths().length;
}

function bracketHalfWidth(): number {
	if (cachedHalfWidth === null) cachedHalfWidth = quantile(halfWidths(), 0.5);

	return cachedHalfWidth;
}

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
		cells.map((c, u) => fitFrom(pointsOf(bracketsOf(c), margin)) - population[u].lambda),
	);

	const kept = MARGINS.map(
		(margin) => cells.reduce((s, c) => s + pointsOf(bracketsOf(c), margin).length, 0) / total,
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

const COMPLETION_RATES = [0, 0.25, 0.5, 0.75];

/**
 * The finished subset, drawn CAUSALLY from the tasks this cell's own step list
 * funded, at exactly the hours the plan gave them: the size cap binds nowhere
 * the plan reached, so the day is still the true rational day and completion
 * moves `openTaskIds` alone. A completion drawn independently of the plan cannot
 * test the bias — at a rational stop `lo ≤ λ₀` already, so removing a maximizer
 * only lowers it and the corrected scope would lose by construction.
 */
function openIdsOf(random: () => number, cell: DayCell, rate: number): ReadonlySet<number> {
	const finished = new Set(
		cell.observation.workedHours.filter(() => random() < rate).map((w) => w.taskId),
	);

	return new Set(cell.observation.tasks.filter((t) => !finished.has(t.id)).map((t) => t.id));
}

interface ScopeSide {
	rmse: number;
	bias: number;
	usedDays: number;
}

interface ScopeArm {
	mix: MixName;
	rate: number;
	dayCount: number;
	corrected: ScopeSide;
	allTasks: ScopeSide;
}

function sideOf(
	population: SimulatedUser[],
	brackets: (Bracket | null)[][],
	dayCount: number,
): ScopeSide {
	let usedDays = 0;

	const errors = population.map((user, u) => {
		const points = pointsOf(brackets[u].slice(0, dayCount), STOP_INVERSION_MARGIN);

		usedDays += points.length;

		return fitFrom(points) - user.lambda;
	});

	return {
		rmse: Math.sqrt(errors.reduce((s, x) => s + x * x, 0) / errors.length),
		bias: errors.reduce((s, x) => s + x, 0) / errors.length,
		usedDays,
	};
}

function buildScopeArms(): ScopeArm[] {
	const { population, assignment } = fixture();

	return MIXES.flatMap((mix, m) =>
		COMPLETION_RATES.flatMap((rate, r) => {
			const random = mulberry32(0x51a040 + COMPLETION_RATES.length * m + r);
			const cells = population.map((user, u) => cellsFor(user, assignment[mix][u], DAY_COUNT));

			// Drawn once per (user, day) at the full DAY_COUNT so the n = 3 arm reads a
			// PREFIX of the n = 12 arm's completions rather than a fresh roll.
			const corrected = cells.map((row, u) =>
				row.map((cell) =>
					bracketOf(
						{
							...cell.observation,
							openTaskIds: openIdsOf(random, cell, rate),
						},
						population[u].params,
					),
				),
			);

			// The pre-2026-08-12 scope never read the field, so completion is invisible
			// to it and its bracket is the cell's own.
			const allTasks = cells.map(bracketsOf);

			return DAY_COUNTS.map((dayCount) => ({
				mix,
				rate,
				dayCount,
				corrected: sideOf(population, corrected, dayCount),
				allTasks: sideOf(population, allTasks, dayCount),
			}));
		}),
	);
}

let cachedScopeArms: ScopeArm[] | null = null;

function scopeArms(): ScopeArm[] {
	cachedScopeArms ??= buildScopeArms();

	return cachedScopeArms;
}

const label = (arm: Arm) => `${arm.mix.padEnd(16)} n=${String(arm.dayCount).padStart(2)}`;
const signed = (x: number) => `${x >= 0 ? '+' : ''}${fmt(x, 4)}`;

const rmseOf = (errors: number[], sample: number[]) =>
	Math.sqrt(sample.reduce((s, i) => s + errors[i] * errors[i], 0) / sample.length);

const mean = (values: number[]) => values.reduce((s, x) => s + x, 0) / values.length;
const MEAN_LAMBDA = mean(LAMBDAS);

interface UserPoints {
	lambda: number;
	/** The kept indifference points this user's fit averages, at the shipped margin. */
	points: number[];
}

function pointsByUser(mix: MixName, dayCount: number): UserPoints[] {
	const { population, assignment } = fixture();

	return population.map((user, u) => ({
		lambda: user.lambda,
		points: pointsOf(
			bracketsOf(cellsFor(user, assignment[mix][u], dayCount)),
			STOP_INVERSION_MARGIN,
		),
	}));
}

interface BiasRow {
	mix: MixName;
	dayCount: number;
	keptMean: number;
	/** Mean over users of (fit − truth), the arms above's `bias` at this n. */
	measured: number;
	/**
	 * The two halves the ridge splits that mean into, exactly: with the identity
	 * prediction, fit − λ = (k·ē + strength·(default − λ))/(k + strength) per user,
	 * so the data half carries the per-day bias ē and the prior half the offset
	 * between the default and this user's truth. Their sum is `measured` — exactly,
	 * unless `fitFrom`'s [0, 3] clamp bit, which the printed residual would show.
	 */
	dataTerm: number;
	priorTerm: number;
	/** The same fit with the prior switched off — the per-day bias, unshrunk. */
	priorFree: number;
	/** Users that column could score: the rest had no day survive. */
	fittedUsers: number;
	/**
	 * The per-day bias over the DAYS: mean (point − truth) across every kept day
	 * in the arm. This is the column the flatness test below reads, and
	 * `priorFree` is not, for a reason that is structural rather than empirical:
	 * a per-user mean exists only for a user with a kept day, so at n = 1 it
	 * scores a different population than at n = 12, and it weights a user with
	 * one surviving day like a user with twelve.
	 */
	pooled: number;
}

function biasRows(): BiasRow[] {
	return MIXES.flatMap((mix) =>
		Array.from(
			{
				length: DAY_COUNT,
			},
			(_, i) => i + 1,
		).map((dayCount) => {
			const users = pointsByUser(mix, dayCount);
			const fitted = users.filter((user) => user.points.length > 0);

			const weighted = (part: (user: UserPoints) => number) =>
				mean(users.map((user) => part(user) / (user.points.length + STOP_PRIOR_STRENGTH)));

			return {
				mix,
				dayCount,
				keptMean: mean(users.map((user) => user.points.length)),
				measured: mean(users.map((user) => fitFrom(user.points) - user.lambda)),
				dataTerm: weighted((user) =>
					user.points.length === 0
						? 0
						: user.points.length * mean(user.points.map((p) => p - user.lambda)),
				),
				priorTerm: weighted((user) => STOP_PRIOR_STRENGTH * (FALLBACK - user.lambda)),
				priorFree: mean(fitted.map((user) => fitFrom(user.points, 0) - user.lambda)),
				fittedUsers: fitted.length,
				pooled: mean(users.flatMap((user) => user.points.map((point) => point - user.lambda))),
			};
		}),
	);
}

describe('MATH.md §8.10 — λ₀ fit error as a function of STOP_INVERSION_MARGIN', () => {
	it('validates the replica fit against the shipped fitStoppingValue', () => {
		const { population, assignment } = fixture();
		const random = mulberry32(0x51a050);
		let worst = 0;
		let worstWithCompletions = 0;

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
				Math.abs(fitFrom(pointsOf(bracketsOf(cells), STOP_INVERSION_MARGIN)) - shipped.value),
			);

			const scoped = cells.map((cell) => ({
				...cell.observation,
				openTaskIds: openIdsOf(random, cell, 0.5),
			}));

			const shippedScoped = fitStoppingValue(scoped, FALLBACK, user.params, CONSTANTS);

			const replicaScoped = fitFrom(
				pointsOf(
					scoped.map((observation) => bracketOf(observation, user.params)),
					STOP_INVERSION_MARGIN,
				),
			);

			worstWithCompletions = Math.max(
				worstWithCompletions,
				Math.abs(replicaScoped - shippedScoped.value),
			);
		}

		console.log(
			`[§8.10 replica] ${population.length} users × ${DAY_COUNT} mixed days: ` +
				`worst |replica fit − shipped fit| ${worst.toExponential(3)}`,
		);

		console.log(
			`[§8.10 replica] the same days CARRYING completions at q=0.50: ` +
				`worst |replica fit − shipped fit| ${worstWithCompletions.toExponential(3)}`,
		);

		console.log(
			worst < 1e-9 && worstWithCompletions < 1e-9
				? '[§8.10 replica] VALID — every number below reads the same bracket the shipped code does'
				: '[§8.10 replica] INVALID — the arms below are measuring a different estimator',
		);
	});

	it('measures each day kind against the truth that generated it', () => {
		// Both readings, because the inversion rate is what §8.10 values as a
		// contamination DETECTOR: recovering a day's breaks makes it look more
		// rational, so the detector's hit rate on interrupted and grind days is
		// exactly the thing this change could cost.
		for (const kind of KINDS)
			for (const isSummed of [false, true]) {
				const rows = fixture().population.flatMap((user) =>
					user.days
						.map((day) => (isSummed ? day[kind].summedBracket : day[kind].bracket))
						.filter((bracket): bracket is Bracket => bracket !== null)
						.map((bracket) => ({
							gap: bracket.stopBound - bracket.hi,
							point: (bracket.stopBound + bracket.hi) / 2,
							lambda: user.lambda,
						})),
				);

				const gaps = rows.filter((r) => r.gap > 0).map((r) => r.gap);

				console.log(
					`[§8.10 per-kind] ${kind.padEnd(17)} ${isSummed ? 'summed' : 'logged'}  days ${String(rows.length).padStart(4)}  ` +
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
		console.log(
			`[§8.10 resolution] median bracket half-width over ${halfWidthDayCount()} non-inverted ` +
				`rational logged days, this probe's own population: ${fmt(bracketHalfWidth())}`,
		);

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
			const fired = movement < bracketHalfWidth() / 10;

			console.log(
				`[§8.10 verdict] ${label(arm)}  RMSE over [0.1,0.5] ${fmt(Math.min(...inRange), 4)}–${fmt(Math.max(...inRange), 4)}  ` +
					`largest movement ${fmt(movement, 4)} λ₀ = ${fmt((100 * movement) / bracketHalfWidth(), 1)}% of the ` +
					`${fmt(bracketHalfWidth())} bracket half-width, ${fmt((100 * movement) / STOP_NOISE_PRIOR_STD, 1)}% of σ₀=${STOP_NOISE_PRIOR_STD}  ` +
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
						`${fmt(bracketHalfWidth())} bracket half-width the instrument already concedes, so the constant ` +
						'does not matter over [0.1, 0.5] and §8.10 must say so. Read the per-arm endpoint ' +
						'contrasts above for the sign: it was negative in all four arms while the ' +
						"reconstruction discarded the days' breaks, and only the contaminated arms still say " +
						'wider censors less and fits slightly better.'
				: `[§8.10 verdict] KILL CRITERION DID NOT FIRE in ${verdicts.filter((v) => !v).length} arm(s) — ` +
						'the margin moves the fit by an instrument-visible amount and 0.25 can be re-derived',
		);
	});

	it('prints the SIGNED per-day error, which no arm above does', () => {
		for (const mix of MIXES) {
			const errors = pointsByUser(mix, DAY_COUNT).flatMap(({ lambda, points }) =>
				points.map((point) => point - lambda),
			);

			console.log(
				`[§8.10 signed] ${mix.padEnd(16)} kept days ${String(errors.length).padStart(4)}  ` +
					`point−truth mean ${signed(mean(errors))} ` +
					`p10 ${signed(quantile(errors, 0.1))} p50 ${signed(quantile(errors, 0.5))} ` +
					`p90 ${signed(quantile(errors, 0.9))}  ` +
					`above truth ${fmt((100 * errors.filter((e) => e > 0).length) / errors.length, 1)}%`,
			);
		}

		// Split by the truth that generated the day, honest days only. A bias that
		// is flat across the grid is the estimator's own; one concentrated at
		// λ₀ = 0.3 would be `max(0, lo)`, the only part of the bracket that knows
		// where zero is.
		const honest = pointsByUser('honest', DAY_COUNT);

		for (const lambda of LAMBDAS) {
			const errors = honest
				.filter((user) => user.lambda === lambda)
				.flatMap(({ points }) => points.map((point) => point - lambda));

			console.log(
				`[§8.10 signed] honest λ₀=${lambda.toFixed(1)}    kept days ${String(errors.length).padStart(4)}  ` +
					`point−truth mean ${signed(mean(errors))} p50 ${signed(quantile(errors, 0.5))}  ` +
					`above truth ${fmt((100 * errors.filter((e) => e > 0).length) / errors.length, 1)}%`,
			);
		}
	});

	it('decomposes the fit bias by n at fixed prior strength', () => {
		console.log(
			`[§8.10 prior] the fit's default λ₀ is ${FALLBACK} and this population's truths are drawn ` +
				`from ${LAMBDAS.join(', ')} (mean ${fmt(MEAN_LAMBDA, 2)}), so the ridge pulls every fit ` +
				`toward a value ${signed(FALLBACK - MEAN_LAMBDA)} from the mean truth. That offset is this ` +
				'instrument’s own draw and not a property of the app: a real user’s λ₀ can sit either side ' +
				'of the default.',
		);

		const rows = biasRows();

		for (const row of rows)
			console.log(
				`[§8.10 bias-by-n] ${row.mix.padEnd(16)} n=${String(row.dayCount).padStart(2)}  ` +
					`kept/user ${fmt(row.keptMean, 2)}  bias ${signed(row.measured)} = ` +
					`data ${signed(row.dataTerm)} + prior ${signed(row.priorTerm)}  ` +
					`per-day bias ${signed(row.pooled)}  ` +
					`prior-free bias ${signed(row.priorFree)} over ${row.fittedUsers} users`,
			);

		const residual = Math.max(
			...rows.map((row) => Math.abs(row.measured - (row.dataTerm + row.priorTerm))),
		);

		const honest = rows.filter((row) => row.mix === 'honest');
		const [low, high] = DAY_COUNTS.map((n) => honest[n - 1]);
		const growth = high.measured - low.measured;
		const priorShare = (high.priorTerm - low.priorTerm) / growth;
		const perDay = honest.map((row) => row.pooled);
		const movementOf = (values: number[]) => Math.max(...values) - Math.min(...values);
		// Every clause reads the SAME window — the one the finding names, n = 3 to
		// n = 12. The whole sweep's movement is printed beside it because the n = 1
		// and n = 2 cells are worth seeing, but a criterion whose clauses span
		// different windows is measuring two different claims (reviewed 2026-09-14).
		const named = perDay.slice(low.dayCount - 1, high.dayCount);
		const movement = movementOf(named);
		const free = honest.map((row) => row.priorFree);
		// Three things have to hold for the ridge to be the explanation: the split
		// is arithmetic and must close exactly; the prior's weakening has to carry
		// the MAJORITY of the growth; and the per-day bias the prior is weakening
		// against must not itself move over that window — flat by the same
		// resolution rule the margin verdict uses, a tenth of the bracket
		// half-width.
		const fired = residual < 1e-9 && priorShare > 0.5 && movement < bracketHalfWidth() / 10;
		// What the whole sweep's wider movement is worth, since it is printed: the
		// cells there are NOT the paired sample the margin verdict above
		// deliberately refuses to price — n = 1 scores one day per user and n = 12
		// scores twelve, so the two ends are different amounts of data about the
		// same per-day quantity, and a spread over users is what says whether that
		// movement is anything.
		const random = mulberry32(0x51a060);
		const [first, last] = [1, DAY_COUNT].map((n) => pointsByUser('honest', n));

		const pooledOf = (users: UserPoints[], sample: number[]) =>
			mean(sample.flatMap((u) => users[u].points.map((point) => point - users[u].lambda)));

		const differences = Array.from(
			{
				length: 400,
			},
			() => {
				const sample = first.map(() => Math.floor(random() * first.length));

				return pooledOf(last, sample) - pooledOf(first, sample);
			},
		);

		console.log(
			`[§8.10 bias-by-n] worst |bias − (data + prior)| over ${rows.length} rows ` +
				`${residual.toExponential(3)}; honest n=${low.dayCount}→${high.dayCount} growth ` +
				`${signed(growth)} = prior ${signed(high.priorTerm - low.priorTerm)} ` +
				`(${fmt(100 * priorShare, 1)}%) + data ${signed(high.dataTerm - low.dataTerm)}; ` +
				`per-day bias over n ∈ [${low.dayCount}, ${high.dayCount}] ${signed(Math.min(...named))}–${signed(Math.max(...named))}, ` +
				`movement ${fmt(movement, 4)} λ₀ = ${fmt((100 * movement) / bracketHalfWidth(), 1)}% of the ` +
				`${fmt(bracketHalfWidth())} bracket half-width; over the whole sweep n ∈ [1, ${DAY_COUNT}] ` +
				`${signed(Math.min(...perDay))}–${signed(Math.max(...perDay))}, movement ${fmt(movementOf(perDay), 4)} λ₀ = ` +
				`${fmt((100 * movementOf(perDay)) / bracketHalfWidth(), 1)}%, n=1→${DAY_COUNT} contrast ` +
				`${signed(perDay[DAY_COUNT - 1] - perDay[0])} ` +
				`[paired 95% CI ${fmt(quantile(differences, 0.025), 4)}, ${fmt(quantile(differences, 0.975), 4)}] ` +
				`(per-user prior-free ${signed(Math.min(...free))}–${signed(Math.max(...free))}, over a ` +
				'population that changes with n)',
		);

		console.log(
			fired
				? '[§8.10 bias-by-n] THE RIDGE EXPLAINS IT — the per-day point carries a bias that does not ' +
						'move with n, and the prior, sitting below this population’s mean truth, cancels part of it. ' +
						'The cancellation is what shrinks as days accumulate, so the honest arm’s bias GROWS toward ' +
						'the per-day bias rather than away from a correct value: the small-n arm is not more ' +
						'accurate, it is two errors of opposite sign. Both halves ROADMAP M106 left untested hold — ' +
						'the point IS biased, and the default DOES sit off this population’s truths.'
				: '[§8.10 bias-by-n] THE RIDGE DOES NOT EXPLAIN IT ALONE — read the three parts above: the ' +
						'decomposition either does not close, or the prior’s weakening is a minority of the growth, ' +
						'or the per-day bias moves with n and something beyond the ridge is acting',
		);
	});

	it('scores the corrected open-task scope against the pre-2026-08-12 all-tasks scope', () => {
		console.log(
			'[§8.10 scope] completion is CAUSAL: only tasks the day’s own plan funded are finished, at ' +
				'exactly the hours the plan gave them. A completion drawn independently of the plan cannot ' +
				'test this and would show the correction losing — at a rational stop lo ≤ λ₀ already, so ' +
				'removing a maximizer only lowers it.',
		);

		for (const arm of scopeArms()) {
			console.log(
				`[§8.10 scope] ${arm.mix.padEnd(16)} q=${arm.rate.toFixed(2)} n=${String(arm.dayCount).padStart(2)}  ` +
					`corrected RMSE ${fmt(arm.corrected.rmse, 4)} bias ${signed(arm.corrected.bias)} used ${arm.corrected.usedDays}  ` +
					`all-tasks RMSE ${fmt(arm.allTasks.rmse, 4)} bias ${signed(arm.allTasks.bias)} used ${arm.allTasks.usedDays}  ` +
					`RMSE gain ${signed(arm.allTasks.rmse - arm.corrected.rmse)}`,
			);
		}

		// q = 0 is the identity: every task open is the same set the old scope read.
		const live = scopeArms().filter((arm) => arm.rate > 0);
		const best = Math.max(...live.map((arm) => arm.allTasks.rmse - arm.corrected.rmse));

		console.log(
			best > bracketHalfWidth()
				? `[§8.10 scope] the corrected scope beats the all-tasks scope by up to ${fmt(best, 4)} λ₀ RMSE, ` +
						`past the ${fmt(bracketHalfWidth())} bracket half-width — §8.10's "biased λ₀ up" is a measured bias`
				: `[§8.10 scope] KILL LINE: the corrected scope's best RMSE gain over ${live.length} arms is ` +
						`${fmt(best, 4)} λ₀, inside the ${fmt(bracketHalfWidth())} bracket half-width, so §8.10's "biased ` +
						'λ₀ up by the whole marginal of work that no longer existed" is a one-day witness and not a ' +
						'measured bias. The scope rule does not move on it — it is settled behaviour and this is a ' +
						'measurement.',
		);
	});
});
