import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/calendar-store.test-harness.svelte';
import * as sessionHistory from '$lib/business/session-history';
import type { CalendarStore } from '$lib/business/store/calendar-store.svelte';
import type { DaySummary } from '$lib/business/model/metric/history';

vi.mock('$lib/business/session-history', () => ({
	initializeStorage: vi.fn(async () => {}),
	readDaySummaries: vi.fn(async () => []),
}));

const readDaySummariesMock = vi.mocked(sessionHistory.readDaySummaries);
const initializeStorageMock = vi.mocked(sessionHistory.initializeStorage);
// The grid the page hands over: a July month view, then the August one.
const JULY = ['2026-06-29', '2026-08-02'] as const;
const AUGUST = ['2026-07-27', '2026-08-30'] as const;

const day = (date: string): DaySummary => ({
	date,
	tasks: [],
	totalTasks: 2,
	completedTasks: 1,
	completionRate: 50,
	quadrant: 'flow',
	availableHours: 4,
	switchCost: 0.25,
	suggestedTasks: [],
});

/** A read the spec finishes by hand, to hold two of them in flight at once. */
const deferred = () => {
	let settle!: (days: DaySummary[]) => void;
	const promise = new Promise<DaySummary[]>((resolve) => (settle = resolve));

	return {
		promise,
		settle,
	};
};

const notifyLoadFailed = vi.fn();

async function setup(range: readonly [string, string] = JULY) {
	let store!: CalendarStore;

	const { rerender } = render(Harness, {
		onstore: (s: CalendarStore) => (store = s),
		start: range[0],
		end: range[1],
		onloadfailed: notifyLoadFailed,
	});

	const step = (next: readonly [string, string]) =>
		rerender({
			onstore: (s: CalendarStore) => (store = s),
			start: next[0],
			end: next[1],
			onloadfailed: notifyLoadFailed,
		});

	return {
		get store() {
			return store;
		},
		step,
	};
}

describe('CalendarStore', () => {
	beforeEach(() => {
		notifyLoadFailed.mockClear();
		initializeStorageMock.mockReset().mockResolvedValue(undefined);
		readDaySummariesMock.mockReset().mockResolvedValue([]);
	});

	it('reads the visible range once storage is open', async () => {
		await setup();

		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledWith(...JULY));
	});

	it('re-reads when the range steps', async () => {
		const { step } = await setup();

		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledWith(...JULY));
		await step(AUGUST);

		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledWith(...AUGUST));
	});

	it('drops a superseded response instead of painting it over the newer range', async () => {
		const july = deferred();

		readDaySummariesMock.mockReturnValueOnce(july.promise);

		const { store, step } = await setup();

		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledWith(...JULY));

		readDaySummariesMock.mockResolvedValueOnce([day('2026-08-11')]);
		await step(AUGUST);
		await vi.waitFor(() => expect(store.summaryFor('2026-08-11')).toBeDefined());

		// The July read lands last, and is the one the user navigated away from.
		july.settle([day('2026-07-04')]);
		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledTimes(2));

		expect(store.summaryFor('2026-07-04')).toBeUndefined();
		expect(store.summaryFor('2026-08-11')).toBeDefined();
	});

	it('holds isLoading until the read returns, and a range with no days is loaded rather than loading', async () => {
		const range = deferred();

		readDaySummariesMock.mockReturnValueOnce(range.promise);

		const { store } = await setup();

		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledWith(...JULY));
		expect(store.isLoading).toBe(true);

		range.settle([]);

		await vi.waitFor(() => expect(store.isLoading).toBe(false));
		expect(store.hasAnyData).toBe(false);
	});

	it('raises one toast per outage and re-arms after a success', async () => {
		readDaySummariesMock.mockRejectedValueOnce(new Error('db gone'));

		const { store, step } = await setup();

		await vi.waitFor(() => expect(notifyLoadFailed).toHaveBeenCalledTimes(1));
		// The failing read still ends the loading state, or the grid never gets to
		// say anything at all.
		expect(store.isLoading).toBe(false);

		readDaySummariesMock.mockRejectedValueOnce(new Error('db still gone'));
		await step(AUGUST);
		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledTimes(2));

		expect(notifyLoadFailed).toHaveBeenCalledTimes(1);

		readDaySummariesMock.mockResolvedValueOnce([day('2026-07-04')]);
		await step(JULY);
		await vi.waitFor(() => expect(store.summaryFor('2026-07-04')).toBeDefined());

		readDaySummariesMock.mockRejectedValueOnce(new Error('db gone again'));
		await step(AUGUST);

		await vi.waitFor(() => expect(notifyLoadFailed).toHaveBeenCalledTimes(2));
	});

	it('reports a storage that will not open, and still lets the range read run', async () => {
		initializeStorageMock.mockRejectedValueOnce(new Error('no indexeddb'));

		await setup();

		await vi.waitFor(() => expect(notifyLoadFailed).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(readDaySummariesMock).toHaveBeenCalledWith(...JULY));
	});
});
