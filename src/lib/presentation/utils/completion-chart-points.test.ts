import { describe, expect, it } from 'vitest';
import type { DaySummary, MonthlyCompletion } from '$lib/business/model/metric/history';
import {
	completionChartPoints,
	type CompletionChartInput,
} from '$lib/presentation/utils/completion-chart-points';

const summary = (date: string, completionRate: number, completedTasks = 1): DaySummary => ({
	date,
	tasks: [],
	totalTasks: 2,
	completedTasks,
	completionRate,
	quadrant: 'flow',
	availableHours: 8,
});

const input = (over: Partial<CompletionChartInput> = {}): CompletionChartInput => ({
	range: 'week',
	summaries: [],
	monthlyRates: [],
	rangeStart: '2026-07-25',
	rangeDays: 7,
	today: '2026-07-31',
	locale: 'en-US',
	...over,
});

describe('completionChartPoints', () => {
	it('gives the week view one slot per day, weekday-labelled', () => {
		const points = completionChartPoints(input());

		expect(points).toHaveLength(7);
		expect(points.map((p) => p.label)).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
	});

	// The chart draws these two differently — a 0% day gets a stub, an unrecorded
	// day gets nothing — so they must not both arrive as a falsy number.
	it('separates a recorded 0% day from a day with no data', () => {
		const points = completionChartPoints(
			input({
				summaries: [summary('2026-07-25', 0, 0)],
			}),
		);

		expect(points[0].value).toBe(0);
		expect(points[0].sub).toBe('0/2 tasks done');
		expect(points[1].value).toBeNull();
		expect(points[1].sub).toBe('no data');
	});

	it('marks today in the tooltip label', () => {
		const points = completionChartPoints(input());

		expect(points[6].full).toBe('Today, Jul 31');
		expect(points[0].full).toBe('Sat, Jul 25');
	});

	it('labels every day of the week view and every fifth day of the month view', () => {
		expect(completionChartPoints(input()).map((p) => p.showLabel)).not.toContain(false);

		const month = completionChartPoints(
			input({
				range: 'month',
				rangeStart: '2026-07-02',
				rangeDays: 30,
			}),
		);

		expect(month.filter((p) => p.showLabel)).toHaveLength(6);
		expect(month[0].label).toBe('Jul 2');
	});

	it('renders the axis labels in the reader locale', () => {
		const points = completionChartPoints(
			input({
				locale: 'de-DE',
			}),
		);

		expect(points[0].label).toBe('Sa');
	});

	it('gives the year view one slot per month, always labelled', () => {
		const monthlyRates: MonthlyCompletion[] = [
			{
				month: '2026-06',
				average: 72,
				dayCount: 12,
			},
			{
				month: '2026-07',
				average: null,
				dayCount: 0,
			},
		];

		const points = completionChartPoints(
			input({
				range: 'year',
				monthlyRates,
			}),
		);

		expect(points.map((p) => p.label)).toEqual(['Jun', 'Jul']);
		expect(points.map((p) => p.showLabel)).toEqual([true, true]);
		expect(points[0].full).toBe('June 2026');
		expect(points[0].value).toBe(72);
		expect(points[0].sub).toBe('12 active days');
		expect(points[1].value).toBeNull();
		expect(points[1].sub).toBe('no data');
	});

	it('spells a single active month in the singular', () => {
		const points = completionChartPoints(
			input({
				range: 'year',
				monthlyRates: [
					{
						month: '2026-07',
						average: 40,
						dayCount: 1,
					},
				],
			}),
		);

		expect(points[0].sub).toBe('1 active day');
	});

	it('reads no slots from an empty range', () => {
		expect(
			completionChartPoints(
				input({
					rangeDays: 0,
				}),
			),
		).toEqual([]);
	});
});
