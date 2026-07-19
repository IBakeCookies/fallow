/**
 * Cross-day summaries for the calendar and analytics pages.
 *
 * A stored DailySession is summarized with the SAME model pipeline the daily
 * dashboard uses (calculateSuggestedTasks → priority-weighted completion
 * rate), so a day reads identically everywhere in the app.
 */

import type { DailySession, Task } from '$lib/data/type';
import { addDays } from '$lib/business/utils/date';
import {
	type DailyQuadrant,
	calculateSuggestedTasks,
	calculateCompletionRate,
	calculateDailyQuadrant
} from './calculation';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	type FitPosterior,
	type UserConstants
} from '../zenith';

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
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	posterior?: FitPosterior
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
		constants,
		posterior
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
