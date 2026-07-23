/**
 * CRUD access to the `restObservations` object store — the pre/post-rest
 * drain rating pairs that calibrate the energy model's recovery rate.
 */

import type { RestObservationRecord } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Append-only create: unlike drain ratings (one per task per day, upserted)
 * several breaks a day are normal, so every logged rest is its own record.
 * Typo correction happens by deleting the entry from the calibration list.
 */
export async function $createRestObservation(
	observation: Omit<RestObservationRecord, 'id' | 'createdAt'>
): Promise<void> {
	await withStore('restObservations', 'readwrite', (store) => {
		store.put({ ...observation, createdAt: Date.now() });
	});
}

export async function $readAllRestObservations(): Promise<RestObservationRecord[]> {
	const result = await withStore('restObservations', 'readonly', (store) => store.getAll());
	return result || [];
}

/** Remove a single rest pair from the calibration. */
export async function $deleteRestObservation(id: number): Promise<void> {
	await withStore('restObservations', 'readwrite', (store) => {
		store.delete(id);
	});
}

/**
 * Delete ALL rest pairs. The fitted recovery rate is always derived from the
 * observations (never stored), so this reverts the energy model's recovery
 * calibration to the defaults with nothing else to reset.
 */
export async function $deleteAllRestObservations(): Promise<void> {
	await withStore('restObservations', 'readwrite', (store) => {
		store.clear();
	});
}
