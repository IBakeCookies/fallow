/**
 * CRUD access to the `flowObservations` object store — the measured
 * time-to-flow data points that personalize the model's c₁,c₂,c₃ constants.
 */

import type { FlowObservationRecord, Persisted } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Upsert: re-logging the same task on the same day REPLACES the earlier
 * record instead of appending a duplicate. The ⚡ editor prefills the previous
 * value, so correcting a typo behaves like editing — a mistaken measurement
 * doesn't silently pollute the fit.
 *
 * This is the ROW's writer, addressed by (taskId, date) because that is all a row
 * has — hence `createOrUpdate`: the same call logs a day's first measurement and
 * replaces it. A correction addressed by record id goes through
 * `$updateFlowObservation` below — not through here with the record spread back
 * in, which looks equivalent and is not: if the record has since been deleted,
 * the not-found branch INSERTS it again under its own id with a fresh stamp, so a
 * stale ✎ would resurrect a dropped measurement into the fit.
 */
export async function $createOrUpdateFlowObservation(
	observation: Omit<FlowObservationRecord, 'id' | 'createdAt'>,
): Promise<void> {
	await withStore('flowObservations', 'readwrite', (store) => {
		// The upsert key is (taskId, date) and only `date` is indexed, so read that
		// day's handful of records and match taskId in memory — a whole-store scan
		// would read years of history that can never match, and a compound index
		// would cost a schema version.
		const sameDay = store.index('date').getAll(observation.date);

		sameDay.onsuccess = () => {
			const existing = (sameDay.result as FlowObservationRecord[]).find(
				(record) => record.taskId === observation.taskId,
			);

			// A replacement keeps the existing stamp: it re-describes the measurement
			// already there rather than taking a new one, which is the rule 🪫
			// corrections follow too (MATH.md §18). Only a first log is stamped now.
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

/**
 * Correct one measurement in place, by its own key — the analytics ✎, which has a
 * record id and no viewed day. Same contract as `$updateDrainObservation` and
 * `$updateRestObservation`: the `date`, the original `createdAt` and the covariates
 * captured at logging time all stand, so the only field a correction may touch is
 * the quantity the user measured (MATH.md §36).
 *
 * A missing id is a no-op, and that is the whole reason this exists beside the
 * create-or-update above: the row's writer would re-create the record instead.
 */
export async function $updateFlowObservation(
	id: number,
	observation: Pick<FlowObservationRecord, 'phiHours'>,
): Promise<void> {
	await withStore('flowObservations', 'readwrite', (store) => {
		const existing = store.get(id);

		existing.onsuccess = () => {
			const record = existing.result as FlowObservationRecord | undefined;

			if (record === undefined) return;

			store.put({
				...record,
				...observation,
			});
		};
	});
}

export async function $readAllFlowObservations(): Promise<FlowObservationRecord[]> {
	const result = await withStore('flowObservations', 'readonly', (store) => store.getAll());

	return result || [];
}

/** Remove a single measured data point from the personalization fit. */
export async function $deleteFlowObservation(id: number): Promise<void> {
	return withStore('flowObservations', 'readwrite', (store) => {
		store.delete(id);
	});
}

/**
 * Put a dropped measurement back exactly as it was — what the ✕'s undo writes.
 * Same contract as `$restoreDrainObservation`, and the same reason it is not the
 * writer above: the upsert is addressed by (taskId, date) and would re-insert
 * under a fresh id and a fresh stamp.
 *
 * Unlike 🪫 and 😴, a task-day holds at most ONE ⚡ — so if the user re-logged
 * that day while the undo toast was still up, the restore is dropped rather than
 * put back beside it: the newer measurement is the one they meant, and a second
 * record would feed two conflicting φ points for one task-day into the fit with
 * no way for the row to address the older one again.
 */
export async function $restoreFlowObservation(
	record: Persisted<FlowObservationRecord>,
): Promise<void> {
	await withStore('flowObservations', 'readwrite', (store) => {
		const sameDay = store.index('date').getAll(record.date);

		sameDay.onsuccess = () => {
			const superseded = (sameDay.result as Persisted<FlowObservationRecord>[]).some(
				(other) => other.taskId === record.taskId && other.id !== record.id,
			);

			if (superseded) return;

			store.put(record);
		};
	});
}

/**
 * Delete ALL flow observations. The c₁,c₂,c₃ constants are always derived
 * from the observations (never stored), so this reverts the model to the
 * article defaults with nothing else to reset.
 */
export async function $deleteAllFlowObservations(): Promise<void> {
	return withStore('flowObservations', 'readwrite', (store) => {
		store.clear();
	});
}
