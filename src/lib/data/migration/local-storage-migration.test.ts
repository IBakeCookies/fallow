import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateFromLocalStorageToIndexedDB } from './local-storage-migration';
import { $readSessionByDate } from '$lib/data/repository/session-repository';

const STORAGE_KEY = 'zenith-daily-tasks';
const MIGRATION_KEY = 'zenith-migrated-to-idb';

const backing = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => backing.get(key) ?? null,
	setItem: (key: string, value: string) => void backing.set(key, value)
});

describe('migrateFromLocalStorageToIndexedDB', () => {
	beforeEach(() => backing.clear());

	it('skips when already migrated', async () => {
		backing.set(MIGRATION_KEY, 'true');
		backing.set(STORAGE_KEY, JSON.stringify({ tasks: [] }));
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-01', 0.5)).toBe(false);
	});

	it('marks migrated and returns false when there is no old data', async () => {
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-02', 0.5)).toBe(false);
		expect(backing.get(MIGRATION_KEY)).toBe('true');
	});

	it('migrates old data into a session, filling defaults', async () => {
		backing.set(STORAGE_KEY, JSON.stringify({ tasks: [{ id: 1, title: 'Old task' }] }));
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-03', 0.5)).toBe(true);
		const session = await $readSessionByDate('2026-01-03');
		expect(session?.tasks).toHaveLength(1);
		expect(session?.availableHours).toBe(0);
		expect(session?.switchCost).toBe(0.5);
		expect(backing.get(MIGRATION_KEY)).toBe('true');
	});

	it('preserves an explicit switchCost of 0 (?? not ||)', async () => {
		backing.set(STORAGE_KEY, JSON.stringify({ tasks: [], switchCost: 0 }));
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-04', 0.5)).toBe(true);
		expect((await $readSessionByDate('2026-01-04'))?.switchCost).toBe(0);
	});

	it('returns false on corrupt JSON without marking migrated', async () => {
		backing.set(STORAGE_KEY, '{not json');
		expect(await migrateFromLocalStorageToIndexedDB('2026-01-05', 0.5)).toBe(false);
		expect(backing.get(MIGRATION_KEY)).toBeUndefined();
	});
});
