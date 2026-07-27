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
 */

const DB_NAME = 'zenith-db';

export const DB_VERSION = 5;

export const STORE_NAMES = [
	'sessions',
	'routines',
	'flowObservations',
	'drainObservations',
	'restObservations',
	'settings',
] as const;

let databasePromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
	if (!databasePromise) {
		databasePromise = openAndHeal().catch((error) => {
			databasePromise = null;
			throw error;
		});
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
			console.warn('zenith-db upgrade blocked by another open tab');
		};

		request.onsuccess = () => {
			const database = request.result;

			// Another tab is upgrading the schema: release our handle so its
			// upgrade proceeds, and reopen lazily on next access.
			database.onversionchange = () => {
				database.close();
				databasePromise = null;
			};

			// Browser force-closed the connection (e.g. storage cleared).
			database.onclose = () => {
				databasePromise = null;
			};

			resolve(database);
		};

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
		};
	});
}

/**
 * Run `work` against one object store in a single transaction and resolve when
 * the transaction COMMITS — not on request success, which fires before the
 * commit and would hide a later abort (e.g. quota). Resolves with the returned
 * request's result, or undefined when `work` returns nothing. A failing request
 * aborts the transaction, so per-request onerror handlers are unnecessary.
 */
export async function withStore<T>(
	storeName: string,
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
	const database = await openDatabase();

	return new Promise<T>((resolve, reject) => {
		const transaction = database.transaction(storeName, mode);
		const request = work(transaction.objectStore(storeName));
		transaction.oncomplete = () => resolve(request ? request.result : (undefined as T));
		const fail = () => reject(transaction.error ?? new Error('Transaction aborted'));
		transaction.onerror = fail;
		transaction.onabort = fail;
	});
}
