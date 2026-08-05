/**
 * CRUD access to the `drainObservations` object store — the end-of-session
 * drain ratings that calibrate the energy model's α drain rates.
 */

import type { DrainObservationRecord } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Append: every rating is its OWN session row, so a second session on a task
 * already rated today is a second record.
 *
 * NOT an upsert on (taskId, date), which is what this was until 2026-08-05:
 * `hours` is one session's length (§8.7 reads it as `H` from a full
 * reservoir), so replacing the record deleted the earlier session from the
 * day's worked hours — exactly the sum §8.10's stopping fit, §8.11's live
 * advisor and §12's audit read back (MATH.md §8.7). Both accumulators already
 * summed per (date, taskId); the writer was the thing that could never let
 * them fire twice.
 *
 * Correcting a rating is `$editDrainObservation` below, NOT re-logging: a
 * second log of the same session would double-count it in that sum.
 */
export async function $addDrainObservation(
	observation: Omit<DrainObservationRecord, 'id' | 'createdAt'>,
): Promise<void> {
	await withStore('drainObservations', 'readwrite', (store) => {
		store.add({
			...observation,
			createdAt: Date.now(),
		});
	});
}

/**
 * Correct one rating in place, by its own key — the row is the session, so
 * "which session" is never in doubt the way a (taskId, date) key left it.
 *
 * The edit keeps the ORIGINAL `createdAt`: a correction re-describes the same
 * session, so its log moment stands. That moment (≈ session end when logged
 * promptly) is the only time-of-day signal the drain data carries — the
 * instrument a future circadian modulation fit would condition on (MATH.md
 * §8.3) — and refreshing it on a next-morning fix would shift it by hours.
 *
 * A missing id is a no-op: the row can be deleted from the same card the
 * editor was opened from.
 */
export async function $editDrainObservation(
	id: number,
	observation: Omit<DrainObservationRecord, 'id' | 'createdAt'>,
): Promise<void> {
	await withStore('drainObservations', 'readwrite', (store) => {
		const existing = store.get(id);

		existing.onsuccess = () => {
			const record = existing.result as DrainObservationRecord | undefined;

			if (record === undefined) return;

			store.put({
				...record,
				...observation,
			});
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
