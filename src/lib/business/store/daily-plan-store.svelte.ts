/**
 * The daily dashboard's numbers: the day's plan plus every metric, computed
 * from the session's inputs and the user's own calibration logs.
 *
 * Lives in the business layer, not the page, because it is model wiring — WHICH
 * fit feeds WHICH input is load-bearing (the allocator hedges on the ϕ
 * posterior, Burnout Risk reads the drain/rest fits), and none of it is
 * testable while it sits inside a route (AGENTS.md R2).
 */

import { calculateDailyMetrics, type DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import { fitEnergyParams } from '$lib/business/model/energy-calibration';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';

export class DailyPlanStore {
	// Assigned first thing in the constructor. The `!` is load-bearing: the
	// $derived fields below reference these in their initializers, and those are
	// lazy (never evaluated before the constructor body runs) — but TypeScript
	// checks declaration order, not laziness.
	#session!: SessionStore;
	#observations!: EnergyObservationStore;

	// Burnout Risk's parameters are the model DEFAULTS refined by the user's own
	// calibration logs (🪫 drain, ☕ rest) — the same fits the Energy Lab offers,
	// but anchored to defaults rather than the lab's local sliders (the lab
	// deliberately never writes to the session). Kept separate from the metric
	// derivation below so it only refits when the logs change, not on every
	// keystroke.
	#energyParams = $derived(
		fitEnergyParams(this.#observations.restObservations, this.#observations.drainObservations),
	);

	#daily = $derived(
		calculateDailyMetrics({
			tasks: this.#session.tasks,
			availableHours: this.#session.availableHours,
			switchCost: this.#session.switchCost,
			pools: this.#session.pools,
			constants: this.#session.userConstants,
			// The fit posterior makes the allocator hedge ϕ-uncertainty (MATH.md
			// §5.1): barely-measured tasks plan slightly shorter/lower.
			posterior: this.#session.constantsFit.posterior,
			energyParams: this.#energyParams,
		}),
	);

	constructor(session: SessionStore, observations: EnergyObservationStore) {
		this.#session = session;
		this.#observations = observations;
	}

	get daily(): DailyMetrics {
		return this.#daily;
	}
}
