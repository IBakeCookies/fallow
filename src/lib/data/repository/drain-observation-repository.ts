/**
 * CRUD access to the `drainObservations` object store — the end-of-session
 * drain ratings that calibrate the energy model's α drain rates.
 */

import type { DrainObservationRecord } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Upsert: re-rating the same task on the same day REPLACES the earlier
 * record instead of appending a duplicate — the same typo-correction
 * semantics as flow logs (the editor prefills the previous values).
 */
export async function $updateDrainObservation(
	observation: Omit<DrainObservationRecord, 'id' | 'createdAt'>
): Promise<void> {
	await withStore('drainObservations', 'readwrite', (store) => {
		// The store is small (one record per task per day), so a scan for the
		// existing record beats maintaining a compound index + schema migration.
		const getAll = store.getAll();
		getAll.onsuccess = () => {
			const existing = (getAll.result as DrainObservationRecord[]).find(
				(record) => record.taskId === observation.taskId && record.date === observation.date
			);
			const record = existing
				? { ...existing, ...observation, createdAt: Date.now() }
				: { ...observation, createdAt: Date.now() };
			store.put(record);
		};
	});
}

export async function $readAllDrainObservations(): Promise<DrainObservationRecord[]> {
	const result = await withStore('drainObservations', 'readonly', (store) => store.getAll());
	return result || [];
}

/** Remove a single drain rating from the calibration. */
export async function $deleteDrainObservation(id: number): Promise<void> {
	await withStore('drainObservations', 'readwrite', (store) => {
		store.delete(id);
	});
}

/**
 * Delete ALL drain ratings. The fitted α values are always derived from the
 * observations (never stored), so this reverts the energy model's drain
 * calibration to the defaults with nothing else to reset.
 */
export async function $deleteAllDrainObservations(): Promise<void> {
	await withStore('drainObservations', 'readwrite', (store) => {
		store.clear();
	});
}
