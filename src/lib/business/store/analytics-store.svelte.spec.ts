import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/analytics-store.test-harness.svelte';
import * as sessionHistory from '$lib/business/store/session-history';
import type { AnalyticsStore } from '$lib/business/store/analytics-store.svelte';
import type { DaySummary } from '$lib/business/model/metric/history';
import type { PlanAudit } from '$lib/business/model/plan-audit';

const TODAY = '2026-07-20';

const EMPTY_AUDIT: PlanAudit = {
	usedCount: 0,
	days: [],
	classicOverlap: 0,
	energyOverlap: 0,
	actualTaskSpread: 0,
	classicTaskSpread: 0,
	energyTaskSpread: 0,
};

vi.mock('$lib/business/state/today.svelte', () => ({
	liveToday: {
		value: '2026-07-20',
	},
}));

vi.mock('$lib/business/store/session-history', () => ({
	EMPTY_PLAN_AUDIT: {
		usedCount: 0,
		days: [],
		classicOverlap: 0,
		energyOverlap: 0,
		actualTaskSpread: 0,
		classicTaskSpread: 0,
		energyTaskSpread: 0,
	},
	initializeStorage: vi.fn(async () => {}),
	readDaySummaries: vi.fn(async () => []),
	readModelReport: vi.fn(async () => ({
		calibration: null,
		audit: EMPTY_AUDIT,
	})),
}));

const readDaySummariesMock = vi.mocked(sessionHistory.readDaySummaries);
const readModelReportMock = vi.mocked(sessionHistory.readModelReport);

const day = (date: string, over: Partial<DaySummary> = {}): DaySummary => ({
	date,
	tasks: [],
	totalTasks: 2,
	completedTasks: 1,
	completionRate: 50,
	quadrant: 'flow',
	availableHours: 4,
	...over,
});

async function setup(summaries: DaySummary[] = []): Promise<AnalyticsStore> {
	readDaySummariesMock.mockResolvedValue(summaries);
	let store!: AnalyticsStore;

	render(Harness, {
		onstore: (s: AnalyticsStore) => (store = s),
	});

	await vi.waitFor(() => expect(store.isLoading).toBe(false));

	return store;
}

describe('AnalyticsStore', () => {
	beforeEach(() => {
		readDaySummariesMock.mockReset().mockResolvedValue([]);

		readModelReportMock.mockReset().mockResolvedValue({
			calibration: null as never,
			audit: EMPTY_AUDIT,
		});
	});

	it('loads the last 365 days ending today', async () => {
		await setup();
		// 365 days inclusive of today, so the earliest is today - 364
		expect(readDaySummariesMock).toHaveBeenCalledWith('2025-07-21', TODAY);
	});

	it('reslices when the range changes', async () => {
		// 2026-06-01 is inside the year but outside the 30-day month (from 06-21)
		const store = await setup([day('2026-06-01'), day('2026-07-13'), day('2026-07-15')]);

		expect(store.rangeDays).toBe(7);
		expect(store.summaries.map((s) => s.date)).toEqual(['2026-07-15']);

		store.range = 'month';
		flushSync();
		expect(store.rangeDays).toBe(30);
		expect(store.summaries.map((s) => s.date)).toEqual(['2026-07-13', '2026-07-15']);

		store.range = 'year';
		flushSync();
		expect(store.summaries).toHaveLength(3);
	});

	it('totals only the viewed range', async () => {
		const store = await setup([
			day('2026-07-10', {
				totalTasks: 9,
				completedTasks: 9,
			}), // outside the week
			day('2026-07-15', {
				totalTasks: 4,
				completedTasks: 3,
			}),
			day('2026-07-16', {
				totalTasks: 6,
				completedTasks: 0,
			}),
		]);

		expect(store.totalTasks).toBe(10);
		expect(store.completedTasks).toBe(3);
		expect(store.completedShare).toBe(30);
	});

	it('reports no share when nothing was planned', async () => {
		const store = await setup([
			day('2026-07-15', {
				totalTasks: 0,
				completedTasks: 0,
			}),
		]);

		expect(store.completedShare).toBe(0);
	});

	it('compares against the previous period of equal length, but never for the year', async () => {
		const store = await setup([
			day('2026-07-08', {
				completionRate: 20,
			}), // previous week
			day('2026-07-16', {
				completionRate: 80,
			}),
		]);

		expect(store.averageCompletionRate).toBe(80);
		expect(store.completionRateDelta).toBe(60);

		store.range = 'year';
		flushSync();
		// Only 365 days are loaded, so there is no previous year to compare to
		expect(store.completionRateDelta).toBeNull();
	});

	// The subtle one: a streak is not a property of whichever window is open.
	it('counts the streak across the whole loaded year, not the viewed range', async () => {
		const dates = [
			'2026-07-12',
			'2026-07-13',
			'2026-07-14',
			'2026-07-15',
			'2026-07-16',
			'2026-07-17',
			'2026-07-18',
			'2026-07-19',
		];

		const store = await setup(dates.map((d) => day(d)));

		expect(store.rangeDays).toBe(7);
		// 8 consecutive days back from yesterday — two of them outside the week
		expect(store.streak).toBe(8);
	});

	it('sums the declared budget to one decimal', async () => {
		const store = await setup([
			day('2026-07-15', {
				availableHours: 3.35,
			}),
			day('2026-07-16', {
				availableHours: 2.4,
			}),
		]);

		expect(store.plannedHours).toBe(5.8);
	});

	it('falls back to an empty audit and flags the calibration when the read fails', async () => {
		readModelReportMock.mockRejectedValue(new Error('indexeddb is gone'));
		const store = await setup([day('2026-07-15')]);

		await vi.waitFor(() => expect(store.audit).not.toBeNull());
		expect(store.audit?.usedCount).toBe(0);
		expect(store.calibrationFailed).toBe(true);
		expect(store.isLoading).toBe(false);
		// The day summaries still loaded, so the page renders its stats
		expect(store.hasData).toBe(true);
	});
});
