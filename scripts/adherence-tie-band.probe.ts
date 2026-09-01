/**
 * The measurement behind `ADHERENCE_TIE_BAND`, the width that decides which of
 * three English sentences the analytics "Plan adherence" card prints. The
 * shipped 0.05 was never measured; its own docblock asserted "the overlaps are
 * means over a handful of days, so a couple of points either way is noise",
 * and the card reads up to `AUDIT_DAY_CAP = 30` of them.
 *
 * Two things must hold at once and no single arm can see both: the band has to
 * be wide enough that behaviour which did NOT change stops flipping the
 * sentence, and narrow enough that a user who genuinely follows one planner
 * still gets named. A flip-rate arm alone can only ever argue it wider — at a
 * band of 1 nothing ever flips and nothing is ever said. So four arms over the
 * quantity the verdict actually thresholds, the mean of `energyOverlap` minus
 * the mean of `classicOverlap`, each swept over a grid of candidate widths.
 *
 * READ OFF THIS FILE'S RUN (2026-09-01): 900 seeded neutral days, 600 per
 * follower arm, 200 for the recall arm, over the widths {0.05 … 0.30}.
 *
 *   THE NULL IS NOT CENTRED ON ZERO. A logger with no preference for either
 *   plan reads mean diff -0.1040, twice the shipped band toward the classic
 *   plan. That is geometry, not noise: a composition drawn at random spreads
 *   its hours over most of the day's tasks, and the classic Sum-P-bar plan
 *   spreads while the energy plan concentrates (MATH.md §0/§2 vs §8.4). So the
 *   band is not symmetric in what it protects — a neutral logger is at risk of
 *   being called a classic follower and essentially never an energy one.
 *
 *   WANDER. sd of the window mean by day count: 0.2450 (n=1), 0.1466 (3),
 *   0.1074 (5), 0.0749 (10), 0.0439 (20), 0.0357 (30). The shipped 0.05 is
 *   under the wander at every n the card reads at, n=30 included.
 *
 *   WHAT 0.05 DID. It named 100% of neutral 30-day windows, 89% at n=20 and
 *   77-83% from n=10 down. A band that never measured its null called a
 *   coin-flip logger a follower of the classic plan almost every time.
 *
 *   SIGNAL. A true follower, its logged minutes carrying ±5 or ±15 min of
 *   recall error, reads mean diff -0.3664 / -0.3446 (classic) and 0.3550 /
 *   0.3472 (energy) — an order of magnitude above what recall error alone
 *   moves (|delta diff| mean 0.0049 at ±5 min, 0.0145 at ±15 min).
 *
 *   THE WIDTH: 0.2. Neutral windows named / true followers named, per width:
 *   at 0.20, 0% / 100% (n=30), 4% / 100% (20), 13% / 98-100% (10),
 *   15% / 90-93% (5), 27% / 85-90% (3). It is the smallest swept width that
 *   names NO neutral 30-day window — the reading the card is built around —
 *   while still naming a true follower from n=10 up. The next width up, 0.25,
 *   buys 2% and 7% at n=10 and n=5 and pays 7-13 points of true followers
 *   back for them.
 *
 *   THE RESIDUE. Below about five scored days no swept width does both jobs:
 *   the neutral p95 at n=3 is 0.3544, level with a true follower's own signal
 *   (0.345-0.366) and above it at ±15 min of recall error. The card is least
 *   trustworthy in its first week and this width cannot fix that.
 *
 * REACHABILITY. Every figure above is quoted, so every day is one the app can
 * produce: tasks are built from 0-10 sliders through `toEnergyTask`, the window
 * sits on `BUDGET_BOUNDS`' 0.25 h step inside 0-24, pools on the 0.5 h step
 * inside 0-16, the switch cost on the 5-minute step inside 0-60, and every
 * logged duration is a whole number of minutes in 1-960 like the drain form's.
 * The one exception carries no quoted figure: the follower arm's replica CHECK
 * logs each plan's raw hours unrounded, because rounding them is what it is
 * checking the audit against.
 *
 * WHAT WOULD FALSIFY THE WIDTH. If a neutral 30-day window is named at 0.2, or
 * true followers are named on less than about 95% of n>=10 windows (the table
 * above reads 98-100%), the width is wrong. The four tables below
 * are the whole argument; nothing here is asserted outside them. Derivation:
 * MATH.md §9.
 *
 * Usage: npm run probe
 */

import { describe, it } from 'vitest';
import type { Task } from '$lib/data/type';
import { auditPlanAdherence, type PlanAuditDay } from '$lib/business/model/plan-audit';
import {
	calculatePooledAllocations,
	DEFAULT_USER_CONSTANTS,
	importanceWeightOf,
	type CapacityPools,
} from '$lib/business/model/zenith';
import { DEFAULT_ENERGY_PARAMS, optimizeSchedule } from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';

function mulberry32(seed: number): () => number {
	let a = seed;

	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The grid every arm is read at. 0.05 is the width the card shipped with. */
const BANDS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
/** The day counts the card actually reads at; 30 is `AUDIT_DAY_CAP`. */
const WINDOW_SIZES = [1, 3, 5, 10, 20, 30];
const POOL_DAYS = 900;
const RECALL_DAYS = 200;
const FOLLOWER_DAYS = 600;
/** Reachable recall error: the 🪫 form takes whole minutes, 1–960. */
const RECALL_MINUTES = [5, 15];

type Verdict = 'energy' | 'classic' | 'tie';

function verdictOf(diff: number, band: number): Verdict {
	if (diff > band) return 'energy';

	if (diff < -band) return 'classic';

	return 'tie';
}

const randomInt = (random: () => number, lo: number, hi: number): number =>
	lo + Math.floor(random() * (hi - lo + 1));

interface DayInputs {
	tasks: PlanAuditDay['tasks'];
	windowHours: number;
	switchCost: number;
	pools: CapacityPools;
}

/**
 * A day's plan inputs, every field one the app can store: sliders 0–10 through
 * `toEnergyTask`, a half-hour-lattice window, whole-hour pools, and a switch
 * cost off the settings screen's own minutes.
 */
function planInputs(random: () => number, dayIndex: number): DayInputs {
	const taskCount = randomInt(random, 2, 5);

	const tasks = Array.from(
		{
			length: taskCount,
		},
		(_, i) => {
			const task: Task = {
				id: dayIndex * 10 + i,
				title: `t${i}`,
				mentalDifficulty: randomInt(random, 0, 10),
				physicalDifficulty: randomInt(random, 0, 10),
				enjoyment: randomInt(random, 1, 10),
				createdAt: '2026-01-01',
				completed: false,
				importance: (['low', 'normal', 'high'] as const)[randomInt(random, 0, 2)],
			};

			return toEnergyTask(task);
		},
	);

	return {
		tasks,
		windowHours: 4 + randomInt(random, 0, 12) * 0.5,
		switchCost: [5, 15, 30][randomInt(random, 0, 2)] / 60,
		pools: {
			cognitiveHours: randomInt(random, 3, 6),
			physicalHours: randomInt(random, 4, 8),
		},
	};
}

/**
 * Logged minutes drawn with no reference to either plan — the null the first two
 * arms need. Each task is worked with probability 0.7, for a whole number of
 * minutes, and an overrunning day is scaled back to its window.
 */
function neutralWorkedHours(
	random: () => number,
	tasks: PlanAuditDay['tasks'],
	windowHours: number,
): PlanAuditDay['workedHours'] {
	const picked = tasks.filter(() => random() < 0.7);
	const worked = picked.length > 0 ? picked : [tasks[randomInt(random, 0, tasks.length - 1)]];
	const minutes = worked.map(() => randomInt(random, 15, 180));
	const total = minutes.reduce((sum, m) => sum + m, 0);
	const cap = windowHours * 60;
	const scale = total > cap ? cap / total : 1;

	return worked.map((task, i) => ({
		taskId: task.id,
		hours: Math.max(1, Math.round(minutes[i] * scale)) / 60,
	}));
}

function neutralDays(seed: number, count: number): PlanAuditDay[] {
	const random = mulberry32(seed);

	return Array.from(
		{
			length: count,
		},
		(_, day) => {
			const inputs = planInputs(random, day);

			return {
				...inputs,
				workedHours: neutralWorkedHours(random, inputs.tasks, inputs.windowHours),
			};
		},
	);
}

/** Whole-minute recall error of at most `spread` minutes, either direction. */
function withRecallError(days: PlanAuditDay[], spread: number, seed: number): PlanAuditDay[] {
	const random = mulberry32(seed);

	return days.map((day) => ({
		...day,
		workedHours: day.workedHours.map((entry) => ({
			...entry,
			hours: Math.max(1, Math.round(entry.hours * 60) + randomInt(random, -spread, spread)) / 60,
		})),
	}));
}

/**
 * Days whose logged composition IS one planner's allocation, quantized to the
 * whole minutes the 🪫 form takes and then mis-remembered by `recallSpread`.
 * The plan is rebuilt here from the same exported calls the audit itself makes,
 * which this arm VALIDATES rather than assumes: with no recall error the
 * followed planner's own overlap has to read 1.
 */
function followerDays(
	seed: number,
	count: number,
	planner: 'classic' | 'energy',
	recallSpread: number,
): PlanAuditDay[] {
	const random = mulberry32(seed);

	return Array.from(
		{
			length: count,
		},
		(_, day) => {
			const inputs = planInputs(random, day);
			const { tasks, windowHours } = inputs;
			const hours = new Map<number, number>();

			if (planner === 'classic') {
				const allocations = calculatePooledAllocations(
					tasks.map((t) => ({
						title: t.title,
						difficulty: t.difficulty,
						enjoyment: t.enjoyment,
						cognitiveWeight: t.cognitiveDemand,
						physicalWeight: t.physicalDemand,
						importanceWeight: importanceWeightOf(t.importance),
					})),
					windowHours,
					inputs.pools,
					DEFAULT_USER_CONSTANTS,
					inputs.switchCost,
				);

				allocations.forEach((allocation, i) => hours.set(tasks[i].id, allocation.allocatedHours));
			} else {
				const plan = optimizeSchedule(tasks, windowHours, DEFAULT_ENERGY_PARAMS);

				for (const block of plan.blocks) {
					if (block.taskId !== null) {
						hours.set(block.taskId, (hours.get(block.taskId) ?? 0) + block.hours);
					}
				}
			}

			const workedHours = [...hours.entries()]
				.filter(([, h]) => h > 0)
				.map(([taskId, h]) => ({
					taskId,
					hours:
						recallSpread === 0
							? h
							: Math.max(1, Math.round(h * 60) + randomInt(random, -recallSpread, recallSpread)) /
								60,
				}));

			return {
				...inputs,
				workedHours,
			};
		},
	);
}

/** Per-day `energyOverlap − classicOverlap`, in the order the days were given. */
function dailyDifferences(days: PlanAuditDay[]): number[] {
	const audit = auditPlanAdherence(days, DEFAULT_ENERGY_PARAMS);

	return audit.days.map((day) => day.energyOverlap - day.classicOverlap);
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;
const percent = (part: number, whole: number): string => `${((100 * part) / whole).toFixed(0)}%`;

function quantile(sorted: number[], p: number): number {
	return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Means over consecutive DISJOINT windows of `n` — one card reading each. */
function windowMeans(differences: number[], n: number): number[] {
	const means: number[] = [];

	for (let start = 0; start + n <= differences.length; start += n) {
		means.push(mean(differences.slice(start, start + n)));
	}

	return means;
}

/** Means over OVERLAPPING windows: consecutive days of the same card. */
function rollingMeans(differences: number[], n: number): number[] {
	const means: number[] = [];

	for (let start = 0; start + n <= differences.length; start++) {
		means.push(mean(differences.slice(start, start + n)));
	}

	return means;
}

describe('the adherence verdict band', () => {
	const neutral = neutralDays(0xa17be1, POOL_DAYS);
	const neutralDifferences = dailyDifferences(neutral);

	it('wander: how far the mean difference moves when neither planner is followed', () => {
		const centre = mean(neutralDifferences);

		console.log(
			`[wander] ${neutralDifferences.length} scored neutral days; the null sits at ` +
				`mean diff ${centre.toFixed(4)}, NOT at 0 — a random composition spreads, ` +
				`and the classic plan spreads while the energy plan concentrates`,
		);

		for (const n of WINDOW_SIZES) {
			const means = windowMeans(neutralDifferences, n);
			const windowCentre = mean(means);
			const sd = Math.sqrt(mean(means.map((m) => (m - windowCentre) ** 2)));
			const absolute = means.map(Math.abs).sort((a, b) => a - b);

			console.log(
				`[wander] n=${String(n).padStart(2)} over ${String(means.length).padStart(3)} windows: ` +
					`sd ${sd.toFixed(4)}; |mean diff| median ${quantile(absolute, 0.5).toFixed(4)}, ` +
					`p90 ${quantile(absolute, 0.9).toFixed(4)}, ` +
					`p95 ${quantile(absolute, 0.95).toFixed(4)}, ` +
					`max ${absolute[absolute.length - 1].toFixed(4)}`,
			);
		}
	});

	it('false names and flips: what each candidate band says about the null', () => {
		for (const n of WINDOW_SIZES) {
			const rolling = rollingMeans(neutralDifferences, n);
			const disjoint = windowMeans(neutralDifferences, n);

			const cells = BANDS.map((band) => {
				let flips = 0;

				for (let i = 1; i < rolling.length; i++) {
					if (verdictOf(rolling[i], band) !== verdictOf(rolling[i - 1], band)) flips++;
				}

				const named = disjoint.filter((diff) => verdictOf(diff, band) !== 'tie').length;

				return (
					`${band.toFixed(2)}: ${percent(named, disjoint.length)} named / ` +
					`${percent(flips, rolling.length - 1)} flip`
				);
			});

			console.log(
				`[null] n=${String(n).padStart(2)} over ${disjoint.length} disjoint windows ` +
					`(${rolling.length} rolling) — ${cells.join(', ')}`,
			);
		}
	});

	it('recall: what mis-remembered minutes alone move', () => {
		const base = neutral.slice(0, RECALL_DAYS);
		const baseDifferences = dailyDifferences(base);

		for (const spread of RECALL_MINUTES) {
			const perturbed = dailyDifferences(withRecallError(base, spread, 0xa17be2 + spread));

			const movement = baseDifferences
				.map((diff, i) => Math.abs(perturbed[i] - diff))
				.sort((a, b) => a - b);

			const flipCells = BANDS.map((band) => {
				const flips = baseDifferences.filter(
					(diff, i) => verdictOf(diff, band) !== verdictOf(perturbed[i], band),
				).length;

				return `${band.toFixed(2)}: ${percent(flips, baseDifferences.length)}`;
			});

			console.log(
				`[recall] ±${String(spread).padStart(2)} min over ${base.length} days: ` +
					`|Δdiff| mean ${mean(movement).toFixed(4)}, ` +
					`p95 ${quantile(movement, 0.95).toFixed(4)}, ` +
					`max ${movement[movement.length - 1].toFixed(4)}`,
			);

			console.log(
				`[recall] ±${String(spread).padStart(2)} min, share of single days whose verdict ` +
					`changes on the perturbation alone — ${flipCells.join(', ')}`,
			);
		}
	});

	it('follower: whether a user who does follow one planner clears each band', () => {
		for (const planner of ['classic', 'energy'] as const) {
			const exact = auditPlanAdherence(
				followerDays(0xa17be3, 100, planner, 0),
				DEFAULT_ENERGY_PARAMS,
			);

			const followed = planner === 'classic' ? exact.classicOverlap : exact.energyOverlap;

			console.log(
				`[follower] ${planner}: replica check — mean overlap against the followed plan ` +
					`${followed.toFixed(4)} with no recall error (1 means the replica IS the audit's plan)`,
			);

			for (const spread of RECALL_MINUTES) {
				const differences = dailyDifferences(
					followerDays(0xa17be3, FOLLOWER_DAYS, planner, spread),
				);

				const wanted: Verdict = planner;

				console.log(
					`[follower] ${planner} ±${spread} min: mean diff ${mean(differences).toFixed(4)} ` +
						`over ${differences.length} days`,
				);

				for (const n of WINDOW_SIZES) {
					const means = windowMeans(differences, n);

					const cells = BANDS.map((band) => {
						const named = means.filter((m) => verdictOf(m, band) === wanted).length;

						return `${band.toFixed(2)}: ${percent(named, means.length)}`;
					});

					console.log(
						`[follower] ${planner} ±${spread} min, n=${String(n).padStart(2)} over ` +
							`${String(means.length).padStart(3)} windows, share named ${planner} — ${cells.join(
								', ',
							)}`,
					);
				}
			}
		}
	});
});
