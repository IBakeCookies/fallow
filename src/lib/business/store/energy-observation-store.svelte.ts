import { getContext, setContext, onMount } from 'svelte';
import type { Task, DrainObservationRecord, RestObservationRecord } from '$lib/data/type';
// Namespace imports: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes), but property access
// on a namespace is fine.
import * as drainObservationRepository from '$lib/data/repository/drain-observation-repository';
import * as restObservationRepository from '$lib/data/repository/rest-observation-repository';
import { liveToday } from '$lib/business/state/today.svelte';
import type { StorageErrorKind } from '$lib/business/store/session-store.svelte';

const CONTEXT_KEY = Symbol();

/** Looks up the day's tasks — a drain rating captures the rated task's demands. */
export type ReadTasks = () => Task[];

/**
 * Raises the app-wide persistence banner, which the session store owns: one
 * place a storage failure shows up rather than one banner per store.
 */
export type ReportStorageError = (kind: StorageErrorKind) => void;

/**
 * Drain and rest observations: the measurements that calibrate the energy
 * model's drain rates α and recovery rate r (MATH.md §8.7/§8.9).
 *
 * Separate from the session store because it shares none of that store's
 * state. A measurement is stamped with the live clock's today, never the viewed
 * day, so none of the date-routing, load or auto-save machinery applies — and
 * the two things it does need (a task lookup, somewhere to report a failed
 * write) are injected, so it owns no session state either.
 *
 * Flow observations deliberately stay in the session store: logging one stamps
 * `flowMinutes` onto the task, which is persisted with the day's session.
 *
 * Created via context in the (app) layout — never at module scope, so no state
 * can leak between SSR requests.
 */
export class EnergyObservationStore {
	#drainObservations = $state<DrainObservationRecord[]>([]);
	#restObservations = $state<RestObservationRecord[]>([]);

	#readTasks: ReadTasks;
	#reportStorageError: ReportStorageError;

	constructor(readTasks: ReadTasks, reportStorageError: ReportStorageError) {
		this.#readTasks = readTasks;
		this.#reportStorageError = reportStorageError;

		// No `initializeStorage()` here: the localStorage migration it runs writes
		// only sessions and the energy params, never these two stores, so this read
		// needs no ordering against it.
		onMount(() => {
			this.#load();
		});
	}

	async #load() {
		try {
			this.#drainObservations = await drainObservationRepository.$readAllDrainObservations();
			this.#restObservations = await restObservationRepository.$readAllRestObservations();
		} catch (e) {
			console.error('Failed to load energy observations', e);
			this.#reportStorageError('load-failed');
		}
	}

	/** Re-run the initial read — the banner's retry action covers this store too. */
	retryLoad() {
		this.#load();
	}

	get drainObservations() {
		return this.#drainObservations;
	}
	get restObservations() {
		return this.#restObservations;
	}

	// ----- Drain observations (energy-model α calibration) -----

	// Log an end-of-session drain rating for a task: after `hours` of work,
	// how drained body and mind feel (0–10). Captures the task's reservoir
	// demands at logging time; re-rating the same task today REPLACES the
	// earlier record (typo correction), mirroring logFlow. Today-only because it
	// is a measurement, not a plan.
	async logDrain(id: number, hours: number, mindDrain: number, bodyDrain: number) {
		const task = this.#readTasks().find((t) => t.id === id);
		if (!task) return;

		try {
			await drainObservationRepository.$updateDrainObservation({
				date: liveToday.value,
				taskId: id,
				taskTitle: task.title,
				hours,
				cognitiveDemand: task.mentalDifficulty / 10,
				physicalDemand: task.physicalDifficulty / 10,
				mindDrain,
				bodyDrain
			});
			this.#drainObservations = await drainObservationRepository.$readAllDrainObservations();
		} catch (e) {
			console.error('Failed to save drain observation', e);
			this.#reportStorageError('save-failed');
		}
	}

	// Remove one drain rating; any fitted α values are derived from the
	// observations, so consumers refit automatically.
	async deleteDrainLog(id: number) {
		try {
			await drainObservationRepository.$deleteDrainObservation(id);
			this.#drainObservations = await drainObservationRepository.$readAllDrainObservations();
		} catch (e) {
			console.error('Failed to delete drain observation', e);
			this.#reportStorageError('save-failed');
		}
	}

	// Delete all drain ratings → the energy model's drain calibration reverts
	// to whatever the lab parameters say.
	async resetDrainLogs() {
		try {
			await drainObservationRepository.$deleteAllDrainObservations();
			this.#drainObservations = [];
		} catch (e) {
			console.error('Failed to reset drain observations', e);
			this.#reportStorageError('save-failed');
		}
	}

	// ----- Rest observations (energy-model recovery calibration) -----

	// Log a pre/post-rest rating pair: a break of `hours`, with both energy
	// systems rated going in and coming out (0–10). Not tied to a task, and
	// appended rather than upserted — several breaks a day are normal.
	// Today-only like the other measurements.
	async logRest(
		hours: number,
		mindBefore: number,
		mindAfter: number,
		bodyBefore: number,
		bodyAfter: number
	) {
		try {
			await restObservationRepository.$createRestObservation({
				date: liveToday.value,
				hours,
				mindBefore,
				mindAfter,
				bodyBefore,
				bodyAfter
			});
			this.#restObservations = await restObservationRepository.$readAllRestObservations();
		} catch (e) {
			console.error('Failed to save rest observation', e);
			this.#reportStorageError('save-failed');
		}
	}

	// Remove one rest pair; the fitted recovery rate is derived from the
	// observations, so consumers refit automatically.
	async deleteRestLog(id: number) {
		try {
			await restObservationRepository.$deleteRestObservation(id);
			this.#restObservations = await restObservationRepository.$readAllRestObservations();
		} catch (e) {
			console.error('Failed to delete rest observation', e);
			this.#reportStorageError('save-failed');
		}
	}

	// Delete all rest pairs → the energy model's recovery calibration reverts
	// to whatever the lab parameters say.
	async resetRestLogs() {
		try {
			await restObservationRepository.$deleteAllRestObservations();
			this.#restObservations = [];
		} catch (e) {
			console.error('Failed to reset rest observations', e);
			this.#reportStorageError('save-failed');
		}
	}
}

export function setEnergyObservationStore(
	readTasks: ReadTasks,
	reportStorageError: ReportStorageError
): EnergyObservationStore {
	return setContext<EnergyObservationStore>(
		CONTEXT_KEY,
		new EnergyObservationStore(readTasks, reportStorageError)
	);
}

export function getEnergyObservationStore(): EnergyObservationStore {
	return getContext<EnergyObservationStore>(CONTEXT_KEY);
}
