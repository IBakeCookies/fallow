import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
	$updateDrainObservation,
	$readAllDrainObservations,
	$deleteDrainObservation,
	$deleteAllDrainObservations
} from './drain-observation-repository';
import type { DrainObservationRecord } from '$lib/data/type';

function observation(
	overrides: Partial<DrainObservationRecord> = {}
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
		...overrides
	};
}

describe('drain-observation-repository', () => {
	it('upserts: same taskId + date replaces instead of appending', async () => {
		await $updateDrainObservation(observation({ mindDrain: 4 }));
		await $updateDrainObservation(observation({ mindDrain: 8 }));
		const all = await $readAllDrainObservations();
		expect(all).toHaveLength(1);
		expect(all[0].mindDrain).toBe(8);
	});

	it('different taskId or date appends', async () => {
		await $updateDrainObservation(observation({ taskId: 2 }));
		await $updateDrainObservation(observation({ date: '2026-01-02' }));
		expect(await $readAllDrainObservations()).toHaveLength(3);
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllDrainObservations();
		await $deleteDrainObservation(all[0].id!);
		expect(await $readAllDrainObservations()).toHaveLength(all.length - 1);
	});

	it('deletes all records', async () => {
		await $deleteAllDrainObservations();
		expect(await $readAllDrainObservations()).toEqual([]);
	});
});
