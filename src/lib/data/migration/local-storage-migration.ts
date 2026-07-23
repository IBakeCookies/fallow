/**
 * One-time migration of the old localStorage format into IndexedDB.
 *
 * The current date and default switch cost are passed in by the caller — the
 * data layer must not reach up into the business layer for model defaults.
 */

import type { DailySession } from '$lib/data/type';
import { $updateSession } from '$lib/data/repository/session-repository';

const STORAGE_KEY = 'zenith-daily-tasks';
const MIGRATION_KEY = 'zenith-migrated-to-idb';

export async function migrateFromLocalStorageToIndexedDB(
	today: string,
	defaultSwitchCost: number
): Promise<boolean> {
	if (typeof localStorage === 'undefined') return false;
	if (localStorage.getItem(MIGRATION_KEY)) return false;

	const oldData = localStorage.getItem(STORAGE_KEY);
	if (!oldData) {
		localStorage.setItem(MIGRATION_KEY, 'true');
		return false;
	}

	let session: DailySession;
	try {
		const parsed = JSON.parse(oldData);
		session = {
			date: today,
			tasks: parsed.tasks || [],
			availableHours: parsed.availableHours || 0,
			switchCost: parsed.switchCost ?? defaultSwitchCost,
			updatedAt: Date.now()
		};
	} catch {
		// Unparseable/malformed legacy JSON will never parse — a permanent
		// failure. Mark migrated so we stop retrying it on every load.
		localStorage.setItem(MIGRATION_KEY, 'true');
		return false;
	}

	try {
		await $updateSession(session);
	} catch {
		// An IndexedDB write can fail transiently (e.g. quota): leave the flag
		// unset so a later load retries the migration.
		return false;
	}

	localStorage.setItem(MIGRATION_KEY, 'true');
	// Keep old data for safety, can be cleaned up later
	return true;
}
