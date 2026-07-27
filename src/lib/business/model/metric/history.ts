/**
 * Cross-day summaries for the calendar and analytics pages, plus the pure
 * derivations the analytics screen reads off a range of them.
 *
 * A stored DailySession is summarized with the SAME model pipeline the daily
 * dashboard uses (calculateSuggestedTasks → priority-weighted completion
 * rate), so a day reads identically everywhere in the app.
 */

import type { DailySession, Task } from '$lib/data/type';
import { addDays } from '$lib/business/utils/date';
import {
	type DailyQuadrant,
	type SuggestedTask,
	calculateSuggestedTasks,
	calculateCompletionRate,
	calculateDailyQuadrant,
} from '$lib/business/model/metric/calculation';
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
	quadrant: DailyQuadrant;
	availableHours: number;
};

/**
 * Score each task on its own instead of solving the whole day's plan.
 *
 * The only thing the summary needs from the model is `completionRate`, which
 * weights tasks by `priorityScore` = P̄(T*)×10 — the task's INTRINSIC value,
 * a function of its own difficulty/enjoyment and the fit alone (see
 * calculation.ts). Solving the plan enumerates 2ⁿ funded subsets per day
 * (~55ms at n = 12), so summarizing a year of history cost ~20s of blocked
 * main thread for numbers that were then thrown away. A one-task list takes
 * the allocator's n = 1 short-circuit and yields bit-identical scores.
 */
function scoreTasksIndividually(
	session: DailySession,
	pools: CapacityPools,
	constants: UserConstants,
	posterior?: FitPosterior,
): SuggestedTask[] {
	return session.tasks.flatMap((task) =>
		calculateSuggestedTasks(
			[task],
			session.availableHours,
			session.switchCost,
			pools,
			constants,
			posterior,
		),
	);
}

export function summarizeSession(
	session: DailySession,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior,
): DaySummary {
	const pools = {
		cognitiveHours: session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
		physicalHours: session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours,
	};

	const suggested = scoreTasksIndividually(session, pools, constants, posterior);

	return {
		date: session.date,
		tasks: session.tasks,
		totalTasks: session.tasks.length,
		completedTasks: session.tasks.filter((t) => t.completed).length,
		completionRate: calculateCompletionRate(suggested),
		quadrant: calculateDailyQuadrant(session.tasks),
		availableHours: session.availableHours,
	};
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

/** How many days in the range fell into each day profile. */
export function countQuadrants(summaries: DaySummary[]): Record<DailyQuadrant, number> {
	const counts: Record<DailyQuadrant, number> = {
		flow: 0,
		cruise: 0,
		grind: 0,
		routine: 0,
	};

	for (const summary of summaries) counts[summary.quadrant]++;

	return counts;
}

export type MonthlyCompletion = {
	/** YYYY-MM */
	month: string;
	/** Mean completion rate of the days recorded in the month; null = no data */
	average: number | null;
	dayCount: number;
};

/**
 * Completion rate averaged per calendar month, from `rangeStart`'s month
 * through `today`'s month INCLUSIVE. Months with no recorded day still get an
 * entry so the year chart keeps a slot for them rather than silently closing
 * the gap.
 */
export function monthlyCompletionRates(
	summaries: DaySummary[],
	rangeStart: string,
	today: string,
): MonthlyCompletion[] {
	const buckets = new Map<string, DaySummary[]>();

	for (const summary of summaries) {
		const key = summary.date.slice(0, 7);
		const bucket = buckets.get(key);

		if (bucket) {
			bucket.push(summary);
			continue;
		}

		buckets.set(key, [summary]);
	}

	const months: MonthlyCompletion[] = [];
	const lastMonth = today.slice(0, 7);
	let month = rangeStart.slice(0, 7);

	while (month <= lastMonth) {
		const daysIn = buckets.get(month) ?? [];

		months.push({
			month,
			average: daysIn.length > 0 ? averageCompletionRate(daysIn) : null,
			dayCount: daysIn.length,
		});

		month = nextMonth(month);
	}

	return months;
}

// YYYY-MM + 1 month. String math, not Date: the chart only ever needs the key.
function nextMonth(month: string): string {
	const [year, index] = month.split('-').map(Number);

	if (index === 12) return `${year + 1}-01`;

	return `${year}-${String(index + 1).padStart(2, '0')}`;
}
