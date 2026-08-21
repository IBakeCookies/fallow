/**
 * How many days a task has been on the list, and whether that is worth saying.
 * The threshold is display policy, so it lives here and not with the plan
 * (AGENTS.md R2).
 */

import { daysBetween } from '$lib/business/utils/date';

export const CHRONIC_SLIDE_MIN_DAYS = 3;

/** The day the task is on, counting the day it was added as day 1 — or null below the gate. */
export function getSlideDay(createdAt: string, viewedDate: string): number | null {
	const age = daysBetween(createdAt, viewedDate);

	return age >= CHRONIC_SLIDE_MIN_DAYS ? age + 1 : null;
}
