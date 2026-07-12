/**
 * CRUD access to the `routines` object store (saved task templates).
 */

import type { SavedRoutine } from '$lib/data/type';
import { openDatabase } from '$lib/data/storage/indexed-db';

/** Upsert: put() replaces the record for the same id, creating it if absent. */
export async function $updateRoutine(routine: SavedRoutine): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('routines', 'readwrite');
		const store = transaction.objectStore('routines');
		const request = store.put(routine);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function $readAllRoutines(): Promise<SavedRoutine[]> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('routines', 'readonly');
		const store = transaction.objectStore('routines');
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

export async function $deleteRoutine(id: string): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction('routines', 'readwrite');
		const store = transaction.objectStore('routines');
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
