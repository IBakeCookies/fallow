import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
	$createRestObservation,
	$readAllRestObservations,
	$deleteRestObservation,
	$deleteAllRestObservations
} from './rest-observation-repository';
import type { RestObservationRecord } from '$lib/data/type';

function observation(
	overrides: Partial<RestObservationRecord> = {}
): Omit<RestObservationRecord, 'id' | 'createdAt'> {
	return {
		date: '2026-01-01',
		hours: 0.5,
		mindBefore: 7,
		mindAfter: 3,
		bodyBefore: 4,
		bodyAfter: 2,
		...overrides
	};
}

describe('rest-observation-repository', () => {
	it('appends: identical same-day records do NOT upsert', async () => {
		await $createRestObservation(observation());
		await $createRestObservation(observation());
		const all = await $readAllRestObservations();
		expect(all).toHaveLength(2);
		expect(all[0].id).not.toBe(all[1].id);
	});

	it('stamps createdAt', async () => {
		const [record] = await $readAllRestObservations();
		expect(record.createdAt).toBeGreaterThan(0);
	});

	it('deletes a single record by id', async () => {
		const all = await $readAllRestObservations();
		await $deleteRestObservation(all[0].id!);
		expect(await $readAllRestObservations()).toHaveLength(all.length - 1);
	});

	it('deletes all records', async () => {
		await $deleteAllRestObservations();
		expect(await $readAllRestObservations()).toEqual([]);
	});
});
