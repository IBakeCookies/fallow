/**
 * CRUD access to the `fitSnapshots` object store — one record per day holding
 * the model parameters fitted that day (MATH.md §12).
 */

import type { FitSnapshotRecord } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/**
 * Upsert: put() replaces the record for the same date, creating it if absent.
 * Callers only ever record TODAY, so a replacement is a fresher belief about the
 * day in progress — never a rewrite of a finished day's history.
 *
 * `createdAt` moves with it, unlike the drain log's upsert: that one corrects a
 * single measurement and keeps its original moment, while this records the fit
 * as it stands now.
 */
export async function $updateFitSnapshot(
	snapshot: Omit<FitSnapshotRecord, 'createdAt'>,
): Promise<void> {
	await withStore('fitSnapshots', 'readwrite', (store) => {
		store.put({
			...snapshot,
			createdAt: Date.now(),
		});
	});
}

/**
 * All snapshots with startDate ≤ date ≤ endDate (inclusive), sorted ascending.
 * The store's keyPath IS the ISO date, so lexicographic key order is
 * chronological order and no index is needed.
 */
export async function $readFitSnapshotsByDateRange(
	startDate: string,
	endDate: string,
): Promise<FitSnapshotRecord[]> {
	const result = await withStore('fitSnapshots', 'readonly', (store) =>
		store.getAll(IDBKeyRange.bound(startDate, endDate)),
	);

	return result || [];
}
