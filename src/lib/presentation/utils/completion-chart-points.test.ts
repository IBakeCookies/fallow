import { describe, expect, it } from 'vitest';
import type { DaySummary, WeeklyRollup } from '$lib/business/model/metric/history';
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
	yieldIndex: completedTasks > 0 ? 80 : null,
	quadrant: 'flow',
	availableHours: 8,
	switchCost: 0.25,
	suggestedTasks: [],
});

const input = (over: Partial<CompletionChartInput> = {}): CompletionChartInput => ({
	range: 'week',
	summaries: [],
	weeklyRollups: [],
	rangeStart: '2026-07-25',
	rangeDays: 7,
	today: '2026-07-31',
	locale: 'en-US',
	...over,
});

describe('completionChartPoints', () => {
	// Date-labelled, like the month view and like the Load chart under it: three
	// axes reading three ways made the same range look like three ranges.
	it('gives the week view one slot per day, date-labelled', () => {
		const points = completionChartPoints(input());

		expect(points).toHaveLength(7);

		expect(points.map((p) => p.label)).toEqual([
			'Jul 25',
			'Jul 26',
			'Jul 27',
			'Jul 28',
			'Jul 29',
			'Jul 30',
			'Jul 31',
		]);
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

		expect(points[0].label).toBe('25. Juli');
	});

	it('gives the year view one slot per 7-day block, labelled once a month', () => {
		const weeklyRollups: WeeklyRollup[] = [
			{
				start: '2026-06-24',
				isMonthStart: true,
				average: 72,
				yieldAverage: null,
				dayCount: 5,
			},
			{
				start: '2026-07-01',
				isMonthStart: true,
				average: null,
				yieldAverage: null,
				dayCount: 0,
			},
			{
				start: '2026-07-08',
				isMonthStart: false,
				average: 40,
				yieldAverage: 60,
				dayCount: 7,
			},
		];

		const points = completionChartPoints(
			input({
				range: 'year',
				weeklyRollups,
			}),
		);

		expect(points.map((p) => p.label)).toEqual(['Jun', 'Jul', '']);
		// 52 labels do not fit the axis; only the block opening a month prints one.
		expect(points.map((p) => p.showLabel)).toEqual([true, true, false]);
		expect(points[0].full).toBe('Week of Jun 24');
		expect(points[0].value).toBe(72);
		expect(points[0].sub).toBe('5 active days');
		expect(points[1].value).toBeNull();
		expect(points[1].sub).toBe('no data');
		expect(points[2].line).toBe(60);
	});

	it('spells a single active day in the block in the singular', () => {
		const points = completionChartPoints(
			input({
				range: 'year',
				weeklyRollups: [
					{
						start: '2026-07-01',
						isMonthStart: true,
						average: 40,
						yieldAverage: null,
						dayCount: 1,
					},
				],
			}),
		);

		expect(points[0].sub).toBe('1 active day');
	});

	// Yield reads what you finished against the best you could have finished, so a
	// day that finished nothing has no reading and the line breaks rather than
	// plunging to 0.
	it('carries each day slot its yield reading, and none on a day that completed nothing', () => {
		const points = completionChartPoints(
			input({
				summaries: [summary('2026-07-25', 60), summary('2026-07-26', 0, 0)],
			}),
		);

		expect(points[0].line).toBe(80);
		expect(points[1].line).toBeNull();
		expect(points[2].line).toBeNull();
	});

	it('carries the same reading on the month range', () => {
		const points = completionChartPoints(
			input({
				range: 'month',
				rangeStart: '2026-07-02',
				rangeDays: 30,
				summaries: [summary('2026-07-02', 60)],
			}),
		);

		expect(points[0].line).toBe(80);
		expect(points[1].line).toBeNull();
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
