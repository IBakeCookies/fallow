/**
 * CRUD access to the `restObservations` object store — the pre/post-rest
 * drain rating pairs that calibrate the energy model's recovery rate.
 */

import type { RestObservationRecord, Persisted } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Append-only create: several breaks a day are normal, so every logged rest is
 * its own record — the same one-row-per-event shape drain ratings have carried,
 * minus their task. Correcting one is `$updateRestObservation` below, NOT
 * re-logging: a second log of the same break would fit r twice off one recovery.
 */
export async function $createRestObservation(
	observation: Omit<RestObservationRecord, 'id' | 'createdAt'>,
): Promise<void> {
	await withStore('restObservations', 'readwrite', (store) => {
		store.put({
			...observation,
			createdAt: Date.now(),
		});
	});
}

/**
 * Correct one break in place, by its own key. Same contract as
 * `$updateDrainObservation`: the `date` and the original `createdAt` both stand,
 * because a correction re-describes the break that happened rather than taking a
 * new one. A break carries nothing derived from anything else — five numbers the
 * user typed — so those five are the whole of what an edit may touch.
 */
export async function $updateRestObservation(
	id: number,
	observation: Omit<RestObservationRecord, 'id' | 'createdAt' | 'date'>,
): Promise<void> {
	await withStore('restObservations', 'readwrite', (store) => {
		const existing = store.get(id);

		existing.onsuccess = () => {
			const record = existing.result as RestObservationRecord | undefined;

			if (record === undefined) return;

			store.put({
				...record,
				...observation,
			});
		};
	});
}

export async function $readAllRestObservations(): Promise<RestObservationRecord[]> {
	const result = await withStore('restObservations', 'readonly', (store) => store.getAll());

	return result || [];
}

/** Remove a single rest pair from the calibration. */
export async function $deleteRestObservation(id: number): Promise<void> {
	return withStore('restObservations', 'readwrite', (store) => {
		store.delete(id);
	});
}

/**
 * Put a dropped break back exactly as it was — what the ✕'s undo writes. Same
 * contract as `$restoreDrainObservation`: a re-log would be a second recovery for
 * §8.9 to fit r against, so the record comes back as itself, id and stamp included.
 */
export async function $restoreRestObservation(
	record: Persisted<RestObservationRecord>,
): Promise<void> {
	await withStore('restObservations', 'readwrite', (store) => {
		store.put(record);
	});
}

/**
 * Delete ALL rest pairs. The fitted recovery rate is always derived from the
 * observations (never stored), so this reverts the energy model's recovery
 * calibration to the defaults with nothing else to reset.
 */
export async function $deleteAllRestObservations(): Promise<void> {
	return withStore('restObservations', 'readwrite', (store) => {
		store.clear();
	});
}
