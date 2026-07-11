/**
 * Cross-day helpers for the calendar and analytics pages.
 *
 * A stored DailySession is summarized with the SAME model pipeline the daily
 * dashboard uses (calculateSuggestedTasks → priority-weighted completion
 * rate), so a day reads identically everywhere in the app.
 *
 * All date math works on YYYY-MM-DD strings, anchored at local noon when a
 * Date object is needed — noon is immune to DST shifts and UTC off-by-one.
 */

import type { DailySession } from '$lib/storage/db';
import {
	type Task,
	type DailyQuadrant,
	calculateSuggestedTasks,
	calculateCompletionRate,
	calculateDailyQuadrant
} from './calculations';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	type UserConstants
} from '$lib/zenith';

// ================== Date utilities ==================

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string): Date {
	return new Date(iso + 'T12:00:00');
}

export function addDays(iso: string, n: number): string {
	const d = fromISO(iso);
	d.setDate(d.getDate() + n);
	return toISODate(d);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
	const dow = (fromISO(iso).getDay() + 6) % 7; // Mon=0 … Sun=6
	return addDays(iso, -dow);
}

/**
 * Full weeks (Mon–Sun) covering a month, as ISO date strings.
 * Leading/trailing cells belong to the adjacent months.
 * `month` is 0-based to match Date#getMonth.
 */
export function monthGrid(year: number, month: number): string[][] {
	const lastDay = new Date(year, month + 1, 0).getDate();
	const lastOfMonth = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
	let cursor = startOfWeek(`${year}-${pad(month + 1)}-01`);

	const weeks: string[][] = [];
	while (cursor <= lastOfMonth) {
		const week: string[] = [];
		for (let i = 0; i < 7; i++) {
			week.push(cursor);
			cursor = addDays(cursor, 1);
		}
		weeks.push(week);
	}
	return weeks;
}

// ================== Day summaries ==================

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

export function summarizeSession(
	session: DailySession,
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): DaySummary {
	const pools = {
		cognitiveHours: session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours,
		physicalHours: session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours
	};
	const suggested = calculateSuggestedTasks(
		session.tasks,
		session.availableHours,
		session.switchCost,
		pools,
		constants
	);
	return {
		date: session.date,
		tasks: session.tasks,
		totalTasks: session.tasks.length,
		completedTasks: session.tasks.filter((t) => t.completed).length,
		completionRate: calculateCompletionRate(suggested),
		quadrant: calculateDailyQuadrant(session.tasks),
		availableHours: session.availableHours
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

/**
 * Background class for completion bars/fills, same thresholds as
 * getStatusBiggerBetter (which only provides text-* classes).
 */
export function completionBarClass(rate: number): string {
	if (rate >= 75) return 'bg-emerald-400';
	if (rate >= 50) return 'bg-zinc-300';
	if (rate >= 25) return 'bg-amber-400';
	return 'bg-red-400';
}
