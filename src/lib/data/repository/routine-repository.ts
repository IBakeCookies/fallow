/**
 * CRUD access to the `routines` object store (saved task templates).
 */

import type { SavedRoutine } from '$lib/data/type';
import { withStore } from '$lib/data/storage/indexed-db';

/** Upsert: put() replaces the record for the same id, creating it if absent. */
export async function $updateRoutine(routine: SavedRoutine): Promise<void> {
	await withStore('routines', 'readwrite', (store) => {
		store.put(routine);
	});
}

export async function $readAllRoutines(): Promise<SavedRoutine[]> {
	const result = await withStore('routines', 'readonly', (store) => store.getAll());
	return result || [];
}

export async function $deleteRoutine(id: string): Promise<void> {
	await withStore('routines', 'readwrite', (store) => {
		store.delete(id);
	});
}
