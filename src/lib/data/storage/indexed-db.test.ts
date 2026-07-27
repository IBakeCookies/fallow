import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

async function importFresh() {
	vi.resetModules();
	return import('./indexed-db');
}

function openRaw(version?: number, stores: readonly string[] = []): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('zenith-db', version);
		request.onerror = () => reject(request.error);
		request.onupgradeneeded = () => {
			for (const name of stores) request.result.createObjectStore(name, { keyPath: 'key' });
		};
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
			'sessions',
			'settings'
		]);
	});

	// The literal above is an independent oracle; this catches the other half of
	// the drift — a store added to onupgradeneeded but not to STORE_NAMES (or the
	// reverse), which would silently skip it in export/import/wipe.
	it('creates exactly the stores STORE_NAMES declares', async () => {
		const { openDatabase, STORE_NAMES } = await importFresh();
		const database = await openDatabase();

		expect([...database.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
	});

	it('returns the same connection on repeated calls', async () => {
		const { openDatabase } = await importFresh();
		const [first, second] = await Promise.all([openDatabase(), openDatabase()]);

		expect(first).toBe(second);
	});

	it('falls back to the on-disk version when it is newer than the code version', async () => {
		const { STORE_NAMES } = await importFresh();
		(await openRaw(99, STORE_NAMES)).close();

		const { openDatabase } = await importFresh();
		const database = await openDatabase();

		expect(database.version).toBe(99);
	});

	// A build that bumped DB_VERSION before creating a store leaves the on-disk
	// schema at our version but incomplete, so onupgradeneeded never fires again.
	it('upgrades past the on-disk version when a store is missing', async () => {
		const { DB_VERSION } = await importFresh();
		(await openRaw(DB_VERSION, ['sessions'])).close();

		const { openDatabase } = await importFresh();
		const database = await openDatabase();

		expect(database.version).toBe(DB_VERSION + 1);
		expect(database.objectStoreNames.contains('settings')).toBe(true);
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
