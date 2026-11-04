import { getContext, onMount, setContext } from 'svelte';
import { logError } from '$lib/logger';
// Namespace import: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes).
import * as settingsRepository from '$lib/data/repository/settings-repository';
import { ENERGY_PARAMS_SETTING } from '$lib/data/repository/settings-repository';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import type { StorageStatusStore } from '$lib/business/store/storage-status.svelte';
import {
	createDebouncedWrite,
	type DebouncedWrite,
} from '$lib/business/store/debounced-write.svelte';
import { readStopObservations } from '$lib/business/session-history';
import { liveNow } from '$lib/business/state/today.svelte';
import {
	adviseStop,
	DEFAULT_ENERGY_PARAMS,
	type EnergyParams,
	type StopObservation,
} from '$lib/business/model/zenith-energy';
import { toEnergyTask } from '$lib/business/model/metric/calculation';

const CONTEXT_KEY = Symbol();

/**
 * The domain each param must land in. Rates and values are non-negative
 * because a negative one breaks the reservoir law: rec·gate < 0 gives ρ > 0
 * with an equilibrium below 0, so a long enough block drives the reservoir
 * negative and `level^wc` is NaN (MATH.md §8.5) — which reaches the objective
 * and makes the optimizer return the do-nothing plan. `microRecoveryFraction`
 * is a share of recovery capacity, so [0, 1]. Nothing is bounded above
 * otherwise: the model admits any scale.
 *
 * The two omissions are deliberate. `initialCog`/`initialPhys` are clamped to
 * [0, 1] at every entry point that reads them, and `resumptionTimeConstant`
 * ≤ 0 is the documented binary reset (`resumePhase`), not a corrupt value.
 */
const PARAM_BOUNDS = {
	alphaCog: [0, Infinity],
	alphaPhys: [0, Infinity],
	recoveryRate: [0, Infinity],
	restRecoveryMultiplier: [0, Infinity],
	microRecoveryFraction: [0, 1],
	satietyScale: [0, Infinity],
	freeTimeValue: [0, Infinity],
	terminalEnergyValue: [0, Infinity],
} as const satisfies Partial<Record<keyof EnergyParams, readonly [number, number]>>;

/**
 * Persisted params are user-reachable JSON (edited by hand, or restored from
 * an older backup): accept only finite numbers for known keys and clamp them
 * to their domain (R4's keep-and-clamp), so corrupt-but-parseable data (e.g.
 * `{"recoveryRate":"abc"}` or `{"recoveryRate":-0.7}`) can never reach the model.
 */
export function sanitizeEnergyParams(raw: unknown): EnergyParams {
	const params: EnergyParams = {
		...DEFAULT_ENERGY_PARAMS,
	};

	if (raw && typeof raw === 'object') {
		for (const key of Object.keys(params) as (keyof EnergyParams)[]) {
			const value = (raw as Record<string, unknown>)[key];

			if (typeof value !== 'number' || !Number.isFinite(value)) continue;

			const bounds: readonly [number, number] | undefined =
				PARAM_BOUNDS[key as keyof typeof PARAM_BOUNDS];

			params[key] = bounds ? Math.min(Math.max(value, bounds[0]), bounds[1]) : value;
		}
	}

	return params;
}

/**
 * Tells the user their saved parameters could not be read, so the sliders
 * showing defaults does not look like their calibration was thrown away.
 *
 * Injected rather than imported: raising a toast is presentation, which the
 * business layer may not reach (R1), and copy is a presentation concern (R2).
 * Same shape and the same reason as `ReportStorageError` — but a distinct
 * surface, because this is not the viewed day and the banner's retry does not
 * cover it.
 */
export type NotifyParamsLoadFailed = () => void;

/**
 * The Energy Lab's lasting half: the user's model parameters, the finished days
 * the λ₀ fit reads, and the live stop advice `/`'s session clock reads too.
 * Everything else the Lab derives from the params is `EnergyPlanStore`'s.
 *
 * Params are the Lab's own, deliberately never written back to the daily
 * session — but they ARE persisted (IndexedDB `settings`, so backup covers
 * them) and they ARE the model's inputs, so they belong to a store rather than
 * to component state.
 *
 * The day window is the exception that proves the rule: it is NOT a param. It
 * is `session.availableHours`, shared both ways with the main page — see
 * `EnergyPlanStore`'s `#windowHours`.
 */
export class EnergyLabStore {
	// Assigned first thing in the constructor. The `!` is load-bearing: the
	// $derived fields below reference it in their initializers, and those are
	// lazy (never evaluated before the constructor body runs) — but TypeScript
	// checks declaration order, not laziness.
	#session!: SessionStore;
	#observations!: EnergyObservationStore;

	#params = $state<EnergyParams>({
		...DEFAULT_ENERGY_PARAMS,
	});
	#loaded = $state(false);

	// Trailing-debounced persistence: dragging a slider must not fire a put per
	// intermediate value. Built in the constructor — it registers lifecycle hooks.
	#autoSave!: DebouncedWrite<EnergyParams>;
	#saveArmed = false;

	// Past days' stop decisions (MATH.md §8.10), re-read whenever the drain logs
	// change. Loaded async, so a version guard keeps out-of-order completions
	// from landing stale data.
	#stopObservations = $state<StopObservation[]>([]);
	#stopLoadVersion = 0;

	constructor(
		session: SessionStore,
		observations: EnergyObservationStore,
		status: StorageStatusStore,
		notifyParamsLoadFailed: NotifyParamsLoadFailed,
	) {
		this.#session = session;
		this.#observations = observations;

		// No `retryLoad` passed: a failed params READ raises a toast rather than the
		// banner, because it is not the viewed day. Reporting is safe — a lost
		// write is cleared by nothing but the user's dismissal.
		const reporter = status.register('energyLab');

		this.#autoSave = createDebouncedWrite(
			(params) => settingsRepository.$updateSetting(ENERGY_PARAMS_SETTING, params),
			(error) => {
				logError('Failed to save energy lab params', error);
				reporter.report('save-failed');
			},
		);

		onMount(async () => {
			try {
				this.#params = sanitizeEnergyParams(
					await settingsRepository.$readSetting(ENERGY_PARAMS_SETTING),
				);
			} catch (e) {
				// #params keeps DEFAULT_ENERGY_PARAMS, which is indistinguishable from
				// a never-calibrated user unless we say so.
				logError('Failed to load energy lab params', e);
				notifyParamsLoadFailed();
			}

			this.#loaded = true;
		});

		$effect(() => {
			if (!this.#loaded) return;

			// The snapshot must be taken before the arming check: the first run
			// after load only establishes tracking. Scheduling a save there would
			// write the just-loaded params straight back — and after a FAILED load,
			// overwrite the stored calibration with the defaults.
			const snapshot = $state.snapshot(this.#params);

			if (!this.#saveArmed) {
				this.#saveArmed = true;

				return;
			}

			this.#autoSave.schedule(snapshot);
		});

		$effect(() => {
			void this.#observations.drainObservations;
			// A finished day's stored session carries its open scope and its window into
			// `toStopObservations`, and any write to a past day moves them — so the
			// logs alone do not say when this reading is out of date.
			void this.#session.pastWriteGeneration;
			const version = ++this.#stopLoadVersion;

			readStopObservations(this.#session.today)
				.then((observations) => {
					if (version === this.#stopLoadVersion) this.#stopObservations = observations;
				})
				// Silent on purpose, but never unhandled: in any real outage the params
				// read above fails too and raises the toast for both. An isolated
				// failure here only empties the stopping-value fit, which the card
				// already renders as "not fitted".
				.catch((e) => logError('Failed to load stopping observations', e));
		});
	}

	// ----- Parameters -----

	get params() {
		return this.#params;
	}
	setParam<K extends keyof EnergyParams>(key: K, value: EnergyParams[K]) {
		this.#params[key] = value;
	}
	resetParams() {
		this.#params = {
			...DEFAULT_ENERGY_PARAMS,
		};
	}
	/** False until the persisted params have been read — the page waits on it. */
	get isLoaded() {
		return this.#loaded;
	}
	/** The finished days the λ₀ fit reads (none → nothing to fit). */
	get stopObservations() {
		return this.#stopObservations;
	}
	/** False until today's own day, its 🪫 logs and the params have settled — every input
	 *  `stopAdvice` prices. */
	get isStopAdviceReady() {
		return (
			this.#loaded &&
			!this.#observations.isLoading &&
			this.#session.loadedDate === this.#session.today
		);
	}

	// ----- Live stop advisor (MATH.md §8.11) -----

	// The in-day face of the §8.10 machinery: TODAY's drain logs are the work
	// so far (the same records the stopping fit will read once the day is
	// finished), priced under the CURRENT params — freeTimeValue included, so
	// applying a fitted λ₀ immediately moves the verdict.
	#stopAdvice = $derived.by(() => {
		const worked = this.#observations.drainObservations
			.filter((o) => o.date === this.#session.today)
			.map((o) => ({
				taskId: o.taskId,
				hours: o.hours,
				// The row's log moment is what carries today's breaks into the
				// reconstruction (MATH.md §8.10) — the only adviseStop caller, so
				// without it the advisor prices the summed day.
				endedAt: o.createdAt,
			}));

		return adviseStop(
			{
				tasks: this.#session.tasks.map(toEnergyTask),
				windowHours: this.#session.availableHours,
				workedHours: worked,
				// The card is priced at the moment it is READ, so the rest since the
				// last row is in the day too (MATH.md §8.11).
				readAt: liveNow.value,
				// Only the open rows may be recommended: "one more session of a task you
				// already checked off" is no advice, though its hours stay in the
				// reconstruction above (MATH.md §8.11).
				// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived lookup, rebuilt not mutated
				openTaskIds: new Set(this.#session.tasks.filter((t) => !t.completed).map((t) => t.id)),
			},
			this.#params,
			this.#session.userConstants,
		);
	});
	get stopAdvice() {
		return this.#stopAdvice;
	}
}

/**
 * Read by `/energy` (and at mount by `/`'s session clock, for its suggested
 * minutes), but created in the (app) layout so re-entering the
 * route does not re-read the params it already holds — a ~120ms skeleton on
 * every visit to a page the user tabs in and out of is what that cost. What
 * makes the long lifetime safe is who writes the data: the params are the Lab's
 * alone, and the stopping observations — which any write to a past day DOES
 * move from outside — are re-read by an effect keyed on the session store's
 * past-write generation, so neither needs a refresh on the way back in.
 * Affordable there for the second reason — the constructor's work is two small
 * reads, and the plan is `/energy`'s own `EnergyPlanStore`.
 *
 * The auto-save's `onDestroy` flush now fires on app teardown rather than on
 * leaving the route, which is not a loss — the store outliving the navigation
 * is exactly what keeps its pending debounce alive to fire on its own, and
 * `visibilitychange` still covers a tab that goes away first (the session
 * store has always been in the layout on those terms). `setContext` is here
 * for the guard it gives — it throws outside component initialisation, so no
 * `+page.ts` load can build this store.
 */
export function setEnergyLabStore(
	session: SessionStore,
	observations: EnergyObservationStore,
	status: StorageStatusStore,
	notifyParamsLoadFailed: NotifyParamsLoadFailed,
): EnergyLabStore {
	return setContext<EnergyLabStore>(
		CONTEXT_KEY,
		new EnergyLabStore(session, observations, status, notifyParamsLoadFailed),
	);
}

export function getEnergyLabStore(): EnergyLabStore {
	return getContext<EnergyLabStore>(CONTEXT_KEY);
}
