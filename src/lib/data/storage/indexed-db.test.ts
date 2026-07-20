import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

async function importFresh() {
	vi.resetModules();
	return import('./indexed-db');
}

function openRaw(version?: number): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('zenith-db', version);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

describe('indexed-db', () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
	});

	it('opens the database with all object stores', async () => {
		const { openDatabase } = await importFresh();
		const database = await openDatabase();

		expect([...database.objectStoreNames].sort()).toEqual([
			'drainObservations',
			'flowObservations',
			'restObservations',
			'routines',
			'sessions'
		]);
	});

	it('returns the same connection on repeated calls', async () => {
		const { openDatabase } = await importFresh();
		const [first, second] = await Promise.all([openDatabase(), openDatabase()]);

		expect(first).toBe(second);
	});

	it('falls back to the on-disk version when it is newer than the code version', async () => {
		(await openRaw(99)).close();

		const { openDatabase } = await importFresh();
		const database = await openDatabase();

		expect(database.version).toBe(99);
	});

	it('releases its connection when another tab upgrades, then reopens', async () => {
		const { openDatabase } = await importFresh();
		const stale = await openDatabase();

		// Second tab opens a newer schema; our versionchange handler must close
		// the stale handle or this open would stay blocked forever.
		const upgraded = await openRaw(stale.version + 1);
		upgraded.close();

		const reopened = await openDatabase();
		expect(reopened).not.toBe(stale);
		expect(reopened.version).toBe(stale.version + 1);
	});
});
