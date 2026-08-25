/**
 * IndexedDB connection for Zenith — one lazily-opened, cached database handle.
 *
 * Object stores:
 * - sessions:         daily sessions, keyed by date, indexed by updatedAt
 * - routines:         saved task templates, keyed by id
 * - flowObservations: measured time-to-flow data points (autoIncrement),
 *                     indexed by date
 * - drainObservations: end-of-session drain ratings (autoIncrement),
 *                     indexed by date
 * - restObservations: pre/post-rest drain rating pairs (autoIncrement),
 *                     indexed by date
 * - settings:         singleton records keyed by name (e.g. the Energy Lab's
 *                     model parameters), so they are backed up with everything
 *                     else instead of living loose in localStorage
 * - fitSnapshots:     one day's fitted model parameters, keyed by date — the
 *                     record of what the model believed that day
 */

import { logWarning } from '$lib/logger';

const DB_NAME = 'zenith-db';
// This TAB has spent its stale-build reload (`sessionStorage`), and the on-disk
// schema version a reload has been proven not to fix (`localStorage`). Two
// questions, two scopes — see `reloadStaleBuild`.
const RELOAD_SPENT_KEY = 'fallow:schema-reload-spent';
const FUTILE_RELOAD_KEY = 'fallow:futile-schema-reload';

export const DB_VERSION = 6;

export const STORE_NAMES = [
	'sessions',
	'routines',
	'flowObservations',
	'drainObservations',
	'restObservations',
	'settings',
	'fitSnapshots',
] as const;

let databasePromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
	if (!databasePromise) {
		// Every invalidation is guarded on the cache still holding THIS connection:
		// a superseded handle's late close event must not evict the newer one that
		// replaced it, which would leave that one open forever — and an open
		// connection nobody can reach is what blocks the next tab's upgrade.
		const promise: Promise<IDBDatabase> = (databasePromise = openAndHeal().then(
			(database) => {
				const invalidate = () => {
					if (databasePromise === promise) databasePromise = null;
				};

				// Another tab is upgrading the schema: release our handle so its
				// upgrade proceeds, and reopen lazily on next access.
				database.onversionchange = () => {
					database.close();
					invalidate();
				};

				// Browser force-closed the connection (e.g. storage cleared).
				database.onclose = invalidate;

				return database;
			},
			(error) => {
				if (databasePromise === promise) databasePromise = null;

				throw error;
			},
		));
	}

	return databasePromise;
}

/** Has a reload against exactly this on-disk version already been shown futile? */
function isReloadFutile(version: number): boolean {
	try {
		return localStorage.getItem(FUTILE_RELOAD_KEY) === String(version);
	} catch (e) {
		logWarning('Failed to read the futile-reload marker', e);

		// Unknown, so leave it to the per-tab guard to bound the attempt.
		return false;
	}
}

/** Spare every other tab a reload this one has just proven pointless. */
function markReloadFutile(version: number): void {
	try {
		localStorage.setItem(FUTILE_RELOAD_KEY, String(version));
	} catch (e) {
		logWarning('Failed to record a futile stale-build reload', e);
	}
}

/**
 * Has this tab already reloaded against exactly this on-disk version? Keyed by
 * version like the other marker, or a tab that reloaded for one release would sit
 * out the next one — and worse, report ITS schema futile to every other tab.
 * Unreadable storage counts as yes: a reload nothing can remember loops.
 */
function hasTabReloaded(version: number): boolean {
	try {
		return sessionStorage.getItem(RELOAD_SPENT_KEY) === String(version);
	} catch (e) {
		logWarning('Failed to read the stale-build reload marker', e);

		return true;
	}
}

/** False when the attempt cannot be recorded, which is the same reload loop. */
function markTabReloaded(version: number): boolean {
	try {
		sessionStorage.setItem(RELOAD_SPENT_KEY, String(version));

		return true;
	} catch (e) {
		logWarning('Failed to record a stale-build reload', e);

		return false;
	}
}

/**
 * The on-disk schema is newer than this build: another tab has already run a
 * newer build's upgrade. Opening at the on-disk version anyway is what this used
 * to do, and it is silent corruption — old code reading records it has never
 * seen, and writing old-shaped ones back into a migrated store, with nothing
 * downstream able to tell.
 *
 * So reload into the build that did the upgrade. Two markers bound that. Both are
 * keyed by the on-disk version; the scope is the whole difference, and either
 * scope alone is a defect:
 * - **Per tab** (`sessionStorage`), or a tab that comes back to the same stale
 *   build reloads forever. It must not be browser-wide: EVERY stale tab has to
 *   reload, and one tab's success says nothing about the three still holding the
 *   old build in memory.
 * - **Per browser** (`localStorage`), or every one of those tabs — and every tab
 *   opened later — repeats a reload already known to change nothing. Reloading
 *   proves futile when the schema outlives the build that wrote it: after a
 *   **rollback**, and after the missing-store heal below, which leaves the disk
 *   permanently a version ahead of the build that healed it (that one never even
 *   costs the first reload — the heal records the verdict itself).
 *
 * Either way out lands on the old degraded behaviour: open at the on-disk
 * version, now reached only once reloading has been proven not to help.
 */
async function reloadStaleBuild(): Promise<IDBDatabase> {
	// Unversioned, because this is the only way to learn what is on disk:
	// `VersionError` does not carry it, and both markers are per version.
	const database = await open();
	const { version } = database;

	logWarning('zenith-db on-disk schema is newer than this build', undefined, {
		version,
	});

	if (isReloadFutile(version)) return database;

	if (hasTabReloaded(version)) {
		// This tab reloaded and came back to the same stale build, so nothing newer
		// is there to reach. Say so once, for every other tab.
		markReloadFutile(version);

		return database;
	}

	if (!markTabReloaded(version)) return database;

	// Nothing may run against the newer schema, and a handle left open blocks the
	// next tab's upgrade for as long as the unload takes.
	database.close();
	location.reload();

	// Never settles: `reload()` only SCHEDULES the unload, so resolving would hand
	// the caller a connection to write through before the page goes — the exact
	// write this exists to prevent. Same shape as `onblocked` below.
	return new Promise<never>(() => {});
}

async function openAndHeal(): Promise<IDBDatabase> {
	const database = await open(DB_VERSION).catch((error) => {
		if (error instanceof DOMException && error.name === 'VersionError') return reloadStaleBuild();

		throw error;
	});

	// A store this build needs is missing even though the on-disk version is at
	// or above ours — an earlier build bumped the version before creating it, so
	// onupgradeneeded will never fire again at that version. Force one upgrade.
	if (STORE_NAMES.some((name) => !database.objectStoreNames.contains(name))) {
		const version = database.version + 1;
		database.close();

		// This build is the reason the disk ends up ahead of it, permanently — so
		// record now that reloading for that version reaches nothing newer, and no
		// tab spends one on it.
		markReloadFutile(version);

		return open(version);
	}

	return database;
}

function open(version?: number): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, version);

		request.onerror = () => reject(request.error);

		request.onblocked = () => {
			// A tab with pre-versionchange-handling code holds an old connection;
			// the open stays pending until that tab closes.
			logWarning('zenith-db upgrade blocked by another open tab');
		};

		// The lifecycle handlers belong to the CACHED connection, so `openDatabase`
		// installs them — the intermediate handle `openAndHeal` opens and closes
		// again must not invalidate a cache entry it never owned.
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;

			// Daily sessions store - keyed by date
			if (!database.objectStoreNames.contains('sessions')) {
				const sessionStore = database.createObjectStore('sessions', {
					keyPath: 'date',
				});

				sessionStore.createIndex('updatedAt', 'updatedAt');
			}

			// Saved routines store
			if (!database.objectStoreNames.contains('routines')) {
				database.createObjectStore('routines', {
					keyPath: 'id',
				});
			}

			// Flow observations store (v2) - measured time-to-flow data points
			if (!database.objectStoreNames.contains('flowObservations')) {
				const flowStore = database.createObjectStore('flowObservations', {
					keyPath: 'id',
					autoIncrement: true,
				});

				flowStore.createIndex('date', 'date');
			}

			// Drain observations store (v3) - end-of-session drain ratings that
			// calibrate the energy model's α drain rates
			if (!database.objectStoreNames.contains('drainObservations')) {
				const drainStore = database.createObjectStore('drainObservations', {
					keyPath: 'id',
					autoIncrement: true,
				});

				drainStore.createIndex('date', 'date');
			}

			// Rest observations store (v4) - pre/post-rest drain rating pairs that
			// calibrate the energy model's recovery rate
			if (!database.objectStoreNames.contains('restObservations')) {
				const restStore = database.createObjectStore('restObservations', {
					keyPath: 'id',
					autoIncrement: true,
				});

				restStore.createIndex('date', 'date');
			}

			// Settings store (v5) - one record per named singleton setting
			if (!database.objectStoreNames.contains('settings')) {
				database.createObjectStore('settings', {
					keyPath: 'key',
				});
			}

			// Fit snapshots store (v6) - one record per day, keyed by the ISO date.
			// No `date` index: the key IS the date, so a range query is a key range.
			if (!database.objectStoreNames.contains('fitSnapshots')) {
				database.createObjectStore('fitSnapshots', {
					keyPath: 'date',
				});
			}
		};
	});
}

/**
 * Run `work` in ONE transaction over one or more object stores and resolve when
 * that transaction COMMITS — not on request success, which fires before the
 * commit and would hide a later abort (e.g. quota). Resolves with the returned
 * request's result, or undefined when `work` returns nothing.
 *
 * A failing request aborts the transaction, so per-request onerror handlers are
 * unnecessary. A request that throws SYNCHRONOUSLY (`put()` on a malformed
 * record throws DataError/DataCloneError) is aborted here, because the requests
 * queued before it would otherwise still commit — leaving the caller with a
 * rejection over a half-written database.
 *
 * Nothing may `await` between creating the transaction and queueing the first
 * request: a transaction goes inactive at the end of the task that created it,
 * so a microtask hop in between is an InvalidStateError on the strictest
 * engines. That is why the retry below re-creates the transaction rather than
 * being awaited on the way in.
 */
export async function withTransaction<T>(
	storeNames: readonly string[],
	mode: IDBTransactionMode,
	work: (transaction: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
	const names = [...storeNames];
	const promise = openDatabase();
	const database = await promise;
	let transaction: IDBTransaction;

	try {
		transaction = database.transaction(names, mode);
	} catch (error) {
		// A force-closed connection (storage cleared, an eviction while the tab
		// slept) throws InvalidStateError, and reopening IS the recovery — the
		// alternative is failing a perfectly retryable read. Evict only while the
		// cache still holds THIS dead handle, or a concurrent caller's healthy
		// replacement gets thrown away and left open with nobody able to reach it.
		if (!(error instanceof DOMException) || error.name !== 'InvalidStateError') throw error;

		if (databasePromise === promise) databasePromise = null;

		transaction = (await openDatabase()).transaction(names, mode);
	}

	return new Promise<T>((resolve, reject) => {
		let request: IDBRequest<T> | void;

		transaction.oncomplete = () => resolve(request ? request.result : (undefined as T));
		const fail = () => reject(transaction.error ?? new Error('Transaction aborted'));
		transaction.onerror = fail;
		transaction.onabort = fail;

		try {
			request = work(transaction);
		} catch (error) {
			transaction.abort();
			reject(error);
		}
	});
}

/** `withTransaction` over a single store — what every per-store repository wants. */
export function withStore<T>(
	storeName: string,
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
	return withTransaction([storeName], mode, (transaction) =>
		work(transaction.objectStore(storeName)),
	);
}
