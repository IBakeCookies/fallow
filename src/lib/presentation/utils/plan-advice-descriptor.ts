/**
 * Plan advice → display rows.
 *
 * The model prices every axis unconditionally (MATH.md §14); deciding which of
 * those answers is worth showing is a band, and bands are presentation policy —
 * so the filter here is `isOutOfBand`, the same call that colors the metric
 * rows. Nothing in this file computes a reading.
 */

import type { AdviceAxis, AdviceLever, PlanAdvice } from '$lib/business/model/metric/plan-advice';
import * as m from '$lib/paraglide/messages.js';
import type { DailyQuadrant } from '$lib/business/model/metric/calculation';
import { BAND, isOutOfBand } from '$lib/presentation/utils/metric-descriptor';

export interface AdviceRowOption {
	lever: AdviceLever;
	/** What to do, in words: "Move “Tax return” off today". */
	action: string;
	after: string;
	afterStyle: string;
	/** What it costs in plan value, already signed. */
	cost: string;
	/** Set only when this lever also changes the Day Profile. */
	profileFlip: string | null;
}

export interface AdviceRow {
	axis: AdviceAxis;
	label: string;
	before: string;
	beforeStyle: string;
	options: AdviceRowOption[];
}

export interface AdviceDisplay {
	rows: AdviceRow[];
	/** Active tasks the plan funds no hours for, as a sentence, or null. */
	unfunded: string | null;
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

/** Energy Balance reads as a direction, not a percentage — the metric row agrees. */
function formatReading(axis: AdviceAxis, value: number): string {
	if (!Number.isFinite(value)) return m.na_value();

	if (axis === 'energyBalance')
		return value > 60
			? m.metric_cognitive_heavy()
			: value < 40
				? m.metric_physical_heavy()
				: m.metric_balanced();

	return `${Math.round(value)}%`;
}

function formatAction(lever: AdviceLever): string {
	if (lever.kind === 'defer-task')
		return m.advice_action_defer({
			title: lever.title,
		});

	return m.advice_action_budget({
		hours: lever.hours,
	});
}

function formatCost(deltaPercent: number): string {
	if (deltaPercent === 0) return m.advice_cost_free();

	// An explicit sign both ways: "+3.1%" and "−6.2%" have to be told apart at a
	// glance, and a bare "6.2%" reads as a gain.
	return m.advice_cost({
		percent: `${deltaPercent > 0 ? '+' : '−'}${Math.abs(deltaPercent)}`,
	});
}

export function buildAdviceDisplay(advice: PlanAdvice, maxOptions = 3): AdviceDisplay {
	const rows = advice.findings
		.filter((finding) => isOutOfBand(finding.axis, finding.before))
		.map((finding) => ({
			axis: finding.axis,
			label: AXIS_LABEL[finding.axis](),
			before: formatReading(finding.axis, finding.before),
			beforeStyle: BAND[finding.axis](finding.before).color,
			options: finding.options.slice(0, maxOptions).map((option) => ({
				lever: option.lever,
				action: formatAction(option.lever),
				after: formatReading(finding.axis, option.after),
				afterStyle: BAND[finding.axis](option.after).color,
				cost: formatCost(option.planValueDeltaPercent),
				profileFlip:
					option.quadrant === advice.quadrant
						? null
						: m.advice_profile_flip({
								profile: QUADRANT_LABEL[option.quadrant](),
							}),
			})),
		}));

	const unfundedCount = advice.unfundedTaskIds.length;

	return {
		rows,
		unfunded:
			unfundedCount === 0
				? null
				: unfundedCount === 1
					? m.advice_unfunded_one()
					: m.advice_unfunded({
							count: unfundedCount,
						}),
	};
}
