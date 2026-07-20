import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
	$updateFlowObservation,
	$readAllFlowObservations,
	$deleteFlowObservation,
	$deleteAllFlowObservations
} from './flow-observation-repository';
import type { FlowObservationRecord } from '$lib/data/type';

function observation(
	overrides: Partial<FlowObservationRecord> = {}
): Omit<FlowObservationRecord, 'id' | 'createdAt'> {
	return {
		date: '2026-01-01',
		taskId: 1,
		taskTitle: 'Write tests',
		difficulty: 5,
		enjoyment: 6,
		E: 3,
		beta: 1.5,
		phiHours: 0.4,
		...overrides
	};
}

describe('flow-observation-repository', () => {
	it('starts empty', async () => {
		expect(await $readAllFlowObservations()).toEqual([]);
	});

	it('creates a record with a generated id and createdAt', async () => {
		await $updateFlowObservation(observation());
		const [record] = await $readAllFlowObservations();
		expect(record.id).toBeTypeOf('number');
		expect(record.createdAt).toBeGreaterThan(0);
	});

	it('upserts: same taskId + date replaces instead of appending', async () => {
		await $updateFlowObservation(observation({ phiHours: 0.9 }));
		const all = await $readAllFlowObservations();
		expect(all).toHaveLength(1);
		expect(all[0].phiHours).toBe(0.9);
	});

	it('different taskId or date appends', async () => {
		await $updateFlowObservation(observation({ taskId: 2 }));
		await $updateFlowObservation(observation({ date: '2026-01-02' }));
		expect(await $readAllFlowObservations()).toHaveLength(3);
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllFlowObservations();
		await $deleteFlowObservation(all[0].id!);
		expect(await $readAllFlowObservations()).toHaveLength(all.length - 1);
	});

	it('deletes all records', async () => {
		await $deleteAllFlowObservations();
		expect(await $readAllFlowObservations()).toEqual([]);
	});
});
