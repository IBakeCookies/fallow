import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from '$lib/business/store/energy-observation-store.test-harness.svelte';
import * as drainObservationRepository from '$lib/data/repository/drain-observation-repository';
import * as restObservationRepository from '$lib/data/repository/rest-observation-repository';
import { toISODate } from '$lib/business/utils/date';
import type { EnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
import type { StorageErrorKind } from '$lib/business/store/session-store.svelte';
import type { Task, DrainObservationRecord } from '$lib/data/type';

vi.mock('$lib/data/repository/drain-observation-repository', () => ({
	$updateDrainObservation: vi.fn(async () => {}),
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

const updateDrainMock = vi.mocked(drainObservationRepository.$updateDrainObservation);
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

const drainRecord = (over: Partial<DrainObservationRecord> = {}): DrainObservationRecord => ({
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

/** Mount the store and settle the initial read. */
async function setup(tasks: Task[] = [task()]) {
	const reported: StorageErrorKind[] = [];
	let store!: EnergyObservationStore;

	render(Harness, {
		onstore: (s: EnergyObservationStore) => (store = s),
		readTasks: () => tasks,
		reportStorageError: (kind: StorageErrorKind) => reported.push(kind),
	});

	await vi.waitFor(() => expect(readAllDrainMock).toHaveBeenCalled());

	return {
		store,
		reported,
	};
}

describe('EnergyObservationStore', () => {
	beforeEach(() => {
		readAllDrainMock.mockReset().mockResolvedValue([]);
		readAllRestMock.mockReset().mockResolvedValue([]);
		updateDrainMock.mockReset().mockResolvedValue(undefined);
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

		expect(updateDrainMock.mock.calls[0][0]).toMatchObject({
			date: toISODate(),
		});
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

		expect(updateDrainMock.mock.calls[0][0]).toMatchObject({
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
		const { store, reported } = await setup([]);

		await store.logDrain(1, 3, 9, 4);

		expect(updateDrainMock).not.toHaveBeenCalled();
		expect(reported).toEqual([]);
	});

	// Consumers derive their fits from these lists, so a write that does not
	// refresh them leaves every fit stale until the next reload.
	it('re-reads the logs after a write so the fits refit', async () => {
		const { store } = await setup();
		readAllDrainMock.mockResolvedValue([drainRecord()]);

		await store.logDrain(1, 3, 9, 4);

		expect(store.drainObservations).toEqual([drainRecord()]);
	});

	it('reports a failed write as save-failed on the injected reporter', async () => {
		const { store, reported } = await setup();
		updateDrainMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		await store.logDrain(1, 3, 9, 4);

		expect(reported).toEqual(['save-failed']);
	});

	it('reports a failed rest write as save-failed', async () => {
		const { store, reported } = await setup();
		createRestMock.mockRejectedValueOnce(new Error('QuotaExceededError'));

		await store.logRest(0.5, 9, 2, 8, 1);

		expect(reported).toEqual(['save-failed']);
	});

	// A failed read is the recoverable kind: it must raise the retryable banner
	// rather than the write one, and the retry must actually re-read.
	it('reports a failed load as load-failed and recovers on retry', async () => {
		readAllDrainMock.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
		const { store, reported } = await setup();

		await vi.waitFor(() => expect(reported).toEqual(['load-failed']));
		expect(store.drainObservations).toEqual([]);

		readAllDrainMock.mockResolvedValue([drainRecord()]);
		store.retryLoad();

		await vi.waitFor(() => expect(store.drainObservations).toEqual([drainRecord()]));
		expect(reported).toEqual(['load-failed']);
	});
});
