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
// `toISODate` because the store's "today" is the LOCAL wall clock (`liveToday`
// → `toISODate()`), and a spec that dates its own fixtures with
// `new Date().toISOString()` is using UTC instead. The two disagree between
// local and UTC midnight, which made the §33 tests below pass in CI and fail
// for two hours every night east of Greenwich — the exact off-by-one
// `utils/date.ts` exists to prevent.
import { addDays, toISODate } from '$lib/business/utils/date';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import type { StorageStatusStore } from '$lib/business/store/storage-status.svelte';
import type { DailySession } from '$lib/business/type';
import type { TitleRating } from '$lib/business/model/title-memory';
import { summarizeBudgetHistory } from '$lib/business/model/budget-memory';

vi.mock('$lib/business/session-history', () => ({
	initializeStorage: vi.fn(async () => {}),
	readHistoryPrefills: vi.fn(),
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
	$createOrUpdateFlowObservation: vi.fn(async () => {}),
	$updateFlowObservation: vi.fn(async () => {}),
	$deleteFlowObservation: vi.fn(async () => {}),
	$restoreFlowObservation: vi.fn(async () => {}),
	$deleteAllFlowObservations: vi.fn(async () => {}),
	$readAllFlowObservations: vi.fn(async () => []),
}));

const readHistoryPrefillsMock = vi.mocked(sessionHistory.readHistoryPrefills);
const updateSessionMock = vi.mocked(sessionRepository.$updateSession);
const readSessionByDateMock = vi.mocked(sessionRepository.$readSessionByDate);

/** What the boot read answers before any day has been budgeted or rated. */
const noPrefills = () => ({
	titleRatings: new Map<string, TitleRating>(),
	budgets: summarizeBudgetHistory([]),
});

const createOrUpdateFlowObservationMock = vi.mocked(
	flowObservationRepository.$createOrUpdateFlowObservation,
);

const updateFlowObservationMock = vi.mocked(flowObservationRepository.$updateFlowObservation);
const readAllFlowObservationsMock = vi.mocked(flowObservationRepository.$readAllFlowObservations);

// Installed here rather than in the mock factory, which is hoisted above the
// imports and so cannot call the fold that defines an empty history.
beforeEach(() => {
	readHistoryPrefillsMock.mockImplementation(async () => noPrefills());
});

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

		createOrUpdateFlowObservationMock.mockRejectedValueOnce(new Error('write failed'));
		await store.logFlow(id, 25);
		expect(store.flowMinutesOn(store.today).get(id)).toBeUndefined();
		expect(status.error).toBe('save-failed');

		status.clear();

		readAllFlowObservationsMock.mockResolvedValue([
			{
				...flowLog(store.today),
				taskId: id,
				phiHours: 25 / 60,
			},
		]);

		await store.logFlow(id, 25);
		expect(store.flowMinutesOn(store.today).get(id)).toBe(25);
		expect(status.error).toBeNull();
	});

	// The row's own ⚡ editor drops the measurement it opened on, so it addresses the
	// log the only way a row can — by its task — where the budget panel's list has a
	// record id to hand. Both land on the same delete, badge clearing included.
	it('clears a task’s ⚡ measurement without its record id', async () => {
		const { store } = await setup();

		store.addTask({
			title: 'deep work',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 6,
		});

		flushSync();
		const id = store.tasks[0].id;

		readAllFlowObservationsMock.mockResolvedValue([
			{
				id: 77,
				date: toISODate(),
				taskId: id,
				taskTitle: 'deep work',
				difficulty: 5,
				enjoyment: 6,
				E: 3,
				beta: 1.5,
				phiHours: 0.4,
				createdAt: 0,
			},
		]);

		await store.logFlow(id, 24);
		expect(store.flowMinutesOn(store.today).get(id)).toBe(24);

		readAllFlowObservationsMock.mockResolvedValue([]);
		await store.clearFlowLog(id);

		expect(vi.mocked(flowObservationRepository.$deleteFlowObservation)).toHaveBeenCalledWith(77);
		expect(store.flowMinutesOn(store.today).get(id)).toBeUndefined();
	});

	/* A dropped measurement is offered back for as long as its toast lives, the way a
	   deleted task is (`removeTaskWithUndo`). The undo is a closure because only the
	   store knows what putting it back means: the whole record, under the id and stamp
	   it was dropped with — a re-log would be a second measurement. */
	it('hands back an undo that puts a dropped ⚡ measurement back', async () => {
		const record = {
			...flowLog(toISODate()),
			id: 77,
			taskId: 5,
		};

		readAllFlowObservationsMock.mockResolvedValue([record]);

		const { store } = await setup();

		readAllFlowObservationsMock.mockResolvedValue([]);
		const undo = await store.deleteFlowLog(77);

		expect(vi.mocked(flowObservationRepository.$deleteFlowObservation)).toHaveBeenCalledWith(77);
		expect(store.flowMinutesOn(toISODate()).get(5)).toBeUndefined();

		readAllFlowObservationsMock.mockResolvedValue([record]);
		await undo?.();

		expect(vi.mocked(flowObservationRepository.$restoreFlowObservation)).toHaveBeenCalledWith(
			record,
		);

		expect(store.flowMinutesOn(toISODate()).get(5)).toBe(240);
	});

	/* The row addresses its ⚡ by TASK — it has no record id — and the 🗑 in its editor
	   drops the same measurement the analytics ✕ does, so it must offer the same window.
	   Forwarding the undo is what lets one helper cover both addresses. */
	it('hands the row’s by-task delete the same undo', async () => {
		const record = {
			...flowLog(toISODate()),
			id: 77,
			taskId: 5,
		};

		readAllFlowObservationsMock.mockResolvedValue([record]);

		const { store } = await setup();

		readAllFlowObservationsMock.mockResolvedValue([]);
		const undo = await store.clearFlowLog(5);

		expect(vi.mocked(flowObservationRepository.$deleteFlowObservation)).toHaveBeenCalledWith(77);

		readAllFlowObservationsMock.mockResolvedValue([record]);
		await undo?.();

		expect(store.flowMinutesOn(toISODate()).get(5)).toBe(240);
	});

	// A double-click on ✕: the second one addresses a record the store no longer holds,
	// and must neither delete blind nor raise a toast offering to restore nothing.
	it('drops nothing and offers no undo for a ⚡ record it does not hold', async () => {
		const { store } = await setup();

		expect(await store.deleteFlowLog(4242)).toBeUndefined();
		expect(vi.mocked(flowObservationRepository.$deleteFlowObservation)).not.toHaveBeenCalled();
	});

	/* ⚡ became correctable on a past day on 2026-08-10. It could not be before, because
	   the badge read a `flowMinutes` field stamped on the day's session and the auto-save
	   deliberately never rewrites a past day — an amended one came back on the next load.
	   The badge now reads the day's own observation, which is the only record a correction
	   has to touch, and these three tests are that rule from its three sides. */
	const pastDay = (date: string): DailySession => ({
		date,
		tasks: [
			{
				id: 3,
				title: 'a slow one',
				physicalDifficulty: 2,
				mentalDifficulty: 8,
				enjoyment: 5,
				createdAt: '2000-01-01',
				completed: false,
			},
		],
		availableHours: 8,
		switchCost: 0.25,
		updatedAt: 0,
	});

	const viewing = async (date: string) => {
		readSessionByDateMock.mockResolvedValue(pastDay(date));

		const { store } = await setup();

		mockPage.url = new URL(`http://localhost/?date=${date}`);
		await vi.waitFor(() => expect(store.selectedDate).toBe(date));
		createOrUpdateFlowObservationMock.mockClear();

		return store;
	};

	it('corrects a past day’s ⚡ reading, on that day', async () => {
		const past = '2000-01-01';

		readAllFlowObservationsMock.mockResolvedValue([
			{
				...flowLog(past),
				taskId: 3,
				phiHours: 0.5,
			},
		]);

		const store = await viewing(past);

		// What the row's badge shows, read off the observation and not the session.
		expect(store.flowMinutesOn(past).get(3)).toBe(30);

		await store.logFlow(3, 25);

		expect(createOrUpdateFlowObservationMock).toHaveBeenCalledWith(
			expect.objectContaining({
				date: past,
				taskId: 3,
				phiHours: 25 / 60,
			}),
		);
	});

	// The row's ✎ is a correction too, and MATH.md §36's rule is about the correction and
	// not about the address it arrived by: the covariates on the record were captured when
	// the measurement was taken, so the task as it is NOW must not reach them. Without
	// this, raising a task's difficulty on Friday and then fixing Monday's reading
	// re-prices Monday's data point in the ϕ fit (MATH.md §5) — and so does re-saving the
	// same number.
	it('keeps the captured (E, β) when the row corrects a reading', async () => {
		const past = '2000-01-01';

		readAllFlowObservationsMock.mockResolvedValue([
			{
				...flowLog(past),
				taskId: 3,
				difficulty: 3,
				enjoyment: 9,
				E: 2,
				beta: 1.8,
			},
		]);

		const store = await viewing(past);

		// The day's task reads 8/5 — nothing like the 3/9 the measurement was taken under.
		await store.logFlow(3, 25);

		expect(createOrUpdateFlowObservationMock).toHaveBeenCalledWith(
			expect.objectContaining({
				difficulty: 3,
				enjoyment: 9,
				E: 2,
				beta: 1.8,
				phiHours: 25 / 60,
			}),
		);
	});

	// The other side: a FIRST measurement has no record to read covariates off, so it is
	// the one write that derives them — that is the moment they are being observed.
	it('derives (E, β) from the task when the measurement is new', async () => {
		readAllFlowObservationsMock.mockResolvedValue([]);

		const { store } = await setup();

		store.addTask({
			title: 'deep work',
			physicalDifficulty: 2,
			mentalDifficulty: 8,
			enjoyment: 6,
		});

		flushSync();

		await store.logFlow(store.tasks[0].id, 25);

		// 8.6, not the raw 8: `getEffectiveDifficulty` blends the physical channel in, and
		// the whole point of freezing it is that it is derived rather than stored anywhere.
		expect(createOrUpdateFlowObservationMock).toHaveBeenCalledWith(
			expect.objectContaining({
				difficulty: 8.6,
				enjoyment: 6,
			}),
		);
	});

	// The other side of the rule: a correction re-describes a measurement that exists,
	// while a FIRST one on a past day is a measurement nobody took. Refused here rather
	// than only hidden in the UI, because the store is what the date belongs to.
	it('refuses a first ⚡ on a past day', async () => {
		readAllFlowObservationsMock.mockResolvedValue([]);

		const store = await viewing('2000-01-01');

		await store.logFlow(3, 25);

		expect(createOrUpdateFlowObservationMock).not.toHaveBeenCalled();
	});

	/* `logFlow` above is the ROW's verb: it reads the viewed day and that day's task,
	   which is what lets it derive (E, β) for a first measurement and what confines it
	   to a day the page is showing. `editFlowLog` is the same correction addressed the
	   only other way a caller can address it — by the record — for the analytics
	   history, which shows every day at once and so views none of them.

	   It goes through the repository's edit-by-id rather than the row's upsert with the
	   record spread back in. The two differ exactly when the record is already gone: the
	   upsert's not-found branch would INSERT it again under its own id with a fresh
	   `createdAt`, resurrecting a dropped measurement into the ϕ fit. */
	it('corrects a ⚡ measurement by its record, with no day in view', async () => {
		const { store } = await setup();

		await store.editFlowLog(77, 25);

		// Only the measured quantity. Everything that identifies the record — its day, its
		// task, its captured (E, β) and its log moment — is the repository's to keep, and
		// the payload type is what says so.
		expect(updateFlowObservationMock).toHaveBeenCalledWith(77, {
			phiHours: 25 / 60,
		});

		expect(createOrUpdateFlowObservationMock).not.toHaveBeenCalled();
	});

	it('reports a failed ⚡ correction as save-failed', async () => {
		const { store, status } = await setup();
		updateFlowObservationMock.mockRejectedValueOnce(new Error('write failed'));

		await store.editFlowLog(77, 25);

		expect(status.error).toBe('save-failed');
	});

	it('drops the ⚡ reading a past day shows', async () => {
		const past = '2000-01-01';

		readAllFlowObservationsMock.mockResolvedValue([
			{
				...flowLog(past),
				id: 77,
				taskId: 3,
			},
		]);

		const store = await viewing(past);

		await store.clearFlowLog(3);

		expect(vi.mocked(flowObservationRepository.$deleteFlowObservation)).toHaveBeenCalledWith(77);
	});

	// Nothing to delete is not a failure: the ⚡ editor is open on an unmeasured task,
	// which is the ordinary case of logging one for the first time.
	it('clears nothing when the task has no ⚡ measurement', async () => {
		const { store } = await setup();

		await store.clearFlowLog(4242);

		expect(vi.mocked(flowObservationRepository.$deleteFlowObservation)).not.toHaveBeenCalled();
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

	// The store feeds the main page's allocator, so this is where a missing
	// `ageDays` would do the most damage — and it would do it silently: the fit
	// still succeeds, just over the person the user was a decade ago. Measured
	// from age 1, the freshest a counted log can now be (§33).
	it('ages ⚡ logs against the planned day, so a decade-old log no longer personalizes the plan', async () => {
		const constantsFrom = async (ageDays: number) => {
			const today = toISODate();
			readAllFlowObservationsMock.mockResolvedValue([flowLog(addDays(today, -ageDays))]);
			const { store } = await setup();
			const { c1, c2, c3 } = store.userConstants;

			cleanup();

			return c1 * 3 + c2 * 1.5 + c3;
		};

		const fresh = await constantsFrom(1);
		const ancient = await constantsFrom(3650);

		expect(fresh).toBeGreaterThan(ancient + 1);
	});

	/* MATH.md §33: a plan for day D is fitted from logs dated STRICTLY BEFORE D.
	   The constants are global, so one ⚡ re-times every task on the page — 33% on
	   a task the user never logged, most of it on the very first log. Landing that
	   on the day already in flight is what made a plan reshuffle under someone
	   halfway through running it. */
	it('keeps the viewed day out of its own fit, and counts the log from the next day', async () => {
		const today = toISODate();

		readAllFlowObservationsMock.mockResolvedValue([flowLog(today)]);
		const sameDay = await setup();

		expect(sameDay.store.pendingFlowLogCount).toBe(1);
		expect(sameDay.store.constantsFit.fitted).toBe(false);
		expect(sameDay.store.userConstants).toEqual(DEFAULT_USER_CONSTANTS);

		cleanup();

		readAllFlowObservationsMock.mockResolvedValue([flowLog(addDays(today, -1))]);
		const dayAfter = await setup();

		expect(dayAfter.store.pendingFlowLogCount).toBe(0);
		expect(dayAfter.store.constantsFit.fitted).toBe(true);
		// The same log, one day older, is the whole difference.
		expect(dayAfter.store.userConstants).not.toEqual(DEFAULT_USER_CONSTANTS);
	});

	// The rule is "before the day being PLANNED", not "before today" — so a day
	// the user is previewing already carries every log made so far, and only the
	// day in flight defers.
	it("counts today's ⚡ when the viewed day is tomorrow", async () => {
		const today = toISODate();

		readAllFlowObservationsMock.mockResolvedValue([flowLog(today)]);
		const { store } = await setup();

		expect(store.constantsFit.fitted).toBe(false);

		mockPage.url = new URL(`http://localhost/?date=${addDays(today, 1)}`);
		await vi.waitFor(() => expect(store.selectedDate).toBe(addDays(today, 1)));

		expect(store.pendingFlowLogCount).toBe(0);
		expect(store.constantsFit.fitted).toBe(true);
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
		await store.logFlow(id, 25); // a measurement keyed to today, which must NOT travel
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

		// A statement about today stays behind, and so does the measurement: it is keyed
		// by (task, date) in its own store, and the move gives the task a fresh id in
		// tomorrow's id space, so tomorrow reads no ⚡ for it.
		expect(write.tasks[0].mustDoToday).toBeUndefined();
		expect(store.flowMinutesOn(addDays(store.today, 1)).size).toBe(0);
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

	/* The destination line reads a day the card cannot send to on a past day, where
	   the move itself refuses (ROADMAP item 21) — so both answer through the same
	   guards, and the reading never describes a day no button can reach. */
	it('previews no destination on a past day', async () => {
		const { store } = await setup();
		const lastWeek = addDays(store.today, -7);
		mockPage.url = new URL(`http://localhost/?date=${lastWeek}`);

		await vi.waitFor(() => expect(store.loadedDate).toBe(lastWeek));

		expect(await store.readDeferDestination()).toBeNull();
	});

	/* `readHistoryPrefills`' policy: the advice this line sits under is priced on
	   today and still correct, so a failed destination read costs the line and
	   never the card — and a banner would claim the day failed to load. */
	it('drops the preview when the destination read fails, and raises no banner', async () => {
		const { store, status } = await setup();
		const tomorrow = addDays(store.today, 1);

		readSessionByDateMock.mockImplementation(async (date: string) => {
			if (date === tomorrow) throw new Error('InvalidStateError');

			return null;
		});

		expect(await store.readDeferDestination()).toBeNull();
		expect(status.error).toBeNull();
	});

	/* A reading about ANOTHER day cannot be kept fresh by the advice fingerprint,
	   which is a value over the VIEWED day's inputs: today → tomorrow (edit it) →
	   today fingerprints identically. The count is per DATE, because only a write to
	   the day a reading describes can change what it says (ROADMAP item 21). */
	it('counts a landed session write against the date it wrote', async () => {
		const { store } = await setup();
		useFakeTimers();
		expect(store.writeGenerationFor(store.today)).toBe(0);

		store.availableHours = 4;
		flushSync();
		setHidden(true); // flushes the pending write at once
		vi.useRealTimers();

		await vi.waitFor(() => expect(store.writeGenerationFor(store.today)).toBe(1));
		expect(store.writeGenerationFor(addDays(store.today, 1))).toBe(0);
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

describe('SessionStore budget prefill', () => {
	const today = toISODate();
	// A week apart is the same weekday, which is what the prefill keys on — so
	// only the day's pastness, or a record of its own, can change these answers.
	const lastWeek = addDays(today, -7);
	const nextWeek = addDays(today, 7);

	const budgeted = (date: string, availableHours: number): DailySession => ({
		date,
		tasks: [],
		availableHours,
		switchCost: 0.25,
		updatedAt: 0,
	});

	// Today's weekday reads 6, tomorrow's 3, so an answer names which weekday it
	// came from rather than falling out of one number for the whole history.
	const prefilledBudgets = () =>
		summarizeBudgetHistory([
			budgeted(lastWeek, 6),
			budgeted(addDays(lastWeek, -7), 6),
			budgeted(addDays(today, -6), 3),
		]);

	beforeEach(() => {
		mockPage.url = new URL('http://localhost/');

		readHistoryPrefillsMock.mockImplementation(async () => ({
			...noPrefills(),
			budgets: prefilledBudgets(),
		}));
	});

	afterEach(() => {
		vi.useRealTimers();
		readSessionByDateMock.mockImplementation(async () => null);
	});

	it('opens a day with no stored session on the hours that weekday usually has', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));
	});

	/* The whole item turns on this one: the autosave's dirty test used to be the
	   budget itself, so a prefill would write a phantom session for every future
	   day the user merely looked at — a day that then appears in the calendar, in
	   analytics' planned hours, and as a declared intent driving Burnout Risk. */
	it('writes no session for a day the user only looked at', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));
		useFakeTimers();
		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

		expect(updateSessionMock).not.toHaveBeenCalled();
	});

	// A stored 0 is an answer — the day the user emptied, or has not budgeted yet
	// but has already saved for another reason. The prefill speaks for unseen days.
	it('leaves a stored budget of zero alone', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));
		readSessionByDateMock.mockImplementation(async (date: string) => budgeted(date, 0));
		mockPage.url = new URL(`http://localhost/?date=${nextWeek}`);

		await vi.waitFor(() => {
			expect(store.loadedDate).toBe(nextWeek);
			expect(store.availableHours).toBe(0);
		});
	});

	it('keeps a budget the user typed to zero', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));
		store.availableHours = 0;
		flushSync();

		expect(store.availableHours).toBe(0);
	});

	// The day is saved for a reason of its own, so it records the hours it was
	// showing while the task was added — not the 0 nobody was looking at.
	it('persists the prefilled hours once the day is saved for another reason', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));
		useFakeTimers();

		store.addTask({
			title: 'ship it',
			physicalDifficulty: 3,
			mentalDifficulty: 5,
			enjoyment: 5,
		});

		flushSync();
		vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

		expect(updateSessionMock).toHaveBeenCalledTimes(1);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			date: today,
			availableHours: 6,
		});
	});

	// A past day with no record is history, and history had no budget. Filling
	// one in would be the app making a claim about a day the user did not plan.
	it('offers nothing on a past day with no record', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));
		mockPage.url = new URL(`http://localhost/?date=${lastWeek}`);

		await vi.waitFor(() => {
			expect(store.loadedDate).toBe(lastWeek);
			expect(store.availableHours).toBe(0);
		});
	});

	/* The day the deferred task lands on is being saved for a reason of its own,
	   so it records the hours it will open on — the rule the autosave payload
	   follows. A hard 0 here would make the destination a STORED day at 0, which
	   no prefill may then speak for: the symptom item 16 exists to remove, and
	   item 21's prereq. */
	it('gives tomorrow the hours its own weekday usually has when a defer creates it', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));

		store.addTask({
			title: 'Tax return',
			physicalDifficulty: 2,
			mentalDifficulty: 10,
			enjoyment: 1,
		});

		flushSync();
		const id = store.tasks[0].id;
		useFakeTimers(); // freeze the auto-save so only the move writes

		expect(await store.moveTaskToTomorrow(id)).toBe(true);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			date: addDays(today, 1),
			availableHours: 3,
		});
	});

	/* The preview and the move read tomorrow through ONE definition (AGENTS.md R3):
	   the line would otherwise be free to print hours the write does not use, and
	   nothing in either signature would say the two agree. Tomorrow's own weekday
	   reads 3 here, today's 6, so the wrong day's fallback is visible. */
	it('previews tomorrow on the hours the defer would write it with', async () => {
		const { store } = await setup();

		await vi.waitFor(() => expect(store.availableHours).toBe(6));

		expect(await store.readDeferDestination()).toEqual({
			taskCount: 0,
			budgetHours: 3,
			fundedCount: 0,
		});

		store.addTask({
			title: 'Tax return',
			physicalDifficulty: 2,
			mentalDifficulty: 10,
			enjoyment: 1,
		});

		flushSync();
		useFakeTimers(); // freeze the auto-save so only the move writes

		expect(await store.moveTaskToTomorrow(store.tasks[0].id)).toBe(true);

		expect(updateSessionMock.mock.calls[0][0]).toMatchObject({
			availableHours: 3,
		});
	});

	/* The bar the constraints panel opens is remounted on `loadedDate` and
	   snapshots its `isOpen` prop, so a day that lands before its hours do opens
	   the panel against a budget of 0 and then fills in behind it. Deriving the
	   prefill cannot win that race on its own — the boot read has to be in hand
	   before the day is presented. */
	it('does not present the day until its hours are known', async () => {
		let land!: (prefills: ReturnType<typeof noPrefills>) => void;

		readHistoryPrefillsMock.mockReturnValue(new Promise((resolve) => (land = resolve)));

		let store!: SessionStore;

		render(Harness, {
			onstore: (s: SessionStore) => (store = s),
		});

		await vi.waitFor(() => expect(readHistoryPrefillsMock).toHaveBeenCalled());

		expect(store.loadedDate).toBeNull();

		land({
			...noPrefills(),
			budgets: prefilledBudgets(),
		});

		await vi.waitFor(() => expect(store.loadedDate).toBe(today));

		expect(store.availableHours).toBe(6);
	});
});

describe('SessionStore title memory', () => {
	beforeEach(() => {
		mockPage.url = new URL('http://localhost/');
		// The call log is what the date-scoping test reads, and `mount()` deliberately
		// does not clear it — so without this that test could pass on a call another
		// test made, and only fail for its own reason while it happens to run first.
		readHistoryPrefillsMock.mockClear();
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

		await vi.waitFor(() => expect(readHistoryPrefillsMock).toHaveBeenCalled());

		expect(store.selectedDate).toBe('2099-01-01');
		expect(readHistoryPrefillsMock).toHaveBeenCalledWith(store.today);
		expect(readHistoryPrefillsMock).not.toHaveBeenCalledWith('2099-01-01');
	});

	it('suggests the rated titles a part-typed one could be', async () => {
		readHistoryPrefillsMock.mockResolvedValue({
			...noPrefills(),
			titleRatings: new Map([
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
		});

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
	 * A suggestion list on screen is a subscriber that has already asked, and a
	 * re-read — the banner's retry, after a boot whose history read failed — has to
	 * reach it. Polling `suggestTitles` in a waitFor cannot tell that apart from a
	 * field nothing ever invalidates, so the answers are recorded in an effect.
	 */
	it('lets a suggestion list that already asked see a later history land', async () => {
		const { store } = mount();

		await vi.waitFor(() => expect(store.isLoading).toBe(false));

		const answers: number[] = [];

		const stop = $effect.root(() => {
			$effect(() => void answers.push(store.suggestTitles('gym').length));
		});

		flushSync();
		expect(answers).toEqual([0]); // asked, and answered from an empty history

		readHistoryPrefillsMock.mockResolvedValue({
			...noPrefills(),
			titleRatings: new Map([
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
		});

		store.retryLoad();

		await vi.waitFor(() => {
			flushSync();
			expect(answers.at(-1)).toBe(1);
		});

		stop();
	});

	// The form falling back to 5/5 is the state the app shipped in for a year;
	// raising the banner over it would tell the user their day failed to load.
	it('leaves the banner clear when the ratings read fails', async () => {
		readHistoryPrefillsMock.mockRejectedValue(new Error('IndexedDB unavailable'));

		const { store, status } = mount();

		await vi.waitFor(() => expect(store.isLoading).toBe(false));

		expect(status.error).toBeNull();
		expect(store.suggestTitles('gym')).toEqual([]);
	});
});
