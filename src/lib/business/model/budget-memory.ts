/**
 * What a weekday's budget usually is, so a day with no stored session opens on
 * the hours that weekday has had before instead of on 0 — a reading the user
 * overwrites by typing, and one nothing persists until the day is saved for a
 * reason of its own (ROADMAP item 16).
 *
 * Only days the user actually budgeted count. A stored day with no hours is a
 * day they added a task to and left, not evidence of a habit, and folding those
 * in drags every median toward the 0 this replaces.
 *
 * No lookback window, for `title-memory.ts`'s reason: a weekday read from a year
 * ago is still a better guess than no reading at all.
 */

import type { DailySession } from '$lib/data/type';
import { fromISO } from '$lib/business/utils/date';

export interface BudgetHistory {
	/** Keyed by `Date#getDay`, over the days that declared a budget. */
	medianByWeekday: Map<number, number>;
	/** Over all of them — the answer for a weekday with no history of its own. */
	median: number;
}

/**
 * The lower of the two middles on an even count, so the answer is always a
 * number the user really declared rather than an average of two they did.
 */
function median(hours: number[]): number {
	if (hours.length === 0) return 0;

	return [...hours].sort((a, b) => a - b)[Math.ceil(hours.length / 2) - 1];
}

export function summarizeBudgetHistory(sessions: DailySession[]): BudgetHistory {
	const hoursByWeekday = new Map<number, number[]>();
	const all: number[] = [];

	for (const session of sessions) {
		if (session.availableHours <= 0) continue;

		const weekday = fromISO(session.date).getDay();
		const hours = hoursByWeekday.get(weekday) ?? [];

		hours.push(session.availableHours);
		hoursByWeekday.set(weekday, hours);
		all.push(session.availableHours);
	}

	return {
		medianByWeekday: new Map(
			[...hoursByWeekday].map(([weekday, hours]) => [weekday, median(hours)]),
		),
		median: median(all),
	};
}

export function prefillBudgetFor(history: BudgetHistory, date: string): number {
	return history.medianByWeekday.get(fromISO(date).getDay()) ?? history.median;
}
