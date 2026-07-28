import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	migrateFromLocalStorageToIndexedDB,
	migrateEnergyParamsFromLocalStorage,
} from '$lib/data/migration/local-storage-migration';
import { $readSessionByDate, $updateSession } from '$lib/data/repository/session-repository';
import { $deleteAllStores } from '$lib/data/repository/backup-repository';
import {
	ENERGY_PARAMS_SETTING,
	$readSetting,
	$updateSetting,
} from '$lib/data/repository/settings-repository';

const STORAGE_KEY = 'zenith-daily-tasks';
const MIGRATION_KEY = 'zenith-migrated-to-idb';
const ENERGY_PARAMS_STORAGE_KEY = 'zenith-energy-params';
const backing = new Map<string, string>();

vi.stubGlobal('localStorage', {
	getItem: (key: string) => backing.get(key) ?? null,
	setItem: (key: string, value: string) => void backing.set(key, value),
	removeItem: (key: string) => void backing.delete(key),
});

describe('migrateFromLocalStorageToIndexedDB', () => {
	beforeEach(() => backing.clear());

	it('skips when already migrated', async () => {
		backing.set(MIGRATION_KEY, 'true');

		backing.set(
			STORAGE_KEY,
			JSON.stringify({
				tasks: [],
			}),
		);

		expect(await migrateFromLocalStorageToIndexedDB('2026-01-01', 0.5)).toBe(false);
	});

	// "Delete all data" wipes IndexedDB only, and the legacy blob is kept on
	// purpose (see the migration's comment). The one-way flag is what stops it
	// resurrecting the wiped tasks on the next load — R8 step 5.
	it('never resurrects the legacy blob after a wipe', async () => {
		backing.set(
			STORAGE_KEY,
			JSON.stringify({
				tasks: [
					{
						id: 1,
						title: 'Wiped task',
					},
				],
			}),
		);

		expect(await migrateFromLocalStorageToIndexedDB('2026-01-06', 0.5)).toBe(true);

		await $deleteAllStores();

		expect(await migrateFromLocalStorageToIndexedDB('2026-01-06', 0.5)).toBe(false);
		expect(await $readSessionByDate('2026-01-06')).toBeNull();
	});

	it('marks migrated and returns false when there is no old data', async () => {
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-02', 0.5)).toBe(false);
		expect(backing.get(MIGRATION_KEY)).toBe('true');
	});

	it('migrates old data into a session, filling defaults', async () => {
		backing.set(
			STORAGE_KEY,
			JSON.stringify({
				tasks: [
					{
						id: 1,
						title: 'Old task',
					},
				],
			}),
		);

		expect(await migrateFromLocalStorageToIndexedDB('2026-01-03', 0.5)).toBe(true);
		const session = await $readSessionByDate('2026-01-03');
		expect(session?.tasks).toHaveLength(1);
		expect(session?.availableHours).toBe(0);
		expect(session?.switchCost).toBe(0.5);
		expect(backing.get(MIGRATION_KEY)).toBe('true');
	});

	it('preserves an explicit switchCost of 0 (?? not ||)', async () => {
		backing.set(
			STORAGE_KEY,
			JSON.stringify({
				tasks: [],
				switchCost: 0,
			}),
		);

		expect(await migrateFromLocalStorageToIndexedDB('2026-01-04', 0.5)).toBe(true);
		expect((await $readSessionByDate('2026-01-04'))?.switchCost).toBe(0);
	});

	// The legacy blob is kept forever, so any lost flag (a failed flag write, a
	// devtools hand-edit) re-runs the migration — over a day the user is using.
	it('never lets the kept legacy blob overwrite a day IndexedDB already owns', async () => {
		await $updateSession({
			date: '2026-01-07',
			tasks: [],
			availableHours: 4,
			switchCost: 0.5,
			updatedAt: 1,
		});

		backing.set(
			STORAGE_KEY,
			JSON.stringify({
				tasks: [
					{
						id: 1,
						title: 'Stale task',
					},
				],
			}),
		);

		await migrateFromLocalStorageToIndexedDB('2026-01-07', 0.5);

		expect((await $readSessionByDate('2026-01-07'))?.tasks).toHaveLength(0);
		expect(backing.get(MIGRATION_KEY)).toBe('true');
	});

	it('survives a flag write that throws instead of failing the boot', async () => {
		backing.set(
			STORAGE_KEY,
			JSON.stringify({
				tasks: [],
			}),
		);

		const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});

		try {
			await expect(migrateFromLocalStorageToIndexedDB('2026-01-08', 0.5)).resolves.toBe(true);
		} finally {
			setItem.mockRestore();
		}

		expect(await $readSessionByDate('2026-01-08')).not.toBeNull();
	});

	it('marks migrated on corrupt JSON so it does not retry forever', async () => {
		backing.set(STORAGE_KEY, '{not json');
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-05', 0.5)).toBe(false);
		expect(backing.get(MIGRATION_KEY)).toBe('true');
	});
});

describe('migrateEnergyParamsFromLocalStorage', () => {
	beforeEach(async () => {
		backing.clear();
		// fake-indexeddb is shared across this file; storing `undefined` reads
		// back as "nothing stored", which is exactly the pre-migration state.
		await $updateSetting(ENERGY_PARAMS_SETTING, undefined);
	});

	it('does nothing when there is no legacy copy', async () => {
		expect(await migrateEnergyParamsFromLocalStorage()).toBe(false);
	});

	it('moves the params into the settings store and drops the legacy key', async () => {
		backing.set(
			ENERGY_PARAMS_STORAGE_KEY,
			JSON.stringify({
				alphaCog: 0.7,
			}),
		);

		expect(await migrateEnergyParamsFromLocalStorage()).toBe(true);

		expect(await $readSetting(ENERGY_PARAMS_SETTING)).toEqual({
			alphaCog: 0.7,
		});

		expect(backing.has(ENERGY_PARAMS_STORAGE_KEY)).toBe(false);
	});

	it('never lets a stale legacy copy overwrite what IndexedDB already owns', async () => {
		await $updateSetting(ENERGY_PARAMS_SETTING, {
			alphaCog: 0.9,
		});

		backing.set(
			ENERGY_PARAMS_STORAGE_KEY,
			JSON.stringify({
				alphaCog: 0.1,
			}),
		);

		expect(await migrateEnergyParamsFromLocalStorage()).toBe(true);

		expect(await $readSetting(ENERGY_PARAMS_SETTING)).toEqual({
			alphaCog: 0.9,
		});

		expect(backing.has(ENERGY_PARAMS_STORAGE_KEY)).toBe(false);
	});

	it('drops corrupt legacy JSON instead of retrying it forever', async () => {
		backing.set(ENERGY_PARAMS_STORAGE_KEY, '{not json');

		expect(await migrateEnergyParamsFromLocalStorage()).toBe(false);

		expect(backing.has(ENERGY_PARAMS_STORAGE_KEY)).toBe(false);
		expect(await $readSetting(ENERGY_PARAMS_SETTING)).toBeUndefined();
	});
});
