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
			for (const name of stores)
				request.result.createObjectStore(name, {
					keyPath: 'key',
				});
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
			'settings',
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

	// A dead handle is recoverable: reopening is the whole fix, so failing the
	// read instead would surface a hard error for a transient condition.
	it('reopens after the browser force-closes the connection', async () => {
		const { openDatabase, withStore } = await importFresh();
		(await openDatabase()).close();

		await expect(withStore('sessions', 'readonly', (store) => store.getAll())).resolves.toEqual([]);
	});

	// A superseded handle's close event must not evict the cache entry that
	// replaced it: the live connection would then be unreachable AND still open,
	// which is what blocks the next tab's upgrade.
	it('keeps the cached connection when a stale handle closes late', async () => {
		const { openDatabase } = await importFresh();
		const stale = await openDatabase();
		(await openRaw(stale.version + 1)).close(); // another tab upgrades
		const live = await openDatabase();

		// Invoked directly: a closed connection refuses dispatchEvent, and what is
		// under test is what the handler does, not how the browser delivers it.
		stale.onclose?.call(stale, new Event('close'));

		expect(await openDatabase()).toBe(live);
	});

	it('rolls back every store when one record in a multi-store write is malformed', async () => {
		const { withStore, withTransaction } = await importFresh();

		await withTransaction(['sessions', 'routines'], 'readwrite', (transaction) => {
			transaction.objectStore('sessions').put({
				date: '2026-01-01',
			});
		});

		await expect(
			withTransaction(['sessions', 'routines'], 'readwrite', (transaction) => {
				transaction.objectStore('routines').put({
					id: 'morning',
				});

				// No `date`, so put() throws synchronously on the missing keyPath.
				transaction.objectStore('sessions').put({
					tasks: [],
				});
			}),
		).rejects.toThrow();

		// The routine queued before the throw must have gone with it, and the
		// session written earlier must have survived.
		expect(await withStore('routines', 'readonly', (store) => store.getAll())).toEqual([]);
		expect(await withStore('sessions', 'readonly', (store) => store.getAll())).toHaveLength(1);
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
