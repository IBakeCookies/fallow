/**
 * CRUD access to the `drainObservations` object store — the end-of-session
 * drain ratings that calibrate the energy model's α drain rates.
 */

import type { DrainObservationRecord } from '$lib/data/type';
import { openDatabase } from '$lib/data/storage/indexed-db';

/**
 * Upsert: re-rating the same task on the same day REPLACES the earlier
 * record instead of appending a duplicate — the same typo-correction
 * semantics as flow logs (the editor prefills the previous values).
 */
export async function $updateDrainObservation(
	observation: Omit<DrainObservationRecord, 'id' | 'createdAt'>
): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('drainObservations', 'readwrite');
		const store = transaction.objectStore('drainObservations');
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
			const put = store.put(record);
			put.onerror = () => reject(put.error);
		};
		getAll.onerror = () => reject(getAll.error);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
}

export async function $readAllDrainObservations(): Promise<DrainObservationRecord[]> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('drainObservations', 'readonly');
		const store = transaction.objectStore('drainObservations');
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

/** Remove a single drain rating from the calibration. */
export async function $deleteDrainObservation(id: number): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('drainObservations', 'readwrite');
		const store = transaction.objectStore('drainObservations');
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

/**
 * Delete ALL drain ratings. The fitted α values are always derived from the
 * observations (never stored), so this reverts the energy model's drain
 * calibration to the defaults with nothing else to reset.
 */
export async function $deleteAllDrainObservations(): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('drainObservations', 'readwrite');
		const store = transaction.objectStore('drainObservations');
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
