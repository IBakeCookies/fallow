/**
 * IndexedDB persistence layer for Zenith
 *
 * Stores:
 * - Daily sessions (tasks, settings for each day)
 * - Saved routines (task templates)
 * - Flow observations (measured time-to-flow data points that personalize
 *   the model's c₁,c₂,c₃ constants via least squares)
 *
 * Auto-cleanup: Sessions older than 1 year are deleted on init
 */

import type { Task } from '$lib/metrics/calculations';
import { DEFAULT_SWITCH_COST } from '$lib/zenith';

const DB_NAME = 'zenith-db';
const DB_VERSION = 2;

export interface DailySession {
	date: string; // YYYY-MM-DD
	tasks: Task[];
	availableHours: number;
	switchCost: number;
	// Capacity pools (optional: sessions saved before pools were configurable
	// fall back to DEFAULT_CAPACITY_POOLS on load)
	cognitivePool?: number;
	physicalPool?: number;
	updatedAt: number; // timestamp
}

export interface SavedRoutine {
	id: string;
	name: string;
	tasks: Omit<Task, 'id' | 'createdAt' | 'completed'>[];
	createdAt: number;
}

/**
 * One measured (E, β, ϕ) data point: how long a task actually took to reach
 * flow state. E/β are the MAPPED Zenith values at logging time (what the
 * regression needs); the raw slider values are kept for provenance.
 */
export interface FlowObservationRecord {
	id?: number; // autoIncrement key
	date: string; // YYYY-MM-DD
	taskId: number;
	taskTitle: string;
	difficulty: number; // effective Eᵤ (1-10) when logged
	enjoyment: number; // βᵤ (1-10) when logged
	E: number; // mapped effort (1-5)
	beta: number; // mapped enjoyability (1-2)
	phiHours: number; // measured time to flow, in hours
	createdAt: number;
}

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
	if (dbInstance) return Promise.resolve(dbInstance);

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);

		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Daily sessions store - keyed by date
			if (!db.objectStoreNames.contains('sessions')) {
				const sessionStore = db.createObjectStore('sessions', { keyPath: 'date' });
				sessionStore.createIndex('updatedAt', 'updatedAt');
			}

			// Saved routines store
			if (!db.objectStoreNames.contains('routines')) {
				db.createObjectStore('routines', { keyPath: 'id' });
			}

			// Flow observations store (v2) - measured time-to-flow data points
			if (!db.objectStoreNames.contains('flowObservations')) {
				const flowStore = db.createObjectStore('flowObservations', {
					keyPath: 'id',
					autoIncrement: true
				});
				flowStore.createIndex('date', 'date');
			}
		};
	});
}

// ================== Sessions ==================

export async function saveSession(session: DailySession): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readwrite');
		const store = tx.objectStore('sessions');
		const request = store.put({ ...session, updatedAt: Date.now() });
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getSession(date: string): Promise<DailySession | null> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readonly');
		const store = tx.objectStore('sessions');
		const request = store.get(date);
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
}

export async function getYesterdaySession(): Promise<DailySession | null> {
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const dateStr = yesterday.toISOString().slice(0, 10);
	return getSession(dateStr);
}

export async function getAllSessionDates(): Promise<string[]> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readonly');
		const store = tx.objectStore('sessions');
		const request = store.getAllKeys();
		request.onsuccess = () => resolve(request.result as string[]);
		request.onerror = () => reject(request.error);
	});
}

export async function getRecentSessions(days: number = 7): Promise<DailySession[]> {
	const db = await getDB();
	const sessions: DailySession[] = [];

	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readonly');
		const store = tx.objectStore('sessions');
		const request = store.openCursor(null, 'prev');

		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor && sessions.length < days) {
				sessions.push(cursor.value);
				cursor.continue();
			} else {
				resolve(sessions);
			}
		};
		request.onerror = () => reject(request.error);
	});
}

export async function cleanupOldSessions(): Promise<number> {
	const db = await getDB();
	const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
	let deletedCount = 0;

	return new Promise((resolve, reject) => {
		const tx = db.transaction('sessions', 'readwrite');
		const store = tx.objectStore('sessions');
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

		tx.oncomplete = () => resolve(deletedCount);
		tx.onerror = () => reject(tx.error);
	});
}

// ================== Routines ==================

export async function saveRoutine(routine: SavedRoutine): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('routines', 'readwrite');
		const store = tx.objectStore('routines');
		const request = store.put(routine);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getRoutine(id: string): Promise<SavedRoutine | null> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('routines', 'readonly');
		const store = tx.objectStore('routines');
		const request = store.get(id);
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
}

export async function getAllRoutines(): Promise<SavedRoutine[]> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('routines', 'readonly');
		const store = tx.objectStore('routines');
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

export async function deleteRoutine(id: string): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('routines', 'readwrite');
		const store = tx.objectStore('routines');
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

// ================== Flow Observations ==================

/**
 * Save a flow observation with UPSERT semantics: re-logging the same task on
 * the same day REPLACES the earlier record instead of appending a duplicate.
 * The ⚡ editor prefills the previous value, so correcting a typo behaves
 * like editing — a mistaken measurement doesn't silently pollute the fit.
 */
export async function saveFlowObservation(
	observation: Omit<FlowObservationRecord, 'id' | 'createdAt'>
): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('flowObservations', 'readwrite');
		const store = tx.objectStore('flowObservations');
		// The store is small (one record per task per day), so a scan for the
		// existing record beats maintaining a compound index + schema migration.
		const getAll = store.getAll();
		getAll.onsuccess = () => {
			const existing = (getAll.result as FlowObservationRecord[]).find(
				(r) => r.taskId === observation.taskId && r.date === observation.date
			);
			const record = existing
				? { ...existing, ...observation, createdAt: Date.now() }
				: { ...observation, createdAt: Date.now() };
			const put = store.put(record);
			put.onerror = () => reject(put.error);
		};
		getAll.onerror = () => reject(getAll.error);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/** Remove a single measured data point from the personalization fit. */
export async function deleteFlowObservation(id: number): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('flowObservations', 'readwrite');
		const store = tx.objectStore('flowObservations');
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
export async function clearFlowObservations(): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('flowObservations', 'readwrite');
		const store = tx.objectStore('flowObservations');
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getAllFlowObservations(): Promise<FlowObservationRecord[]> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('flowObservations', 'readonly');
		const store = tx.objectStore('flowObservations');
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result || []);
		request.onerror = () => reject(request.error);
	});
}

// ================== Migration ==================

/**
 * Migrate data from old localStorage format to IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
	const storageKey = 'zenith-daily-tasks';
	const migrationKey = 'zenith-migrated-to-idb';

	if (typeof localStorage === 'undefined') return false;
	if (localStorage.getItem(migrationKey)) return false;

	const oldData = localStorage.getItem(storageKey);
	if (!oldData) {
		localStorage.setItem(migrationKey, 'true');
		return false;
	}

	try {
		const parsed = JSON.parse(oldData);
		const today = new Date().toISOString().slice(0, 10);

		await saveSession({
			date: today,
			tasks: parsed.tasks || [],
			availableHours: parsed.availableHours || 0,
			switchCost: parsed.switchCost ?? DEFAULT_SWITCH_COST,
			updatedAt: Date.now()
		});

		localStorage.setItem(migrationKey, 'true');
		// Keep old data for safety, can be cleaned up later
		return true;
	} catch {
		return false;
	}
}

// ================== Initialization ==================

export async function initDB(): Promise<void> {
	await getDB();
	await migrateFromLocalStorage();
	const deleted = await cleanupOldSessions();
	if (deleted > 0) {
		console.log(`Cleaned up ${deleted} old sessions`);
	}
}
