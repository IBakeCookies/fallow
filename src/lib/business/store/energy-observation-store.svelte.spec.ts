import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/energy-observation-store.test-harness.svelte';
import * as drainObservationRepository from '$lib/data/repository/drain-observation-repository';
import * as restObservationRepository from '$lib/data/repository/rest-observation-repository';
import { toISODate } from '$lib/business/utils/date';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import { StorageStatusStore } from '$lib/business/store/storage-status.svelte';
import type { Persisted, Task, DrainObservationRecord } from '$lib/data/type';

vi.mock('$lib/data/repository/drain-observation-repository', () => ({
	$addDrainObservation: vi.fn(async () => {}),
	$editDrainObservation: vi.fn(async () => {}),
	$deleteDrainObservation: vi.fn(async () => {}),
	$deleteAllDrainObservations: vi.fn(async () => {}),
	$readAllDrainObservations: vi.fn(async () => []),
}));

vi.mock('$lib/data/repository/rest-observation-repository', () => ({
	$createRestObservation: vi.fn(async () => {}),
	$deleteRestObservation: vi.fn(async () => {}),
	$deleteAllRestObservations: vi.fn(async () => {}),
	$readAllRestObservations: vi.fn(async () => []),
}));

const addDrainMock = vi.mocked(drainObservationRepository.$addDrainObservation);
const editDrainMock = vi.mocked(drainObservationRepository.$editDrainObservation);
const readAllDrainMock = vi.mocked(drainObservationRepository.$readAllDrainObservations);
const createRestMock = vi.mocked(restObservationRepository.$createRestObservation);
const readAllRestMock = vi.mocked(restObservationRepository.$readAllRestObservations);

const task = (over: Partial<Task> = {}): Task => ({
	id: 1,
	title: 'deep work',
	physicalDifficulty: 3,
	mentalDifficulty: 8,
	enjoyment: 6,
	createdAt: '2026-07-19',
	completed: false,
	...over,
});

const drainRecord = (
	over: Partial<DrainObservationRecord> = {},
): Persisted<DrainObservationRecord> => ({
	id: 1,
	date: toISODate(),
	taskId: 1,
	taskTitle: 'deep work',
	hours: 3,
	cognitiveDemand: 0.8,
	physicalDemand: 0.3,
	mindDrain: 9,
	bodyDrain: 4,
	createdAt: 0,
	...over,
});

/**
 * Mount the store and settle the initial read. The banner store is the real
 * one: what matters is which failure kind reaches it, and that the store
 * registered its own re-read there.
 */
async function setup(tasks: Task[] = [task()]) {
	const status = new StorageStatusStore();
	let store!: EnergyObservationStore;

	render(Harness, {
		onstore: (s: EnergyObservationStore) => (store = s),
		readTasks: () => tasks,
		status,
	});

	await vi.waitFor(() => expect(readAllDrainMock).toHaveBeenCalled());

	return {
		store,
		status,
	};
}

describe('EnergyObservationStore', () => {
	beforeEach(() => {
		readAllDrainMock.mockReset().mockResolvedValue([]);
		readAllRestMock.mockReset().mockResolvedValue([]);
		addDrainMock.mockReset().mockResolvedValue(undefined);
		editDrainMock.mockReset().mockResolvedValue(undefined);
		createRestMock.mockReset().mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// The invariant that makes this a separate store: a measurement belongs to
	// the day it was taken, so it reads the live clock and has no notion of the
	// viewed day — browsing to another date must not be able to misdate one.
	it('stamps a drain rating with today, not with any viewed day', async () => {
		const { store } = await setup();

		await store.logDrain(1, 3, 9, 4);

		expect(addDrainMock.mock.calls[0][0]).toMatchObject({
			date: toISODate(),
		});
	});

	// The row corrects a rating on whatever day it is showing, so a correction must
	// re-describe the session where it happened. Restamping it with the live clock
	// would move the measurement onto today: the day it was worked loses those hours
	// and today gains hours nobody worked, in every per-day fit that reads them
	// (MATH.md §8.7) and in the §33 causal window that scopes plans by date.
	it('leaves a corrected rating on the day it was logged', async () => {
		const { store } = await setup();

		await store.editDrainLog(7, 1, 2, 5, 3);

		expect(editDrainMock.mock.calls[0][1]).not.toHaveProperty('date');
	});

	// One row per session (MATH.md §8.7), so a task can hold several on one day and
	// the row has to show which is which. Scoped to the day it is asked for, not to
	// the live clock: the main page renders past days too.
	it('groups a day’s ratings by task and reads no other day', async () => {
		readAllDrainMock.mockResolvedValue([
			drainRecord({
				id: 1,
				date: '2026-08-08',
				taskId: 1,
			}),
			drainRecord({
				id: 2,
				date: '2026-08-08',
				taskId: 1,
				hours: 1,
			}),
			drainRecord({
				id: 3,
				date: '2026-08-08',
				taskId: 2,
			}),
			drainRecord({
				id: 4,
				date: '2026-08-09',
				taskId: 1,
			}),
		]);

		const { store } = await setup();
		await vi.waitFor(() => expect(store.drainObservations).toHaveLength(4));

		const day = store.drainLogsOn('2026-08-08');

		expect(day.get(1)?.map((log) => log.id)).toEqual([1, 2]);
		expect(day.get(2)?.map((log) => log.id)).toEqual([3]);
		expect(store.drainLogsOn('2026-08-10').size).toBe(0);
	});

	// MATH.md §8.7: the α fit reads the demands off the record, so they have to be
	// the rated task's demands at logging time — not whatever the task says later.
	it('captures the rated task’s demands on the record', async () => {
		const { store } = await setup([
			task({
				mentalDifficulty: 8,
				physicalDifficulty: 3,
			}),
		]);

		await store.logDrain(1, 2.5, 9, 4);

		expect(addDrainMock.mock.calls[0][0]).toMatchObject({
			taskId: 1,
			taskTitle: 'deep work',
			hours: 2.5,
			cognitiveDemand: 0.8,
			physicalDemand: 0.3,
			mindDrain: 9,
			bodyDrain: 4,
		});
	});

	it('writes nothing when the rated task is gone', async () => {
		const { store, status } = await setup([]);

		await store.logDrain(1, 3, 9, 4);

		expect(addDrainMock).not.toHaveBeenCalled();
		expect(status.error).toBeNull();
	});

	// Consumers derive their fits from these lists, so a write that does not
	// refresh them leaves every fit stale until the next reload.
	it('re-reads the logs after a write so the fits refit', async () => {
		const { store } = await setup();
		readAllDrainMock.mockResolvedValue([drainRecord()]);

		await store.logDrain(1, 3, 9, 4);

		expect(store.drainObservations).toEqual([drainRecord()]);
	});

	it('reports a failed write as save-failed on the banner store', async () => {
		const { store, status } = await setup();
		addDrainMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		await store.logDrain(1, 3, 9, 4);

		expect(status.error).toBe('save-failed');
	});

	it('reports a failed rest write as save-failed', async () => {
		const { store, status } = await setup();
		createRestMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		await store.logRest(0.5, 9, 2, 8, 1);

		expect(status.error).toBe('save-failed');
	});

	// A failed read is the recoverable kind: it must raise the retryable banner
	// rather than the write one, and the retry must actually re-read. Driven
	// through the banner rather than through `retryLoad()` — this store is one of
	// the two that register there, and the registration is what replaced the
	// layout's hand-maintained list of stores to retry.
	it('reports a failed load as load-failed and recovers on the banner’s retry', async () => {
		readAllDrainMock.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
		const { store, status } = await setup();

		await vi.waitFor(() => expect(status.error).toBe('load-failed'));
		expect(store.drainObservations).toEqual([]);

		readAllDrainMock.mockResolvedValue([drainRecord()]);
		status.retry();

		await vi.waitFor(() => expect(store.drainObservations).toEqual([drainRecord()]));
		expect(status.error).toBeNull();
	});

	// A screen listing these logs must not say "nothing logged in this range" over a
	// read still in flight: an empty array is what loading and an empty history look
	// like alike, so loaded-ness is a field (AGENTS.md).
	it('says it is loading until the first read lands', async () => {
		let landed!: (logs: Persisted<DrainObservationRecord>[]) => void;

		readAllDrainMock.mockReturnValue(
			new Promise((resolve) => {
				landed = resolve;
			}),
		);

		const { store } = await setup();

		expect(store.isLoading).toBe(true);

		landed([]);

		await vi.waitFor(() => expect(store.isLoading).toBe(false));
	});

	// Otherwise the banner says the read failed while the list beside it is still
	// promising the logs are on their way.
	it('stops loading when the first read fails', async () => {
		readAllDrainMock.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
		const { store, status } = await setup();

		await vi.waitFor(() => expect(status.error).toBe('load-failed'));
		expect(store.isLoading).toBe(false);
	});

	// The other recovery path, and the one only this store can take: a read that
	// works again without the banner's retry having cleared anything first. The
	// banner is app-wide but the failure is per store, so nothing else is allowed
	// to decide that THIS store's logs became readable — and before that was true,
	// the session store's next successful read used to say it on its behalf.
	it('clears its own load failure when its read works again', async () => {
		readAllDrainMock.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
		const { store, status } = await setup();

		await vi.waitFor(() => expect(status.error).toBe('load-failed'));

		readAllDrainMock.mockResolvedValue([drainRecord()]);
		store.retryLoad(); // not status.retry(): the entry is still standing

		await vi.waitFor(() => expect(status.error).toBeNull());
		expect(store.drainObservations).toEqual([drainRecord()]);
	});
});
