/**
 * CRUD access to the `restObservations` object store — the pre/post-rest
 * drain rating pairs that calibrate the energy model's recovery rate.
 */

import type { RestObservationRecord } from '$lib/data/type';
import { openDatabase } from '$lib/data/storage/indexed-db';

/**
 * Append-only create: unlike drain ratings (one per task per day, upserted)
 * several breaks a day are normal, so every logged rest is its own record.
 * Typo correction happens by deleting the entry from the calibration list.
 */
export async function $createRestObservation(
	observation: Omit<RestObservationRecord, 'id' | 'createdAt'>
): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('restObservations', 'readwrite');
		const store = transaction.objectStore('restObservations');
		const put = store.put({ ...observation, createdAt: Date.now() });
		put.onerror = () => reject(put.error);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
}

export async function $readAllRestObservations(): Promise<RestObservationRecord[]> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('restObservations', 'readonly');
		const store = transaction.objectStore('restObservations');
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

/** Remove a single rest pair from the calibration. */
export async function $deleteRestObservation(id: number): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('restObservations', 'readwrite');
		const store = transaction.objectStore('restObservations');
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

/**
 * Delete ALL rest pairs. The fitted recovery rate is always derived from the
 * observations (never stored), so this reverts the energy model's recovery
 * calibration to the defaults with nothing else to reset.
 */
export async function $deleteAllRestObservations(): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('restObservations', 'readwrite');
		const store = transaction.objectStore('restObservations');
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
