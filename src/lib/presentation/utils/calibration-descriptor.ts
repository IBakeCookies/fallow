/* The "Your model" rows: each fit's value beside the default it is anchored to.

   Five rows × fitted-or-not is ten spellings of a number, and the ≈/±/unit
   vocabulary has to match the Energy Lab's fit lines exactly. It lived in
   `analytics/+page.svelte`, where a row that quietly printed a default as though
   it were a fit would have gone unnoticed.

   The counts are each fit's OWN `usedCount` — informative observations, not raw
   log rows. The ϕ row's is additionally recency-weighted, so it is a fresh-log
   equivalent and prints with a decimal (MATH.md §5.2); the other four are
   whole counts. A row that deferred today's logs names them separately, as the
   raw rows they are. */

import * as m from '$lib/paraglide/messages.js';
import { formatDecimals } from '$lib/presentation/utils/number-format';
import type { CalibrationSnapshot } from '$lib/business/session-history';

/** One fit's history as a sparkline. */
export interface RowTrend {
	/** Ascending by recorded day, ending in the value this row prints */
	values: number[];
	/** Drawn inside the line's range, so the line's level says something */
	defaultValue: number;
	/** A line carries no numbers, so the name states start, end and span */
	ariaLabel: string;
}

export interface ModelRow {
	label: string;
	/** The fit with its ± posterior std, or the bare default when not fitted */
	value: string;
	/** The default the fit is anchored to, and how many observations moved it */
	note: string;
	/** Its recorded history, or null while there is not yet a line to draw */
	trend: RowTrend | null;
}

/** One row per calibrated parameter; empty until the snapshot has loaded. */
export function calibrationRows(
	calibration: CalibrationSnapshot | null,
	locale: string,
): ModelRow[] {
	if (calibration === null) return [];

	const f2 = (value: number) => formatDecimals(value, 2, locale);
	const minutes = (hours: number) => `${Math.round(hours * 60)} ${m.unit_minutes()}`;
	const perHour = (value: number) => `${f2(value)} ${m.unit_per_hour()}`;
	const outputPerHour = (value: number) => `${f2(value)} ${m.unit_output_per_hour()}`;

	// The §5 prequential skill reading arrives in signed hours (positive when the
	// fit was closer); the spelling is one decimal of minutes, direction out loud.
	const noteWithSkill = (note: string, skill: CalibrationSnapshot['flow']['skill']) =>
		!skill
			? note
			: `${note} · ${(skill.gapHours >= 0
					? m.ana_model_note_flow_closer
					: m.ana_model_note_flow_further)({
					value: `${formatDecimals(Math.abs(skill.gapHours) * 60, 1, locale)} ${m.unit_minutes()}`,
					count: skill.scoredCount,
				})}`;

	const rate = (
		fit: {
			fitted: boolean;
		},
		value: number,
		std: number | undefined,
		unit: string,
	) => (fit.fitted ? `≈ ${f2(value)} ± ${f2(std ?? 0)} ${unit}` : `${f2(value)} ${unit}`);

	// One point is a dot, not a trend — and a row that plotted one would draw a
	// flat line through whatever single day happens to be recorded.
	const trend = (
		label: string,
		values: number[],
		defaultValue: number,
		format: (value: number) => string,
	): RowTrend | null =>
		values.length < 2
			? null
			: {
					values,
					defaultValue,
					ariaLabel: m.ana_model_trend_aria({
						label,
						count: values.length,
						from: format(values[0]),
						to: format(values[values.length - 1]),
					}),
				};

	const { flow, energy, stopping, defaults } = calibration;

	// Both α fits read the same 🪫 rows, so the two drain rows name one count.
	const drainNote = (value: number, count: number) =>
		energy.pendingDrainCount > 0
			? m.ana_model_note_drain_pending({
					value: f2(value),
					count,
					pending: energy.pendingDrainCount,
				})
			: m.ana_model_note_ratings({
					value: f2(value),
					count,
				});

	const series = calibration.trend;
	const flowLabel = m.ana_model_flow();
	const recoveryLabel = m.ana_model_recovery();
	const cognitiveLabel = m.ana_model_drain_cog();
	const physicalLabel = m.ana_model_drain_phys();
	const stopLabel = m.ana_model_stop();

	return [
		{
			label: flowLabel,
			value: flow.fitted ? `≈ ${minutes(flow.phiHours)}` : minutes(flow.phiHours),
			// Σw, what the history is worth in FRESH logs (MATH.md §5.2) — a
			// year-old log counts half. Printing the raw count beside a discounted
			// fit would overstate what moved it. Today's logs are in neither number:
			// no fit has read them yet, so they are named, not folded in — the
			// row would otherwise read as though the ⚡ just logged had done nothing.
			// The skill sentence's predicted-log count DOES include them — a fit
			// predicted them even though none has read them (MATH.md §5).
			note: noteWithSkill(
				flow.pendingCount > 0
					? m.ana_model_note_flow_pending({
							value: minutes(flow.defaultPhiHours),
							count: formatDecimals(flow.usedCount, 1, locale),
							pending: flow.pendingCount,
						})
					: m.ana_model_note_flow({
							value: minutes(flow.defaultPhiHours),
							count: formatDecimals(flow.usedCount, 1, locale),
						}),
				flow.skill,
			),
			trend: trend(flowLabel, series.phiHours, flow.defaultPhiHours, minutes),
		},
		{
			label: recoveryLabel,
			value: rate(
				energy.recovery,
				energy.recovery.rate,
				energy.recovery.rateStd,
				m.unit_per_hour(),
			),
			note:
				energy.pendingRestCount > 0
					? m.ana_model_note_recovery_pending({
							value: f2(defaults.recoveryRate),
							count: energy.recovery.usedCount,
							pending: energy.pendingRestCount,
						})
					: m.ana_model_note_ratings({
							value: f2(defaults.recoveryRate),
							count: energy.recovery.usedCount,
						}),
			trend: trend(recoveryLabel, series.recoveryRate, defaults.recoveryRate, perHour),
		},
		{
			label: cognitiveLabel,
			value: rate(
				energy.cognitiveDrain,
				energy.cognitiveDrain.alpha,
				energy.cognitiveDrain.alphaStd,
				m.unit_per_hour(),
			),
			note: drainNote(defaults.alphaCog, energy.cognitiveDrain.usedCount),
			trend: trend(cognitiveLabel, series.alphaCog, defaults.alphaCog, perHour),
		},
		{
			label: physicalLabel,
			value: rate(
				energy.physicalDrain,
				energy.physicalDrain.alpha,
				energy.physicalDrain.alphaStd,
				m.unit_per_hour(),
			),
			note: drainNote(defaults.alphaPhys, energy.physicalDrain.usedCount),
			trend: trend(physicalLabel, series.alphaPhys, defaults.alphaPhys, perHour),
		},
		{
			label: stopLabel,
			value: rate(stopping, stopping.value, stopping.valueStd, m.unit_output_per_hour()),
			note: stopping.todayPending
				? m.ana_model_note_days_pending({
						value: f2(defaults.freeTimeValue),
						count: stopping.usedCount,
					})
				: m.ana_model_note_days({
						value: f2(defaults.freeTimeValue),
						count: stopping.usedCount,
					}),
			trend: trend(stopLabel, series.stoppingValue, defaults.freeTimeValue, outputPerHour),
		},
	];
}
