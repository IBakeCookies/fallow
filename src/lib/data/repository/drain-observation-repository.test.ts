import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	$updateDrainObservation,
	$readAllDrainObservations,
	$deleteDrainObservation,
	$deleteAllDrainObservations,
} from '$lib/data/repository/drain-observation-repository';
import type { DrainObservationRecord } from '$lib/data/type';

function observation(
	overrides: Partial<DrainObservationRecord> = {},
): Omit<DrainObservationRecord, 'id' | 'createdAt'> {
	return {
		date: '2026-01-01',
		taskId: 1,
		taskTitle: 'Write tests',
		hours: 2,
		cognitiveDemand: 0.7,
		physicalDemand: 0.1,
		mindDrain: 6,
		bodyDrain: 2,
		...overrides,
	};
}

describe('drain-observation-repository', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('upserts: same taskId + date replaces instead of appending', async () => {
		await $updateDrainObservation(
			observation({
				mindDrain: 4,
			}),
		);

		await $updateDrainObservation(
			observation({
				mindDrain: 8,
			}),
		);

		const all = await $readAllDrainObservations();
		expect(all).toHaveLength(1);
		expect(all[0].mindDrain).toBe(8);
	});

	it('different taskId or date appends', async () => {
		await $updateDrainObservation(
			observation({
				taskId: 2,
			}),
		);

		await $updateDrainObservation(
			observation({
				date: '2026-01-02',
			}),
		);

		expect(await $readAllDrainObservations()).toHaveLength(3);
	});

	it('editing a rating keeps the original createdAt', async () => {
		const loggedAt = Date.parse('2026-01-03T18:30:00Z');
		const editedAt = Date.parse('2026-01-04T09:00:00Z');

		vi.spyOn(Date, 'now').mockReturnValue(loggedAt);

		await $updateDrainObservation(
			observation({
				date: '2026-01-03',
				mindDrain: 4,
			}),
		);

		vi.spyOn(Date, 'now').mockReturnValue(editedAt);

		await $updateDrainObservation(
			observation({
				date: '2026-01-03',
				mindDrain: 5,
			}),
		);

		const edited = (await $readAllDrainObservations()).find((r) => r.date === '2026-01-03');
		expect(edited?.mindDrain).toBe(5);
		expect(edited?.createdAt).toBe(loggedAt);
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllDrainObservations();
		// `id!`: a repository read is unsanitized, and asserting the key IndexedDB
		// just assigned is this test's point.
		await $deleteDrainObservation(all[0].id!);
		expect(await $readAllDrainObservations()).toHaveLength(all.length - 1);
	});

	it('deletes all records', async () => {
		await $deleteAllDrainObservations();
		expect(await $readAllDrainObservations()).toEqual([]);
	});
});
