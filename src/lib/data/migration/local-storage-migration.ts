/**
 * One-time migration of the old localStorage format into IndexedDB.
 *
 * The current date and default switch cost are passed in by the caller — the
 * data layer must not reach up into the business layer for model defaults.
 */

import type { DailySession } from '$lib/data/type';
import { $readSessionByDate, $updateSession } from '$lib/data/repository/session-repository';
import {
	ENERGY_PARAMS_SETTING,
	$readSetting,
	$updateSetting,
} from '$lib/data/repository/settings-repository';

const STORAGE_KEY = 'zenith-daily-tasks';
const MIGRATION_KEY = 'zenith-migrated-to-idb';
const ENERGY_PARAMS_STORAGE_KEY = 'zenith-energy-params';

/**
 * The flag write can itself throw (quota) — after a successful migration, that
 * must not fail the boot. The retry next load is harmless: the owns-the-day
 * guard below skips the write once IndexedDB has the session.
 */
function markMigrated(): void {
	try {
		localStorage.setItem(MIGRATION_KEY, 'true');
	} catch {
		// Retried on the next load.
	}
}

/**
 * Move the Energy Lab's parameters out of localStorage into the `settings`
 * store (v5), where backup/export covers them. The blob is moved verbatim —
 * validating it is the business layer's job, and it has to validate restored
 * backups anyway, so a second copy of that logic down here would buy nothing.
 *
 * Only runs when nothing is stored yet: once IndexedDB owns the setting, a
 * stale localStorage copy must never win.
 */
export async function migrateEnergyParamsFromLocalStorage(): Promise<boolean> {
	if (typeof localStorage === 'undefined') return false;

	const raw = localStorage.getItem(ENERGY_PARAMS_STORAGE_KEY);

	if (!raw) return false;

	let value: unknown;

	try {
		value = JSON.parse(raw);
	} catch {
		// Unparseable legacy JSON never will parse: drop it rather than retry.
		localStorage.removeItem(ENERGY_PARAMS_STORAGE_KEY);

		return false;
	}

	try {
		if ((await $readSetting(ENERGY_PARAMS_SETTING)) === undefined) {
			await $updateSetting(ENERGY_PARAMS_SETTING, value);
		}
	} catch {
		// Transient IndexedDB failure (e.g. quota): keep the localStorage copy
		// so a later load retries.
		return false;
	}

	localStorage.removeItem(ENERGY_PARAMS_STORAGE_KEY);

	return true;
}

export async function migrateFromLocalStorageToIndexedDB(
	today: string,
	defaultSwitchCost: number,
): Promise<boolean> {
	if (typeof localStorage === 'undefined') return false;

	if (localStorage.getItem(MIGRATION_KEY)) return false;

	const oldData = localStorage.getItem(STORAGE_KEY);

	if (!oldData) {
		markMigrated();

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
			updatedAt: Date.now(),
		};
	} catch {
		// Unparseable/malformed legacy JSON will never parse — a permanent
		// failure. Mark migrated so we stop retrying it on every load.
		markMigrated();

		return false;
	}

	try {
		// Once IndexedDB owns a session for today, the legacy copy must never
		// win: the blob is kept forever, so a lost flag (a failed flag write, a
		// hand-edit) would otherwise re-import it over the user's live plan.
		if (!(await $readSessionByDate(today))) {
			await $updateSession(session);
		}
	} catch {
		// An IndexedDB write can fail transiently (e.g. quota): leave the flag
		// unset so a later load retries the migration.
		return false;
	}

	markMigrated();

	// Keep old data for safety, can be cleaned up later
	return true;
}
