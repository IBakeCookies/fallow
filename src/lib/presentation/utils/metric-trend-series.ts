/* The trend card's three lines, laid onto one slot per day of the viewed range.

   The model reports a point only for days that have a stored session, so the
   gaps are made here: the chart draws a break at a `null`, which is what keeps
   a day the user never opened from reading as a plunge to zero.

   Colours are utility classes, not raw `var()` — STYLE.md's normal path, and
   what `completion-bar-chart` and `energy-chart` already do. The locale tag is
   a parameter for the reason `number-format.ts` gives. */

import * as m from '$lib/paraglide/messages.js';
import { addDays, fromISO } from '$lib/business/utils/date';
import type { MetricTrendPoint } from '$lib/business/model/metric/history';

export interface TrendSeries {
	label: string;
	/** One per slot; `null` is a day with no stored session, not a zero. */
	values: (number | null)[];
	/** A `stroke-*` token class from tokens.css. */
	strokeClass: string;
	/** The matching `fill-*`, for a day with no neighbour to draw a line to. */
	fillClass: string;
	/** A matching `bg-*` for the legend swatch. */
	swatchClass: string;
	isDashed: boolean;
}

export interface MetricTrendSeriesInput {
	trend: MetricTrendPoint[];
	rangeStart: string;
	rangeDays: number;
	/** BCP-47 tag — `getDateLocale()` at the call site */
	locale: string;
}

/** About this many x-axis ticks at any range length; 7 slots print all seven. */
const TICK_TARGET = 7;

export function metricTrendSeries(input: MetricTrendSeriesInput): {
	labels: string[];
	series: TrendSeries[];
} {
	const byDate = new Map(input.trend.map((point) => [point.date, point]));
	const step = Math.ceil(input.rangeDays / TICK_TARGET);

	const slots = Array.from(
		{
			length: input.rangeDays,
		},
		(_, index) => byDate.get(addDays(input.rangeStart, index)) ?? null,
	);

	const labels = slots.map((_, index) =>
		index % step === 0
			? fromISO(addDays(input.rangeStart, index)).toLocaleDateString(input.locale, {
					month: 'short',
					day: 'numeric',
				})
			: '',
	);

	// Every class is spelled out rather than derived from the stroke name:
	// Tailwind tree-shakes the @theme aliases down to what its scanner can see
	// literally, so `'stroke-' + hue` resolves to nothing (STYLE.md, and the same
	// trap `series-color.ts` documents).
	const line = (
		label: string,
		read: (point: MetricTrendPoint) => number,
		classes: Pick<TrendSeries, 'strokeClass' | 'fillClass' | 'swatchClass'>,
		isDashed = false,
	): TrendSeries => ({
		label,
		values: slots.map((point) => (point === null ? null : read(point))),
		...classes,
		isDashed,
	});

	return {
		labels,
		series: [
			line(m.metric_burnout_risk(), (p) => p.burnoutRisk, {
				strokeClass: 'stroke-danger',
				fillClass: 'fill-danger',
				swatchClass: 'bg-danger',
			}),
			line(m.metric_cognitive_load(), (p) => p.cognitiveLoad, {
				strokeClass: 'stroke-mind',
				fillClass: 'fill-mind',
				swatchClass: 'bg-mind',
			}),
			line(
				m.metric_physical_load(),
				(p) => p.physicalLoad,
				{
					strokeClass: 'stroke-body',
					fillClass: 'fill-body',
					swatchClass: 'bg-body',
				},
				true,
			),
		],
	};
}
