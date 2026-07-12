/**
 * Persisted entities — the storage models of the data layer.
 *
 * These live at the bottom of the layer stack so both the repositories (data)
 * and the stores/models (business) can depend on them. Presentation code must
 * import them via `$lib/business/type`, never from here.
 */

export type Task = {
	id: number;
	title: string;
	physicalDifficulty: number;
	mentalDifficulty: number;
	enjoyment: number;
	createdAt: string;
	completed: boolean;
	// Measured minutes until flow state, if the user logged one for this task.
	// Feeds the least-squares personalization of the c₁,c₂,c₃ constants.
	flowMinutes?: number;
};

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
