import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// Re-spelled as independent oracles, per R4.
const RELOAD_SPENT_KEY = 'fallow:schema-reload-spent';
const FUTILE_RELOAD_KEY = 'fallow:futile-schema-reload';

// Node has none of them, and the stale-build path needs all three: two Storage
// implementations to keep the per-tab and per-browser markers apart, and a
// `reload` that counts calls instead of taking the test runner's page down.
function createStorage() {
	const entries = new Map<string, string>();

	return {
		getItem: (key: string) => entries.get(key) ?? null,
		setItem: (key: string, value: string) => void entries.set(key, value),
		removeItem: (key: string) => void entries.delete(key),
	};
}

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
	let reload: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
		reload = vi.fn();

		vi.stubGlobal('location', {
			reload,
		});

		vi.stubGlobal('localStorage', createStorage());
		vi.stubGlobal('sessionStorage', createStorage());
	});

	// A second tab of the same browser: its own sessionStorage, the same
	// localStorage, and a module instance that has never opened the database.
	function openTab() {
		vi.stubGlobal('sessionStorage', createStorage());

		return importFresh();
	}

	// Stubbed globals are process-wide: without this they outlive the file and
	// every other server test runs against a fake `location`.
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens the database with all object stores', async () => {
		const { openDatabase } = await importFresh();
		const database = await openDatabase();

		expect([...database.objectStoreNames].sort()).toEqual([
			'drainObservations',
			'fitSnapshots',
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

	// This tab is running the build from BEFORE a release whose upgrade another
	// tab has already applied. Reading that schema with this code, and writing
	// old-shaped records back into it, is corruption nothing downstream can spot —
	// so the tab reloads into the build that upgraded it instead.
	it('reloads when the on-disk schema is newer than this build', async () => {
		const { STORE_NAMES } = await importFresh();
		(await openRaw(99, STORE_NAMES)).close();

		const { openDatabase } = await importFresh();
		const pending = openDatabase();

		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

		// And never settles: a connection handed back here is one the caller writes
		// through in the window before the page actually goes.
		await expect(
			Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve('pending')))]),
		).resolves.toBe('pending');
	});

	// The reason the spent-reload marker is per TAB and not per browser. A
	// browser-wide one records "somebody reloaded for this schema", which the other
	// tabs — still holding the old build in memory, still writing — would read as
	// permission to open the migrated schema. Every stale tab reloads.
	it('reloads a second stale tab too, after the first one has reloaded', async () => {
		const { STORE_NAMES } = await importFresh();
		(await openRaw(99, STORE_NAMES)).close();

		const first = await openTab();
		void first.openDatabase();

		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

		const second = await openTab();
		void second.openDatabase();

		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
	});

	// The rollback: this tab reloaded and came back to the same stale build, so
	// there is nothing newer to reach. Reloading again would leave the app
	// unbootable — open degraded instead, old code on a newer schema but alive.
	it('opens at the on-disk version when its own reload changed nothing', async () => {
		sessionStorage.setItem(RELOAD_SPENT_KEY, '99');

		const { STORE_NAMES } = await importFresh();
		(await openRaw(99, STORE_NAMES)).close();

		const { openDatabase } = await importFresh();
		const database = await openDatabase();

		expect(database.version).toBe(99);
		expect(reload).not.toHaveBeenCalled();
		// And says so browser-wide, so the tabs after this one skip the same proof.
		expect(localStorage.getItem(FUTILE_RELOAD_KEY)).toBe('99');
	});

	it('spares a later tab a reload already proven futile', async () => {
		localStorage.setItem(FUTILE_RELOAD_KEY, '99');

		const { STORE_NAMES } = await importFresh();
		(await openRaw(99, STORE_NAMES)).close();

		const { openDatabase } = await openTab();
		const database = await openDatabase();

		expect(database.version).toBe(99);
		expect(reload).not.toHaveBeenCalled();
	});

	// Why BOTH markers record the version instead of just "spent" and "futile": a
	// tab left behind by two releases in a row has to reload for the second one
	// too — and a bare per-tab flag would instead have it declare the second
	// release's schema futile to every other tab.
	it.each([
		['browser', () => localStorage.setItem(FUTILE_RELOAD_KEY, '99')],
		['tab', () => sessionStorage.setItem(RELOAD_SPENT_KEY, '99')],
	])('reloads again when a later release moves the schema on (%s marker)', async (_, spend) => {
		spend();

		const { STORE_NAMES } = await importFresh();
		(await openRaw(100, STORE_NAMES)).close();

		const { openDatabase } = await importFresh();
		void openDatabase();

		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
		expect(localStorage.getItem(FUTILE_RELOAD_KEY)).not.toBe('100');
	});

	// The heal below leaves the disk a version ahead of the build that healed it,
	// permanently — and that build is not stale, it wrote the schema itself. Every
	// later visit would otherwise reload once into an identical build.
	it('never reloads for a version the missing-store heal created', async () => {
		const { DB_VERSION } = await importFresh();
		(await openRaw(DB_VERSION, ['sessions'])).close();

		const healed = await openTab();
		await healed.openDatabase();

		const later = await openTab();
		const database = await later.openDatabase();

		expect(database.version).toBe(DB_VERSION + 1);
		expect(reload).not.toHaveBeenCalled();
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

	// The path an EXISTING user takes, and the one R8 step 2's "additive, never
	// destructive" guard exists for. Every other test here starts from nothing, so
	// they only ever prove store CREATION at the current version — they would all
	// pass an onupgradeneeded that dropped and recreated the stores it already had.
	it('upgrades an older database without touching the data already in it', async () => {
		const previous = await openRaw(5, [
			'sessions',
			'routines',
			'flowObservations',
			'drainObservations',
			'restObservations',
			'settings',
		]);

		await new Promise<void>((resolve, reject) => {
			const transaction = previous.transaction('sessions', 'readwrite');

			transaction.objectStore('sessions').put({
				key: '2026-08-01',
				tasks: ['keep me'],
			});

			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});

		previous.close();

		const { openDatabase, DB_VERSION } = await importFresh();
		const database = await openDatabase();

		expect(database.version).toBe(DB_VERSION);
		expect(database.objectStoreNames.contains('fitSnapshots')).toBe(true);

		const kept = await new Promise((resolve, reject) => {
			const request = database.transaction('sessions', 'readonly').objectStore('sessions').getAll();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});

		expect(kept).toEqual([
			{
				key: '2026-08-01',
				tasks: ['keep me'],
			},
		]);
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
		// What is under test is the caching, so rule the reload out and let the
		// reopen take the degraded path.
		localStorage.setItem(FUTILE_RELOAD_KEY, String(stale.version + 1));

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
		// As above: the versionchange release is what is under test, not the reload
		// the newer schema would otherwise trigger.
		localStorage.setItem(FUTILE_RELOAD_KEY, String(stale.version + 1));

		const reopened = await openDatabase();
		expect(reopened).not.toBe(stale);
		expect(reopened.version).toBe(stale.version + 1);
	});
});
