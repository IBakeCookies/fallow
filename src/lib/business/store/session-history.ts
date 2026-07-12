/**
 * Read-side session access for pages outside the live daily session (calendar,
 * analytics) plus storage startup. This is the business layer's facade over
 * the data layer — presentation code calls these instead of the repositories.
 */

import type { DailySession } from '$lib/data/type';
import {
	$deleteExpiredSessions,
	$readSessionsByDateRange
} from '$lib/data/repository/session-repository';
import { $readAllFlowObservations } from '$lib/data/repository/flow-observation-repository';
import { migrateFromLocalStorageToIndexedDB } from '$lib/data/migration/local-storage-migration';
import { toISODate } from '$lib/business/utils/date';
import { DEFAULT_SWITCH_COST, fitUserConstants, type UserConstants } from '$lib/business/model/zenith';

/**
 * Run once per page that touches persistence: migrates any legacy
 * localStorage data and prunes sessions older than a year.
 */
export async function initializeStorage(): Promise<void> {
	await migrateFromLocalStorageToIndexedDB(toISODate(), DEFAULT_SWITCH_COST);
	const deleted = await $deleteExpiredSessions();
	if (deleted > 0) {
		console.log(`Cleaned up ${deleted} old sessions`);
	}
}

/**
 * The personalized model constants: ridge least-squares fit of the logged
 * time-to-flow measurements, anchored to the article defaults. Used by the
 * calendar/analytics pages so per-day completion rates match what the main
 * dashboard showed that day.
 */
export async function readUserConstants(): Promise<UserConstants> {
	const observations = await $readAllFlowObservations();
	return fitUserConstants(observations.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours })))
		.constants;
}

export async function readSessionsByDateRange(
	startDate: string,
	endDate: string
): Promise<DailySession[]> {
	return $readSessionsByDateRange(startDate, endDate);
}
