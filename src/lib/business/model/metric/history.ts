/**
 * Cross-day summaries for the calendar and analytics pages, plus the pure
 * derivations the analytics screen reads off a range of them.
 *
 * A stored DailySession is summarized with the SAME model pipeline the daily
 * dashboard uses (calculateSuggestedTasks → priority-weighted completion rate).
 * Identically for every reading that does not depend on the allocation, and to
 * a measured and stated distance for the one that does — see
 * `solveWithoutSwitchCost`, which is where a year of history stops being
 * affordable to solve exactly.
 */

import type {
	DailySession,
	DrainObservationRecord,
	RestObservationRecord,
	Task,
} from '$lib/data/type';
import { addDays } from '$lib/business/utils/date';
import { seedMorningReservoirs } from '$lib/business/model/energy-calibration';
import {
	type DailyQuadrant,
	type SuggestedTask,
	calculateBurnoutRisk,
	calculateCognitiveLoad,
	calculatePhysicalLoad,
	calculateSuggestedTasks,
	calculateCompletionRate,
	calculateDailyQuadrant,
	calculateYieldIndex,
} from '$lib/business/model/metric/calculation';
import type { EnergyParams } from '$lib/business/model/zenith-energy';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	type CapacityPools,
	type FitPosterior,
	type UserConstants,
} from '$lib/business/model/zenith';

export type DaySummary = {
	date: string;
	tasks: Task[];
	totalTasks: number;
	completedTasks: number;
	/** Priority-weighted completion rate (0–100), same as the dashboard metric. */
	completionRate: number;
	/** 0–100, and 0 on a day that completed nothing — read it with `completedTasks`. */
	yieldIndex: number;
	/**
	 * `null` on a day that booked no hours. Hour-weighted over a switch-cost-free
	 * solve, which is what history can afford — see `solveWithoutSwitchCost` for
	 * the cost and for how far it lands from the dashboard's exact plan.
	 */
	quadrant: DailyQuadrant | null;
	availableHours: number;
	/** The day's stored switch cost — what `calculateMetricTrend` prices with. */
	switchCost: number;
	/**
	 * The switch-cost-free plan every allocation-dependent reading above was
	 * taken from, kept so the trend fold does not solve the year a second time.
	 */
	suggestedTasks: SuggestedTask[];
	/**
	 * The α and r recorded on the day — what `calculateMetricTrend` prices it
	 * with. Absent for today and a day with no record, read under the live fit.
	 */
	energyParams?: EnergyParams;
};

/**
 * Solve the day, but without its switch cost — the one term that costs 2ⁿ.
 *
 * What the exact allocator spends its time on is choosing which subset of tasks
 * to fund once each additional session is charged an overhead; at `switchCost 0`
 * that choice disappears and `bestPlanWithSwitchCost` takes a single
 * marginal-value pass over all tasks. Measured over 365 seeded days: **60ms at
 * n = 12 against tens of seconds** for the exact solve — the difference between
 * a summary and a frozen tab. `scripts/mtr-metric-trend.probe.ts` has the cost
 * by n; a single figure is not quoted here because the cost is dominated by the
 * largest n.
 *
 * The two readings this feeds are affected differently, which is why the
 * approximation is drawn here and not somewhere cheaper:
 *
 * - `completionRate` weights by `priorityScore` = P̄(T*)×10, the task's
 *   INTRINSIC value — a function of its own difficulty/enjoyment and the fit
 *   alone. Unchanged by any allocation, so this is exact.
 * - `quadrant` weights by allocated hours, so it does depend on the solve. Real
 *   budget, real pools, real marginal-value allocation, no subset choice: it
 *   disagrees with the dashboard's exact plan on **7.5%** of seeded days
 *   (`scripts/mtr-day-profile.probe.ts`, 2026-08-07). Scoring each task on its
 *   own instead — the previous shortcut here — hands every task its full T* as
 *   though it were the only one, and disagrees on 21.0%.
 *
 * `calculateMetricTrend` reads the same plan and carries the same caveat.
 */
function solveWithoutSwitchCost(
	session: DailySession,
	pools: CapacityPools,
	constants: UserConstants,
	posterior?: FitPosterior,
): SuggestedTask[] {
	return calculateSuggestedTasks(
		session.tasks,
		session.availableHours,
		0,
		pools,
		constants,
		posterior,
	);
}

export function summarizeSession(
	session: DailySession,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior,
	energyParams?: EnergyParams,
): DaySummary {
	const pools = {
		cognitiveHours: session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
		physicalHours: session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours,
	};

	const suggested = solveWithoutSwitchCost(session, pools, constants, posterior);

	return {
		date: session.date,
		tasks: session.tasks,
		totalTasks: session.tasks.length,
		completedTasks: session.tasks.filter((t) => t.completed).length,
		completionRate: calculateCompletionRate(suggested),
		yieldIndex: calculateYieldIndex(suggested),
		quadrant: calculateDailyQuadrant(suggested),
		availableHours: session.availableHours,
		switchCost: session.switchCost,
		suggestedTasks: suggested,
		...(energyParams && {
			energyParams,
		}),
	};
}

/** One day of the analytics trend card. */
export interface MetricTrendPoint {
	date: string;
	/** 0–100. */
	burnoutRisk: number;
	/** 0–100. The two are separate systems and may both be high. */
	cognitiveLoad: number;
	physicalLoad: number;
}

/**
 * Three of the dashboard's readings, per day, for the analytics trend card:
 * Burnout Risk and the two Loads.
 *
 * Each point is priced under the α and r recorded on its day, the fit the
 * dashboard read that day under (model/AGENTS.md's causal window): today's live
 * fit has read a past day's own 🪫 ratings. `params` is that live fit, for today
 * and a day with no record — it arrives with the model report, one read after
 * the summaries.
 *
 * `drain` is the same reason carried one step further: the dashboard seeds each
 * morning's reservoirs from the PREVIOUS day's 🪫 rows, keyed to the viewed day,
 * so a series simulated from full reservoirs would read a rested morning on
 * every day the user actually started depleted — a gap that is not the
 * allocation approximation and would not shrink with a better solve
 * (`scripts/mtr2-carry-over.probe.ts` sizes the carry-over). Keyed per point for
 * the same reason the dashboard keys it to the viewed day: a past day reads with
 * its own morning, not today's.
 *
 * Every point is read off `solveWithoutSwitchCost`'s plan, so the whole series
 * inherits that approximation; the day's own `switchCost` is still what Burnout
 * Risk is priced at, because it takes the cost as an argument separate from the
 * allocation. `scripts/mtr-metric-trend.probe.ts` sizes both effects, and is
 * also why Fallow Gain is deliberately absent — its approximation error is
 * larger than the reading.
 */
export function calculateMetricTrend(
	summaries: DaySummary[],
	params: EnergyParams,
	drain: DrainObservationRecord[] = [],
): MetricTrendPoint[] {
	const drainByDate = new Map<string, DrainObservationRecord[]>();

	for (const row of drain) {
		const rows = drainByDate.get(row.date);

		if (rows) rows.push(row);
		else drainByDate.set(row.date, [row]);
	}

	return summaries.map((summary) => ({
		date: summary.date,
		burnoutRisk: calculateBurnoutRisk(
			summary.suggestedTasks,
			summary.availableHours,
			summary.switchCost,
			seedMorningReservoirs(
				summary.energyParams ?? params,
				drainByDate.get(addDays(summary.date, -1)) ?? [],
			),
		),
		cognitiveLoad: calculateCognitiveLoad(summary.suggestedTasks, summary.availableHours),
		physicalLoad: calculatePhysicalLoad(summary.suggestedTasks, summary.availableHours),
	}));
}

/**
 * Consecutive days with ≥1 completed task, counting backwards from today.
 * A completion-free today doesn't break the streak (the day isn't over yet) —
 * it just doesn't count until something is checked off.
 */
export function currentStreak(datesWithCompletion: Set<string>, today: string): number {
	let cursor = datesWithCompletion.has(today) ? today : addDays(today, -1);
	let streak = 0;

	while (datesWithCompletion.has(cursor)) {
		streak++;
		cursor = addDays(cursor, -1);
	}

	return streak;
}

/**
 * The longest run of consecutive dates anywhere in the set — unlike
 * `currentStreak`'s backward walk from today, so an old record survives a
 * broken week. ISO dates sort lexicographically.
 */
export function longestStreak(datesWithCompletion: Set<string>): number {
	let longest = 0;
	let run = 0;
	let previous: string | null = null;

	for (const date of [...datesWithCompletion].sort()) {
		run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
		longest = Math.max(longest, run);
		previous = date;
	}

	return longest;
}

// `+ 0` normalises -0, which `Math.round` returns for any small negative mean
// and `Intl` prints as "-0.0" — under the "+" the rest tile adds for a reading
// it tests as non-negative.
const roundToTenth = (value: number): number => Math.round(value * 10) / 10 + 0;

/**
 * Total 🪫-logged session hours on or after `rangeStart` — the logged side of
 * the analytics screen's logged-vs-declared hours reading. A row counts at a
 * positive length, the one rule every other reader of 🪫 hours shares
 * (`readFinishedDays`).
 */
export function loggedHours(drain: DrainObservationRecord[], rangeStart: string): number {
	const total = drain.reduce(
		(sum, row) => (row.date >= rangeStart && row.hours > 0 ? sum + row.hours : sum),
		0,
	);

	return roundToTenth(total);
}

/**
 * The ☕ fold behind the analytics screen's rest tile. `lift` is how far each of
 * the two drain ratings dropped across the breaks on average — positive means
 * the user came out fresher. One nullable field and not two, because the two
 * averages are one fact: they exist over the same rows or not at all.
 */
export type RestSummary = {
	hours: number;
	/** `null` when nothing was rested: no breaks is no average, not a zero lift. */
	lift: { mind: number; body: number } | null;
};

export function restSummary(rest: RestObservationRecord[], rangeStart: string): RestSummary {
	const rows = rest.filter((row) => row.date >= rangeStart);

	if (rows.length === 0)
		return {
			hours: 0,
			lift: null,
		};

	const meanLift = (before: 'bodyBefore' | 'mindBefore', after: 'bodyAfter' | 'mindAfter') =>
		roundToTenth(rows.reduce((sum, row) => sum + (row[before] - row[after]), 0) / rows.length);

	return {
		hours: roundToTenth(rows.reduce((sum, row) => sum + row.hours, 0)),
		lift: {
			mind: meanLift('mindBefore', 'mindAfter'),
			body: meanLift('bodyBefore', 'bodyAfter'),
		},
	};
}

/** Mean priority-weighted completion rate over the given days, 0 when empty. */
export function averageCompletionRate(summaries: DaySummary[]): number {
	if (summaries.length === 0) return 0;

	return Math.round(summaries.reduce((sum, s) => sum + s.completionRate, 0) / summaries.length);
}

/**
 * Change in average completion rate against the previous period of equal
 * length; null when there is no previous period to compare against.
 */
export function completionRateDelta(current: DaySummary[], previous: DaySummary[]): number | null {
	if (previous.length === 0) return null;

	return averageCompletionRate(current) - averageCompletionRate(previous);
}

/**
 * The best day in the range: highest completion rate, ties broken by the
 * number of tasks actually completed — a 100% day of one task should not
 * outrank a 100% day of six. Days with nothing completed never win (a day with
 * no tasks done reads 0% and is not an achievement).
 */
export function findBestDay(summaries: DaySummary[]): DaySummary | null {
	const withCompletion = summaries.filter((s) => s.completedTasks > 0);

	if (withCompletion.length === 0) return null;

	return withCompletion.reduce((best, s) =>
		s.completionRate > best.completionRate ||
		(s.completionRate === best.completionRate && s.completedTasks > best.completedTasks)
			? s
			: best,
	);
}

/**
 * How many days in the range fell into each day profile. A day that booked no
 * hours has no profile and is counted nowhere rather than into `routine`,
 * which is a reading about work that was planned.
 */
export function countQuadrants(summaries: DaySummary[]): Record<DailyQuadrant, number> {
	const counts: Record<DailyQuadrant, number> = {
		flow: 0,
		cruise: 0,
		grind: 0,
		routine: 0,
	};

	for (const summary of summaries) if (summary.quadrant) counts[summary.quadrant]++;

	return counts;
}

export type WeeklyRollup = {
	/** ISO date of the block's first day */
	start: string;
	/** Whether this block opens a calendar month — the year axis labels those */
	isMonthStart: boolean;
	/** Mean completion rate of the days recorded in the block; null = no data */
	average: number | null;
	/** Mean yield of the days that completed something; null = no such day */
	yieldAverage: number | null;
	dayCount: number;
};

/**
 * The year chart's two readings per 7-day block — completion rate and yield —
 * over `bucketByWeek`'s blocks. Yield averages only the days that completed
 * something: `yieldIndex` is 0 on a day that finished nothing, and averaging
 * those in reads as a bad week rather than an idle one.
 */
export function weeklyRollups(
	summaries: DaySummary[],
	rangeStart: string,
	rangeDays: number,
): WeeklyRollup[] {
	return bucketByWeek(summaries, rangeStart, rangeDays).map((block) => {
		const completingDays = block.rows.filter((day) => day.completedTasks > 0);

		return {
			start: block.start,
			isMonthStart: block.isMonthStart,
			average: block.rows.length > 0 ? averageCompletionRate(block.rows) : null,
			yieldAverage:
				completingDays.length > 0
					? Math.round(
							completingDays.reduce((sum, day) => sum + day.yieldIndex, 0) / completingDays.length,
						)
					: null,
			dayCount: block.rows.length,
		};
	});
}

export type WeeklyMetricTrend = {
	/** ISO date of the block's first day */
	start: string;
	isMonthStart: boolean;
	/** Mean over the days recorded in the block; null = no such day */
	burnoutRisk: number | null;
	cognitiveLoad: number | null;
	physicalLoad: number | null;
};

/**
 * The year chart's three load readings per 7-day block, over the same blocks
 * `weeklyRollups` walks so the page's two year charts line up slot for slot.
 * A block with no recorded day has no reading rather than a zero: the chart
 * breaks its line there, and 365 daily points read as noise at this width.
 */
export function rollUpMetricTrendByWeek(
	trend: MetricTrendPoint[],
	rangeStart: string,
	rangeDays: number,
): WeeklyMetricTrend[] {
	return bucketByWeek(trend, rangeStart, rangeDays).map((block) => ({
		start: block.start,
		isMonthStart: block.isMonthStart,
		burnoutRisk: meanOf(block.rows, (point) => point.burnoutRisk),
		cognitiveLoad: meanOf(block.rows, (point) => point.cognitiveLoad),
		physicalLoad: meanOf(block.rows, (point) => point.physicalLoad),
	}));
}

function meanOf<T>(rows: T[], read: (row: T) => number): number | null {
	if (rows.length === 0) return null;

	return Math.round(rows.reduce((sum, row) => sum + read(row), 0) / rows.length);
}

/**
 * The range cut into 7-day blocks, each with the rows dated in it. A contiguous
 * range chunks by index, so a block with nothing recorded keeps its slot without
 * any gap-filling. The REMAINDER goes to the oldest block, so the last one ends
 * on the range's final day and the most recent point is a full week.
 *
 * `isMonthStart` marks the block that opens a calendar month: 52 labels do not
 * fit the axis, and one per month is the density the year view already read at.
 */
function bucketByWeek<T extends { date: string }>(
	rows: T[],
	rangeStart: string,
	rangeDays: number,
): { start: string; isMonthStart: boolean; rows: T[] }[] {
	const byDate = new Map(rows.map((row) => [row.date, row]));
	const blocks: { start: string; rows: T[] }[] = [];
	let index = 0;
	let span = rangeDays % 7 || 7;

	while (index < rangeDays) {
		const start = addDays(rangeStart, index);
		const inBlock: T[] = [];

		for (let day = 0; day < span; day++) {
			const row = byDate.get(addDays(start, day));

			if (row) inBlock.push(row);
		}

		blocks.push({
			start,
			rows: inBlock,
		});

		index += span;
		span = 7;
	}

	return blocks.map((block, at) => ({
		...block,
		isMonthStart: at === 0 || block.start.slice(0, 7) !== blocks[at - 1].start.slice(0, 7),
	}));
}
