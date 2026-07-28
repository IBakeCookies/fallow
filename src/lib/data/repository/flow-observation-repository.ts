/**
 * CRUD access to the `flowObservations` object store — the measured
 * time-to-flow data points that personalize the model's c₁,c₂,c₃ constants.
 */

import type { FlowObservationRecord } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Upsert: re-logging the same task on the same day REPLACES the earlier
 * record instead of appending a duplicate. The ⚡ editor prefills the previous
 * value, so correcting a typo behaves like editing — a mistaken measurement
 * doesn't silently pollute the fit.
 */
export async function $updateFlowObservation(
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

			const record = existing
				? {
						...existing,
						...observation,
						createdAt: Date.now(),
					}
				: {
						...observation,
						createdAt: Date.now(),
					};

			store.put(record);
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
 * Delete ALL flow observations. The c₁,c₂,c₃ constants are always derived
 * from the observations (never stored), so this reverts the model to the
 * article defaults with nothing else to reset.
 */
export async function $deleteAllFlowObservations(): Promise<void> {
	return withStore('flowObservations', 'readwrite', (store) => {
		store.clear();
	});
}
