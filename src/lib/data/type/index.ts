/**
 * Persisted entities — the storage models of the data layer.
 *
 * These live at the bottom of the layer stack so both the repositories (data)
 * and the stores/models (business) can depend on them. Presentation code must
 * import them via `$lib/business/type`, never from here.
 */

/**
 * A record with its `autoIncrement` key. The interfaces below leave `id`
 * optional because that is how a record is written — the key does not exist
 * until IndexedDB assigns it — but consumers that key a list or delete a row
 * need to rely on one rather than asserting `id!` at every call site.
 *
 * Only the sanitizers in `business/model/persisted.ts` hand this out: they drop
 * records without a usable id, so the type is earned there. A repository read is
 * a raw `getAll()` and verifies nothing, so it promises the bare record.
 */
export type Persisted<T> = T & { id: number };

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
	// This task cannot move to another day (a deadline, someone else waiting).
	// The plan advisor never offers to defer it (MATH.md §14) and
	// `moveTaskToTomorrow` refuses it. A statement about TODAY, not about the
	// task's definition, so routines, day-imports and a cross-day move
	// deliberately do not carry it.
	mustDoToday?: boolean;
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

/**
 * One end-of-session drain rating: after `hours` on a task, how drained the
 * user rated each energy system (0 = fresh, 10 = completely spent). The
 * reservoir demands are captured AT LOGGING TIME (like E/β on flow logs), so
 * later slider edits don't silently rewrite past measurements. Feeds the
 * energy model's per-reservoir α drain-rate calibration.
 */
export interface DrainObservationRecord {
	id?: number; // autoIncrement key
	date: string; // YYYY-MM-DD
	taskId: number;
	taskTitle: string;
	hours: number; // session length worked before the rating
	cognitiveDemand: number; // wc = mentalDifficulty/10 when logged (0-1)
	physicalDemand: number; // wp = physicalDifficulty/10 when logged (0-1)
	mindDrain: number; // 0-10 rating of cognitive drain after the session
	bodyDrain: number; // 0-10 rating of physical drain after the session
	// Log moment, preserved across edits (≈ session end when logged promptly).
	// The time-of-day instrument a future circadian drain fit would need.
	createdAt: number;
}

/**
 * A named singleton setting. `value` is opaque here on purpose: the data layer
 * stores it, the business layer that owns the setting validates it on read
 * (persisted JSON is user-reachable and can be edited or restored from an old
 * backup). Kept in IndexedDB rather than localStorage so settings that are
 * really model inputs — the Energy Lab's parameters — are covered by backup.
 */
export interface SettingRecord {
	key: string;
	value: unknown;
	updatedAt: number;
}

/**
 * One day's fitted model parameters — what the model believed about the user on
 * that date (MATH.md §12). Only the values a FIT can move are stored: the rest
 * of `EnergyParams` is model constants, and copying those would freeze a
 * constant into history rather than record a measurement.
 *
 * Flat numbers rather than the business layer's `UserConstants` / `FitPosterior`
 * / `EnergyParams` shapes, because the data layer never imports upward (R1) and
 * mirroring those interfaces here is the R3 failure. `business/model/persisted.ts`
 * validates a record and composes it back into them.
 *
 * Keyed by date, and only TODAY's record is ever written: a past day's fit is
 * what the user actually had, so it is recorded once and never recomputed.
 */
export interface FitSnapshotRecord {
	date: string; // YYYY-MM-DD
	// The ϕ plane fitted from ⚡ flow logs (MATH.md §5.1)
	c1: number;
	c2: number;
	c3: number;
	// Posterior of that plane. Stored because a MISSING posterior means σ_ϕ = 0
	// downstream — a user with one ⚡ log read as perfectly certain (§13.1) — so a
	// snapshot without it would re-introduce exactly the bias it exists to remove.
	covariance: number[][];
	sigma2: number;
	// The energy-model rates fitted from ☕ / 🪫 logs (§8.7/§8.9)
	alphaCog: number;
	alphaPhys: number;
	recoveryRate: number;
	// Fitted λ₀ (§8.10). Not part of the fitted params: `EnergyParams.freeTimeValue`
	// keeps its default there, and the stopping fit reports λ₀ separately.
	stoppingValue: number;
	createdAt: number;
}

/**
 * One pre/post-rest rating pair: the user took a break of `hours` and rated
 * both energy systems going in and coming out (0 = fresh, 10 = completely
 * spent). Feeds the energy model's recovery-rate calibration — during pure
 * rest the drain decays as e^(−r·m·g), so the pair identifies r without
 * involving the α drain rates. Unlike drain ratings there is no task and no
 * per-day upsert key: several breaks a day are normal, so records append.
 */
export interface RestObservationRecord {
	id?: number; // autoIncrement key
	date: string; // YYYY-MM-DD
	hours: number; // break length
	mindBefore: number; // 0-10 cognitive drain going into the break
	mindAfter: number; // 0-10 cognitive drain coming out
	bodyBefore: number; // 0-10 physical drain going into the break
	bodyAfter: number; // 0-10 physical drain coming out
	createdAt: number;
}
