import { getContext, setContext, onMount } from 'svelte';
import type {
	Persisted,
	Task,
	DrainObservationRecord,
	RestObservationRecord,
} from '$lib/data/type';
import { logError } from '$lib/logger';
// Namespace imports: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes), but property access
// on a namespace is fine.
import * as drainObservationRepository from '$lib/data/repository/drain-observation-repository';
import * as restObservationRepository from '$lib/data/repository/rest-observation-repository';
import { liveToday } from '$lib/business/state/today.svelte';
import { sanitizeDrainObservations, sanitizeRestObservations } from '$lib/business/model/persisted';
import type {
	StorageReporter,
	StorageStatusStore,
} from '$lib/business/store/storage-status.svelte';

const CONTEXT_KEY = Symbol();

/** Looks up the day's tasks — a drain rating captures the rated task's demands. */
export type ReadTasks = () => Task[];

/**
 * Drain and rest observations: the measurements that calibrate the energy
 * model's drain rates α and recovery rate r (MATH.md §8.7/§8.9).
 *
 * Separate from the session store because it shares none of that store's
 * state. A measurement is stamped with the live clock's today, never the viewed
 * day, so none of the date-routing, load or auto-save machinery applies — and
 * the one thing it needs from the session (a task lookup) is injected, so it
 * owns no session state either. Failures go to the app-wide banner's own store,
 * not through the session's.
 *
 * Flow observations deliberately stay in the session store: logging one reads the
 * VIEWED day and that day's task to write it, which is this store's one blind spot —
 * it has no notion of a viewed day and must not grow one.
 *
 * Created via context in the (app) layout — never at module scope, so no state
 * can leak between SSR requests.
 */
export class EnergyObservationStore {
	#drainObservations = $state<Persisted<DrainObservationRecord>[]>([]);
	#restObservations = $state<Persisted<RestObservationRecord>[]>([]);
	/** Whether the first read is still in flight — see the getter. */
	#isLoading = $state(true);

	#readTasks: ReadTasks;
	#reporter: StorageReporter;

	constructor(readTasks: ReadTasks, status: StorageStatusStore) {
		this.#readTasks = readTasks;
		this.#reporter = status.register('energyObservations', () => this.retryLoad());

		// No `initializeStorage()` here: the localStorage migration it runs writes
		// only sessions and the energy params, never these two stores, so this read
		// needs no ordering against it.
		onMount(() => {
			this.#load();
		});
	}

	// Every read of these two stores goes through the sanitizers: the records feed
	// the α and r fits, where one corrupt number would make every fitted energy
	// parameter NaN (AGENTS.md R4).
	async #readDrain(): Promise<Persisted<DrainObservationRecord>[]> {
		return sanitizeDrainObservations(await drainObservationRepository.$readAllDrainObservations());
	}

	async #readRest(): Promise<Persisted<RestObservationRecord>[]> {
		return sanitizeRestObservations(await restObservationRepository.$readAllRestObservations());
	}

	async #load() {
		try {
			// Read both before assigning either: a failure half-way through would
			// otherwise leave one log replaced and the other stale behind the
			// load-failed banner. Independent stores, so they read in parallel.
			const [drain, rest] = await Promise.all([this.#readDrain(), this.#readRest()]);

			this.#drainObservations = drain;
			this.#restObservations = rest;
			// Both logs are readable again, so this store's own failure is over —
			// which nothing else can say for it, and nothing else may say for it.
			this.#reporter.clearLoadFailure();
		} catch (e) {
			logError('Failed to load energy observations', e);
			this.#reporter.report('load-failed');
		} finally {
			// Also on the failing path: the banner already says the read failed, and a
			// list still promising "loading" beside it contradicts it.
			this.#isLoading = false;
		}
	}

	/** Re-run the initial read — the banner's retry action covers this store too. */
	retryLoad() {
		this.#load();
	}

	/**
	 * Whether the first read is still in flight. A screen that LISTS the logs needs
	 * it: both arrays read empty until the read lands, so "nothing logged" and "not
	 * read yet" are the same value, and only this says which. The fits do not — an
	 * unfitted parameter and a fitted one are already different states.
	 *
	 * Stays false through `retryLoad()`: a re-read replaces logs the screen is
	 * already showing, and flipping it back would blank them to say so.
	 */
	get isLoading() {
		return this.#isLoading;
	}

	get drainObservations() {
		return this.#drainObservations;
	}

	/**
	 * One day's 🪫 ratings, per task — never "the" rating: a task worked in two
	 * sessions has two (MATH.md §8.7), and the row shows them individually because
	 * picking one is how a correction says which session it means. Owned here rather
	 * than folded by each page, because both screens read it and asking it twice is
	 * how the two drift.
	 *
	 * Takes the day rather than reading the live clock: the main page renders any
	 * date, and a row must show the ratings of the day it is showing. Writes still
	 * stamp `liveToday` — this store has no notion of a viewed day and must not.
	 *
	 * A plain `Map`, not a `SvelteMap`: it is rebuilt on every read from `$state`
	 * observations, so the reactivity is already the array's — a reactive Map here
	 * would be a second source of truth for a value nothing mutates in place.
	 */
	drainLogsOn(date: string): ReadonlyMap<number, Persisted<DrainObservationRecord>[]> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived, never mutated
		const byTask = new Map<number, Persisted<DrainObservationRecord>[]>();

		for (const log of this.#drainObservations) {
			if (log.date !== date) continue;

			const logs = byTask.get(log.taskId);

			if (logs) logs.push(log);
			else byTask.set(log.taskId, [log]);
		}

		return byTask;
	}

	get restObservations() {
		return this.#restObservations;
	}

	// ----- Drain observations (energy-model α calibration) -----

	// Log an end-of-session drain rating for a task: after `hours` of work,
	// how drained body and mind feel (0–10). Captures the task's reservoir
	// demands at logging time. One record per SESSION — a second session on a
	// task already rated today appends rather than replacing, because the
	// day's worked hours are the sum of its sessions (MATH.md §8.7); unlike
	// logFlow, which upserts because time-to-flow is one number per day.
	// Today-only because it is a measurement, not a plan.
	async logDrain(id: number, hours: number, mindDrain: number, bodyDrain: number) {
		const task = this.#readTasks().find((t) => t.id === id);

		// A rating needs the task's demands, so an id the day no longer holds (a
		// task deleted while the rating dialog was open) is nothing to log, not a
		// storage failure — drop it silently rather than raise the banner.
		if (!task) return;

		try {
			await drainObservationRepository.$addDrainObservation({
				date: liveToday.value,
				taskId: id,
				taskTitle: task.title,
				hours,
				cognitiveDemand: task.mentalDifficulty / 10,
				physicalDemand: task.physicalDifficulty / 10,
				mindDrain,
				bodyDrain,
			});

			this.#drainObservations = await this.#readDrain();
		} catch (e) {
			logError('Failed to save drain observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Correct one already-logged session in place. Separate from logDrain
	// because appending a corrected copy would count the session twice — the
	// row IS the session now (MATH.md §18).
	//
	// It writes the three numbers the editor asked for and nothing else. No `date`,
	// because a correction re-describes a session that already happened, so it stays
	// on the day it was logged even when that day is not today. And no task lookup
	// (2026-08-10): the demands on the record were captured at logging time precisely
	// so a task edited afterwards cannot rewrite what an earlier session measured, and
	// re-deriving them here is that rewrite by another route. Which is what makes a
	// correction addressable by record id alone — the analytics history corrects a
	// rating whose task no day in view holds, or that no day holds at all.
	async editDrainLog(recordId: number, hours: number, mind: number, body: number) {
		try {
			await drainObservationRepository.$editDrainObservation(recordId, {
				hours,
				mindDrain: mind,
				bodyDrain: body,
			});

			this.#drainObservations = await this.#readDrain();
		} catch (e) {
			logError('Failed to save drain observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Remove one drain rating; any fitted α values are derived from the
	// observations, so consumers refit automatically.
	async deleteDrainLog(id: number) {
		try {
			await drainObservationRepository.$deleteDrainObservation(id);
			this.#drainObservations = await this.#readDrain();
		} catch (e) {
			logError('Failed to delete drain observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Delete all drain ratings → the energy model's drain calibration reverts
	// to whatever the lab parameters say.
	async resetDrainLogs() {
		try {
			await drainObservationRepository.$deleteAllDrainObservations();
			this.#drainObservations = [];
		} catch (e) {
			logError('Failed to reset drain observations', e);
			this.#reporter.report('save-failed');
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
		bodyAfter: number,
	) {
		try {
			await restObservationRepository.$createRestObservation({
				date: liveToday.value,
				hours,
				mindBefore,
				mindAfter,
				bodyBefore,
				bodyAfter,
			});

			this.#restObservations = await this.#readRest();
		} catch (e) {
			logError('Failed to save rest observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Correct one already-logged break in place, for the reason editDrainLog is not a
	// re-log: appending would fit r twice off one recovery. A break has no task and so
	// no row on either screen — the analytics history is the only place it can be
	// corrected from, which is why this arrived with that list's ✎ (2026-08-10) while
	// the other two kinds had a chip years earlier. The day it was taken stands.
	async editRestLog(
		recordId: number,
		entry: {
			hours: number;
			mindBefore: number;
			mindAfter: number;
			bodyBefore: number;
			bodyAfter: number;
		},
	) {
		try {
			await restObservationRepository.$editRestObservation(recordId, entry);

			this.#restObservations = await this.#readRest();
		} catch (e) {
			logError('Failed to save rest observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Remove one rest pair; the fitted recovery rate is derived from the
	// observations, so consumers refit automatically.
	async deleteRestLog(id: number) {
		try {
			await restObservationRepository.$deleteRestObservation(id);
			this.#restObservations = await this.#readRest();
		} catch (e) {
			logError('Failed to delete rest observation', e);
			this.#reporter.report('save-failed');
		}
	}

	// Delete all rest pairs → the energy model's recovery calibration reverts
	// to whatever the lab parameters say.
	async resetRestLogs() {
		try {
			await restObservationRepository.$deleteAllRestObservations();
			this.#restObservations = [];
		} catch (e) {
			logError('Failed to reset rest observations', e);
			this.#reporter.report('save-failed');
		}
	}
}

export function setEnergyObservationStore(
	readTasks: ReadTasks,
	status: StorageStatusStore,
): EnergyObservationStore {
	return setContext<EnergyObservationStore>(
		CONTEXT_KEY,
		new EnergyObservationStore(readTasks, status),
	);
}

export function getEnergyObservationStore(): EnergyObservationStore {
	return getContext<EnergyObservationStore>(CONTEXT_KEY);
}
