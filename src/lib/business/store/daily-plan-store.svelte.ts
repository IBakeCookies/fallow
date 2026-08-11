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
import { calculateRemainingDay, type RemainingDay } from '$lib/business/model/metric/remaining-day';
import { fitEnergyParams, seedMorningReservoirs } from '$lib/business/model/energy-calibration';
import { workedHoursByTask } from '$lib/business/model/zenith-energy';
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
	// but anchored to defaults rather than the lab's local sliders (a fit never
	// writes params silently, and the params stay the lab's —
	// business/model/AGENTS.md; the day's HOURS are shared, but they are a session
	// field, not a param this store reads from the lab). Kept separate from the
	// metric derivation below so it only refits when the logs change, not on every
	// keystroke.
	//
	// Causal, on the same rule as the ϕ fit (MATH.md §33): strictly before the
	// planned day. Today's 🪫/☕ still reach the day — through the SIMULATION, which
	// is where a measurement of what happened belongs (the carry-over below, and
	// the Lab's stop advisor reading today's worked hours). What the rule forbids
	// is a log moving α and r under a plan the user is part-way through running.
	#fitObservations = $derived({
		rest: this.#observations.restObservations.filter((o) => o.date < this.#session.selectedDate),
		drain: this.#observations.drainObservations.filter((o) => o.date < this.#session.selectedDate),
	});

	#calibratedParams = $derived(
		fitEnergyParams(this.#fitObservations.rest, this.#fitObservations.drain),
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

	// What is left of today, re-planned from the hours already logged against it
	// (MATH.md §35). A SECOND solve, deliberately outside `#daily`: folding it in
	// would rescope the plan-family rows (§11.8) and double a `$derived` that
	// re-runs on every keystroke.
	//
	// It costs nothing until there is something to re-plan. Only TODAY can have a
	// remainder — a past day is finished and a future one has not started — and
	// `calculateRemainingDay` returns before solving when no hours are logged,
	// which is every morning, i.e. exactly when the day is being typed into.
	#remainingDay = $derived.by((): RemainingDay | null => {
		if (this.#session.selectedDate !== this.#session.today) return null;

		const tasks = this.#session.tasks;

		// The one definition of "hours per task, restricted to the day's tasks"
		// (AGENTS.md R3). Today's logs reach this immediately: it is a gauge of the
		// present, which §33 exempts from the causal fit window.
		const worked = workedHoursByTask(
			tasks,
			this.#observations.drainObservations.filter((o) => o.date === this.#session.today),
		);

		if (worked.size === 0) return null;

		return calculateRemainingDay({
			tasks,
			availableHours: this.#session.availableHours,
			switchCost: this.#session.switchCost,
			pools: this.#session.pools,
			constants: this.#session.userConstants,
			posterior: this.#session.constantsFit.posterior,
			workedHours: worked,
		});
	});

	// Everything the advice depends on, as a value. Not the identity of `#input`
	// or `#daily`: a `$derived` read from outside a reactive context is not
	// guaranteed to hand back the same object twice, so identity reports staleness
	// on a day that never changed.
	#fingerprint = $derived(JSON.stringify(this.#input));

	#advice = $state<PlanAdvice | null>(null);
	#isAdviceBusy = $state(false);
	#hasAdviceError = $state(false);
	#adviceFor = $state<string | null>(null);

	constructor(session: SessionStore, observations: EnergyObservationStore) {
		this.#session = session;
		this.#observations = observations;
	}

	get daily(): DailyMetrics {
		return this.#daily;
	}

	/** `null` until today has logged hours to re-plan from (MATH.md §35). */
	get remainingDay(): RemainingDay | null {
		return this.#remainingDay;
	}

	get advice(): PlanAdvice | null {
		return this.#advice;
	}

	get isAdviceBusy(): boolean {
		return this.#isAdviceBusy;
	}

	/** The last check failed; the advice shown (if any) predates the failure. */
	get hasAdviceError(): boolean {
		return this.#hasAdviceError;
	}

	/** Advice exists but describes an older version of the day. */
	get isAdviceStale(): boolean {
		return this.#advice !== null && this.#adviceFor !== this.#fingerprint;
	}

	/**
	 * One full solve per candidate — measured 421 ms on a 12-task day (MATH.md
	 * §14), which is why this is a method and not a `$derived`. The yield before
	 * the search lets the caller's busy state paint; the search itself blocks.
	 */
	async computeAdvice(): Promise<void> {
		if (this.#isAdviceBusy) return;

		this.#isAdviceBusy = true;
		this.#hasAdviceError = false;

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
			this.#hasAdviceError = true;
		} finally {
			this.#isAdviceBusy = false;
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
