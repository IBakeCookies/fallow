/* Each fit's reading on both screens: the Analytics "Your model" rows, the fit beside
   the default it is anchored to, and the Energy Lab's line under each fitted stepper.

   The counts are each fit's OWN `usedCount` — informative observations, not raw
   log rows. The ϕ row's is additionally recency-weighted, so it is a fresh-log
   equivalent and prints with a decimal (MATH.md §5.2); the other four are
   whole counts, and three of them count DAYS rather than logs — the two α fits
   read one 🪫 row per day per reservoir (MATH.md §8.7) and λ₀ reads whole days,
   while the ☕ recovery row keeps counting ratings. A row that deferred today's
   logs names them separately, as the raw rows they are. */

import * as m from '$lib/paraglide/messages.js';
import { FIT_DECIMALS } from '$lib/business/utils/energy-fit-bounds';
import { formatDecimals } from '$lib/presentation/utils/number-format';
import type { CalibrationSnapshot } from '$lib/business/session-history';

// Only for a fit: a default is not an estimate and has no std.
function formatFitFigures(
	isFitted: boolean,
	value: number,
	std: number | undefined,
	locale: string,
) {
	return isFitted
		? {
				value: formatDecimals(value, FIT_DECIMALS, locale),
				std: formatDecimals(std ?? 0, FIT_DECIMALS, locale),
			}
		: null;
}

/** The three ☕/🪫 readings share one shape. */
type RatingSkill = CalibrationSnapshot['energy']['skill']['recovery'];

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
	/** The default the fit is anchored to — minutes for ϕ, a bare two-decimal rate otherwise */
	defaultValue: string;
	/** How many observations moved the fit, and what it has not read yet */
	evidence: string;
	/** Its recorded history, or null while there is not yet a line to draw */
	trend: RowTrend | null;
}

/** One row per calibrated parameter; empty until the snapshot has loaded. */
export function calibrationRows(
	calibration: CalibrationSnapshot | null,
	locale: string,
	pending: { flow: number; rest: number; drain: number },
): ModelRow[] {
	if (calibration === null) return [];

	const f2 = (value: number) => formatDecimals(value, 2, locale);
	const minutes = (hours: number) => `${Math.round(hours * 60)} ${m.unit_minutes()}`;
	const formatFit = (value: number) => formatDecimals(value, FIT_DECIMALS, locale);
	const perHour = (value: number) => `${formatFit(value)} ${m.unit_per_hour()}`;
	const outputPerHour = (value: number) => `${formatFit(value)} ${m.unit_output_per_hour()}`;

	// A §5 prequential skill reading arrives signed, positive when the fit was
	// closer: `spell` gives its size in the row's unit, the pair says the direction.
	const evidenceWithSkill = (
		evidence: string,
		skill: { gap: number; scoredCount: number } | null,
		spell: (size: number) => string,
		closer: typeof m.ana_model_note_flow_closer,
		further: typeof m.ana_model_note_flow_further,
	) =>
		!skill
			? evidence
			: `${evidence} · ${(skill.gap >= 0 ? closer : further)({
					value: spell(Math.abs(skill.gap)),
					count: skill.scoredCount,
				})}`;

	// A ☕/🪫 reading is a drained fraction, spelled as one decimal of the 0–10
	// points the user rated in; its count is ratings, never the drain rows' days.
	const evidenceWithRatingSkill = (evidence: string, skill: RatingSkill) =>
		evidenceWithSkill(
			evidence,
			skill && {
				gap: skill.gapFraction,
				scoredCount: skill.scoredCount,
			},
			(fraction) => formatDecimals(fraction * 10, 1, locale),
			m.ana_model_note_rating_closer,
			m.ana_model_note_rating_further,
		);

	const rate = (
		fit: {
			fitted: boolean;
		},
		value: number,
		std: number | undefined,
		unit: string,
	) => {
		const figures = formatFitFigures(fit.fitted, value, std, locale);

		return figures ? `≈ ${figures.value} ± ${figures.std} ${unit}` : `${f2(value)} ${unit}`;
	};

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

	// One spelling for both drain rows; the counts can differ, a session that
	// loaded one reservoir alone being kept for that reservoir only (MATH.md §8.7).
	const drainEvidence = (count: number, skill: RatingSkill) => {
		const days = m.ana_model_note_days({
			count,
		});

		const drainPending = describeDrainPending(pending.drain);

		return evidenceWithRatingSkill(drainPending ? `${days} · ${drainPending}` : days, skill);
	};

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
			defaultValue: minutes(flow.defaultPhiHours),
			// Σw, what the history is worth in FRESH logs (MATH.md §5.2) — a
			// year-old log counts half. Printing the raw count beside a discounted
			// fit would overstate what moved it. Today's logs are in neither number:
			// no fit has read them yet, so they are named, not folded in — the
			// row would otherwise read as though the ⚡ just logged had done nothing.
			// The skill sentence's predicted-log count DOES include them — a fit
			// predicted them even though none has read them (MATH.md §5).
			evidence: evidenceWithSkill(
				pending.flow > 0
					? m.ana_model_note_flow_pending({
							count: formatDecimals(flow.usedCount, 1, locale),
							pending: pending.flow,
						})
					: m.ana_model_note_flow({
							count: formatDecimals(flow.usedCount, 1, locale),
						}),
				flow.skill && {
					gap: flow.skill.gapHours,
					scoredCount: flow.skill.scoredCount,
				},
				(hours) => `${formatDecimals(hours * 60, 1, locale)} ${m.unit_minutes()}`,
				m.ana_model_note_flow_closer,
				m.ana_model_note_flow_further,
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
			defaultValue: f2(defaults.recoveryRate),
			evidence: evidenceWithRatingSkill(
				pending.rest > 0
					? m.ana_model_note_recovery_pending({
							count: energy.recovery.usedCount,
							pending: pending.rest,
						})
					: m.ana_model_note_ratings({
							count: energy.recovery.usedCount,
						}),
				energy.skill.recovery,
			),
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
			defaultValue: f2(defaults.alphaCog),
			evidence: drainEvidence(energy.cognitiveDrain.usedCount, energy.skill.cognitiveDrain),
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
			defaultValue: f2(defaults.alphaPhys),
			evidence: drainEvidence(energy.physicalDrain.usedCount, energy.skill.physicalDrain),
			trend: trend(physicalLabel, series.alphaPhys, defaults.alphaPhys, perHour),
		},
		{
			label: stopLabel,
			value: rate(stopping, stopping.value, stopping.valueStd, m.unit_output_per_hour()),
			defaultValue: f2(defaults.freeTimeValue),
			evidence: stopping.todayPending
				? m.ana_model_note_days_pending({
						count: stopping.usedCount,
					})
				: m.ana_model_note_days({
						count: stopping.usedCount,
					}),
			trend: trend(stopLabel, series.stoppingValue, defaults.freeTimeValue, outputPerHour),
		},
	];
}

/** The 🪫 ratings logged today, which α reads from tomorrow; undefined while there are none. */
export function describeDrainPending(count: number): string | undefined {
	if (count === 0) return undefined;

	return count === 1
		? m.energy_drain_pending_one()
		: m.energy_drain_pending({
				count,
			});
}

/** The line under a fitted Lab stepper; without a signal it names that instead of a number. */
export interface FitLine {
	text: string;
	hasSignal: boolean;
}

/** The line under each fitted Lab stepper: undefined with no logs. */
export function buildLabFitLines(
	fits: {
		cognitiveDrain: CalibrationSnapshot['energy']['cognitiveDrain'];
		physicalDrain: CalibrationSnapshot['energy']['physicalDrain'];
		recovery: CalibrationSnapshot['energy']['recovery'];
		stopping: Omit<CalibrationSnapshot['stopping'], 'todayPending'>;
	},
	hasLogs: { drain: boolean; rest: boolean; stop: boolean },
	locale: string,
): Record<'alphaCog' | 'alphaPhys' | 'recoveryRate' | 'freeTimeValue', FitLine | undefined> {
	const line = (
		hasLog: boolean,
		fit: { fitted: boolean; usedCount: number },
		value: number,
		std: number | undefined,
		message: (inputs: { value: string; std: string; count: number }) => string,
	) => {
		if (!hasLog) return undefined;

		const figures = formatFitFigures(fit.fitted, value, std, locale);

		return figures
			? {
					text: message({
						...figures,
						count: fit.usedCount,
					}),
					hasSignal: true,
				}
			: {
					text: m.energy_fit_no_signal(),
					hasSignal: false,
				};
	};

	const { cognitiveDrain, physicalDrain, recovery, stopping } = fits;

	return {
		alphaCog: line(
			hasLogs.drain,
			cognitiveDrain,
			cognitiveDrain.alpha,
			cognitiveDrain.alphaStd,
			m.energy_fit_value,
		),
		alphaPhys: line(
			hasLogs.drain,
			physicalDrain,
			physicalDrain.alpha,
			physicalDrain.alphaStd,
			m.energy_fit_value,
		),
		recoveryRate: line(hasLogs.rest, recovery, recovery.rate, recovery.rateStd, m.energy_fit_value),
		// λ₀'s std prices scatter alone (MATH.md §8.10), which the Lab says: spread here, ± on Analytics (M108).
		freeTimeValue: line(
			hasLogs.stop,
			stopping,
			stopping.value,
			stopping.valueStd,
			m.energy_stop_fit_value,
		),
	};
}
