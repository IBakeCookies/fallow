/**
 * Whole-database backup: export every object store to a single JSON-friendly
 * object, and import one back. Import is a merge — records land via put(), so
 * entries sharing a key (session date, routine id, observation id) are
 * overwritten and everything else is kept.
 */

import { withTransaction, DB_VERSION, STORE_NAMES } from '$lib/data/storage/indexed-db';

type StoreName = (typeof STORE_NAMES)[number];

export interface BackupFile {
	app: 'fallow';
	schemaVersion: number;
	exportedAt: string;
	stores: Record<StoreName, unknown[]>;
}

export async function $exportAllStores(): Promise<BackupFile> {
	const stores = {} as Record<StoreName, unknown[]>;

	// ONE transaction over every store, so the file is a consistent snapshot. Read
	// per store instead and a save landing mid-export produces a backup whose
	// observations reference a session state that never existed.
	await withTransaction(STORE_NAMES, 'readonly', (transaction) => {
		for (const name of STORE_NAMES) {
			const request = transaction.objectStore(name).getAll();

			request.onsuccess = () => {
				stores[name] = request.result || [];
			};
		}
	});

	return {
		app: 'fallow',
		schemaVersion: DB_VERSION,
		exportedAt: new Date().toISOString(),
		stores,
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

	const backupStores = parsed.stores;

	// A newer schema may carry records this build can't interpret; refuse rather
	// than blind-merge them. Missing/older versions still import — readers
	// tolerate absent fields by design.
	if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > DB_VERSION) {
		throw new Error(
			`Backup schema v${parsed.schemaVersion} is newer than this app (v${DB_VERSION})`,
		);
	}

	// A malformed record makes put() throw synchronously; withTransaction aborts
	// on that, so a bad record rolls back the records queued before it.
	await withTransaction(STORE_NAMES, 'readwrite', (transaction) => {
		for (const name of STORE_NAMES) {
			const records = backupStores[name];

			if (!Array.isArray(records)) continue;

			const store = transaction.objectStore(name);
			for (const record of records) store.put(record);
		}
	});
}

/** Wipe every object store in one transaction — all data or none. */
export async function $deleteAllStores(): Promise<void> {
	await withTransaction(STORE_NAMES, 'readwrite', (transaction) => {
		for (const name of STORE_NAMES) transaction.objectStore(name).clear();
	});
}
