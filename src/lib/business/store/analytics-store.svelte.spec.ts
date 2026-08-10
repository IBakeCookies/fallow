import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/analytics-store.test-harness.svelte';
import * as sessionHistory from '$lib/business/session-history';
import type { CalibrationSnapshot } from '$lib/business/session-history';
import * as fitSnapshotRepository from '$lib/data/repository/fit-snapshot-repository';
import type { AnalyticsStore } from '$lib/business/store/analytics-store.svelte';
import type { DaySummary } from '$lib/business/model/metric/history';
import { DEFAULT_ENERGY_PARAMS } from '$lib/business/model/zenith-energy';
import type { PlanAudit } from '$lib/business/model/plan-audit';
import type { FitSnapshotRecord, Task } from '$lib/data/type';

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

// The store publishes the snapshot untouched, so a shallow stub suffices — plus
// the fitted energy params, which it does read, for the metric trend (§31).
const CALIBRATION = {
	flow: {
		fitted: false,
		usedCount: 0,
		phiHours: 0.5,
		defaultPhiHours: 0.5,
	},
	energy: {
		params: DEFAULT_ENERGY_PARAMS,
	},
} as CalibrationSnapshot;

vi.mock('$lib/business/state/today.svelte', () => ({
	liveToday: {
		value: '2026-07-20',
	},
}));

/** What §12 stamps for today; only its identity matters to the store. */
const TODAYS_FIT: Omit<FitSnapshotRecord, 'createdAt'> = {
	date: TODAY,
	c1: 0.56,
	c2: -0.24,
	c3: 0.5,
	covariance: [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	],
	sigma2: 0.0625,
	alphaCog: 0.35,
	alphaPhys: 0.3,
	recoveryRate: 0.7,
	stoppingValue: 0.5,
};

vi.mock('$lib/business/session-history', () => ({
	initializeStorage: vi.fn(async () => {}),
	readDaySummaries: vi.fn(async () => []),
	readModelReport: vi.fn(async () => ({
		calibration: null,
		audit: EMPTY_AUDIT,
		todaysFit: TODAYS_FIT,
		drain: [],
	})),
}));

vi.mock('$lib/data/repository/fit-snapshot-repository', () => ({
	$updateFitSnapshot: vi.fn(async () => {}),
}));

const readDaySummariesMock = vi.mocked(sessionHistory.readDaySummaries);
const readModelReportMock = vi.mocked(sessionHistory.readModelReport);
const updateFitSnapshotMock = vi.mocked(fitSnapshotRepository.$updateFitSnapshot);

const day = (date: string, over: Partial<DaySummary> = {}): DaySummary => ({
	date,
	tasks: [],
	totalTasks: 2,
	completedTasks: 1,
	completionRate: 50,
	quadrant: 'flow',
	availableHours: 4,
	switchCost: 0.25,
	suggestedTasks: [],
	...over,
});

const task = (id: number, title: string): Task => ({
	id,
	title,
	physicalDifficulty: 3,
	mentalDifficulty: 6,
	enjoyment: 5,
	createdAt: '2026-06-01',
	completed: false,
});

// Stands in for the route's toast. Declared here so a spec can assert both that
// the store raised it and — for the model-report half — that it did not.
const notifyHistoryLoadFailed = vi.fn();

async function setup(summaries: DaySummary[] = []): Promise<AnalyticsStore> {
	readDaySummariesMock.mockResolvedValue(summaries);
	let store!: AnalyticsStore;

	render(Harness, {
		onstore: (s: AnalyticsStore) => (store = s),
		onhistoryloadfailed: notifyHistoryLoadFailed,
	});

	await vi.waitFor(() => expect(store.isLoading).toBe(false));

	return store;
}

describe('AnalyticsStore', () => {
	beforeEach(() => {
		notifyHistoryLoadFailed.mockClear();
		updateFitSnapshotMock.mockReset().mockResolvedValue(undefined);
		readDaySummariesMock.mockReset().mockResolvedValue([]);

		readModelReportMock.mockReset().mockResolvedValue({
			calibration: CALIBRATION,
			audit: EMPTY_AUDIT,
			todaysFit: TODAYS_FIT,
			drain: [],
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

	// The log history names measurements from this rather than from the title frozen
	// onto each record, so it has to span the whole loaded year — the history's "all
	// time" scope reads past the viewed range — and take the newest name for an id.
	it('maps every loaded day’s task ids to their current titles', async () => {
		const store = await setup([
			day('2026-06-01', {
				tasks: [task(4, 'writing'), task(5, 'boxing')],
			}),
			day('2026-07-15', {
				tasks: [task(6, 'the chapter')],
			}),
		]);

		expect(store.range).toBe('week');

		expect([...store.taskTitles]).toEqual([
			[4, 'writing'],
			[5, 'boxing'],
			[6, 'the chapter'],
		]);
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

	it('publishes the model report once it resolves', async () => {
		const audit: PlanAudit = {
			...EMPTY_AUDIT,
			usedCount: 3,
		};

		readModelReportMock.mockResolvedValue({
			calibration: CALIBRATION,
			audit,
			todaysFit: TODAYS_FIT,
			drain: [],
		});

		const store = await setup([day('2026-07-15')]);

		// toEqual, not toBe: $state proxies the assigned object.
		await vi.waitFor(() => expect(store.calibration).toEqual(CALIBRATION));
		expect(store.audit).toEqual(audit);
		expect(store.hasModelReportFailed).toBe(false);
		expect(readModelReportMock).toHaveBeenCalledWith(TODAY, 30);
	});

	// MATH.md §31: the trend is read through the user's own calibrated energy
	// params, which arrive one read after the summaries — so it stays null until
	// they do rather than publishing a series fitted to the defaults.
	it('withholds the metric trend until the calibrated params arrive', async () => {
		let resolveReport!: (
			report: Awaited<ReturnType<typeof sessionHistory.readModelReport>>,
		) => void;

		readModelReportMock.mockReturnValue(
			new Promise((resolve) => {
				resolveReport = resolve;
			}),
		);

		const store = await setup([day('2026-07-15'), day('2026-07-16')]);

		expect(store.metricTrend).toBeNull();

		resolveReport({
			calibration: CALIBRATION,
			audit: EMPTY_AUDIT,
			todaysFit: TODAYS_FIT,
			drain: [],
		});

		await vi.waitFor(() => expect(store.metricTrend).not.toBeNull());
		expect(store.metricTrend?.map((point) => point.date)).toEqual(['2026-07-15', '2026-07-16']);
	});

	it('leaves the metric trend null when the model report fails', async () => {
		readModelReportMock.mockRejectedValue(new Error('indexeddb is gone'));

		const store = await setup([day('2026-07-15')]);

		await vi.waitFor(() => expect(store.hasModelReportFailed).toBe(true));
		expect(store.metricTrend).toBeNull();
	});

	it('reslices the metric trend with the range', async () => {
		// The same window `summaries` reads: a trend over the loaded year would
		// plot 365 points into a card the toggle says holds 7.
		const store = await setup([day('2026-06-01'), day('2026-07-15')]);

		await vi.waitFor(() => expect(store.metricTrend).not.toBeNull());
		expect(store.metricTrend?.map((point) => point.date)).toEqual(['2026-07-15']);

		store.range = 'year';
		flushSync();

		expect(store.metricTrend?.map((point) => point.date)).toEqual(['2026-06-01', '2026-07-15']);
	});

	// MATH.md §12: today's fit is recorded so a LATER visit audits today against
	// what the model believed today, not against months of subsequent logs.
	it("records today's fit once the report resolves", async () => {
		await setup([day('2026-07-15')]);

		await vi.waitFor(() => expect(updateFitSnapshotMock).toHaveBeenCalledTimes(1));
		expect(updateFitSnapshotMock).toHaveBeenCalledWith(TODAYS_FIT);
	});

	// A lost stamp costs one day of trend, never anything the user typed — so it
	// must not put the two cards into their failure state.
	it('leaves the cards intact when the fit stamp cannot be written', async () => {
		updateFitSnapshotMock.mockRejectedValue(new Error('quota exceeded'));

		const store = await setup([day('2026-07-15')]);

		await vi.waitFor(() => expect(store.calibration).toEqual(CALIBRATION));
		expect(store.hasModelReportFailed).toBe(false);
		expect(store.audit).toEqual(EMPTY_AUDIT);
	});

	it('never stamps a fit the report failed to produce', async () => {
		readModelReportMock.mockRejectedValue(new Error('indexeddb is gone'));

		const store = await setup([day('2026-07-15')]);

		await vi.waitFor(() => expect(store.hasModelReportFailed).toBe(true));
		expect(updateFitSnapshotMock).not.toHaveBeenCalled();
	});

	// Both cards come off this one read, so one flag covers them — and it never
	// publishes an audit of no days, which the card would render as a statement
	// about the user's drain logs.
	it('flags the whole model report when the read fails, publishing no audit', async () => {
		readModelReportMock.mockRejectedValue(new Error('indexeddb is gone'));
		const store = await setup([day('2026-07-15')]);

		await vi.waitFor(() => expect(store.hasModelReportFailed).toBe(true));
		expect(store.audit).toBeNull();
		expect(store.calibration).toBeNull();
		expect(store.isLoading).toBe(false);
		// The day summaries still loaded, so the page renders its stats
		expect(store.hasData).toBe(true);
		// …and that card says so itself, which is why this half raises no toast.
		expect(notifyHistoryLoadFailed).not.toHaveBeenCalled();
	});

	// The reason the load is two try blocks: an empty year of charts is
	// indistinguishable from a new user, so only this half gets the toast.
	it('reports a failed history read and still leaves the model cards explained', async () => {
		// Rendered directly: `setup` resolves the history read, which is the thing
		// this case has to break.
		readDaySummariesMock.mockRejectedValue(new Error('indexeddb is gone'));
		let store!: AnalyticsStore;

		render(Harness, {
			onstore: (s: AnalyticsStore) => (store = s),
			onhistoryloadfailed: notifyHistoryLoadFailed,
		});

		await vi.waitFor(() => expect(notifyHistoryLoadFailed).toHaveBeenCalledTimes(1));
		expect(store.hasData).toBe(false);
		expect(store.hasModelReportFailed).toBe(true);
		expect(store.audit).toBeNull();
		// The second read is never attempted — its transaction would fail too.
		expect(readModelReportMock).not.toHaveBeenCalled();
	});
});
