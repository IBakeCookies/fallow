/**
 * CRUD access to the `sessions` object store (one record per calendar day).
 *
 * Auto-cleanup policy: sessions untouched for over a year are deleted via
 * $deleteExpiredSessions, called from the business layer on startup.
 */

import type { DailySession } from '$lib/data/type';
import { openDatabase } from '$lib/data/storage/indexed-db';

/** Upsert: put() replaces the record for the same date, creating it if absent. */
export async function $updateSession(session: DailySession): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('sessions', 'readwrite');
		const store = transaction.objectStore('sessions');
		const request = store.put({ ...session, updatedAt: Date.now() });
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function $readSessionByDate(date: string): Promise<DailySession | null> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('sessions', 'readonly');
		const store = transaction.objectStore('sessions');
		const request = store.get(date);
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
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
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('sessions', 'readonly');
		const store = transaction.objectStore('sessions');
		const request = store.getAll(IDBKeyRange.bound(startDate, endDate));
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

/** Delete sessions not updated for over a year; returns the number removed. */
export async function $deleteExpiredSessions(): Promise<number> {
	const database = await openDatabase();
	const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
	let deletedCount = 0;

	return new Promise((resolve, reject) => {
		const transaction = database.transaction('sessions', 'readwrite');
		const store = transaction.objectStore('sessions');
		const index = store.index('updatedAt');
		const range = IDBKeyRange.upperBound(oneYearAgo);
		const request = index.openCursor(range);

		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor) {
				cursor.delete();
				deletedCount++;
				cursor.continue();
			}
		};

		transaction.oncomplete = () => resolve(deletedCount);
		transaction.onerror = () => reject(transaction.error);
	});
}
