/**
 * CRUD access to the `sessions` object store (one record per calendar day).
 */

import type { DailySession } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/** Upsert: put() replaces the record for the same date, creating it if absent. */
export async function $updateSession(session: DailySession): Promise<void> {
	await withStore('sessions', 'readwrite', (store) => {
		store.put({ ...session, updatedAt: Date.now() });
	});
}

export async function $readSessionByDate(date: string): Promise<DailySession | null> {
	const result = await withStore('sessions', 'readonly', (store) => store.get(date));
	return result || null;
}

/**
 * All sessions with startDate ≤ date ≤ endDate (inclusive), sorted ascending.
 * Dates are YYYY-MM-DD strings (the store's keyPath), so lexicographic key
 * order IS chronological order.
 */
export async function $readSessionsByDateRange(
	startDate: string,
	endDate: string
): Promise<DailySession[]> {
	const result = await withStore('sessions', 'readonly', (store) =>
		store.getAll(IDBKeyRange.bound(startDate, endDate))
	);
	return result || [];
}
