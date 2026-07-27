import { onDestroy, onMount } from 'svelte';
import { browser } from '$app/environment';
import type { StopObservation } from '$lib/business/model/zenith-energy';
// Namespace import: the $-prefixed controller methods can't be imported by
// name inside .svelte.ts files ($ is reserved for runes).
import * as settingsRepository from '$lib/data/repository/settings-repository';
import { ENERGY_PARAMS_SETTING } from '$lib/data/repository/settings-repository';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import { readStopObservations } from '$lib/business/store/session-history';
import {
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	fitDrainRate,
	fitRecoveryRate,
	fitStoppingValue,
	optimizeSchedule,
	sampleTrajectory,
	type EnergyParams,
	type ScheduleBlock
} from '$lib/business/model/zenith-energy';
import {
	calculateInterleavedOrder,
	calculateSuggestedTasks,
	toEnergyTask
} from '$lib/business/model/metric/calculation';
import {
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations
} from '$lib/business/model/energy-calibration';

/** Fitted values are surfaced (and applied) at 2dp — the sliders' precision. */
const round2 = (x: number) => Math.round(x * 100) / 100;

const SAVE_DEBOUNCE_MS = 500;

/**
 * Persisted params are user-reachable JSON (edited by hand, or restored from
 * an older backup): accept only finite numbers for known keys, so corrupt-but-
 * parseable data (e.g. `{"recoveryRate":"abc"}`) can never reach the model.
 */
export function sanitizeEnergyParams(raw: unknown): EnergyParams {
	const params: EnergyParams = { ...DEFAULT_ENERGY_PARAMS };
	if (raw && typeof raw === 'object') {
		for (const key of Object.keys(params) as (keyof EnergyParams)[]) {
			const value = (raw as Record<string, unknown>)[key];
			if (typeof value === 'number' && Number.isFinite(value)) params[key] = value;
		}
	}
	return params;
}

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
 */
export class EnergyLabStore {
	// Assigned first thing in the constructor. The `!` is load-bearing: the
	// $derived fields below reference it in their initializers, and those are
	// lazy (never evaluated before the constructor body runs) — but TypeScript
	// checks declaration order, not laziness.
	#session!: SessionStore;
	#observations!: EnergyObservationStore;

	#params = $state<EnergyParams>({ ...DEFAULT_ENERGY_PARAMS });
	#loaded = $state(false);

	// Trailing-debounced persistence, same reasoning as the session store's:
	// dragging a slider must not fire a put per intermediate value.
	#saveTimer: ReturnType<typeof setTimeout> | undefined;
	#pendingSave: EnergyParams | null = null;

	// Day window follows today's budget until overridden — the override is
	// lab-local and never written back to the session.
	#windowOverride = $state<number | null>(null);

	// Past days' stop decisions (MATH.md §8.10), re-read whenever the drain logs
	// change. Loaded async, so a version guard keeps out-of-order completions
	// from landing stale data.
	#stopObservations = $state<StopObservation[]>([]);
	#stopLoadVersion = 0;

	constructor(session: SessionStore, observations: EnergyObservationStore) {
		this.#session = session;
		this.#observations = observations;

		onMount(async () => {
			try {
				this.#params = sanitizeEnergyParams(
					await settingsRepository.$readSetting(ENERGY_PARAMS_SETTING)
				);
			} catch (e) {
				console.error('Failed to load energy lab params', e);
			}
			this.#loaded = true;
		});

		$effect(() => {
			if (!browser || !this.#loaded) return;
			this.#pendingSave = $state.snapshot(this.#params);
			clearTimeout(this.#saveTimer);
			this.#saveTimer = setTimeout(() => this.#flushSave(), SAVE_DEBOUNCE_MS);
		});

		// The effect's own teardown can't do this: it also runs before every
		// re-run, so flushing there would defeat the debounce. Destroy is the
		// common case here — this store is per-page, so navigating off /energy
		// within the debounce used to discard the edit outright.
		onDestroy(() => this.#flushSave());

		// Same safety net as the session store's: the debounce may never fire if
		// the tab is discarded while hidden.
		$effect(() => {
			if (!browser) return;
			const onVisibility = () => {
				if (document.hidden) this.#flushSave();
			};
			document.addEventListener('visibilitychange', onVisibility);
			return () => document.removeEventListener('visibilitychange', onVisibility);
		});

		$effect(() => {
			void this.#observations.drainObservations;
			const version = ++this.#stopLoadVersion;
			readStopObservations(this.#session.today).then((observations) => {
				if (version === this.#stopLoadVersion) this.#stopObservations = observations;
			});
		});
	}

	// Persist the pending snapshot now, cancelling any scheduled debounce.
	#flushSave() {
		if (!this.#pendingSave) return;
		clearTimeout(this.#saveTimer);
		const payload = this.#pendingSave;
		this.#pendingSave = null;
		settingsRepository.$updateSetting(ENERGY_PARAMS_SETTING, payload).catch((e) => {
			console.error('Failed to save energy lab params', e);
			this.#session.reportStorageError('save-failed');
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
		this.#params = { ...DEFAULT_ENERGY_PARAMS };
	}
	/** False until the persisted params have been read — the page waits on it. */
	get isLoaded() {
		return this.#loaded;
	}

	#windowHours = $derived(this.#windowOverride ?? (this.#session.availableHours || 8));
	get windowHours() {
		return this.#windowHours;
	}
	set windowHours(hours: number) {
		this.#windowOverride = hours;
	}

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
			this.#session.userConstants
		)
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
			this.#session.userConstants
		)
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
			this.#session.constantsFit.posterior
		);
		// Completed tasks stay in: both plans simulate the full intended day,
		// otherwise the comparison strips work from the classic side only.
		const funded = calculateInterleavedOrder(suggested);
		if (funded.length === 0) return null;
		const blocks: ScheduleBlock[] = [];
		funded.forEach((task, index) => {
			if (index > 0 && this.#session.switchCost > 0) {
				blocks.push({ taskId: null, hours: this.#session.switchCost });
			}
			blocks.push({ taskId: task.id, hours: task.suggestedHours });
		});
		return evaluateSchedule(
			blocks,
			this.#energyTasks,
			this.#windowHours,
			this.#params,
			this.#session.userConstants
		);
	});

	/** Percent more output than the classic plan, or null when incomparable. */
	#outputVsClassic = $derived.by(() => {
		const classic = this.#classicEvaluation;
		if (!classic || classic.totalOutput <= 0) return null;
		return Math.round(
			((this.#plan.evaluation.totalOutput - classic.totalOutput) / classic.totalOutput) * 100
		);
	});
	get outputVsClassic() {
		return this.#outputVsClassic;
	}

	// ----- Drain calibration (α fit from end-of-session ratings) -----

	// The fit conditions on the CURRENT recovery parameters (that conditioning
	// is what makes α identifiable at all — MATH.md §8.7), so dragging a
	// recovery slider legitimately re-fits. The prior anchors to the model
	// DEFAULTS, not the current inputs, mirroring fitUserConstants.
	#drainLawParams = $derived({
		recoveryRate: this.#params.recoveryRate,
		restRecoveryMultiplier: this.#params.restRecoveryMultiplier,
		microRecoveryFraction: this.#params.microRecoveryFraction
	});

	#cognitiveDrainFit = $derived(
		fitDrainRate(
			toCognitiveDrainObservations(this.#observations.drainObservations),
			DEFAULT_ENERGY_PARAMS.alphaCog,
			this.#drainLawParams
		)
	);
	get cognitiveDrainFit() {
		return this.#cognitiveDrainFit;
	}

	#physicalDrainFit = $derived(
		fitDrainRate(
			toPhysicalDrainObservations(this.#observations.drainObservations),
			DEFAULT_ENERGY_PARAMS.alphaPhys,
			this.#drainLawParams
		)
	);
	get physicalDrainFit() {
		return this.#physicalDrainFit;
	}

	#drainFitApplied = $derived(
		(!this.#cognitiveDrainFit.fitted ||
			Math.abs(this.#params.alphaCog - round2(this.#cognitiveDrainFit.alpha)) < 1e-9) &&
			(!this.#physicalDrainFit.fitted ||
				Math.abs(this.#params.alphaPhys - round2(this.#physicalDrainFit.alpha)) < 1e-9)
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
			{ restRecoveryMultiplier: this.#params.restRecoveryMultiplier }
		)
	);
	get recoveryFit() {
		return this.#recoveryFit;
	}

	#recoveryFitApplied = $derived(
		!this.#recoveryFit.fitted ||
			Math.abs(this.#params.recoveryRate - round2(this.#recoveryFit.rate)) < 1e-9
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
			this.#session.userConstants
		)
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
			Math.abs(this.#params.freeTimeValue - round2(this.#stoppingFit.value)) < 1e-9
	);
	get stoppingFitApplied() {
		return this.#stoppingFitApplied;
	}

	applyStoppingFit() {
		if (this.#stoppingFit.fitted) this.#params.freeTimeValue = round2(this.#stoppingFit.value);
	}
}
