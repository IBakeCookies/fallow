import { describe, it, expect } from 'vitest';
import type { DailySession, Task } from '$lib/data/type';
import {
	averageCompletionRate,
	completionRateDelta,
	countQuadrants,
	currentStreak,
	findBestDay,
	monthlyCompletionRates,
	summarizeSession,
	type DaySummary,
} from '$lib/business/model/metric/history';
import {
	calculateCompletionRate,
	calculateSuggestedTasks,
} from '$lib/business/model/metric/calculation';
import {
	DEFAULT_CAPACITY_POOLS,
	DEFAULT_USER_CONSTANTS,
	type FitPosterior,
} from '$lib/business/model/zenith';

function makeTask(index: number, completed: boolean): Task {
	return {
		id: index + 1,
		title: `task ${index}`,
		physicalDifficulty: (index * 3 + 1) % 11,
		mentalDifficulty: (index * 5 + 2) % 11,
		enjoyment: 1 + ((index * 7) % 10),
		createdAt: '2026-01-01',
		completed,
	};
}

function makeSession(taskCount: number, availableHours = 8): DailySession {
	return {
		date: '2026-07-11',
		tasks: Array.from(
			{
				length: taskCount,
			},
			(_, i) => makeTask(i, i % 3 === 0),
		),
		availableHours,
		switchCost: 0.25,
		updatedAt: 0,
	};
}

const POSTERIOR: FitPosterior = {
	covariance: [
		[0.004, 0.001, -0.002],
		[0.001, 0.006, -0.001],
		[-0.002, -0.001, 0.01],
	],
	sigma2: 0.02,
};

/** The pre-refactor path: solve the whole day's plan, then weight by priority. */
function completionRateViaFullPlan(session: DailySession, posterior?: FitPosterior): number {
	return calculateCompletionRate(
		calculateSuggestedTasks(
			session.tasks,
			session.availableHours,
			session.switchCost,
			DEFAULT_CAPACITY_POOLS,
			DEFAULT_USER_CONSTANTS,
			posterior,
		),
	);
}

describe('summarizeSession', () => {
	// 32 full-plan solves under always-on coverage instrumentation run ~5s on a
	// loaded suite — the default 5s timeout is too tight, the grid is the point.
	it(
		'reports the same completion rate as solving the full day plan',
		{
			timeout: 20_000,
		},
		() => {
			for (const taskCount of [1, 3, 8, 12]) {
				for (const hours of [0, 2, 8, 24]) {
					const session = makeSession(taskCount, hours);
					expect(summarizeSession(session).completionRate).toBe(completionRateViaFullPlan(session));

					expect(summarizeSession(session, DEFAULT_USER_CONSTANTS, POSTERIOR).completionRate).toBe(
						completionRateViaFullPlan(session, POSTERIOR),
					);
				}
			}
		},
	);

	it('scores a day with no stored hours by the tasks own intrinsic priorities', () => {
		// availableHours 0 — never entered, or a day written by moveTaskToTomorrow
		// — used to zero every priority score, so a fully ticked-off day read 0%.
		const session = makeSession(3, 0);
		expect(session.tasks.filter((t) => t.completed)).toHaveLength(1);
		expect(summarizeSession(session).completionRate).toBeGreaterThan(0);

		const allDone = {
			...session,
			tasks: session.tasks.map((t) => ({
				...t,
				completed: true,
			})),
		};

		expect(summarizeSession(allDone).completionRate).toBe(100);
	});

	it('summarizes a year of full days without running the exhaustive allocator', () => {
		// The 2ⁿ funded-subset enumeration costs ~55ms per 12-task day, so the old
		// path needed ~20s here and blocked first paint. Bound is deliberately
		// loose — it only has to fail if the subset search comes back.
		const sessions = Array.from(
			{
				length: 365,
			},
			() => makeSession(12),
		);

		const started = performance.now();
		const summaries = sessions.map((s) => summarizeSession(s));
		expect(performance.now() - started).toBeLessThan(3000);
		expect(summaries).toHaveLength(365);
	});
});

describe('currentStreak', () => {
	const today = '2026-07-11';

	it('counts consecutive completed days ending today', () => {
		const dates = new Set(['2026-07-09', '2026-07-10', '2026-07-11']);
		expect(currentStreak(dates, today)).toBe(3);
	});

	it('does not break the streak when today has no completion yet', () => {
		const dates = new Set(['2026-07-09', '2026-07-10']);
		expect(currentStreak(dates, today)).toBe(2);
	});

	it('breaks on a gap', () => {
		const dates = new Set(['2026-07-07', '2026-07-08', '2026-07-10', '2026-07-11']);
		expect(currentStreak(dates, today)).toBe(2);
	});

	it('is zero with no recent completions', () => {
		expect(currentStreak(new Set(['2026-07-01']), today)).toBe(0);
		expect(currentStreak(new Set(), today)).toBe(0);
	});
});

function day(date: string, completionRate: number, completedTasks = 1): DaySummary {
	return {
		date,
		tasks: [],
		totalTasks: Math.max(1, completedTasks),
		completedTasks,
		completionRate,
		quadrant: 'flow',
		availableHours: 4,
	};
}

describe('averageCompletionRate', () => {
	it('is the rounded mean of the days given', () => {
		expect(averageCompletionRate([day('2026-07-01', 50), day('2026-07-02', 75)])).toBe(63);
	});

	it('is zero with no days rather than NaN', () => {
		expect(averageCompletionRate([])).toBe(0);
	});
});

describe('completionRateDelta', () => {
	it('is null when there is no previous period to compare against', () => {
		expect(completionRateDelta([day('2026-07-01', 80)], [])).toBeNull();
	});

	it('is the signed change against the previous period', () => {
		const current = [day('2026-07-08', 80), day('2026-07-09', 60)];
		const previous = [day('2026-07-01', 40), day('2026-07-02', 60)];
		expect(completionRateDelta(current, previous)).toBe(20);
		expect(completionRateDelta(previous, current)).toBe(-20);
	});
});

describe('findBestDay', () => {
	it('breaks a completion-rate tie by tasks completed', () => {
		const fewer = day('2026-07-01', 100, 1);
		const more = day('2026-07-02', 100, 6);
		expect(findBestDay([fewer, more])?.date).toBe('2026-07-02');
		expect(findBestDay([more, fewer])?.date).toBe('2026-07-02');
	});

	it('prefers the higher rate over the busier day', () => {
		expect(findBestDay([day('2026-07-01', 90, 9), day('2026-07-02', 95, 2)])?.date).toBe(
			'2026-07-02',
		);
	});

	it('ignores days with nothing completed', () => {
		expect(findBestDay([day('2026-07-01', 0, 0)])).toBeNull();
		expect(findBestDay([])).toBeNull();
	});
});

describe('countQuadrants', () => {
	it('counts every profile, including the ones with no days', () => {
		const days = [
			day('2026-07-01', 10),
			{
				...day('2026-07-02', 10),
				quadrant: 'grind' as const,
			},
		];

		expect(countQuadrants(days)).toEqual({
			flow: 1,
			cruise: 0,
			grind: 1,
			routine: 0,
		});
	});
});

describe('monthlyCompletionRates', () => {
	it('keeps a slot for months with no recorded day', () => {
		const months = monthlyCompletionRates(
			[day('2026-05-04', 40), day('2026-07-02', 80)],
			'2026-05-01',
			'2026-07-26',
		);

		expect(months.map((month) => month.month)).toEqual(['2026-05', '2026-06', '2026-07']);

		expect(months[1]).toEqual({
			month: '2026-06',
			average: null,
			dayCount: 0,
		});
	});

	it('averages only the days recorded in each month', () => {
		const months = monthlyCompletionRates(
			[day('2026-07-02', 80), day('2026-07-03', 50), day('2026-07-04', 20)],
			'2026-07-01',
			'2026-07-26',
		);

		expect(months).toEqual([
			{
				month: '2026-07',
				average: 50,
				dayCount: 3,
			},
		]);
	});

	it('crosses the year boundary', () => {
		const months = monthlyCompletionRates([day('2026-01-05', 60)], '2025-11-14', '2026-01-05');
		expect(months.map((month) => month.month)).toEqual(['2025-11', '2025-12', '2026-01']);
		expect(months[2].average).toBe(60);
	});
});
