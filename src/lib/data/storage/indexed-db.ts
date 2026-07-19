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
 */

const DB_NAME = 'zenith-db';
const DB_VERSION = 4;

let databaseInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
	if (databaseInstance) return Promise.resolve(databaseInstance);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);

		request.onsuccess = () => {
			databaseInstance = request.result;
			resolve(databaseInstance);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;

			// Daily sessions store - keyed by date
			if (!database.objectStoreNames.contains('sessions')) {
				const sessionStore = database.createObjectStore('sessions', { keyPath: 'date' });
				sessionStore.createIndex('updatedAt', 'updatedAt');
			}

			// Saved routines store
			if (!database.objectStoreNames.contains('routines')) {
				database.createObjectStore('routines', { keyPath: 'id' });
			}

			// Flow observations store (v2) - measured time-to-flow data points
			if (!database.objectStoreNames.contains('flowObservations')) {
				const flowStore = database.createObjectStore('flowObservations', {
					keyPath: 'id',
					autoIncrement: true
				});
				flowStore.createIndex('date', 'date');
			}

			// Drain observations store (v3) - end-of-session drain ratings that
			// calibrate the energy model's α drain rates
			if (!database.objectStoreNames.contains('drainObservations')) {
				const drainStore = database.createObjectStore('drainObservations', {
					keyPath: 'id',
					autoIncrement: true
				});
				drainStore.createIndex('date', 'date');
			}

			// Rest observations store (v4) - pre/post-rest drain rating pairs that
			// calibrate the energy model's recovery rate
			if (!database.objectStoreNames.contains('restObservations')) {
				const restStore = database.createObjectStore('restObservations', {
					keyPath: 'id',
					autoIncrement: true
				});
				restStore.createIndex('date', 'date');
			}
		};
	});
}
