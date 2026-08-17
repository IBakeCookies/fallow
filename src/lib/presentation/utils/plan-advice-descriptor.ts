/**
 * Plan advice → display rows.
 *
 * The model prices every axis unconditionally (MATH.md §14); deciding which of
 * those answers is worth showing is a band, and bands are presentation policy —
 * so the filter here is `isOutOfBand`, the same call that colors the metric
 * rows. Nothing in this file computes a reading.
 */

import type {
	AdviceAxis,
	AdviceLever,
	AdviceOption,
	BudgetMarginal,
	PlanAdvice,
	SwitchCostPrice,
} from '$lib/business/model/metric/plan-advice';
import type { DeferDestination } from '$lib/business/model/metric/defer-destination';
import * as m from '$lib/paraglide/messages.js';
import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
import {
	AXIS_BAND,
	energyBalanceReading,
	isOutOfBand,
	type Band,
} from '$lib/presentation/utils/band';
import { formatDuration } from '$lib/presentation/utils/duration-format';

/**
 * How many frontier options a row shows. A constant and not a parameter: the one
 * caller has never wanted a different number, and `cap` below is written for
 * "keep both ends", which is not what a caller passing 1 would get.
 */
const MAX_OPTIONS = 3;

export interface AdviceRowOption {
	lever: AdviceLever;
	/** What to do, in words: "Move “Tax return” off today". */
	action: string;
	after: string;
	afterBand: Band;
	/** What it costs in plan value, already signed. */
	cost: string;
	/** Set only when this lever also changes the Day Profile. */
	profileFlip: string | null;
	/** The words on this lever's button, or null when the card supplies them. */
	applyLabel: string | null;
	/**
	 * The budget increase Σ P̄ cannot price (MATH.md §14) — never a member of the
	 * frontier above it, so the card sets it apart rather than listing it as a
	 * fourth comparable option. Always the last option of a row when present.
	 */
	isUnpriced: boolean;
}

export interface AdviceRow {
	axis: AdviceAxis;
	label: string;
	before: string;
	beforeBand: Band;
	options: AdviceRowOption[];
}

export interface AdviceDisplay {
	rows: AdviceRow[];
	/** Active tasks the plan funds no hours for, as a sentence, or null. */
	unfunded: string | null;
	/**
	 * The same read for tasks flagged `mustDoToday`, kept apart because the badge
	 * promises the day, not the hours — and the menu below has no lever for them.
	 */
	unfundedMustDo: string | null;
	/** The budget's shadow price as a sentence (MATH.md §14.2) — always a reading. */
	marginal: string;
	/**
	 * What the day's declared switch cost reserves, and what the plan would be
	 * worth at zero and at double (MATH.md §14.3) — always a reading, and never
	 * phrased as something to act on.
	 */
	switchCost: string;
}

const AXIS_LABEL: Record<AdviceAxis, () => string> = {
	burnoutRisk: m.metric_burnout_risk,
	humanCapacity: m.metric_human_capacity,
	cognitiveLoad: m.metric_cognitive_load,
	physicalLoad: m.metric_physical_load,
	energyBalance: m.metric_energy_balance,
	frictionIndex: m.metric_friction_index,
	timeScarcity: m.metric_time_scarcity,
	scheduleIntegrity: m.metric_schedule_integrity,
};

const QUADRANT_LABEL: Record<DailyQuadrant, () => string> = {
	flow: m.quadrant_flow,
	grind: m.quadrant_grind,
	cruise: m.quadrant_cruise,
	routine: m.quadrant_routine,
};

/**
 * A reading and the band it falls in. Energy Balance reads as a direction AND
 * the share behind it — the metric row agrees, through the same call.
 *
 * A non-reading gets no band: Human Capacity is `Infinity` when a pool holds 0
 * hours with demand on it (MATH.md §14), and `AXIS_BAND` would call that
 * critical — colouring "N/A" red, and announcing it as critical to a screen
 * reader, is a judgement about a number that does not exist. The metric rows
 * render every N/A neutral for the same reason.
 */
function readingOf(axis: AdviceAxis, value: number): { text: string; band: Band } {
	if (!Number.isFinite(value))
		return {
			text: m.na_value(),
			band: 'neutral',
		};

	const text = axis === 'energyBalance' ? energyBalanceReading(value) : `${Math.round(value)}%`;

	return {
		text,
		band: AXIS_BAND[axis](value),
	};
}

/**
 * The lever carries unrounded hours on purpose (MATH.md §14); only the label
 * rounds, and only to keep "6.4167h" out of the card. `maximumFractionDigits`
 * rather than `formatDecimals`, which pads: a whole-hour lever reads "8h", not
 * "8.00h". The locale owns the separator either way — a German card printing
 * "6.42h" between two German dates is what `number-format.ts` exists to stop.
 */
function formatHours(hours: number, locale: string): string {
	return hours.toLocaleString(locale, {
		maximumFractionDigits: 2,
	});
}

function formatAction(lever: AdviceLever, locale: string): string {
	if (lever.kind === 'defer-task')
		return m.advice_action_defer({
			title: lever.title,
		});

	return m.advice_action_budget({
		hours: formatHours(lever.hours, locale),
	});
}

/**
 * The button's whole accessible name, built here because only this file has the
 * locale that rounds the hours (WCAG 2.5.3 — the visible words ARE the name, so
 * there is nothing for an `aria-label` to contradict). Null for a deferral,
 * whose label the card owns: it needs the task title, not an hours reading.
 *
 * The unpriced increase names no hours. Two axes both offer `budget + 1`, so the
 * hours would not tell those buttons apart, and what distinguishes this one is
 * not its number but that it is paid for in an hour of the user's day.
 */
function formatApplyLabel(lever: AdviceLever, isUnpriced: boolean, locale: string): string | null {
	if (lever.kind === 'defer-task') return null;

	return isUnpriced
		? m.advice_apply_budget_hour()
		: m.advice_apply_budget({
				hours: formatHours(lever.hours, locale),
			});
}

/**
 * A change in plan value, signed: "+3.1% plan value", "−6.2% plan value", or
 * "N/A" when there is no Σ P̄ to compare against (MATH.md §14.1-3).
 *
 * An explicit sign both ways, because "+3.1%" and "−6.2%" have to be told apart
 * at a glance and a bare "6.2%" reads as a gain. One signing for all three
 * readings priced this way — the cost column, the budget's marginal and the
 * switch cost's bracket.
 */
function signedPlanValue(deltaPercent: number | null, locale: string): string {
	if (deltaPercent === null) return m.na_value();

	const sign = deltaPercent > 0 ? '+' : deltaPercent < 0 ? '−' : '';

	const magnitude = Math.abs(deltaPercent).toLocaleString(locale, {
		maximumFractionDigits: 1,
	});

	return m.advice_cost({
		percent: `${sign}${magnitude}`,
	});
}

function formatCost(deltaPercent: number | null, locale: string): string {
	// A genuinely costless lever, said in words. Null falls through to
	// `signedPlanValue`'s own N/A — the plan's Σ P̄ is 0 and there is no ratio.
	if (deltaPercent === 0) return m.advice_cost_free();

	return signedPlanValue(deltaPercent, locale);
}

/**
 * The block the budget would buy, and who gets it (MATH.md §14.2). Priced in the
 * same "% plan value" as the cost column — `advice_cost` spells that half — but
 * signed +, because a wider budget can only add.
 */
function formatMarginal(marginal: BudgetMarginal, locale: string): string {
	const minutes = Math.round(marginal.blockHours * 60);

	// Keyed on the gain as well as the recipient: the pooled heuristic can hand a
	// task the block while the day's value nets out flat (MATH.md §14.2), and
	// "goes to X · +0% plan value" is the same non-advice as no recipient at all.
	//
	// The sentence is scoped to output, not to the worth of the time: on these
	// same days the unpriced `budget + 1` lever below is still right, because Load
	// is `weightedHours / budget` and a longer day for the same work is real
	// relief (MATH.md §14.2). "Adds nothing to this plan" contradicted that row.
	if (!marginal.recipient || marginal.planValueGainPercent === 0)
		return m.advice_marginal_none({
			minutes,
		});

	return m.advice_marginal({
		minutes,
		title: marginal.recipient.title,
		gain: signedPlanValue(marginal.planValueGainPercent, locale),
	});
}

/**
 * What the declared switch cost is doing to today, bracketed by zero and double
 * (MATH.md §14.3).
 *
 * Conditional on purpose: each alternative is what this plan would be worth *if*
 * the declaration were that number, and never "switch faster and gain this". The
 * user cannot decide to switch tasks more cheaply, only report how cheaply they
 * do — which is the same reason §14 refuses to make this a lever.
 */
function formatSwitchCostPrice(price: SwitchCostPrice, locale: string): string {
	const declared = formatDuration(price.declared);
	// Both arms or neither: `plan-advice.ts` drops them on the same test, |s| under
	// a minute, so a length-1 `alternatives` does not exist (MATH.md §14.3).
	const [free, doubled] = price.alternatives;

	// TWO INDEPENDENT SUPPRESSIONS, and unioning them was a defect: a plan can
	// reserve nothing and still have a large bracket, because the declaration is
	// *why* it funds too few tasks to switch between. That is the generic 3-task
	// day at budget 0.5 h and s = 15 min, not a corner — every case swept lands in
	// it, at a median +41.9% and up to +63.4% at s = 0 (MATH.md §14.3) — and the
	// unioned version printed "pays for no switching" — discarding the reading
	// both extra solves existed to produce, on precisely the day the constant did
	// the most damage.
	const head =
		price.reservedHours === 0
			? m.advice_switch_cost_none({
					declared,
				})
			: m.advice_switch_cost({
					reserved: formatDuration(price.reservedHours),
					// Non-null by the branch: the share is null only at budget 0, where
					// the allocator funds nothing and `reservedHours` is 0 (MATH.md §14.3).
					share: Math.round(price.reservedShare! * 100),
					declared,
				});

	// The bracket is dropped only when it would say nothing, and that is read off
	// the numbers rather than guessed from the day's shape: a null delta means the
	// plan's Σ P̄ is 0 and there is no ratio to state (MATH.md §14.1-3), and two
	// zero deltas mean both declarations reproduce this exact plan — which is what
	// a day with a single task on the list looks like, as against a day the
	// declaration starved down to one funded task, where the free arm is large.
	//
	// One arm answers for the pair: the two deltas share a single `baseValue > 0`
	// test in the model, so they are both null or both numbers. `doubled` is named
	// here only to narrow the type.
	if (
		!free ||
		!doubled ||
		free.planValueDeltaPercent === null ||
		(free.planValueDeltaPercent === 0 && doubled.planValueDeltaPercent === 0)
	)
		return head;

	return `${head} ${m.advice_switch_cost_bracket({
		free: signedPlanValue(free.planValueDeltaPercent, locale),
		doubled: formatDuration(doubled.switchCost),
		cost: signedPlanValue(doubled.planValueDeltaPercent, locale),
	})}`;
}

/**
 * The frontier rises in plan value, so its *last* option is the cheapest one —
 * the "most of the relief for a fraction of the cost" row §14 returns a whole
 * frontier to surface. Truncating from the end would drop exactly that, so drop
 * from the middle and keep both ends.
 */
function cap(options: AdviceOption[]): AdviceOption[] {
	if (options.length <= MAX_OPTIONS) return options;

	return [...options.slice(0, MAX_OPTIONS - 1), options[options.length - 1]];
}

/**
 * Where every defer lever on the card sends a task, as tomorrow stands (ROADMAP
 * item 21) — counts and hours, and nothing about what the deferred task itself
 * would get there: that is the Δ% pair item 8 was superseded for, and after item
 * 16 the destination's hours are frequently a weekday median rather than a
 * declaration.
 *
 * Its own function and its own card prop rather than a field on `AdviceDisplay`:
 * that object is built from `PlanAdvice`, which is contractually today's inputs
 * alone (MATH.md §14), and this is a reading about another day.
 */
export function describeDeferDestination(destination: DeferDestination | null): string | null {
	if (!destination) return null;

	const hours = formatDuration(destination.budgetHours);

	// Nothing on it and no hours to spend is nothing to say — the dead row item 21's
	// own kill criterion names, which only a user with no budgeted day in history
	// reaches (item 16). The pair, never the hours alone: an over-subscribed unseen
	// day is the most useful thing this line says.
	if (destination.taskCount === 0)
		return destination.budgetHours === 0
			? null
			: m.advice_destination_empty({
					hours,
				});

	return destination.taskCount === 1
		? m.advice_destination_one({
				hours,
				funded: destination.fundedCount,
			})
		: m.advice_destination({
				hours,
				count: destination.taskCount,
				funded: destination.fundedCount,
			});
}

/** `locale` is a BCP-47 tag — `getDateLocale()` at the call site. */
export function buildAdviceDisplay(advice: PlanAdvice, locale: string): AdviceDisplay {
	const toRow = (
		axis: AdviceAxis,
		option: AdviceOption,
		cost: string,
		isUnpriced = false,
	): AdviceRowOption => {
		const after = readingOf(axis, option.after);

		return {
			lever: option.lever,
			action: formatAction(option.lever, locale),
			after: after.text,
			afterBand: after.band,
			cost,
			profileFlip: option.quadrantFlip
				? m.advice_profile_flip({
						profile: QUADRANT_LABEL[option.quadrantFlip](),
					})
				: null,
			applyLabel: formatApplyLabel(option.lever, isUnpriced, locale),
			isUnpriced,
		};
	};

	const rows = advice.findings
		.filter(
			(finding) =>
				isOutOfBand(finding.axis, finding.before) &&
				// A reading that is not a number judges nothing — `readingOf` prints it
				// N/A and bands it neutral — so it earns a row only when there is a
				// lever under it. That is Human Capacity's Infinity, which real options
				// bring down to a number. The two NaN sentinels (MATH.md §14.1-5) have
				// none, and `getBandBiggerBetter(NaN)` calls Schedule Integrity's
				// critical: a row reading "N/A · nothing improves this" on a day with no
				// budget is the alarm-about-nothing the sentinel exists to prevent.
				(Number.isFinite(finding.before) ||
					finding.options.length > 0 ||
					finding.unpriced !== null),
		)
		.map((finding) => {
			const before = readingOf(finding.axis, finding.before);

			return {
				axis: finding.axis,
				label: AXIS_LABEL[finding.axis](),
				before: before.text,
				beforeBand: before.band,
				options: [
					...cap(finding.options).map((option) =>
						toRow(finding.axis, option, formatCost(option.planValueDeltaPercent, locale)),
					),
					// Last, and priced in hours rather than plan value: Σ P̄ *rises* when
					// the budget does, so showing that rise in the cost column would read
					// as the extra hour being free (MATH.md §14).
					...(finding.unpriced
						? [toRow(finding.axis, finding.unpriced, m.advice_cost_hour(), true)]
						: []),
				],
			};
		});

	const unfundedCount = advice.unfundedTaskIds.length;
	const unfundedMustDoCount = advice.unfundedMustDoTaskIds.length;

	return {
		rows,
		marginal: formatMarginal(advice.budgetMarginal, locale),
		switchCost: formatSwitchCostPrice(advice.switchCostPrice, locale),
		unfunded:
			unfundedCount === 0
				? null
				: unfundedCount === 1
					? m.advice_unfunded_one()
					: m.advice_unfunded({
							count: unfundedCount,
						}),
		unfundedMustDo:
			unfundedMustDoCount === 0
				? null
				: unfundedMustDoCount === 1
					? m.advice_unfunded_must_do_one()
					: m.advice_unfunded_must_do({
							count: unfundedMustDoCount,
						}),
	};
}
