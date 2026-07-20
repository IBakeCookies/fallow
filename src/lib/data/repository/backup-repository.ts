/**
 * Whole-database backup: export every object store to a single JSON-friendly
 * object, and import one back. Import is a merge — records land via put(), so
 * entries sharing a key (session date, routine id, observation id) are
 * overwritten and everything else is kept.
 */

import { openDatabase, DB_VERSION } from '$lib/data/storage/indexed-db';

const STORE_NAMES = [
	'sessions',
	'routines',
	'flowObservations',
	'drainObservations',
	'restObservations'
] as const;

type StoreName = (typeof STORE_NAMES)[number];

export interface BackupFile {
	app: 'fallow';
	schemaVersion: number;
	exportedAt: string;
	stores: Record<StoreName, unknown[]>;
}

export async function $exportAllStores(): Promise<BackupFile> {
	const database = await openDatabase();
	const stores = {} as Record<StoreName, unknown[]>;
	await Promise.all(
		STORE_NAMES.map(
			(name) =>
				new Promise<void>((resolve, reject) => {
					const request = database.transaction(name, 'readonly').objectStore(name).getAll();
					request.onsuccess = () => {
						stores[name] = request.result || [];
						resolve();
					};
					request.onerror = () => reject(request.error);
				})
		)
	);
	return {
		app: 'fallow',
		schemaVersion: DB_VERSION,
		exportedAt: new Date().toISOString(),
		stores
	};
}

/**
 * Merge a backup into the database in one transaction over all stores, so a
 * malformed record aborts the whole import instead of restoring half a backup.
 * Unknown store names in the file are ignored.
 */
export async function $importAllStores(backup: unknown): Promise<void> {
	const parsed = backup as Partial<BackupFile> | null;
	if (!parsed || parsed.app !== 'fallow' || typeof parsed.stores !== 'object' || !parsed.stores) {
		throw new Error('Not a Fallow backup file');
	}

	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAMES as unknown as string[], 'readwrite');
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error ?? new Error('Import aborted'));

		for (const name of STORE_NAMES) {
			const records = parsed.stores?.[name];
			if (!Array.isArray(records)) continue;
			const store = transaction.objectStore(name);
			for (const record of records) store.put(record);
		}
	});
}

/** Wipe every object store in one transaction — all data or none. */
export async function $deleteAllStores(): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAMES as unknown as string[], 'readwrite');
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error ?? new Error('Wipe aborted'));
		for (const name of STORE_NAMES) transaction.objectStore(name).clear();
	});
}
