/**
 * Banding policy: a reading → one of four bands, and a band → the tokens and
 * the words that render it.
 *
 * Presentation policy on purpose — calling a number good or bad is a display
 * decision, not domain math, so the thresholds live here and not with the
 * metric model. Nothing in this file computes a reading.
 *
 * A view model carries the **band** (`Metric.band`, `AdviceRow.beforeBand`),
 * never a class string. Keying anything off `text-success` makes renaming a
 * token a silent behaviour change: that is how the dashboard's screen-reader
 * band text was wired, and a `-strong` swap would have dropped it with nothing
 * failing.
 */

import type { AdviceAxis } from '$lib/business/model/metric/plan-advice';
import * as m from '$lib/paraglide/messages.js';

export const BANDS = ['success', 'neutral', 'warning', 'critical'] as const;

export type Band = (typeof BANDS)[number];

/** Value colour per band. */
export const BAND_TEXT_CLASS: Record<Band, string> = {
	success: 'text-success',
	neutral: 'text-ty-primary',
	warning: 'text-warning',
	critical: 'text-danger',
};

/** Fill per band, for completion bars — the same bands, so the same thresholds. */
export const BAND_BAR_CLASS: Record<Band, string> = {
	success: 'bg-success',
	neutral: 'bg-ty-secondary',
	warning: 'bg-warning',
	critical: 'bg-danger',
};

/**
 * The band in words, for the text a screen reader hears where colour is
 * otherwise the only carrier (WCAG 1.4.1). Read per call rather than baked into
 * a table, so it follows a locale switch.
 *
 * Neutral is `null` on purpose: `text-ty-primary` is the default value colour
 * and says nothing, so silence is the honest equivalent.
 */
export function bandLabel(band: Band): string | null {
	switch (band) {
		case 'success':
			return m.metric_band_optimal();
		case 'neutral':
			return null;
		case 'warning':
			return m.metric_band_caution();
		case 'critical':
			return m.metric_band_critical();
	}
}

export function getBandBiggerBetter(value: number): Band {
	if (value >= 75) return 'success';

	if (value >= 50) return 'neutral';

	if (value >= 25) return 'warning';

	return 'critical';
}

export function getBandSmallerBetter(value: number): Band {
	if (value <= 25) return 'success';

	if (value <= 50) return 'neutral';

	if (value <= 75) return 'warning';

	return 'critical';
}

/**
 * Deep Work has an interior optimum, so neither monotone band fits (MATH.md
 * §26): a quarter to 60% of the budget in sustained focus is the shape the row
 * is for — 60 is where Burnout Risk starts bending upward over seeded days —
 * and `getBandBiggerBetter` used to colour a day that is three quarters deep
 * work 'Optimal' beside a Cognitive Load warning about the same hours.
 *
 * It never warns. Outside the optimum the row goes quiet, because a shallow day
 * is a shape rather than a defect, and depletion above it belongs to Burnout
 * Risk — §11.7's split, which took the burnout claim off Momentum for the same
 * reason.
 */
export function getBandDeepWork(value: number): Band {
	return value >= 25 && value <= 60 ? 'success' : 'neutral';
}

/**
 * The band policy for every reading the plan advisor can search on, exported
 * because the advice card decides WHICH findings to surface from exactly the
 * good/bad call the metric rows are coloured by (AGENTS.md R3 — one definition,
 * not two copies of the same thresholds). `satisfies` keeps it total over the
 * axes.
 */
/**
 * Which pool the day leans on, from the cognitive share. The word on the row
 * and the colour behind it are the same call: two copies of `> 60 / < 40` drift
 * into a day labelled "Balanced" and banded a warning.
 */
export function energyBalanceSkew(value: number): 'cognitive' | 'physical' | 'balanced' {
	if (value > 60) return 'cognitive';

	if (value < 40) return 'physical';

	return 'balanced';
}

export const AXIS_BAND = {
	burnoutRisk: (value: number) => getBandSmallerBetter(value),
	humanCapacity: (value: number): Band =>
		value <= 75 ? 'success' : value <= 100 ? 'neutral' : 'critical',
	// Load only reads as a problem past 70%; below that it is just how the day is
	// shaped.
	cognitiveLoad: (value: number) => getBandSmallerBetter(value > 70 ? value : 0),
	physicalLoad: (value: number) => getBandSmallerBetter(value > 70 ? value : 0),
	energyBalance: (value: number): Band =>
		energyBalanceSkew(value) === 'balanced' ? 'success' : 'warning',
	frictionIndex: (value: number) => getBandSmallerBetter(value),
	grindDensity: (value: number) => getBandSmallerBetter(value),
	timeScarcity: (value: number) => getBandSmallerBetter(value),
	scheduleIntegrity: (value: number) => getBandBiggerBetter(value),
} satisfies Record<AdviceAxis, (value: number) => Band>;

/** Whether a reading is bad enough to be worth advice about. */
export function isOutOfBand(axis: AdviceAxis, value: number): boolean {
	const band = AXIS_BAND[axis](value);

	return band === 'warning' || band === 'critical';
}
