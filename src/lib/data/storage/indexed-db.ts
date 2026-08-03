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
 *                     record of what the model believed that day (MATH.md §12)
 */

import { logWarning } from '$lib/logger';

const DB_NAME = 'zenith-db';

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

async function openAndHeal(): Promise<IDBDatabase> {
	const database = await open(DB_VERSION).catch((error) => {
		// On-disk version is newer than the code (user opened an older build after
		// a newer one upgraded the schema): open at the existing version.
		if (error instanceof DOMException && error.name === 'VersionError') return open();

		throw error;
	});

	// A store this build needs is missing even though the on-disk version is at
	// or above ours — an earlier build bumped the version before creating it, so
	// onupgradeneeded will never fire again at that version. Force one upgrade.
	if (STORE_NAMES.some((name) => !database.objectStoreNames.contains(name))) {
		const version = database.version + 1;
		database.close();

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
