import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import Harness from '$lib/business/store/session-store.test-harness.svelte';
import { mockPage } from '$lib/business/store/session-store.test-utils.svelte';
import * as sessionHistory from '$lib/business/session-history';
import * as sessionRepository from '$lib/data/repository/session-repository';
import * as flowObservationRepository from '$lib/data/repository/flow-observation-repository';
import type { SessionStore } from '$lib/business/store/session-store.svelte';
import { AUTOSAVE_DEBOUNCE_MS } from '$lib/business/store/debounced-write.svelte';
import { addDays } from '$lib/business/utils/date';
import type { StorageStatusStore } from '$lib/business/store/storage-status.svelte';
import type { DailySession } from '$lib/business/type';
import type { TitleRating } from '$lib/business/model/title-memory';

vi.mock('$lib/business/session-history', () => ({
	initializeStorage: vi.fn(async () => {}),
	readTitleRatings: vi.fn(async () => new Map()),
}));

vi.mock('$lib/data/repository/session-repository', () => ({
	$updateSession: vi.fn(async () => {}),
	$readSessionByDate: vi.fn(async () => null),
	$readSessionsByDateRange: vi.fn(async () => []),
}));

vi.mock('$lib/data/repository/routine-repository', () => ({
	$updateRoutine: vi.fn(async () => {}),
	$deleteRoutine: vi.fn(async () => {}),
	$readAllRoutines: vi.fn(async () => []),
}));

vi.mock('$lib/data/repository/flow-observation-repository', () => ({
	$updateFlowObservation: vi.fn(async () => {}),
	$deleteFlowObservation: vi.fn(async () => {}),
	$deleteAllFlowObservations: vi.fn(async () => {}),
	$readAllFlowObservations: vi.fn(async () => []),
}));

const readTitleRatingsMock = vi.mocked(sessionHistory.readTitleRatings);
const updateSessionMock = vi.mocked(sessionRepository.$updateSession);
const readSessionByDateMock = vi.mocked(sessionRepository.$readSessionByDate);
const updateFlowObservationMock = vi.mocked(flowObservationRepository.$updateFlowObservation);
const readAllFlowObservationsMock = vi.mocked(flowObservationRepository.$readAllFlowObservations);

/**
 * Mount the store in a component context and wait for the initial load. The
 * banner comes back too: the store reports failures into `StorageStatusStore`
 * rather than owning the flag, so that is where a spec reads them.
 */
async function setup(): Promise<{ store: SessionStore; status: StorageStatusStore }> {
	let store!: SessionStore;
	let status!: StorageStatusStore;

	render(Harness, {
		onstore: (s: SessionStore) => (store = s),
		onstatus: (s: StorageStatusStore) => (status = s),
	});

	await vi.waitFor(() => expect(store.isLoading).toBe(false));
	vi.clearAllMocks(); // drop the initial-load calls; tests assert deltas

	return {
		store,
		status,
	};
}

function setHidden(hidden: boolean) {
	Object.defineProperty(document, 'hidden', {
		value: hidden,
		configurable: true,
	});

	document.dispatchEvent(new Event('visibilitychange'));
}

function useFakeTimers() {
	vi.useFakeTimers({
		toFake: ['setTimeout', 'clearTimeout', 'Date'],
	});
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
		const { store } = await setup();
		useFakeTimers();

		store.availableHours = 4;
		flushSync();
		store.availableHours = 6;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
		expect(updateSessionMock).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(updateSessionMock).toHaveBeenCalledTimes(1);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			date: store.today,
			availableHours: 6,
		});
	});

	it('flushes the pending save immediately when the tab hides', async () => {
		const { store } = await setup();
		useFakeTimers();

		store.availableHours = 3;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		setHidden(true);
		expect(updateSessionMock).toHaveBeenCalledTimes(1);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			availableHours: 3,
		});
	});

	it('re-reads the selected date on becoming visible, picking up another tab’s write', async () => {
		const { store } = await setup();

		const otherTabSession: DailySession = {
			date: store.today,
			tasks: [],
			availableHours: 9,
			switchCost: 0.25,
			updatedAt: Date.now(),
		};

		readSessionByDateMock.mockResolvedValueOnce(otherTabSession);

		setHidden(true); // nothing pending: no write
		expect(updateSessionMock).not.toHaveBeenCalled();
		setHidden(false);

		await vi.waitFor(() => expect(store.availableHours).toBe(9));
		expect(readSessionByDateMock).toHaveBeenCalledWith(store.today);
	});

	// The other half of that handler, and the half the shared autosave writer made
	// a cross-module question — the store asks the writer whether anything is
	// still queued. Reachable in the wild: a hidden tab that rolls over midnight
	// re-loads the day and re-arms the autosave, so a return can land with a write
	// pending. Re-reading then would overwrite the unlanded edit with the stored
	// day, which is the edit the user just typed.
	it('does not re-read on becoming visible while a write is still pending', async () => {
		const { store } = await setup();
		useFakeTimers();

		store.availableHours = 4;
		flushSync();

		const stored: DailySession = {
			date: store.today,
			tasks: [],
			availableHours: 9,
			switchCost: 0.25,
			updatedAt: Date.now(),
		};

		readSessionByDateMock.mockResolvedValue(stored);
		setHidden(false); // still inside the debounce: the edit has not landed

		expect(readSessionByDateMock).not.toHaveBeenCalled();
		expect(store.availableHours).toBe(4);
	});

	it('flushes the pending save before loading a newly selected date', async () => {
		const { store } = await setup();
		const today = store.today;
		useFakeTimers();

		store.availableHours = 5;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		mockPage.url = new URL('http://localhost/?date=2099-01-01');
		flushSync(); // date-change reload flushes the pending edit first

		expect(updateSessionMock).toHaveBeenCalledTimes(1);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			date: today,
			availableHours: 5,
		});
	});

	it('reports a failed save into the banner store, which clears it on demand', async () => {
		const { store, status } = await setup();
		updateSessionMock.mockRejectedValueOnce(new Error('QuotaExceededError'));
		useFakeTimers();

		store.availableHours = 2;
		flushSync();
		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
		vi.useRealTimers();

		await vi.waitFor(() => expect(status.error).toBe('save-failed'));
		status.clear();
		expect(status.error).toBeNull();
	});

	it('stamps the ⚡ badge only when the flow write succeeds', async () => {
		const { store, status } = await setup();

		store.addTask({
			title: 'deep work',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 6,
		});

		flushSync();
		const id = store.tasks[0].id;

		updateFlowObservationMock.mockRejectedValueOnce(new Error('write failed'));
		await store.logFlow(id, 25);
		expect(store.tasks[0].flowMinutes).toBeUndefined();
		expect(status.error).toBe('save-failed');

		status.clear();
		await store.logFlow(id, 25);
		expect(store.tasks[0].flowMinutes).toBe(25);
		expect(status.error).toBeNull();
	});

	// Stored JSON is user-reachable (devtools, a hand-edited backup, an older
	// build), and nothing downstream defends itself: Math.max('abc', 3) is NaN,
	// and the auto-save would then write that NaN straight back.
	it('repairs a corrupt persisted day instead of feeding the model NaN', async () => {
		readSessionByDateMock.mockImplementation(
			async (date: string) =>
				({
					date,
					tasks: [
						{
							id: 1,
							title: 'write',
							physicalDifficulty: 3,
							mentalDifficulty: 'abc',
							enjoyment: 5,
							createdAt: date,
							completed: false,
						},
						{
							title: 'unaddressable, no id',
						},
					],
					availableHours: 'eight',
					switchCost: 0.25,
					updatedAt: 0,
				}) as unknown as DailySession,
		);

		const { store } = await setup();

		expect(store.tasks).toHaveLength(1); // the id-less task can't be kept
		expect(store.tasks[0].title).toBe('write'); // …but the user's writing is
		expect(store.tasks[0].mentalDifficulty).not.toBeNaN();
		expect(store.availableHours).toBe(0);
		expect(store.userConstants.c1).not.toBeNaN();
	});

	// The store feeds the main page's allocator, so this is where a missing
	// `ageDays` would do the most damage — and it would do it silently: the fit
	// still succeeds, just over the person the user was a decade ago.
	it('ages ⚡ logs against today, so a decade-old log no longer personalizes the plan', async () => {
		const flowLog = (date: string) => ({
			id: 1,
			date,
			taskId: 1,
			taskTitle: 'a slow one',
			difficulty: 5,
			enjoyment: 5,
			E: 3,
			beta: 1.5,
			phiHours: 4,
			createdAt: 0,
		});

		const constantsFrom = async (ageDays: number) => {
			const today = new Date().toISOString().slice(0, 10);
			readAllFlowObservationsMock.mockResolvedValue([flowLog(addDays(today, -ageDays))]);
			const { store } = await setup();
			const { c1, c2, c3 } = store.userConstants;

			cleanup();

			return c1 * 3 + c2 * 1.5 + c3;
		};

		const fresh = await constantsFrom(0);
		const ancient = await constantsFrom(3650);

		expect(fresh).toBeGreaterThan(ancient + 1);
	});

	it('gives every task its own integer id, even added in the same millisecond', async () => {
		const { store } = await setup();
		useFakeTimers(); // freezes Date.now(), which alone used to be the id

		const draft = {
			title: 'ship it',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		};

		store.addTask(draft);
		flushSync();
		store.addTask(draft);
		flushSync();
		store.importTasks([draft, draft]); // the path that used to add a fraction
		flushSync();

		const ids = store.tasks.map((t) => t.id);
		expect(new Set(ids).size).toBe(4);
		expect(ids.every(Number.isInteger)).toBe(true);
	});

	it('surfaces a failed load instead of silently never saving again', async () => {
		readSessionByDateMock.mockRejectedValue(new Error('IndexedDB unavailable'));
		let store!: SessionStore;
		let status!: StorageStatusStore;

		render(Harness, {
			onstore: (s: SessionStore) => (store = s),
			onstatus: (s: StorageStatusStore) => (status = s),
		});

		await vi.waitFor(() => expect(status.error).toBe('load-failed'));

		// …and the failure is recoverable: retrying re-reads the day, which both
		// clears the banner and unblocks the auto-save guard.
		readSessionByDateMock.mockImplementation(async () => ({
			date: store.today,
			tasks: [],
			availableHours: 7,
			switchCost: 0.25,
			updatedAt: Date.now(),
		}));

		// Through the banner's own action rather than the store's method: the
		// store registered itself, and that registration is what the layout
		// relies on instead of naming every store it has to retry.
		status.retry();

		await vi.waitFor(() => {
			expect(status.error).toBeNull();
			expect(store.availableHours).toBe(7);
		});
	});

	it('ignores a task toggle while a date change is still loading', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'ship it',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		});

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
			expect.objectContaining({
				date: '2000-01-01',
			}),
		);
	});

	it('flushes the pending save when the component is destroyed', async () => {
		const { store } = await setup();
		useFakeTimers();

		store.availableHours = 8;
		flushSync();
		expect(updateSessionMock).not.toHaveBeenCalled();

		cleanup(); // what a locale switch does: the layout re-keys its subtree

		expect(updateSessionMock).toHaveBeenCalledTimes(1);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			availableHours: 8,
		});
	});

	it('moves a task to tomorrow, leaving today-only facts behind', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'Tax return',
			physicalDifficulty: 2,
			mentalDifficulty: 10,
			enjoyment: 1,
		});

		flushSync();
		const id = store.tasks[0].id;
		await store.logFlow(id, 25); // stamps flowMinutes, which must NOT travel
		vi.clearAllMocks();
		useFakeTimers(); // freeze the auto-save so only the move writes

		expect(await store.moveTaskToTomorrow(id)).toBe(true);
		expect(store.tasks).toHaveLength(0);

		const write = updateSessionMock.mock.calls[0][0];
		expect(write.date).toBe(addDays(store.today, 1));
		expect(write.tasks).toHaveLength(1);

		expect(write.tasks[0]).toMatchObject({
			title: 'Tax return',
			completed: false,
		});

		// A statement about today and a measurement keyed to today stay behind.
		expect(write.tasks[0].mustDoToday).toBeUndefined();
		expect(write.tasks[0].flowMinutes).toBeUndefined();
	});

	it('appends to tomorrow’s existing plan instead of replacing it', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'Migrate the database',
			physicalDifficulty: 1,
			mentalDifficulty: 9,
			enjoyment: 2,
		});

		flushSync();
		const id = store.tasks[0].id;
		const tomorrow = addDays(store.today, 1);

		readSessionByDateMock.mockImplementation(async (date: string) =>
			date === tomorrow
				? {
						date,
						tasks: [
							{
								id: 1,
								title: 'already planned',
								physicalDifficulty: 3,
								mentalDifficulty: 3,
								enjoyment: 5,
								createdAt: tomorrow,
								completed: false,
							},
						],
						availableHours: 5,
						switchCost: 0.5,
						updatedAt: 1,
					}
				: null,
		);

		useFakeTimers();

		expect(await store.moveTaskToTomorrow(id)).toBe(true);

		const write = updateSessionMock.mock.calls[0][0];
		expect(write.tasks.map((t) => t.title)).toEqual(['Migrate the database', 'already planned']);
		expect(new Set(write.tasks.map((t) => t.id)).size).toBe(2);

		// Tomorrow's own budget survives the append.
		expect(write).toMatchObject({
			availableHours: 5,
			switchCost: 0.5,
		});
	});

	// Destination write first, removal after: the failure mode must be a visible
	// duplicate, never a vanished task.
	it('keeps the task and raises the banner when the destination write fails', async () => {
		const { store, status } = await setup();

		store.addTask({
			title: 'ship it',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		});

		flushSync();
		useFakeTimers();
		updateSessionMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		expect(await store.moveTaskToTomorrow(store.tasks[0].id)).toBe(false);
		expect(store.tasks).toHaveLength(1);
		expect(status.error).toBe('save-failed');
	});

	it('refuses to move a completed or must-do-today task', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'Tax return',
			physicalDifficulty: 2,
			mentalDifficulty: 10,
			enjoyment: 1,
			mustDoToday: true,
		});

		store.addTask({
			title: 'done already',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		});

		flushSync();
		await store.toggleTask(store.tasks[0].id); // completes 'done already'
		useFakeTimers();
		vi.clearAllMocks();

		for (const task of store.tasks) {
			expect(await store.moveTaskToTomorrow(task.id)).toBe(false);
		}

		expect(store.tasks).toHaveLength(2);
		expect(updateSessionMock).not.toHaveBeenCalled();
	});

	it('puts an undone removal back where it was, with its id', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'stretch',
			physicalDifficulty: 6,
			mentalDifficulty: 1,
			enjoyment: 4,
		});

		store.addTask({
			title: 'ship it',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		});

		flushSync();
		const removed = store.removeTask(store.tasks[1].id); // 'stretch': addTask prepends
		flushSync();

		expect(store.tasks.map((t) => t.title)).toEqual(['ship it']);

		removed?.undo();
		flushSync();

		// Position and id both: /energy renders the day in store order, and all three
		// observation stores key on the id.
		expect(store.tasks.map((t) => t.title)).toEqual(['ship it', 'stretch']);
		expect(store.tasks[1].id).toBe(removed?.task.id);
	});

	it('refuses an undo aimed at a day the task did not come from', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'ship it',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		});

		flushSync();
		const removed = store.removeTask(store.tasks[0].id);
		flushSync();

		// The undo outlives its toast's few seconds of day: a read that never settles,
		// so the viewed date is already the past day while the in-memory tasks still
		// belong to today — the same shape as the toggle guard above.
		readSessionByDateMock.mockImplementationOnce(() => new Promise(() => {}));
		mockPage.url = new URL('http://localhost/?date=2000-01-01');
		flushSync();

		removed?.undo();
		flushSync();

		expect(store.tasks).toEqual([]);

		expect(updateSessionMock).not.toHaveBeenCalledWith(
			expect.objectContaining({
				date: '2000-01-01',
			}),
		);
	});

	it('re-reads yesterday after a midnight rollover', async () => {
		const { store } = await setup();
		const dayBeforeRollover = store.today;
		const realNow = Date.now();

		vi.useFakeTimers({
			toFake: ['Date'],
		});

		vi.setSystemTime(realNow + 24 * 60 * 60 * 1000);

		readSessionByDateMock.mockImplementation(async (date: string) =>
			date === dayBeforeRollover
				? {
						date,
						tasks: [],
						availableHours: 5,
						switchCost: 0.25,
						updatedAt: 0,
					}
				: null,
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

describe('SessionStore title memory', () => {
	beforeEach(() => {
		mockPage.url = new URL('http://localhost/');
		// The call log is what the date-scoping test reads, and `mount()` deliberately
		// does not clear it — so without this that test could pass on a call another
		// test made, and only fail for its own reason while it happens to run first.
		readTitleRatingsMock.mockClear();
	});

	afterEach(() => {
		readTitleRatingsMock.mockImplementation(async () => new Map());
	});

	/** Mount without clearing the boot calls: the read itself is under test here. */
	function mount(): { store: SessionStore; status: StorageStatusStore } {
		let store!: SessionStore;
		let status!: StorageStatusStore;

		render(Harness, {
			onstore: (s: SessionStore) => (store = s),
			onstatus: (s: StorageStatusStore) => (status = s),
		});

		return {
			store,
			status,
		};
	}

	// The viewed day, not the live one, is what a bug here would read: a future
	// plan's imported 5/5 is a later day than today, and latest day wins.
	it('reads the ratings against today even while a future day is viewed', async () => {
		mockPage.url = new URL('http://localhost/?date=2099-01-01');

		const { store } = mount();

		await vi.waitFor(() => expect(readTitleRatingsMock).toHaveBeenCalled());

		expect(store.selectedDate).toBe('2099-01-01');
		expect(readTitleRatingsMock).toHaveBeenCalledWith(store.today);
		expect(readTitleRatingsMock).not.toHaveBeenCalledWith('2099-01-01');
	});

	it('suggests the rated titles a part-typed one could be', async () => {
		readTitleRatingsMock.mockResolvedValue(
			new Map([
				[
					'gym session',
					{
						title: 'Gym session',
						physicalDifficulty: 8,
						mentalDifficulty: 2,
						enjoyment: 3,
					},
				],
			]),
		);

		const { store } = mount();

		await vi.waitFor(() =>
			expect(store.suggestTitles('  GYM ')).toEqual([
				{
					title: 'Gym session',
					physicalDifficulty: 8,
					mentalDifficulty: 2,
					enjoyment: 3,
				},
			]),
		);

		// Nothing this could be, and nothing to search on yet
		expect(store.suggestTitles('pilates')).toEqual([]);
		expect(store.suggestTitles('g')).toEqual([]);
	});

	/*
	 * The read is not awaited — `isLoading` is already false while it is in flight,
	 * so the form is on screen and being typed into. A subscriber that asked before
	 * the history landed has to see it arrive; polling `suggestTitles` in a waitFor
	 * cannot tell that apart from a field nothing ever invalidates.
	 */
	it('lets a suggestion list that already asked see the history land', async () => {
		let land!: (ratings: Map<string, TitleRating>) => void;

		readTitleRatingsMock.mockReturnValue(new Promise((resolve) => (land = resolve)));

		const { store } = mount();

		await vi.waitFor(() => expect(store.isLoading).toBe(false));

		const answers: number[] = [];

		const stop = $effect.root(() => {
			$effect(() => void answers.push(store.suggestTitles('gym').length));
		});

		flushSync();
		expect(answers).toEqual([0]); // asked, and answered from an empty history

		land(
			new Map([
				[
					'gym session',
					{
						title: 'Gym session',
						physicalDifficulty: 8,
						mentalDifficulty: 2,
						enjoyment: 3,
					},
				],
			]),
		);

		await vi.waitFor(() => {
			flushSync();
			expect(answers.at(-1)).toBe(1);
		});

		stop();
	});

	// The form falling back to 5/5 is the state the app shipped in for a year;
	// raising the banner over it would tell the user their day failed to load.
	it('leaves the banner clear when the ratings read fails', async () => {
		readTitleRatingsMock.mockRejectedValue(new Error('IndexedDB unavailable'));

		const { store, status } = mount();

		await vi.waitFor(() => expect(store.isLoading).toBe(false));

		expect(status.error).toBeNull();
		expect(store.suggestTitles('gym')).toEqual([]);
	});
});
