/**
 * CRUD access to the `flowObservations` object store — the measured
 * time-to-flow data points that personalize the model's c₁,c₂,c₃ constants.
 */

import type { FlowObservationRecord } from '$lib/data/type';
import { openDatabase } from '$lib/data/storage/indexed-db';

/**
 * Upsert: re-logging the same task on the same day REPLACES the earlier
 * record instead of appending a duplicate. The ⚡ editor prefills the previous
 * value, so correcting a typo behaves like editing — a mistaken measurement
 * doesn't silently pollute the fit.
 */
export async function $updateFlowObservation(
	observation: Omit<FlowObservationRecord, 'id' | 'createdAt'>
): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('flowObservations', 'readwrite');
		const store = transaction.objectStore('flowObservations');
		// The store is small (one record per task per day), so a scan for the
		// existing record beats maintaining a compound index + schema migration.
		const getAll = store.getAll();
		getAll.onsuccess = () => {
			const existing = (getAll.result as FlowObservationRecord[]).find(
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

export async function $readAllFlowObservations(): Promise<FlowObservationRecord[]> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('flowObservations', 'readonly');
		const store = transaction.objectStore('flowObservations');
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

/** Remove a single measured data point from the personalization fit. */
export async function $deleteFlowObservation(id: number): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('flowObservations', 'readwrite');
		const store = transaction.objectStore('flowObservations');
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

/**
 * Delete ALL flow observations. The c₁,c₂,c₃ constants are always derived
 * from the observations (never stored), so this reverts the model to the
 * article defaults with nothing else to reset.
 */
export async function $deleteAllFlowObservations(): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('flowObservations', 'readwrite');
		const store = transaction.objectStore('flowObservations');
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
