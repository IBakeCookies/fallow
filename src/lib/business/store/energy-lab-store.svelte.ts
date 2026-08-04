import { getContext, onMount, setContext } from 'svelte';
import type { StopObservation } from '$lib/business/model/zenith-energy';
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
import {
	adviseStop,
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	fitDrainRate,
	fitRecoveryRate,
	fitStoppingValue,
	optimizeSchedule,
	sampleTrajectory,
	type EnergyParams,
	type ScheduleBlock,
} from '$lib/business/model/zenith-energy';
import {
	calculateInterleavedOrder,
	calculateSuggestedTasks,
	toEnergyTask,
} from '$lib/business/model/metric/calculation';
import {
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations,
} from '$lib/business/model/energy-calibration';

const CONTEXT_KEY = Symbol();
/** Fitted values are surfaced (and applied) at 2dp — the sliders' precision. */
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Persisted params are user-reachable JSON (edited by hand, or restored from
 * an older backup): accept only finite numbers for known keys, so corrupt-but-
 * parseable data (e.g. `{"recoveryRate":"abc"}`) can never reach the model.
 */
export function sanitizeEnergyParams(raw: unknown): EnergyParams {
	const params: EnergyParams = {
		...DEFAULT_ENERGY_PARAMS,
	};

	if (raw && typeof raw === 'object') {
		for (const key of Object.keys(params) as (keyof EnergyParams)[]) {
			const value = (raw as Record<string, unknown>)[key];

			if (typeof value === 'number' && Number.isFinite(value)) params[key] = value;
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
 * The Energy Lab: the user's model parameters plus everything derived from
 * them — the optimized schedule, the classic planner's rival plan evaluated
 * under the same model, and the three calibration fits (α, r, λ₀).
 *
 * Lives in the business layer, not the page, because it is model orchestration:
 * WHICH fit conditions on WHAT is load-bearing math (MATH.md §8.7/§8.9/§8.10),
 * not view code, and none of it is testable while it sits inside a route.
 *
 * Params are the Lab's own, deliberately never written back to the daily
 * session — but they ARE persisted (IndexedDB `settings`, so backup covers
 * them) and they ARE the model's inputs, so they belong to a store rather than
 * to component state.
 *
 * The day window is the exception that proves the rule: it is NOT a param. It
 * is `session.availableHours`, shared both ways with the main page — see
 * `windowHours`.
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
		// banner (it is not the viewed day), and this store is per-route, so a
		// retry callback would outlive it. Reporting is safe — a lost write is
		// cleared by nothing but the user's dismissal.
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

	// ----- Parameters and window -----

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

	/**
	 * The day window IS the session's budget — one value, no lab-local override
	 * (settled 2026-07-29: neither mode owns the day, so neither owns the hours).
	 * Read-only here: the route writes `session.availableHours`, the same way it
	 * writes every other session field on this page, which keeps this store's
	 * "never writes the daily session" true.
	 *
	 * Private, and deliberately not re-exported: it transforms nothing, so a getter
	 * would let the route read the window off this store while writing it to the
	 * session — one value on two objects. The route reads `session.availableHours`.
	 *
	 * No `|| 8` fallback. A fresh day genuinely has no budget yet, and inventing
	 * one here would render a window the main page does not have — the fork this
	 * change exists to remove. The plan card says so instead.
	 */
	#windowHours = $derived(this.#session.availableHours);

	// ----- The plan -----

	// Optimize over ALL tasks (completed included), matching the main page's
	// allocator: checking a task done must not reshuffle the day's plan.
	#energyTasks = $derived(this.#session.tasks.map(toEnergyTask));
	get energyTasks() {
		return this.#energyTasks;
	}

	#plan = $derived(
		optimizeSchedule(
			this.#energyTasks,
			this.#windowHours,
			this.#params,
			this.#session.userConstants,
		),
	);
	get plan() {
		return this.#plan;
	}

	#trajectory = $derived(
		sampleTrajectory(
			this.#plan.blocks,
			this.#energyTasks,
			this.#windowHours,
			this.#params,
			this.#session.userConstants,
		),
	);
	get trajectory() {
		return this.#trajectory;
	}

	#plannedHours = $derived(this.#plan.blocks.reduce((sum, block) => sum + block.hours, 0));
	get plannedHours() {
		return this.#plannedHours;
	}
	#trailingFreeHours = $derived(Math.max(0, this.#windowHours - this.#plannedHours));
	get trailingFreeHours() {
		return this.#trailingFreeHours;
	}

	/**
	 * The plan summed per task, for the task list beside the timeline. Read off the
	 * evaluated blocks, so it is the same partition the timeline draws and the rows
	 * sum to exactly the `workHours` the summary tile reports.
	 *
	 * A task the optimizer funded nothing is absent rather than 0 — the map holds
	 * no empty entries, which is what makes that sum total. The list renders either
	 * as "no hours", so the caller's `?? 0` is not losing a distinction.
	 */
	#allocatedHoursByTask = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived lookup, rebuilt not mutated
		const hours = new Map<number, number>();

		for (const block of this.#plan.evaluation.blocks) {
			if (block.taskId === null) continue;

			hours.set(block.taskId, (hours.get(block.taskId) ?? 0) + block.hours);
		}

		return hours;
	});
	get allocatedHoursByTask() {
		return this.#allocatedHoursByTask;
	}

	// The classic allocator's plan (same math as the main page), evaluated under
	// THIS model: interleaved run order, switch costs as rest gaps.
	#classicEvaluation = $derived.by(() => {
		if (this.#windowHours <= 0 || this.#energyTasks.length === 0) return null;

		const suggested = calculateSuggestedTasks(
			this.#session.tasks,
			this.#windowHours,
			this.#session.switchCost,
			this.#session.pools,
			this.#session.userConstants,
			this.#session.constantsFit.posterior,
		);

		// Completed tasks stay in: both plans simulate the full intended day,
		// otherwise the comparison strips work from the classic side only.
		const funded = calculateInterleavedOrder(suggested);

		if (funded.length === 0) return null;

		const blocks: ScheduleBlock[] = [];

		funded.forEach((task, index) => {
			if (index > 0 && this.#session.switchCost > 0) {
				blocks.push({
					taskId: null,
					hours: this.#session.switchCost,
				});
			}

			blocks.push({
				taskId: task.id,
				hours: task.suggestedHours,
			});
		});

		return evaluateSchedule(
			blocks,
			this.#energyTasks,
			this.#windowHours,
			this.#params,
			this.#session.userConstants,
		);
	});

	/** Percent more output than the classic plan, or null when incomparable. */
	#outputVsClassic = $derived.by(() => {
		const classic = this.#classicEvaluation;

		if (!classic || classic.totalOutput <= 0) return null;

		return Math.round(
			((this.#plan.evaluation.totalOutput - classic.totalOutput) / classic.totalOutput) * 100,
		);
	});
	get outputVsClassic() {
		return this.#outputVsClassic;
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
			}));

		// Open tasks only as candidates (next-up family, §11.8): a checked-off
		// task is no recommendation — but its logged hours stay in the
		// reconstruction above, because they drained the reservoirs.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived lookup, rebuilt not mutated
		const openTaskIds = new Set(this.#session.tasks.filter((t) => !t.completed).map((t) => t.id));

		return adviseStop(
			{
				tasks: this.#energyTasks,
				windowHours: this.#windowHours,
				workedHours: worked,
			},
			this.#params,
			this.#session.userConstants,
			openTaskIds,
		);
	});
	get stopAdvice() {
		return this.#stopAdvice;
	}

	// ----- Drain calibration (α fit from end-of-session ratings) -----

	// The fit conditions on the CURRENT recovery parameters (that conditioning
	// is what makes α identifiable at all — MATH.md §8.7), so dragging a
	// recovery slider legitimately re-fits. The prior anchors to the model
	// DEFAULTS, not the current inputs, mirroring fitUserConstants.
	#drainLawParams = $derived({
		recoveryRate: this.#params.recoveryRate,
		restRecoveryMultiplier: this.#params.restRecoveryMultiplier,
		microRecoveryFraction: this.#params.microRecoveryFraction,
	});

	#cognitiveDrainFit = $derived(
		fitDrainRate(
			toCognitiveDrainObservations(this.#observations.drainObservations),
			DEFAULT_ENERGY_PARAMS.alphaCog,
			this.#drainLawParams,
		),
	);
	get cognitiveDrainFit() {
		return this.#cognitiveDrainFit;
	}

	#physicalDrainFit = $derived(
		fitDrainRate(
			toPhysicalDrainObservations(this.#observations.drainObservations),
			DEFAULT_ENERGY_PARAMS.alphaPhys,
			this.#drainLawParams,
		),
	);
	get physicalDrainFit() {
		return this.#physicalDrainFit;
	}

	#drainFitApplied = $derived(
		(!this.#cognitiveDrainFit.fitted ||
			Math.abs(this.#params.alphaCog - round2(this.#cognitiveDrainFit.alpha)) < 1e-9) &&
			(!this.#physicalDrainFit.fitted ||
				Math.abs(this.#params.alphaPhys - round2(this.#physicalDrainFit.alpha)) < 1e-9),
	);
	get drainFitApplied() {
		return this.#drainFitApplied;
	}

	applyDrainFit() {
		if (this.#cognitiveDrainFit.fitted) {
			this.#params.alphaCog = round2(this.#cognitiveDrainFit.alpha);
		}

		if (this.#physicalDrainFit.fitted) {
			this.#params.alphaPhys = round2(this.#physicalDrainFit.alpha);
		}
	}

	// ----- Recovery calibration (r fit from pre/post-rest pairs) -----

	// During pure rest the reservoir law loses α entirely (drain decays as
	// d_before·e^(−r·m·g) — MATH.md §8.9), so this fit needs no drain
	// parameters: it conditions only on the rest multiplier (rest data
	// identifies the product r·m). The α fit above then conditions on this one —
	// fitting r first makes that conditioning well-founded, not circular.
	#recoveryFit = $derived(
		fitRecoveryRate(
			toRestObservations(this.#observations.restObservations),
			DEFAULT_ENERGY_PARAMS.recoveryRate,
			{
				restRecoveryMultiplier: this.#params.restRecoveryMultiplier,
			},
		),
	);
	get recoveryFit() {
		return this.#recoveryFit;
	}

	#recoveryFitApplied = $derived(
		!this.#recoveryFit.fitted ||
			Math.abs(this.#params.recoveryRate - round2(this.#recoveryFit.rate)) < 1e-9,
	);
	get recoveryFitApplied() {
		return this.#recoveryFitApplied;
	}

	applyRecoveryFit() {
		if (this.#recoveryFit.fitted) this.#params.recoveryRate = round2(this.#recoveryFit.rate);
	}

	// ----- Stopping calibration (λ₀ fit from finished days) -----

	// Conditions on ALL current dynamics params (α, r, m, b, satiety) and the
	// user-owned terminal energy value — so a conditioning-slider change
	// legitimately re-fits, like the drain fit re-fitting under new recovery
	// sliders. The extraction itself is λ₀-free (no circularity with the
	// current free-time slider). Prior anchors to the model DEFAULT.
	#stoppingFit = $derived(
		fitStoppingValue(
			this.#stopObservations,
			DEFAULT_ENERGY_PARAMS.freeTimeValue,
			this.#params,
			this.#session.userConstants,
		),
	);
	get stoppingFit() {
		return this.#stoppingFit;
	}
	/** How many finished days the λ₀ fit had to work with (0 → nothing to fit). */
	get stopObservationCount() {
		return this.#stopObservations.length;
	}

	#stoppingFitApplied = $derived(
		!this.#stoppingFit.fitted ||
			Math.abs(this.#params.freeTimeValue - round2(this.#stoppingFit.value)) < 1e-9,
	);
	get stoppingFitApplied() {
		return this.#stoppingFitApplied;
	}

	applyStoppingFit() {
		if (this.#stoppingFit.fitted) this.#params.freeTimeValue = round2(this.#stoppingFit.value);
	}
}

/**
 * Read by `/energy` alone, and created there rather than in a layout — the
 * context does not change that. Its per-page lifetime is load-bearing: the
 * auto-save's `onDestroy` flush exists because the store dies with the route,
 * and creating it in the layout would also run its `onMount` read on every
 * other page. `setContext` is here for the guard it gives — it throws outside
 * component initialisation, so no `+page.ts` load can build this store.
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
