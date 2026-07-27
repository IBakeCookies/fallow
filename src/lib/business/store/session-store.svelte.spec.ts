import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from './session-store.test-harness.svelte';
import { mockPage } from './session-store.test-utils.svelte';
import * as sessionRepository from '$lib/data/repository/session-repository';
import * as flowObservationRepository from '$lib/data/repository/flow-observation-repository';
import type { SessionStore } from './session-store.svelte';
import type { DailySession } from '$lib/business/type';

vi.mock('$lib/business/store/session-history', () => ({
	initializeStorage: vi.fn(async () => {})
}));

vi.mock('$lib/data/repository/session-repository', () => ({
	$updateSession: vi.fn(async () => {}),
	$readSessionByDate: vi.fn(async () => null),
	$readSessionsByDateRange: vi.fn(async () => [])
}));
vi.mock('$lib/data/repository/routine-repository', () => ({
	$updateRoutine: vi.fn(async () => {}),
	$deleteRoutine: vi.fn(async () => {}),
	$readAllRoutines: vi.fn(async () => [])
}));
vi.mock('$lib/data/repository/flow-observation-repository', () => ({
	$updateFlowObservation: vi.fn(async () => {}),
	$deleteFlowObservation: vi.fn(async () => {}),
	$deleteAllFlowObservations: vi.fn(async () => {}),
	$readAllFlowObservations: vi.fn(async () => [])
}));
const updateSessionMock = vi.mocked(sessionRepository.$updateSession);
const readSessionByDateMock = vi.mocked(sessionRepository.$readSessionByDate);
const updateFlowObservationMock = vi.mocked(flowObservationRepository.$updateFlowObservation);

/** Mount the store in a component context and wait for the initial load. */
async function setup(): Promise<SessionStore> {
	let store!: SessionStore;
	render(Harness, { onstore: (s: SessionStore) => (store = s) });
	await vi.waitFor(() => expect(store.isLoading).toBe(false));
	vi.clearAllMocks(); // drop the initial-load calls; tests assert deltas
	return store;
}

function setHidden(hidden: boolean) {
	Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

function useFakeTimers() {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
}

describe('SessionStore persistence', () => {
	beforeEach(() => {
		mockPage.url = new URL('http://localhost/');
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (document as { hidden?: boolean }).hidden; // restore prototype getter
		// clearAllMocks keeps implementations, so tests that install a failing or
		// canned read must not leak it into the next one.
		readSessionByDateMock.mockImplementation(async () => null);
	});

	it('debounces autosave: a burst of edits collapses to one put with the last value', async () => {
		const store = await setup();
		useFakeTimers();

		store.availableHours = 4;
		flushSync();
		store.availableHours = 6;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		vi.advanceTimersByTime(499);
		expect(updateSessionMock).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(updateSessionMock).toHaveBeenCalledTimes(1);
		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			date: store.today,
			availableHours: 6
		});
	});

	it('flushes the pending save immediately when the tab hides', async () => {
		const store = await setup();
		useFakeTimers();

		store.availableHours = 3;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		setHidden(true);
		expect(updateSessionMock).toHaveBeenCalledTimes(1);
		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({ availableHours: 3 });
	});

	it('re-reads the selected date on becoming visible, picking up another tab’s write', async () => {
		const store = await setup();
		const otherTabSession: DailySession = {
			date: store.today,
			tasks: [],
			availableHours: 9,
			switchCost: 0.25,
			updatedAt: Date.now()
		};
		readSessionByDateMock.mockResolvedValueOnce(otherTabSession);

		setHidden(true); // nothing pending: no write
		expect(updateSessionMock).not.toHaveBeenCalled();
		setHidden(false);

		await vi.waitFor(() => expect(store.availableHours).toBe(9));
		expect(readSessionByDateMock).toHaveBeenCalledWith(store.today);
	});

	it('flushes the pending save before loading a newly selected date', async () => {
		const store = await setup();
		const today = store.today;
		useFakeTimers();

		store.availableHours = 5;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		mockPage.url = new URL('http://localhost/?date=2099-01-01');
		flushSync(); // date-change reload flushes the pending edit first

		expect(updateSessionMock).toHaveBeenCalledTimes(1);
		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({ date: today, availableHours: 5 });
	});

	it('surfaces a failed save as storageError and clears it on demand', async () => {
		const store = await setup();
		updateSessionMock.mockRejectedValueOnce(new Error('QuotaExceededError'));
		useFakeTimers();

		store.availableHours = 2;
		flushSync();
		vi.advanceTimersByTime(500);
		vi.useRealTimers();

		await vi.waitFor(() => expect(store.storageError).toBe('save-failed'));
		store.clearStorageError();
		expect(store.storageError).toBeNull();
	});

	it('stamps the ⚡ badge only when the flow write succeeds', async () => {
		const store = await setup();
		store.addTask({ title: 'deep work', physicalDifficulty: 2, mentalDifficulty: 8, enjoyment: 6 });
		flushSync();
		const id = store.tasks[0].id;

		updateFlowObservationMock.mockRejectedValueOnce(new Error('write failed'));
		await store.logFlow(id, 25);
		expect(store.tasks[0].flowMinutes).toBeUndefined();
		expect(store.storageError).toBe('save-failed');

		store.clearStorageError();
		await store.logFlow(id, 25);
		expect(store.tasks[0].flowMinutes).toBe(25);
		expect(store.storageError).toBeNull();
	});

	it('surfaces a failed load instead of silently never saving again', async () => {
		readSessionByDateMock.mockRejectedValue(new Error('IndexedDB unavailable'));
		let store!: SessionStore;
		render(Harness, { onstore: (s: SessionStore) => (store = s) });

		await vi.waitFor(() => expect(store.storageError).toBe('load-failed'));

		// …and the failure is recoverable: retrying re-reads the day, which both
		// clears the banner and unblocks the auto-save guard.
		readSessionByDateMock.mockImplementation(async () => ({
			date: store.today,
			tasks: [],
			availableHours: 7,
			switchCost: 0.25,
			updatedAt: Date.now()
		}));
		store.retryLoad();

		await vi.waitFor(() => {
			expect(store.storageError).toBeNull();
			expect(store.availableHours).toBe(7);
		});
	});

	it('ignores a task toggle while a date change is still loading', async () => {
		const store = await setup();
		store.addTask({ title: 'ship it', physicalDifficulty: 3, mentalDifficulty: 5, enjoyment: 5 });
		flushSync();
		const id = store.tasks[0].id;

		// A read that never settles: the viewed date is already the past day while
		// the in-memory tasks still belong to today.
		readSessionByDateMock.mockImplementationOnce(() => new Promise(() => {}));
		mockPage.url = new URL('http://localhost/?date=2000-01-01');
		flushSync();
		expect(store.isViewingPast).toBe(true);

		await store.toggleTask(id);

		expect(store.tasks[0].completed).toBe(false);
		expect(updateSessionMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ date: '2000-01-01' })
		);
	});

	it('flushes the pending save when the component is destroyed', async () => {
		const store = await setup();
		useFakeTimers();

		store.availableHours = 8;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		cleanup(); // what a locale switch does: the layout re-keys its subtree

		expect(updateSessionMock).toHaveBeenCalledTimes(1);
		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({ availableHours: 8 });
	});

	it('re-reads yesterday after a midnight rollover', async () => {
		const store = await setup();
		const dayBeforeRollover = store.today;
		const realNow = Date.now();

		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(realNow + 24 * 60 * 60 * 1000);
		readSessionByDateMock.mockImplementation(async (date: string) =>
			date === dayBeforeRollover
				? { date, tasks: [], availableHours: 5, switchCost: 0.25, updatedAt: 0 }
				: null
		);
		window.dispatchEvent(new Event('focus')); // liveToday refreshes on wake
		flushSync();
		vi.useRealTimers(); // the rollover has landed; poll on the real clock

		// Yesterday must follow the clock, or "import yesterday" imports two days ago.
		await vi.waitFor(() => expect(store.yesterdaySession?.date).toBe(dayBeforeRollover));

		window.dispatchEvent(new Event('focus')); // roll the shared clock back
		flushSync();
	});
});
