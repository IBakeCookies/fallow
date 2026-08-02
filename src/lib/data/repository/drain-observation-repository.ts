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
 *
 * Unlike the flow-log upsert, an edit keeps the ORIGINAL `createdAt`: a
 * correction re-describes the same session, so its log moment stands. That
 * moment (≈ session end when logged promptly) is the only time-of-day signal
 * the drain data carries — the instrument a future circadian modulation fit
 * would condition on — and refreshing it on a next-morning edit would shift
 * it by hours.
 */
export async function $updateDrainObservation(
	observation: Omit<DrainObservationRecord, 'id' | 'createdAt'>,
): Promise<void> {
	await withStore('drainObservations', 'readwrite', (store) => {
		// Same as the flow log's upsert: the key is (taskId, date), so read that
		// day's records through the `date` index and match taskId in memory rather
		// than scanning the whole store.
		const sameDay = store.index('date').getAll(observation.date);

		sameDay.onsuccess = () => {
			const existing = (sameDay.result as DrainObservationRecord[]).find(
				(record) => record.taskId === observation.taskId,
			);

			const record = existing
				? {
						...existing,
						...observation,
					}
				: {
						...observation,
						createdAt: Date.now(),
					};

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
