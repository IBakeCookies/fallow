/**
 * The daily dashboard's numbers: the day's plan plus every metric, computed
 * from the session's inputs and the user's own calibration logs.
 *
 * Lives in the business layer, not the page, because it is model wiring — WHICH
 * fit feeds WHICH input is load-bearing (the allocator hedges on the ϕ
 * posterior, Burnout Risk reads the drain/rest fits), and none of it is
 * testable while it sits inside a route (AGENTS.md R2).
 */

import { getContext, setContext } from 'svelte';
import { logError } from '$lib/logger';
import { calculateDailyMetrics, type DailyMetrics } from '$lib/business/model/metric/daily-metrics';
import { suggestPlanAdjustments, type PlanAdvice } from '$lib/business/model/metric/plan-advice';
import { fitEnergyParams, seedMorningReservoirs } from '$lib/business/model/energy-calibration';
import { addDays } from '$lib/business/utils/date';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';

const CONTEXT_KEY = Symbol();

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
	#calibratedParams = $derived(
		fitEnergyParams(this.#observations.restObservations, this.#observations.drainObservations),
	);

	// Overnight carry-over (MATH.md §11.9): the previous day's 🪫 logs seed the
	// morning reservoir levels. Keyed to the VIEWED day's predecessor, so a past
	// day reads with its own morning, not today's.
	#energyParams = $derived(
		seedMorningReservoirs(
			this.#calibratedParams,
			this.#observations.drainObservations.filter(
				(o) => o.date === addDays(this.#session.selectedDate, -1),
			),
		),
	);

	#input = $derived({
		tasks: this.#session.tasks,
		availableHours: this.#session.availableHours,
		switchCost: this.#session.switchCost,
		pools: this.#session.pools,
		constants: this.#session.userConstants,
		// The fit posterior makes the allocator hedge ϕ-uncertainty (MATH.md
		// §5.1): barely-measured tasks plan slightly shorter/lower.
		posterior: this.#session.constantsFit.posterior,
		energyParams: this.#energyParams,
	});

	#daily = $derived(calculateDailyMetrics(this.#input));

	// Everything the advice depends on, as a value. Not the identity of `#input`
	// or `#daily`: a `$derived` read from outside a reactive context is not
	// guaranteed to hand back the same object twice, so identity reports staleness
	// on a day that never changed.
	#fingerprint = $derived(JSON.stringify(this.#input));

	#advice = $state<PlanAdvice | null>(null);
	#adviceBusy = $state(false);
	#adviceError = $state(false);
	#adviceFor = $state<string | null>(null);

	constructor(session: SessionStore, observations: EnergyObservationStore) {
		this.#session = session;
		this.#observations = observations;
	}

	get daily(): DailyMetrics {
		return this.#daily;
	}

	get advice(): PlanAdvice | null {
		return this.#advice;
	}

	get adviceBusy(): boolean {
		return this.#adviceBusy;
	}

	/** The last check failed; the advice shown (if any) predates the failure. */
	get adviceError(): boolean {
		return this.#adviceError;
	}

	/** Advice exists but describes an older version of the day. */
	get adviceStale(): boolean {
		return this.#advice !== null && this.#adviceFor !== this.#fingerprint;
	}

	/**
	 * One full solve per candidate — up to ~950 ms on a 12-task day (MATH.md
	 * §14), which is why this is a method and not a `$derived`. The yield before
	 * the search lets the caller's busy state paint; the search itself blocks.
	 */
	async computeAdvice(): Promise<void> {
		if (this.#adviceBusy) return;

		this.#adviceBusy = true;
		this.#adviceError = false;

		try {
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Both read after the yield, in one tick, so the plan matches the input
			// it was solved from — and the current plan is reused as the baseline
			// rather than solved a second time.
			this.#advice = suggestPlanAdjustments(this.#input, this.#daily);
			this.#adviceFor = this.#fingerprint;
		} catch (e) {
			// The only caller is a fire-and-forget click handler; rethrowing would
			// be an unhandled rejection, not a signal.
			logError('Failed to compute plan advice', e);
			this.#adviceError = true;
		} finally {
			this.#adviceBusy = false;
		}
	}
}

/**
 * Read by `/` alone, so the context is not there to share the instance — it is
 * what makes "a store is only ever created inside a component" enforced rather
 * than conventional. `setContext` throws outside component initialisation, so
 * this store cannot be built in a `+page.ts` load and returned to the layout,
 * where it would be module-adjacent state living across SSR requests. That risk
 * is real here specifically: nothing in this class touches `onMount` or
 * `$effect`, so a bare `new DailyPlanStore(...)` in a load function would
 * succeed instead of throwing.
 */
export function setDailyPlanStore(
	session: SessionStore,
	observations: EnergyObservationStore,
): DailyPlanStore {
	return setContext<DailyPlanStore>(CONTEXT_KEY, new DailyPlanStore(session, observations));
}

export function getDailyPlanStore(): DailyPlanStore {
	return getContext<DailyPlanStore>(CONTEXT_KEY);
}
