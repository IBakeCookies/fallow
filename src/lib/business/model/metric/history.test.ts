import { describe, it, expect } from 'vitest';
import type {
	DailySession,
	DrainObservationRecord,
	RestObservationRecord,
	Task,
} from '$lib/data/type';
import {
	averageCompletionRate,
	calculateMetricTrend,
	completionRateDelta,
	countQuadrants,
	currentStreak,
	findBestDay,
	loggedHours,
	longestStreak,
	monthlyCompletionRates,
	restSummary,
	summarizeSession,
	type DaySummary,
} from '$lib/business/model/metric/history';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import {
	calculateCompletionRate,
	calculateSuggestedTasks,
	calculateYieldIndex,
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

	it('carries a yield index read off the plan it summarized', () => {
		const summary = summarizeSession(makeSession(6));

		expect(summary.yieldIndex).toBe(calculateYieldIndex(summary.suggestedTasks));
		// The fixture completes every third task, which is not the top of the list.
		expect(summary.yieldIndex).toBeLessThan(100);
	});

	it('reads zero yield on a day that completed nothing', () => {
		const session = makeSession(4);

		const nothingDone = {
			...session,
			tasks: session.tasks.map((t) => ({
				...t,
				completed: false,
			})),
		};

		expect(summarizeSession(nothingDone).yieldIndex).toBe(0);
	});
});

describe('calculateMetricTrend', () => {
	// The trend reads the plan `summarizeSession` already solved,
	// so these assert what the fold does with it — not the metrics themselves,
	// which `calculation.test.ts` owns.
	it('reads one point per day, in the order it was given them', () => {
		const summaries = ['2026-07-09', '2026-07-10', '2026-07-11'].map((date) =>
			summarizeSession({
				...makeSession(3),
				date,
			}),
		);

		const trend = calculateMetricTrend(summaries, DEFAULT_ENERGY_PARAMS);

		expect(trend.map((point) => point.date)).toEqual(['2026-07-09', '2026-07-10', '2026-07-11']);
	});

	it('prices Burnout Risk at the day own switch cost, not the plan zero', () => {
		// `summarizeSession` solves at switchCost 0 because the exact allocator is
		// 2ⁿ, but the day's real cost is stored and Burnout Risk takes it as
		// an argument — so the overhead is still charged even though the
		// allocation could not afford to see it.
		const cheap = summarizeSession({
			...makeSession(4),
			switchCost: 0,
		});

		const expensive = summarizeSession({
			...makeSession(4),
			switchCost: 0.5,
		});

		expect(cheap.suggestedTasks).toEqual(expensive.suggestedTasks);

		const [cheapPoint] = calculateMetricTrend([cheap], DEFAULT_ENERGY_PARAMS);
		const [expensivePoint] = calculateMetricTrend([expensive], DEFAULT_ENERGY_PARAMS);

		expect(expensivePoint.burnoutRisk).not.toBe(cheapPoint.burnoutRisk);
	});

	it('reads Burnout Risk through the calibrated params it is handed', () => {
		// Two tasks in eight hours: well clear of the Burnout Risk plateau, where
		// a fixture reads the same 58 under any α and would pass whether or not
		// the params were wired through at all.
		const summaries = [summarizeSession(makeSession(2))];

		const drained = {
			...DEFAULT_ENERGY_PARAMS,
			alphaCog: DEFAULT_ENERGY_PARAMS.alphaCog * 3,
		};

		expect(calculateMetricTrend(summaries, drained)[0].burnoutRisk).toBeGreaterThan(
			calculateMetricTrend(summaries, DEFAULT_ENERGY_PARAMS)[0].burnoutRisk,
		);
	});

	it('seeds each morning from the PREVIOUS day 🪫 rows, not the point own', () => {
		// At DEFAULT_ENERGY_PARAMS a night heals completely, so carry-over is
		// invisible by construction — this is the fitted regime where it is not.
		const slowRecovery = {
			...DEFAULT_ENERGY_PARAMS,
			recoveryRate: 0.1,
		};

		const drained: DrainObservationRecord = {
			date: '2026-07-10',
			taskId: 1,
			taskTitle: 'deep work',
			hours: 8,
			cognitiveDemand: 1,
			physicalDemand: 0.5,
			mindDrain: 6,
			bodyDrain: 2,
			createdAt: 0,
		};

		const summaries = ['2026-07-10', '2026-07-11'].map((date) =>
			summarizeSession({
				...makeSession(2),
				date,
			}),
		);

		const rested = calculateMetricTrend(summaries, slowRecovery);
		const carried = calculateMetricTrend(summaries, slowRecovery, [drained]);

		// 07-11 starts the morning down a worked day, so it reads higher than the
		// same day simulated from full reservoirs.
		expect(carried[1].burnoutRisk).toBeGreaterThan(rested[1].burnoutRisk);

		// 07-10 is unmoved by its OWN rows — that work is the plan it is already
		// priced on — and its predecessor 07-09 logged nothing.
		expect(carried[0].burnoutRisk).toBe(rested[0].burnoutRisk);
	});

	it('reports zero load on a day that booked no hours rather than NaN', () => {
		const summaries = [summarizeSession(makeSession(3, 0))];
		const [point] = calculateMetricTrend(summaries, DEFAULT_ENERGY_PARAMS);

		expect(point.cognitiveLoad).toBe(0);
		expect(point.physicalLoad).toBe(0);
		expect(point.burnoutRisk).toBe(0);
	});

	it('is empty with no days rather than a row of zeroes', () => {
		expect(calculateMetricTrend([], DEFAULT_ENERGY_PARAMS)).toEqual([]);
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

describe('longestStreak', () => {
	it('finds the longest run anywhere in the dates, not the one ending today', () => {
		const dates = new Set(['2026-06-01', '2026-06-02', '2026-06-03', '2026-07-09', '2026-07-10']);
		expect(longestStreak(dates)).toBe(3);
	});

	it('crosses a month boundary', () => {
		expect(longestStreak(new Set(['2026-06-30', '2026-07-01']))).toBe(2);
	});

	it('is zero with no completions', () => {
		expect(longestStreak(new Set())).toBe(0);
	});
});

describe('loggedHours', () => {
	const start = '2026-07-14';

	const drain = (date: string, hours: number): DrainObservationRecord => ({
		id: 1,
		date,
		taskId: 1,
		taskTitle: 'deep work',
		hours,
		cognitiveDemand: 0.8,
		physicalDemand: 0.2,
		mindDrain: 6,
		bodyDrain: 2,
		createdAt: 0,
	});

	it('sums the sessions on or after rangeStart, to one decimal', () => {
		const rows = [drain('2026-06-01', 5), drain('2026-07-15', 2), drain('2026-07-16', 1.25)];
		expect(loggedHours(rows, start)).toBe(3.3);
	});

	it('counts only positive session lengths, like every other reader of 🪫 hours', () => {
		expect(loggedHours([drain('2026-07-15', 0), drain('2026-07-15', 2)], start)).toBe(2);
	});

	it('is zero with no logged work in the range', () => {
		expect(loggedHours([], start)).toBe(0);
	});
});

describe('restSummary', () => {
	const start = '2026-07-14';

	const rest = (over: Partial<RestObservationRecord> = {}): RestObservationRecord => ({
		id: 1,
		date: '2026-07-15',
		hours: 0.5,
		mindBefore: 8,
		mindAfter: 5,
		bodyBefore: 6,
		bodyAfter: 4,
		createdAt: 0,
		...over,
	});

	it('totals the break hours and averages how far each rating dropped', () => {
		const summary = restSummary(
			[
				rest(),
				rest({
					date: '2026-07-16',
					hours: 0.25,
					mindBefore: 4,
					mindAfter: 4,
					bodyBefore: 2,
					bodyAfter: 0,
				}),
				rest({
					date: '2026-06-01',
				}), // outside the range
			],
			start,
		);

		expect(summary.hours).toBe(0.8);

		expect(summary.lift).toEqual({
			mind: 1.5,
			body: 2,
		});
	});

	it('reports no lift when nothing was rested in the range', () => {
		expect(restSummary([], start)).toEqual({
			hours: 0,
			lift: null,
		});
	});

	// `toBe` is `Object.is`, so this fails on -0 — which `Math.round` returns for
	// any small negative mean and `Intl` prints as "-0.0", under the "+" the
	// caller adds for a reading it reads as non-negative.
	it('rounds a tiny net loss to zero rather than to negative zero', () => {
		const rows = [
			rest({
				mindBefore: 4,
				mindAfter: 5,
			}),
			...Array.from(
				{
					length: 29,
				},
				() =>
					rest({
						mindBefore: 4,
						mindAfter: 4,
					}),
			),
		];

		expect(restSummary(rows, start).lift?.mind).toBe(0);
	});
});

function day(date: string, completionRate: number, completedTasks = 1): DaySummary {
	return {
		date,
		tasks: [],
		totalTasks: Math.max(1, completedTasks),
		completedTasks,
		completionRate,
		yieldIndex: 80,
		quadrant: 'flow',
		availableHours: 4,
		switchCost: 0.25,
		suggestedTasks: [],
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
