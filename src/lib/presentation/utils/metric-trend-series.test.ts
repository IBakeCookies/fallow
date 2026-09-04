import { describe, expect, it } from 'vitest';
import type { DaySummary, MetricTrendPoint } from '$lib/business/model/metric/history';
import {
	metricTrendSeries,
	yieldTrendSeries,
	type MetricTrendSeriesInput,
	type YieldTrendSeriesInput,
} from '$lib/presentation/utils/metric-trend-series';

const point = (date: string, burnoutRisk: number): MetricTrendPoint => ({
	date,
	burnoutRisk,
	cognitiveLoad: burnoutRisk + 1,
	physicalLoad: burnoutRisk + 2,
});

const input = (over: Partial<MetricTrendSeriesInput> = {}): MetricTrendSeriesInput => ({
	trend: [],
	rangeStart: '2026-07-25',
	rangeDays: 7,
	locale: 'en-US',
	...over,
});

describe('metricTrendSeries', () => {
	it('gives every day in the range a slot, recorded or not', () => {
		const { series, labels } = metricTrendSeries(
			input({
				trend: [point('2026-07-27', 40)],
			}),
		);

		expect(labels).toHaveLength(7);
		expect(series.map((s) => s.values.length)).toEqual([7, 7, 7]);
	});

	// The chart breaks its line at a null, so an unrecorded day must not arrive
	// as a 0 — which would draw a plunge to the floor and back on a day the user
	// simply did not open the app.
	it('leaves an unrecorded day null rather than zero', () => {
		const { series } = metricTrendSeries(
			input({
				trend: [point('2026-07-25', 0), point('2026-07-27', 40)],
			}),
		);

		expect(series[0].values).toEqual([0, null, 40, null, null, null, null]);
	});

	it('carries the three readings in the order the legend names them', () => {
		const { series } = metricTrendSeries(
			input({
				rangeDays: 1,
				rangeStart: '2026-07-25',
				trend: [point('2026-07-25', 10)],
			}),
		);

		expect(series.map((s) => s.values[0])).toEqual([10, 11, 12]);
	});

	// Physical Load is the only dashed line: `terminal` maps --mind and --body to
	// two greens of the same lightness, so on that theme the dash is the only
	// thing separating the two load lines (STYLE.md, and energy-chart does the
	// same). Burnout Risk is a different token, so it needs no dash.
	it('separates the two loads by more than hue', () => {
		const { series } = metricTrendSeries(input());

		expect(series.map((s) => s.isDashed)).toEqual([false, false, true]);
		expect(new Set(series.map((s) => s.strokeClass)).size).toBe(3);
	});

	it('thins the axis to a handful of ticks however long the range is', () => {
		const printed = (rangeDays: number) =>
			metricTrendSeries(
				input({
					rangeDays,
				}),
			).labels.filter((label) => label !== '');

		expect(printed(7)).toHaveLength(7);
		expect(printed(30)).toHaveLength(6);
		expect(printed(365)).toHaveLength(7);
	});

	it('labels a tick with the day it stands on', () => {
		const { labels } = metricTrendSeries(input());

		expect(labels[0]).toBe('Jul 25');
		expect(labels[6]).toBe('Jul 31');
	});
});

const summary = (date: string, over: Partial<DaySummary> = {}): DaySummary => ({
	date,
	tasks: [],
	totalTasks: 2,
	completedTasks: 1,
	completionRate: 50,
	yieldIndex: 80,
	quadrant: 'flow',
	availableHours: 8,
	switchCost: 0.25,
	suggestedTasks: [],
	...over,
});

const yieldInput = (over: Partial<YieldTrendSeriesInput> = {}): YieldTrendSeriesInput => ({
	summaries: [],
	rangeStart: '2026-07-25',
	rangeDays: 7,
	locale: 'en-US',
	...over,
});

describe('yieldTrendSeries', () => {
	// "Of what you finished" has no value when nothing was finished, which is why
	// the dashboard's Yield tile is gated on `completedTasks > 0`. Completing none
	// of the plan is still a true Completion Rate of 0.
	it('breaks the yield line on a day that finished nothing, and plots its completion rate', () => {
		const { series } = yieldTrendSeries(
			yieldInput({
				rangeDays: 3,
				summaries: [
					summary('2026-07-25'),
					summary('2026-07-26', {
						completedTasks: 0,
						completionRate: 0,
						yieldIndex: 0,
					}),
					summary('2026-07-27'),
				],
			}),
		);

		expect(series[0].values[1]).toBeNull();
		expect(series[1].values[1]).toBe(0);
	});

	it('dashes the completion-rate reference line, which is what separates it from yield', () => {
		const { series } = yieldTrendSeries(yieldInput());

		expect(series.map((s) => s.isDashed)).toEqual([false, true]);
	});

	it('leaves a day the user never opened out of both lines', () => {
		const { series } = yieldTrendSeries(
			yieldInput({
				summaries: [summary('2026-07-25'), summary('2026-07-31')],
			}),
		);

		expect(series.map((s) => s.values.length)).toEqual([7, 7]);

		for (const line of series)
			expect(line.values.slice(1, 6)).toEqual([null, null, null, null, null]);
	});
});
