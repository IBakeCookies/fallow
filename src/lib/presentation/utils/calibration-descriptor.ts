/* The "Your model" rows: each fit's value beside the default it is anchored to.

   Five rows × fitted-or-not is ten spellings of a number, and the ≈/±/unit
   vocabulary has to match the Energy Lab's fit lines exactly. It lived in
   `analytics/+page.svelte`, where a row that quietly printed a default as though
   it were a fit would have gone unnoticed.

   The counts are each fit's OWN `usedCount` — informative observations, not raw
   log rows. */

import * as m from '$lib/paraglide/messages.js';
import { formatDecimals } from '$lib/presentation/utils/number-format';
import type { CalibrationSnapshot } from '$lib/business/session-history';

export interface ModelRow {
	label: string;
	/** The fit with its ± posterior std, or the bare default when not fitted */
	value: string;
	/** The default the fit is anchored to, and how many observations moved it */
	note: string;
}

/** One row per calibrated parameter; empty until the snapshot has loaded. */
export function calibrationRows(
	calibration: CalibrationSnapshot | null,
	locale: string,
): ModelRow[] {
	if (calibration === null) return [];

	const f2 = (value: number) => formatDecimals(value, 2, locale);
	const minutes = (hours: number) => `${Math.round(hours * 60)} ${m.unit_minutes()}`;

	const rate = (
		fit: {
			fitted: boolean;
		},
		value: number,
		std: number | undefined,
		unit: string,
	) => (fit.fitted ? `≈ ${f2(value)} ± ${f2(std ?? 0)} ${unit}` : `${f2(value)} ${unit}`);

	const { flow, energy, stopping, defaults } = calibration;

	return [
		{
			label: m.ana_model_flow(),
			value: flow.fitted ? `≈ ${minutes(flow.phiHours)}` : minutes(flow.phiHours),
			note: m.ana_model_note_flow({
				value: minutes(flow.defaultPhiHours),
				count: flow.usedCount,
			}),
		},
		{
			label: m.ana_model_recovery(),
			value: rate(
				energy.recovery,
				energy.recovery.rate,
				energy.recovery.rateStd,
				m.unit_per_hour(),
			),
			note: m.ana_model_note_ratings({
				value: f2(defaults.recoveryRate),
				count: energy.recovery.usedCount,
			}),
		},
		{
			label: m.ana_model_drain_cog(),
			value: rate(
				energy.cognitiveDrain,
				energy.cognitiveDrain.alpha,
				energy.cognitiveDrain.alphaStd,
				m.unit_per_hour(),
			),
			note: m.ana_model_note_ratings({
				value: f2(defaults.alphaCog),
				count: energy.cognitiveDrain.usedCount,
			}),
		},
		{
			label: m.ana_model_drain_phys(),
			value: rate(
				energy.physicalDrain,
				energy.physicalDrain.alpha,
				energy.physicalDrain.alphaStd,
				m.unit_per_hour(),
			),
			note: m.ana_model_note_ratings({
				value: f2(defaults.alphaPhys),
				count: energy.physicalDrain.usedCount,
			}),
		},
		{
			label: m.ana_model_stop(),
			value: rate(stopping, stopping.value, stopping.valueStd, m.unit_output_per_hour()),
			note: m.ana_model_note_days({
				value: f2(defaults.freeTimeValue),
				count: stopping.usedCount,
			}),
		},
	];
}
