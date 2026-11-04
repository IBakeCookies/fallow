import { getContext, setContext } from 'svelte';
import type { DraftTask } from '$lib/business/model/metric/draft-impact';
import { logError } from '$lib/logger';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import type { EnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
import {
	DEFAULT_ENERGY_PARAMS,
	evaluateSchedule,
	fitDrainRate,
	fitRecoveryRate,
	fitStoppingValue,
	optimizeSchedule,
	sampleTrajectory,
	suggestBudgetCurve,
	type BudgetCurve,
} from '$lib/business/model/zenith-energy';
import {
	calculateInterleavedOrder,
	calculateSuggestedTasks,
	getEffectiveDifficulty,
	toEnergyTask,
	toScheduleBlocks,
} from '$lib/business/model/metric/calculation';
import {
	calculateEnergyDraftImpact,
	type EnergyDraftImpact,
} from '$lib/business/model/metric/energy-draft-impact';
import { mapEffort } from '$lib/business/model/zenith';
import { applyCausalWindow } from '$lib/business/model/causal-window';
import {
	keepDayFirstDrainRows,
	toCognitiveDrainObservations,
	toPhysicalDrainObservations,
	toRestObservations,
} from '$lib/business/model/energy-calibration';

const CONTEXT_KEY = Symbol();
/** Fitted values are surfaced (and applied) at 2dp — the sliders' precision. */
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Whether two published drafts would price the same. Every field of `DraftTask`
 * is one a solve reads, so this is the whole record — but it is compared by
 * VALUE, because the form publishes a fresh object per edit.
 */
function isSameDraft(a: DraftTask | null, b: DraftTask | null): boolean {
	if (a === null || b === null) return a === b;

	return (
		a.physicalDifficulty === b.physicalDifficulty &&
		a.mentalDifficulty === b.mentalDifficulty &&
		a.enjoyment === b.enjoyment &&
		a.importance === b.importance
	);
}

/**
 * One visit to the Energy Lab: everything derived from the Lab's params — the
 * optimized schedule, the classic planner's rival plan evaluated under the same
 * model, the list's order, the budget curve, the add-task draft and the three
 * calibration fits (α, r, λ₀).
 *
 * Lives in the business layer, not the page, because it is model orchestration:
 * WHICH fit conditions on WHAT is load-bearing math (MATH.md §8.7/§8.9/§8.10),
 * not view code, and none of it is testable while it sits inside a route.
 */
export class EnergyPlanStore {
	// Assigned first thing in the constructor. The `!` is load-bearing: the
	// $derived fields below reference it in their initializers, and those are
	// lazy (never evaluated before the constructor body runs) — but TypeScript
	// checks declaration order, not laziness.
	#session!: SessionStore;
	#observations!: EnergyObservationStore;
	#lab!: EnergyLabStore;

	constructor(session: SessionStore, observations: EnergyObservationStore, lab: EnergyLabStore) {
		this.#session = session;
		this.#observations = observations;
		this.#lab = lab;

		// Fills the list's order snapshot while the loaded day is not the one it was taken
		// for, nor the example day. All are read before the plan, so with no snapshot due
		// the optimizer behind it never runs. Blocks arrive in schedule order, so first
		// appearance IS the task's position in the day; a day with no window has none, and
		// the snapshot waits until one is set.
		$effect(() => {
			// `/energy` takes no date, so arriving from `/?date=` lands while the session
			// still holds the last day's tasks; the example day has no loaded date at all.
			if (this.#session.loadedDate !== this.#session.selectedDate) return;

			if (this.#snapshotDate === this.#session.loadedDate) return;

			const { blocks } = this.#plan.evaluation;

			if (blocks.length === 0) return;

			const order: number[] = [];

			for (const block of blocks)
				if (block.taskId !== null && !order.includes(block.taskId)) order.push(block.taskId);

			// Then the tasks the plan funded nothing, behind the scheduled ones and in the
			// store's own order.
			for (const task of this.#session.tasks) if (!order.includes(task.id)) order.push(task.id);

			this.#displayOrder = order;
			this.#snapshotDate = this.#session.loadedDate;
		});
	}

	/**
	 * The day window IS the session's budget — one value, no lab-local override
	 * (settled 2026-07-29: neither mode owns the day, so neither owns the hours).
	 * Read-only here: the route writes `session.availableHours`, the same way it
	 * writes every other session field on this page, which keeps this store's
	 * "never writes the daily session" true (business/AGENTS.md).
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

	#energyTasks = $derived(this.#session.tasks.map(toEnergyTask));
	get energyTasks() {
		return this.#energyTasks;
	}

	#plan = $derived(
		optimizeSchedule(
			this.#energyTasks,
			this.#windowHours,
			this.#lab.params,
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
			this.#lab.params,
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

	/* ----- The task list's order -----

	   The list reads in schedule order, but SNAPSHOT rather than live: every parameter
	   edit re-optimizes, so a live sort re-ranked the rows under a slider drag and moved
	   the row being dragged out from under the cursor. Only positions freeze — every
	   number in a row stays live, so a stale order never shows a stale reading. */

	/** The whole day's task ids in the order last snapshotted — scheduled ones first,
	 *  then the rest. All of them on purpose: it makes "has no position" mean exactly
	 *  one thing, that the task was added after the snapshot. */
	#displayOrder = $state<number[]>([]);
	/** The loaded day `#displayOrder` was taken for. */
	#snapshotDate = $state<string | null>(null);

	#scheduledTasks = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived lookup, rebuilt not mutated
		const position = new Map(this.#displayOrder.map((id, index) => [id, index]));

		// A task added since the snapshot has no position and takes the front, where the
		// form that just added it is: the card's form is above the list and `addTask`
		// puts a new task first, so this is the row the user is looking for. Several of
		// them keep the store's newest-first order — the sort is stable. Only the place
		// is provisional; the row's own readings are live.
		return [...this.#session.tasks]
			.sort((a, b) => (position.get(a.id) ?? -1) - (position.get(b.id) ?? -1))
			.map((task) => ({
				...task,
				trueEffort: mapEffort(getEffectiveDifficulty(task)),
			}));
	});
	/** The day's tasks in the order the list shows them, each with the effort E the main
	 *  plan reports for it (MATH.md §1) — the Lab's `Effort` column prints one number. */
	get scheduledTasks() {
		return this.#scheduledTasks;
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
		const blocks = toScheduleBlocks(calculateInterleavedOrder(suggested), this.#session.switchCost);

		if (blocks.length === 0) return null;

		return evaluateSchedule(
			blocks,
			this.#energyTasks,
			this.#windowHours,
			this.#lab.params,
			this.#session.userConstants,
		);
	});

	/**
	 * Percent more valuable than the classic plan under THIS model's objective —
	 * satiated output plus the free-time and terminal-energy terms — or null when
	 * incomparable.
	 *
	 * The objective and not raw `totalOutput`: the plan above this tile is the
	 * argmax of the objective, so raw output is the one field of the evaluation it
	 * was not chosen for, and scoring the comparison by it both overstates the
	 * verdict (median +61% against the objective's +17%) and inverts its sign on
	 * ~2% of days.
	 */
	#valueVsClassic = $derived.by(() => {
		const classic = this.#classicEvaluation;

		if (!classic || classic.objective <= 0) return null;

		return Math.round(
			((this.#plan.evaluation.objective - classic.objective) / classic.objective) * 100,
		);
	});
	get valueVsClassic() {
		return this.#valueVsClassic;
	}

	// ----- Budget curve (MATH.md §8.12) -----

	// Everything the sweep reads, as a value — the same reason DailyPlanStore
	// fingerprints rather than compares identity: a `$derived` read from outside a
	// reactive context is not guaranteed to hand back the same object twice, so
	// the identity version reports stale on a day that never changed.
	//
	// Two things it deliberately leaves out. The BUDGET, because the curve is a
	// statement about every budget, so dragging the window must not invalidate it —
	// that is the whole point of sweeping the range instead of pricing one step of
	// it. And the task TITLES, which ride along on `EnergyTaskInput` but which no
	// part of the sweep reads and no field of `BudgetCurve` carries, so
	// fingerprinting the whole mapped task greyed out a bit-identical curve and
	// asked for a 16-solve re-run every time a row was renamed.
	//
	// The DATE is in for the opposite reason to those two: it is not an input to
	// the sweep at all, it is WHICH DAY the sweep answers for. `#selectedDate`
	// moves with the live clock while the new day's tasks are still
	// loading, so through that window the inputs alone would report a curve swept
	// on one day as fresh on another.
	#curveFingerprint = $derived(
		JSON.stringify({
			date: this.#session.selectedDate,
			tasks: this.#energyTasks.map(
				({ id, difficulty, enjoyment, cognitiveDemand, physicalDemand }) => [
					id,
					difficulty,
					enjoyment,
					cognitiveDemand,
					physicalDemand,
				],
			),
			params: this.#lab.params,
			constants: this.#session.userConstants,
		}),
	);

	#budgetCurve = $state<BudgetCurve | null>(null);
	#isCurveBusy = $state(false);
	#hasCurveError = $state(false);
	#curveFor = $state<string | null>(null);

	/** Null until the user asks: the sweep costs a full solve per step. */
	get budgetCurve(): BudgetCurve | null {
		return this.#budgetCurve;
	}
	get isCurveBusy(): boolean {
		return this.#isCurveBusy;
	}
	/** The last sweep failed; the curve shown (if any) predates the failure. */
	get hasCurveError(): boolean {
		return this.#hasCurveError;
	}
	/** A curve exists but describes an older version of the day. */
	get isCurveStale(): boolean {
		return this.#budgetCurve !== null && this.#curveFor !== this.#curveFingerprint;
	}

	/**
	 * One full solve per step of the swept range (MATH.md §8.12) — ~16 of them,
	 * which is why this is a method and not a `$derived`. The yield before the
	 * sweep lets the caller's busy state paint; the sweep itself blocks.
	 */
	async computeBudgetCurve(): Promise<void> {
		if (this.#isCurveBusy) return;

		this.#isCurveBusy = true;
		this.#hasCurveError = false;

		try {
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Both read after the yield, in one tick, so the curve matches the
			// fingerprint it was solved from.
			const tasks = this.#energyTasks;

			this.#budgetCurve = suggestBudgetCurve(
				tasks,
				$state.snapshot(this.#lab.params),
				this.#session.userConstants,
			);

			this.#curveFor = this.#curveFingerprint;
		} catch (e) {
			// The only caller is a fire-and-forget click handler; rethrowing would be
			// an unhandled rejection, not a signal.
			logError('Failed to compute the budget curve', e);
			this.#hasCurveError = true;
		} finally {
			this.#isCurveBusy = false;
		}
	}

	// ----- The add-task draft, priced on demand -----

	#previewDraft = $state<DraftTask | null>(null);
	/** What the Lab's add-task form has typed so far, or `null` while it is unnamed. */
	get previewDraft(): DraftTask | null {
		return this.#previewDraft;
	}
	set previewDraft(draft: DraftTask | null) {
		// The form republishes on every edit, the title included — and the title
		// reaches no solve, so a keystroke in it arrives here as the same draft.
		if (isSameDraft(this.#previewDraft, draft)) return;

		this.#previewDraft = draft;
		// Dropped rather than marked stale: a held number beside live fields is a
		// number that disagrees with them, and re-pricing costs one click.
		this.#draftImpact = null;
	}

	#draftImpact = $state<EnergyDraftImpact | null>(null);
	/** Null until the user asks: the reading costs a full solve. */
	get draftImpact(): EnergyDraftImpact | null {
		return this.#draftImpact;
	}

	#isDraftBusy = $state(false);
	get isDraftBusy(): boolean {
		return this.#isDraftBusy;
	}

	/**
	 * One solve of the day with the published draft in it, against the plan this
	 * store already holds. A method and not a `$derived` for the reason the advice
	 * is (business/AGENTS.md): the optimizer costs 35-195 ms over the window the
	 * form is typed in. The yield before the solve lets the busy state paint.
	 *
	 * It reads `previewDraft` rather than taking one: the form publishes the draft
	 * here already, and a press that could name a different one is a reading the
	 * panel would print beside fields that did not produce it.
	 */
	async computeDraftImpact(): Promise<void> {
		const draft = this.#previewDraft;

		// Nothing published — an unnamed task is not one the day can be priced with,
		// and the button that asks is disabled there.
		if (draft === null || this.#isDraftBusy) return;

		this.#isDraftBusy = true;

		try {
			await new Promise((resolve) => setTimeout(resolve, 0));

			const impact = calculateEnergyDraftImpact(
				{
					tasks: this.#session.tasks,
					windowHours: this.#windowHours,
					params: $state.snapshot(this.#lab.params),
					constants: this.#session.userConstants,
				},
				draft,
				this.#plan,
			);

			// The form can move the draft inside that yield — a slider drag publishes on
			// the next flush — and the setter drops the reading when it does. Assigning
			// anyway would put back a number the fields above it no longer produce,
			// which is the disagreement dropping exists to prevent.
			if (isSameDraft(draft, this.#previewDraft)) this.#draftImpact = impact;
		} catch (e) {
			// The only caller is a fire-and-forget click handler; rethrowing would be
			// an unhandled rejection, not a signal. The panel returns to its prompt.
			logError('Failed to price the add-task draft', e);
		} finally {
			this.#isDraftBusy = false;
		}
	}

	// ----- Causal window -----

	// D is today, not the viewed day (business/AGENTS.md,
	// "Being a today-only instrument does not exempt its fits").
	#drainWindow = $derived(
		applyCausalWindow(this.#observations.drainObservations, this.#session.today),
	);
	#restWindow = $derived(
		applyCausalWindow(this.#observations.restObservations, this.#session.today),
	);

	// ----- Drain calibration (α fit from end-of-session ratings) -----

	// The fit conditions on the CURRENT recovery parameters (that conditioning
	// is what makes α identifiable at all — MATH.md §8.7), so dragging a
	// recovery slider legitimately re-fits. The prior anchors to the model
	// DEFAULTS, not the current inputs, mirroring fitUserConstants.
	#drainLawParams = $derived({
		recoveryRate: this.#lab.params.recoveryRate,
		restRecoveryMultiplier: this.#lab.params.restRecoveryMultiplier,
		microRecoveryFraction: this.#lab.params.microRecoveryFraction,
	});

	#cognitiveDrainFit = $derived(
		fitDrainRate(
			toCognitiveDrainObservations(
				keepDayFirstDrainRows(this.#drainWindow.counted, toCognitiveDrainObservations),
			),
			DEFAULT_ENERGY_PARAMS.alphaCog,
			this.#drainLawParams,
		),
	);
	get cognitiveDrainFit() {
		return this.#cognitiveDrainFit;
	}

	#physicalDrainFit = $derived(
		fitDrainRate(
			toPhysicalDrainObservations(
				keepDayFirstDrainRows(this.#drainWindow.counted, toPhysicalDrainObservations),
			),
			DEFAULT_ENERGY_PARAMS.alphaPhys,
			this.#drainLawParams,
		),
	);
	get physicalDrainFit() {
		return this.#physicalDrainFit;
	}

	#drainFitApplied = $derived(
		(!this.#cognitiveDrainFit.fitted ||
			Math.abs(this.#lab.params.alphaCog - round2(this.#cognitiveDrainFit.alpha)) < 1e-9) &&
			(!this.#physicalDrainFit.fitted ||
				Math.abs(this.#lab.params.alphaPhys - round2(this.#physicalDrainFit.alpha)) < 1e-9),
	);

	#applyDrainFit() {
		if (this.#cognitiveDrainFit.fitted) {
			this.#lab.setParam('alphaCog', round2(this.#cognitiveDrainFit.alpha));
		}

		if (this.#physicalDrainFit.fitted) {
			this.#lab.setParam('alphaPhys', round2(this.#physicalDrainFit.alpha));
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
			toRestObservations(this.#restWindow.counted),
			DEFAULT_ENERGY_PARAMS.recoveryRate,
			{
				restRecoveryMultiplier: this.#lab.params.restRecoveryMultiplier,
			},
		),
	);
	get recoveryFit() {
		return this.#recoveryFit;
	}

	#recoveryFitApplied = $derived(
		!this.#recoveryFit.fitted ||
			Math.abs(this.#lab.params.recoveryRate - round2(this.#recoveryFit.rate)) < 1e-9,
	);

	#applyRecoveryFit() {
		if (this.#recoveryFit.fitted)
			this.#lab.setParam('recoveryRate', round2(this.#recoveryFit.rate));
	}

	// ----- Stopping calibration (λ₀ fit from finished days) -----

	// Conditions on ALL current dynamics params (α, r, m, b, satiety) and the
	// user-owned terminal energy value — so a conditioning-slider change
	// legitimately re-fits, like the drain fit re-fitting under new recovery
	// sliders. The extraction itself is λ₀-free (no circularity with the
	// current free-time slider). Prior anchors to the model DEFAULT.
	#stoppingFit = $derived(
		fitStoppingValue(
			this.#lab.stopObservations,
			DEFAULT_ENERGY_PARAMS.freeTimeValue,
			this.#lab.params,
			this.#session.userConstants,
		),
	);
	get stoppingFit() {
		return this.#stoppingFit;
	}

	#stoppingFitApplied = $derived(
		!this.#stoppingFit.fitted ||
			Math.abs(this.#lab.params.freeTimeValue - round2(this.#stoppingFit.value)) < 1e-9,
	);

	#applyStoppingFit() {
		if (this.#stoppingFit.fitted)
			this.#lab.setParam('freeTimeValue', round2(this.#stoppingFit.value));
	}

	// ----- Adopting the fits (one operation, because the order is the math) -----

	/** Any fit has something to offer — with none, "already applied" would be a lie. */
	#hasFit = $derived(
		this.#cognitiveDrainFit.fitted ||
			this.#physicalDrainFit.fitted ||
			this.#recoveryFit.fitted ||
			this.#stoppingFit.fitted,
	);
	get hasFit() {
		return this.#hasFit;
	}

	/** Every fitted parameter already sits at its fit — nothing left to adopt. */
	#fitsApplied = $derived(
		this.#recoveryFitApplied && this.#drainFitApplied && this.#stoppingFitApplied,
	);
	get fitsApplied() {
		return this.#fitsApplied;
	}

	/**
	 * Copy every fit into the sliders, in the ONE order the model admits (business/model/AGENTS.md
	 * / MATH.md §8.7/§8.9/§8.10): r first, then α conditioned on it, then λ₀ on
	 * both. The three used to be three buttons, and any order but this one left a
	 * parameter stale — apply α then r and the α just adopted was fitted against
	 * the old recovery, with nothing on screen to say so. Applying separately is no
	 * longer reachable: each step reads the fits re-derived under the step before
	 * it, so this lands on the fixed point in one press.
	 */
	applyFits() {
		this.#applyRecoveryFit();
		this.#applyDrainFit();
		this.#applyStoppingFit();
	}
}

/**
 * Created by `/energy`'s instance script, so a visit is this store's lifetime: the
 * list's order is snapshotted per visit, and leaving the page leaves nothing solving.
 */
export function setEnergyPlanStore(
	session: SessionStore,
	observations: EnergyObservationStore,
	lab: EnergyLabStore,
): EnergyPlanStore {
	return setContext<EnergyPlanStore>(CONTEXT_KEY, new EnergyPlanStore(session, observations, lab));
}

export function getEnergyPlanStore(): EnergyPlanStore {
	return getContext<EnergyPlanStore>(CONTEXT_KEY);
}
