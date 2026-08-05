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
import * as m from '$lib/paraglide/messages.js';
import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
import { AXIS_BAND, isOutOfBand, type Band } from '$lib/presentation/utils/band';
import { formatDuration } from '$lib/presentation/utils/duration-format';

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
	grindDensity: m.metric_grind_density,
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
 * A reading and the band it falls in. Energy Balance reads as a direction, not
 * a percentage — the metric row agrees.
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

	const text =
		axis === 'energyBalance'
			? value > 60
				? m.metric_cognitive_heavy()
				: value < 40
					? m.metric_physical_heavy()
					: m.metric_balanced()
			: `${Math.round(value)}%`;

	return {
		text,
		band: AXIS_BAND[axis](value),
	};
}

function formatAction(lever: AdviceLever): string {
	if (lever.kind === 'defer-task')
		return m.advice_action_defer({
			title: lever.title,
		});

	// The lever carries unrounded hours on purpose (MATH.md §14); only the label
	// rounds, and only to keep "6.42h" out of the card.
	return m.advice_action_budget({
		hours: Number(lever.hours.toFixed(2)),
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
function signedPlanValue(deltaPercent: number | null): string {
	if (deltaPercent === null) return m.na_value();

	return m.advice_cost({
		percent: `${deltaPercent > 0 ? '+' : deltaPercent < 0 ? '−' : ''}${Math.abs(deltaPercent)}`,
	});
}

function formatCost(deltaPercent: number | null): string {
	// Nothing to compare against — the current plan's Σ P̄ is 0 (MATH.md §14).
	if (deltaPercent === null) return m.na_value();

	if (deltaPercent === 0) return m.advice_cost_free();

	return signedPlanValue(deltaPercent);
}

/**
 * The block the budget would buy, and who gets it (MATH.md §14.2). Priced in the
 * same "% plan value" as the cost column — `advice_cost` spells that half — but
 * signed +, because a wider budget can only add.
 */
function formatMarginal(marginal: BudgetMarginal): string {
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
		gain: signedPlanValue(marginal.planValueGainPercent),
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
function formatSwitchCostPrice(price: SwitchCostPrice): string {
	const declared = formatDuration(price.declared);
	const [free, doubled] = price.alternatives;

	// TWO INDEPENDENT SUPPRESSIONS, and unioning them was a defect: a plan can
	// reserve nothing and still have a large bracket, because the declaration is
	// *why* it funds too few tasks to switch between. Measured on a 3-task day at
	// budget 0.5 h and s = 15 min, the model computes +41.8% at s = 0 and the
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
					share: Math.round((price.reservedShare ?? 0) * 100),
					declared,
				});

	// The bracket is dropped only when it would say nothing, and that is read off
	// the numbers rather than guessed from the day's shape: a null delta means the
	// plan's Σ P̄ is 0 and there is no ratio to state (MATH.md §14.1-3), and two
	// zero deltas mean both declarations reproduce this exact plan — which is what
	// a day with a single task on the list looks like, as against a day the
	// declaration starved down to one funded task, where the free arm is large.
	if (
		!free ||
		!doubled ||
		free.planValueDeltaPercent === null ||
		doubled.planValueDeltaPercent === null ||
		(free.planValueDeltaPercent === 0 && doubled.planValueDeltaPercent === 0)
	)
		return head;

	return `${head} ${m.advice_switch_cost_bracket({
		free: signedPlanValue(free.planValueDeltaPercent),
		doubled: formatDuration(doubled.switchCost),
		cost: signedPlanValue(doubled.planValueDeltaPercent),
	})}`;
}

/**
 * The frontier rises in plan value, so its *last* option is the cheapest one —
 * the "most of the relief for a fraction of the cost" row §14 returns a whole
 * frontier to surface. Truncating from the end would drop exactly that, so drop
 * from the middle and keep both ends.
 */
function cap(options: AdviceOption[], max: number): AdviceOption[] {
	if (options.length <= max) return options;

	return [...options.slice(0, max - 1), options[options.length - 1]];
}

export function buildAdviceDisplay(advice: PlanAdvice, maxOptions = 3): AdviceDisplay {
	const toRow = (axis: AdviceAxis, option: AdviceOption, cost: string): AdviceRowOption => {
		const after = readingOf(axis, option.after);

		return {
			lever: option.lever,
			action: formatAction(option.lever),
			after: after.text,
			afterBand: after.band,
			cost,
			profileFlip:
				option.quadrant === advice.quadrant
					? null
					: m.advice_profile_flip({
							profile: QUADRANT_LABEL[option.quadrant](),
						}),
		};
	};

	const rows = advice.findings
		.filter((finding) => isOutOfBand(finding.axis, finding.before))
		.map((finding) => {
			const before = readingOf(finding.axis, finding.before);

			return {
				axis: finding.axis,
				label: AXIS_LABEL[finding.axis](),
				before: before.text,
				beforeBand: before.band,
				options: [
					...cap(finding.options, maxOptions).map((option) =>
						toRow(finding.axis, option, formatCost(option.planValueDeltaPercent)),
					),
					// Last, and priced in hours rather than plan value: Σ P̄ *rises* when
					// the budget does, so showing that rise in the cost column would read
					// as the extra hour being free (MATH.md §14).
					...(finding.unpriced
						? [toRow(finding.axis, finding.unpriced, m.advice_cost_hour())]
						: []),
				],
			};
		});

	const unfundedCount = advice.unfundedTaskIds.length;
	const unfundedMustDoCount = advice.unfundedMustDoTaskIds.length;

	return {
		rows,
		marginal: formatMarginal(advice.budgetMarginal),
		switchCost: formatSwitchCostPrice(advice.switchCostPrice),
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
